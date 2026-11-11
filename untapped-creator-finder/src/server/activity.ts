import { prisma } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";
import type { ActorType } from "@/generated/prisma/enums";

/**
 * Append-only audit trail. Users today, agents tomorrow: anything that changes
 * workspace data should call this so the history is attributable.
 */
export async function logActivity(input: {
  workspaceId: string;
  actorType?: ActorType;
  actorId?: string | null;
  creatorId?: string | null;
  type: string;
  payload?: Prisma.InputJsonValue;
}) {
  await prisma.activityEvent.create({
    data: {
      workspaceId: input.workspaceId,
      actorType: input.actorType ?? "USER",
      actorId: input.actorId ?? null,
      creatorId: input.creatorId ?? null,
      type: input.type,
      payload: input.payload,
    },
  });
}
