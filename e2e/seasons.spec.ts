import { format, addDays } from "date-fns";
import { test, expect, uniqueName } from "./fixtures";

// A target entered by hand shows on the Jobs page's seasons bar, with the
// window's dates in its details.
test("a target's application window shows on the Jobs page", async ({ page }) => {
  const name = uniqueName("E2E Target");
  const opens = addDays(new Date(), -10);
  const closes = addDays(new Date(), 60);

  await page.goto("/dashboard/seasons");
  await page.getByTestId("add-target-btn").click();
  await page.locator("#target-name").fill(name);
  await page.locator("#target-company").fill(name);
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText("Target added")).toBeVisible();

  const card = page.locator("div.rounded-lg", { has: page.getByText(name, { exact: true }) }).last();
  await card.getByRole("button", { name: "Add window" }).click();
  await page.locator("#window-intake").fill("Summer 2027");
  await page.locator("#window-opens").fill(format(opens, "yyyy-MM-dd"));
  await page.locator("#window-closes").fill(format(closes, "yyyy-MM-dd"));
  await page.locator("#window-source").fill("e2e");
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText("Window added")).toBeVisible();

  await page.goto("/dashboard/myjobs");
  const bar = page.getByTestId("seasons-bar");
  await expect(bar).toBeVisible();
  const band = bar.getByRole("button", { name: `${name}, Summer 2027: Open` });
  await expect(band).toBeVisible();
  await band.click();
  await expect(page.getByText(format(closes, "d MMM yyyy"))).toBeVisible();

  // Tidy up through the UI.
  await page.goto("/dashboard/seasons");
  await page.getByRole("button", { name: `Actions for ${name}` }).click();
  await page.getByRole("menuitem", { name: "Delete" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: /delete/i }).click();
  await expect(page.getByText("Target deleted")).toBeVisible();
});
