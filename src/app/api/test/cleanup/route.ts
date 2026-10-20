import { auth } from "@/auth";
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";

// Test-only endpoint used by e2e fixtures to tear down what a test created:
// job, resume and bank rows, plus the Library items (job titles / companies /
// locations) their comboboxes persist independently. Disabled in production
// so it can never delete real data.
export async function POST(req: NextRequest) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  const userId = session.user.id;

  const {
    jobIds = [],
    resumes = [],
    bankEntries = [],
    tasks = [],
    titles = [],
    companies = [],
    locations = [],
    tags = [],
    mcpTokens = [],
    contacts = [],
    contactRoles = [],
    jobStageTypes = [],
  }: {
    jobIds?: string[];
    resumes?: string[];
    bankEntries?: string[];
    tasks?: string[];
    titles?: string[];
    companies?: string[];
    locations?: string[];
    tags?: string[];
    mcpTokens?: string[];
    contacts?: string[];
    contactRoles?: string[];
    jobStageTypes?: string[];
  } = await req.json();

  // Jobs first: their stages cascade with them, which frees Library items.
  for (const id of jobIds) {
    await prisma.job.deleteMany({ where: { id, userId } });
  }
  // Items and bullets cascade with the doc
  if (resumes.length > 0) {
    await prisma.resumeDoc.deleteMany({
      where: { name: { in: resumes }, userId },
    });
  }
  if (bankEntries.length > 0) {
    await prisma.bankEntry.deleteMany({
      where: { organisation: { in: bankEntries }, userId },
    });
  }
  if (tasks.length > 0) {
    await prisma.task.deleteMany({ where: { title: { in: tasks }, userId } });
  }

  // Delete contacts before the Library teardown: they reference companies,
  // locations and roles. Their job links cascade with them.
  if (contacts.length > 0) {
    await prisma.contact.deleteMany({
      where: { name: { in: contacts }, createdBy: userId },
    });
  }

  // Sources are never created by the tests (they select the seeded "Indeed"),
  // so they are intentionally not cleaned up here.
  await deleteLibraryByName("jobTitle", titles, userId);
  await deleteLibraryByName("company", companies, userId);
  await deleteLibraryByName("location", locations, userId);
  await deleteLibraryByName("contactRole", contactRoles, userId);
  // After the jobs above: a job's stages cascade with it, which is what frees
  // a custom stage type. Seeded types are never registered by a test.
  await deleteLibraryByName("jobStageType", jobStageTypes, userId);
  await deleteTagsByName(tags, userId);
  if (mcpTokens.length > 0) {
    await prisma.mcpAccessToken.deleteMany({
      where: { name: { in: mcpTokens }, userId },
    });
  }

  return NextResponse.json({ success: true });
}

// Tags hang off jobs through an implicit many-to-many, so they get their own
// reference count + delete.
async function deleteTagsByName(names: string[], userId: string) {
  for (const name of names) {
    const value = name.trim().toLowerCase();
    if (!value) continue;
    const tag = await prisma.tag.findFirst({
      where: { value, createdBy: userId },
      select: {
        id: true,
        _count: { select: { jobs: true } },
      },
    });
    if (!tag) continue;
    if (tag._count.jobs > 0) continue;
    await prisma.tag.delete({ where: { id: tag.id } });
  }
}

type RefModel =
  | "jobTitle"
  | "company"
  | "location"
  | "contactRole"
  | "jobStageType";

// Count every place a Library row can still be referenced from, so we never
// delete one that another job or contact still uses.
async function referenceCount(
  model: RefModel,
  refId: string,
): Promise<number> {
  if (model === "jobTitle") {
    return prisma.job.count({ where: { jobTitleId: refId } });
  }
  if (model === "company") {
    return (
      (await prisma.job.count({ where: { companyId: refId } })) +
      (await prisma.contact.count({
        where: { OR: [{ companyId: refId }, { workedAtCompanyId: refId }] },
      }))
    );
  }
  if (model === "contactRole") {
    return (
      (await prisma.jobContact.count({ where: { roleId: refId } })) +
      (await prisma.contact.count({ where: { roleId: refId } }))
    );
  }
  if (model === "jobStageType") {
    return prisma.jobStage.count({ where: { stageTypeId: refId } });
  }
  return (
    (await prisma.job.count({ where: { locationId: refId } })) +
    (await prisma.contact.count({ where: { locationId: refId } }))
  );
}

// Delete each named Library row (matched the same way the create actions store
// it: value = label.trim().toLowerCase()), scoped to the user and only when
// nothing references it anymore.
async function deleteLibraryByName(
  model: RefModel,
  names: string[],
  userId: string,
) {
  for (const name of names) {
    const value = name.trim().toLowerCase();
    if (!value) continue;
    const row = await (prisma[model] as any).findFirst({
      where: { value, createdBy: userId },
      select: { id: true },
    });
    if (!row) continue;
    if ((await referenceCount(model, row.id)) > 0) continue;
    await (prisma[model] as any).delete({ where: { id: row.id } });
  }
}
