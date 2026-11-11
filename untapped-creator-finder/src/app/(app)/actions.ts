"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireContext } from "@/lib/session";
import { logActivity } from "@/server/activity";
import { refreshRollup } from "@/server/rollup";
import { seedDemoData, clearDemoData } from "@/server/demo";
import { PLATFORMS, PROSPECT_STATUSES } from "@/lib/constants";
import type { Platform, ProspectStatus, SignalType } from "@/generated/prisma/enums";

export type ActionState = { ok?: boolean; error?: string; fieldErrors?: Record<string, string> } | undefined;

const platformEnum = z.enum(PLATFORMS.map((p) => p.value) as [Platform, ...Platform[]]);
const statusEnum = z.enum(PROSPECT_STATUSES.map((s) => s.value) as [ProspectStatus, ...ProspectStatus[]]);
const optionalInt = z
  .string()
  .trim()
  .transform((v) => (v === "" ? null : Number(v.replace(/[,_\s]/g, ""))))
  .refine((v) => v === null || (Number.isInteger(v) && v >= 0), "Must be a whole number");
const optionalPct = z
  .string()
  .trim()
  .transform((v) => (v === "" ? null : Number(v.replace("%", "")) / 100))
  .refine((v) => v === null || (Number.isFinite(v) && v >= 0 && v <= 1), "Must be a percentage between 0 and 100");

async function ensureProspect(workspaceId: string, creatorId: string) {
  return prisma.prospect.upsert({
    where: { workspaceId_creatorId: { workspaceId, creatorId } },
    update: {},
    create: { workspaceId, creatorId },
  });
}

function revalidateCreator(creatorId: string) {
  revalidatePath(`/creators/${creatorId}`);
  revalidatePath("/creators");
  revalidatePath("/pipeline");
  revalidatePath("/");
}

function firstErrors(err: z.ZodError) {
  const out: Record<string, string> = {};
  for (const i of err.issues) out[String(i.path[0])] ??= i.message;
  return out;
}

// --- Creators ---------------------------------------------------------------

const handleSchema = z
  .string()
  .trim()
  .min(1, "Handle is required")
  .transform((h) => h.replace(/^@/, ""));

const newCreatorSchema = z.object({
  displayName: z.string().trim().min(1, "Name is required").max(120),
  primaryNiche: z.string().trim().max(60).optional(),
  country: z.string().trim().max(2).optional(),
  language: z.string().trim().max(5).optional(),
  bio: z.string().trim().max(2000).optional(),
  websiteUrl: z.union([z.literal(""), z.url("Must be a full URL, e.g. https://…")]).optional(),
  platform: platformEnum,
  handle: handleSchema,
  url: z.union([z.literal(""), z.url("Must be a full URL")]).optional(),
  followers: optionalInt,
  avgViews: optionalInt,
  engagementRate: optionalPct,
});

function defaultProfileUrl(platform: Platform, handle: string) {
  switch (platform) {
    case "YOUTUBE":
      return `https://www.youtube.com/@${handle}`;
    case "INSTAGRAM":
      return `https://www.instagram.com/${handle}/`;
    case "TIKTOK":
      return `https://www.tiktok.com/@${handle}`;
  }
}

export async function createCreator(_prev: ActionState, form: FormData): Promise<ActionState> {
  const ctx = await requireContext();
  const parsed = newCreatorSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { fieldErrors: firstErrors(parsed.error) };
  const d = parsed.data;

  const existing = await prisma.platformAccount.findUnique({
    where: { platform_handle: { platform: d.platform, handle: d.handle } },
    select: { creatorId: true },
  });
  if (existing) redirect(`/creators/${existing.creatorId}?exists=1`);

  const creator = await prisma.$transaction(async (tx) => {
    const c = await tx.creator.create({
      data: {
        displayName: d.displayName,
        primaryNiche: d.primaryNiche || null,
        niches: d.primaryNiche ? [d.primaryNiche] : [],
        country: d.country || null,
        language: d.language || null,
        bio: d.bio || null,
        websiteUrl: d.websiteUrl || null,
        createdById: ctx.user.id,
        accounts: {
          create: {
            platform: d.platform,
            handle: d.handle,
            url: d.url || defaultProfileUrl(d.platform, d.handle),
            followers: d.followers,
            avgViews: d.avgViews,
            engagementRate: d.engagementRate,
            source: "MANUAL",
            fetchedAt: d.followers != null ? new Date() : null,
            snapshots:
              d.followers != null || d.engagementRate != null
                ? {
                    create: {
                      followers: d.followers,
                      avgViews: d.avgViews,
                      engagementRate: d.engagementRate,
                      source: "MANUAL",
                    },
                  }
                : undefined,
          },
        },
      },
    });
    await tx.prospect.create({ data: { workspaceId: ctx.workspaceId, creatorId: c.id } });
    await refreshRollup(c.id, tx);
    return c;
  });

  await logActivity({ workspaceId: ctx.workspaceId, actorId: ctx.user.id, creatorId: creator.id, type: "creator.created_manual" });
  revalidatePath("/creators");
  revalidatePath("/");
  redirect(`/creators/${creator.id}`);
}

const accountSchema = z.object({
  creatorId: z.string().min(1),
  platform: platformEnum,
  handle: handleSchema,
  url: z.union([z.literal(""), z.url("Must be a full URL")]).optional(),
});

export async function addPlatformAccount(_prev: ActionState, form: FormData): Promise<ActionState> {
  const ctx = await requireContext();
  const parsed = accountSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { fieldErrors: firstErrors(parsed.error) };
  const d = parsed.data;
  const clash = await prisma.platformAccount.findUnique({
    where: { platform_handle: { platform: d.platform, handle: d.handle } },
  });
  if (clash) return { error: "That account is already linked to a creator in the database." };
  await prisma.platformAccount.create({
    data: {
      creatorId: d.creatorId,
      platform: d.platform,
      handle: d.handle,
      url: d.url || defaultProfileUrl(d.platform, d.handle),
      source: "MANUAL",
    },
  });
  await refreshRollup(d.creatorId);
  await logActivity({ workspaceId: ctx.workspaceId, actorId: ctx.user.id, creatorId: d.creatorId, type: "account.added", payload: { platform: d.platform, handle: d.handle } });
  revalidateCreator(d.creatorId);
  return { ok: true };
}

const metricsSchema = z.object({
  accountId: z.string().min(1),
  followers: optionalInt,
  avgViews: optionalInt,
  engagementRate: optionalPct,
  postsLast30d: optionalInt,
});

/** Manual metric update. Writes a snapshot so growth history builds up over time. */
export async function updateAccountMetrics(_prev: ActionState, form: FormData): Promise<ActionState> {
  const ctx = await requireContext();
  const parsed = metricsSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { fieldErrors: firstErrors(parsed.error) };
  const d = parsed.data;
  const account = await prisma.platformAccount.findUnique({ where: { id: d.accountId } });
  if (!account) return { error: "Account not found" };
  if (account.source !== "MANUAL" && account.source !== "DEMO") {
    return { error: "This account is synced from a data provider; manual edits would be overwritten." };
  }
  await prisma.$transaction(async (tx) => {
    await tx.platformAccount.update({
      where: { id: d.accountId },
      data: {
        followers: d.followers,
        avgViews: d.avgViews,
        engagementRate: d.engagementRate,
        postsLast30d: d.postsLast30d,
        fetchedAt: new Date(),
      },
    });
    await tx.metricSnapshot.create({
      data: {
        accountId: d.accountId,
        followers: d.followers,
        avgViews: d.avgViews,
        engagementRate: d.engagementRate,
        source: account.source,
      },
    });
    await refreshRollup(account.creatorId, tx);
  });
  await logActivity({ workspaceId: ctx.workspaceId, actorId: ctx.user.id, creatorId: account.creatorId, type: "metrics.updated_manual", payload: { accountId: d.accountId } });
  revalidateCreator(account.creatorId);
  return { ok: true };
}

const signalSchema = z.object({
  creatorId: z.string().min(1),
  type: z.enum([
    "SPONSORSHIP", "AFFILIATE", "DIGITAL_PRODUCT", "COURSE", "MEMBERSHIP", "SERVICE",
    "MERCH", "BRAND_PARTNERSHIP", "BUSINESS_CONTACT", "TALENT_MANAGEMENT",
  ] as [SignalType, ...SignalType[]]),
  evidence: z.string().trim().min(3, "Describe what you saw").max(1000),
  sourceUrl: z.union([z.literal(""), z.url("Must be a full URL")]).optional(),
});

/** A researcher records monetisation they personally observed. Always OBSERVED. */
export async function addCommercialSignal(_prev: ActionState, form: FormData): Promise<ActionState> {
  const ctx = await requireContext();
  const parsed = signalSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { fieldErrors: firstErrors(parsed.error) };
  const d = parsed.data;
  await prisma.commercialSignal.create({
    data: {
      creatorId: d.creatorId,
      type: d.type,
      evidence: d.evidence,
      sourceUrl: d.sourceUrl || null,
      evidenceKind: "OBSERVED",
      source: "MANUAL",
    },
  });
  await refreshRollup(d.creatorId);
  await logActivity({ workspaceId: ctx.workspaceId, actorId: ctx.user.id, creatorId: d.creatorId, type: "signal.added_manual", payload: { type: d.type } });
  revalidateCreator(d.creatorId);
  return { ok: true };
}

export async function deleteCommercialSignal(form: FormData) {
  const ctx = await requireContext();
  const id = String(form.get("signalId"));
  const s = await prisma.commercialSignal.findUnique({ where: { id } });
  if (!s || s.source !== "MANUAL") return; // provider-derived evidence is not hand-deletable
  await prisma.commercialSignal.delete({ where: { id } });
  await refreshRollup(s.creatorId);
  await logActivity({ workspaceId: ctx.workspaceId, actorId: ctx.user.id, creatorId: s.creatorId, type: "signal.deleted", payload: { type: s.type } });
  revalidateCreator(s.creatorId);
}

// --- Prospect management ------------------------------------------------------

export async function toggleSaved(form: FormData) {
  const ctx = await requireContext();
  const creatorId = String(form.get("creatorId"));
  const p = await ensureProspect(ctx.workspaceId, creatorId);
  await prisma.prospect.update({ where: { id: p.id }, data: { saved: !p.saved } });
  await logActivity({ workspaceId: ctx.workspaceId, actorId: ctx.user.id, creatorId, type: p.saved ? "prospect.unsaved" : "prospect.saved" });
  revalidateCreator(creatorId);
}

export async function setProspectStatus(form: FormData) {
  const ctx = await requireContext();
  const creatorId = String(form.get("creatorId"));
  const status = statusEnum.parse(form.get("status"));
  const p = await ensureProspect(ctx.workspaceId, creatorId);
  if (p.status === status) return;
  await prisma.prospect.update({ where: { id: p.id }, data: { status } });
  await logActivity({ workspaceId: ctx.workspaceId, actorId: ctx.user.id, creatorId, type: "prospect.status_changed", payload: { from: p.status, to: status } });
  revalidateCreator(creatorId);
}

export async function addNote(_prev: ActionState, form: FormData): Promise<ActionState> {
  const ctx = await requireContext();
  const creatorId = String(form.get("creatorId"));
  const body = String(form.get("body") ?? "").trim();
  if (!body) return { fieldErrors: { body: "Note can't be empty" } };
  if (body.length > 5000) return { fieldErrors: { body: "Keep notes under 5,000 characters" } };
  await ensureProspect(ctx.workspaceId, creatorId);
  await prisma.note.create({ data: { workspaceId: ctx.workspaceId, creatorId, authorId: ctx.user.id, body } });
  await logActivity({ workspaceId: ctx.workspaceId, actorId: ctx.user.id, creatorId, type: "note.added" });
  revalidatePath(`/creators/${creatorId}`);
  return { ok: true };
}

export async function deleteNote(form: FormData) {
  const ctx = await requireContext();
  const id = String(form.get("noteId"));
  const note = await prisma.note.findFirst({ where: { id, workspaceId: ctx.workspaceId, authorId: ctx.user.id } });
  if (!note) return;
  await prisma.note.delete({ where: { id } });
  revalidatePath(`/creators/${note.creatorId}`);
}

// --- Lists --------------------------------------------------------------------

export async function createList(_prev: ActionState, form: FormData): Promise<ActionState> {
  const ctx = await requireContext();
  const name = String(form.get("name") ?? "").trim();
  const description = String(form.get("description") ?? "").trim() || null;
  if (!name) return { fieldErrors: { name: "Give the list a name" } };
  const dup = await prisma.prospectList.findUnique({ where: { workspaceId_name: { workspaceId: ctx.workspaceId, name } } });
  if (dup) return { fieldErrors: { name: "A list with that name already exists" } };
  const list = await prisma.prospectList.create({ data: { workspaceId: ctx.workspaceId, name, description } });

  // Optional: add a creator in the same step (used from the profile page).
  const creatorId = form.get("creatorId");
  if (typeof creatorId === "string" && creatorId) {
    const p = await ensureProspect(ctx.workspaceId, creatorId);
    await prisma.prospectListItem.create({ data: { listId: list.id, prospectId: p.id } });
    revalidatePath(`/creators/${creatorId}`);
  }
  await logActivity({ workspaceId: ctx.workspaceId, actorId: ctx.user.id, type: "list.created", payload: { name } });
  revalidatePath("/lists");
  return { ok: true };
}

export async function deleteList(form: FormData) {
  const ctx = await requireContext();
  const id = String(form.get("listId"));
  await prisma.prospectList.deleteMany({ where: { id, workspaceId: ctx.workspaceId } });
  revalidatePath("/lists");
  redirect("/lists");
}

export async function addToList(form: FormData) {
  const ctx = await requireContext();
  const creatorId = String(form.get("creatorId"));
  const listId = String(form.get("listId"));
  const list = await prisma.prospectList.findFirst({ where: { id: listId, workspaceId: ctx.workspaceId } });
  if (!list) return;
  const p = await ensureProspect(ctx.workspaceId, creatorId);
  await prisma.prospectListItem.upsert({
    where: { listId_prospectId: { listId, prospectId: p.id } },
    update: {},
    create: { listId, prospectId: p.id },
  });
  await logActivity({ workspaceId: ctx.workspaceId, actorId: ctx.user.id, creatorId, type: "list.item_added", payload: { list: list.name } });
  revalidatePath(`/creators/${creatorId}`);
  revalidatePath(`/lists/${listId}`);
}

export async function removeFromList(form: FormData) {
  const ctx = await requireContext();
  const creatorId = String(form.get("creatorId"));
  const listId = String(form.get("listId"));
  const p = await prisma.prospect.findUnique({ where: { workspaceId_creatorId: { workspaceId: ctx.workspaceId, creatorId } } });
  if (!p) return;
  await prisma.prospectListItem.deleteMany({ where: { listId, prospectId: p.id, list: { workspaceId: ctx.workspaceId } } });
  revalidatePath(`/creators/${creatorId}`);
  revalidatePath(`/lists/${listId}`);
}

// --- Demo data ------------------------------------------------------------------

export async function loadDemoData() {
  const ctx = await requireContext();
  await seedDemoData();
  await logActivity({ workspaceId: ctx.workspaceId, actorId: ctx.user.id, type: "demo.loaded" });
  revalidatePath("/", "layout");
}

export async function removeDemoData() {
  const ctx = await requireContext();
  await clearDemoData();
  await logActivity({ workspaceId: ctx.workspaceId, actorId: ctx.user.id, type: "demo.cleared" });
  revalidatePath("/", "layout");
}
