import "server-only";
import { cache } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "./auth";
import { prisma } from "./db";

export type AppContext = {
  user: { id: string; name: string; email: string };
  workspaceId: string;
  workspaceName: string;
};

/**
 * Resolve the signed-in user and their active workspace, or redirect to /login.
 * Every new user gets a personal workspace on first visit. All CRM data
 * (prospects, notes, lists) is scoped to the workspace so teams can be added
 * later without a data migration.
 */
export const requireContext = cache(async (): Promise<AppContext> => {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/login");

  const { user } = session;
  let membership = await prisma.membership.findFirst({
    where: { userId: user.id },
    include: { workspace: true },
    orderBy: { createdAt: "asc" },
  });

  if (!membership) {
    membership = await prisma.membership.create({
      data: {
        role: "OWNER",
        user: { connect: { id: user.id } },
        workspace: { create: { name: `${user.name.split(" ")[0] || "My"}'s workspace` } },
      },
      include: { workspace: true },
    });
  }

  return {
    user: { id: user.id, name: user.name, email: user.email },
    workspaceId: membership.workspaceId,
    workspaceName: membership.workspace.name,
  };
});
