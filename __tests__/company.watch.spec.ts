import { setCompanyWatched } from "@/actions/company.actions";
import { getCurrentUser } from "@/utils/user.utils";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

vi.mock("@prisma/client", () => {
  const mPrismaClient = {
    company: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
  };
  return {
    PrismaClient: vi.fn(function () {
      return mPrismaClient;
    }),
  };
});

vi.mock("@/utils/user.utils", () => ({ getCurrentUser: vi.fn() }));

describe("setCompanyWatched", () => {
  const mockUser = { id: "user-id" };

  beforeEach(() => {
    vi.clearAllMocks();
    (getCurrentUser as any).mockResolvedValue(mockUser);
  });

  it("scopes the update by owner", async () => {
    (prisma.company.update as any).mockResolvedValue({ id: "c1" });

    const res = await setCompanyWatched("c1", false);

    expect(res.success).toBe(true);
    expect(prisma.company.update).toHaveBeenCalledWith({
      where: { id: "c1", createdBy: mockUser.id },
      data: { watched: false, watchedAt: null },
    });
  });

  it("stamps watchedAt when watching", async () => {
    (prisma.company.update as any).mockResolvedValue({ id: "c1" });

    await setCompanyWatched("c1", true);

    const args = (prisma.company.update as any).mock.calls[0][0];
    expect(args.data.watched).toBe(true);
    expect(args.data.watchedAt).toBeInstanceOf(Date);
  });
});
