import { test, expect, uniqueName } from "./fixtures";

// The core promise: Claude (or an import) can only produce drafts, and no PDF
// exists until a person approves the content.
test("an imported base has no PDF until it is approved", async ({ page }) => {
  const org = uniqueName("Approval Co");
  const baseName = uniqueName("E2E Base");
  const bank = {
    version: 1,
    entries: [
      {
        key: "e",
        type: "experience",
        organisation: org,
        title: "Intern",
        startDate: "Jan 2026",
        endDate: "Mar 2026",
        bullets: [{ key: "b", text: "Shipped a feature used by every intern on the team" }],
      },
    ],
    bases: [{ name: baseName, targetRole: "Testing", items: [{ entry: "e", bullets: ["b"] }] }],
  };

  await page.goto("/dashboard/bank");
  await page.getByLabel("Import bank file").setInputFiles({
    name: "bank.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(bank)),
  });
  await expect(page.getByText(/Imported 1 entries, 1 bullets and 1 base versions/)).toBeVisible();
  await expect(page.getByText(org)).toBeVisible();

  await page.goto("/dashboard/resumes?tab=bases");
  await page.getByRole("link", { name: new RegExp(baseName) }).click();
  await expect(page.getByRole("heading", { name: baseName })).toBeVisible();
  await expect(page).toHaveURL(/\/dashboard\/resumes\/[0-9a-f-]{36}$/);
  const docId = page.url().split("/").pop()!;

  // Draft: no export button, and the route refuses.
  await expect(page.getByTestId("download-pdf-btn")).toHaveCount(0);
  expect((await page.request.get(`/api/resumes/${docId}/pdf`)).status()).toBe(403);

  await page.getByTestId("approve-resume-btn").click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Approve" }).click();
  await expect(page.getByTestId("download-pdf-btn")).toBeVisible();

  const pdf = await page.request.get(`/api/resumes/${docId}/pdf`);
  expect(pdf.status()).toBe(200);
  expect(pdf.headers()["content-type"]).toBe("application/pdf");
  expect((await pdf.body()).subarray(0, 4).toString()).toBe("%PDF");
});
