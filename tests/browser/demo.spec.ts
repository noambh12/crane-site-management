import { test, expect } from "@playwright/test";
test("demo supports all five screens, local CRUD and reset without remote requests", async ({ page }) => {
  const errors: string[] = [], external: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  page.on("request", request => { if (!request.url().startsWith("http://127.0.0.1:3000")) external.push(request.url()); });
  await page.goto("http://127.0.0.1:3000/preview");
  await expect(page.getByText("DEMO · מצב הדגמה", { exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Fleet overview" })).toBeVisible();
  const nav = page.getByRole("navigation");
  for (const [name, sample] of [["Cranes", "Tower Alpha"], ["Sites", "Harbor Heights"], ["Maintenance", "Hydraulic system service"], ["Faults", "Hydraulic pressure warning"]]) {
    await nav.getByRole("button", { name, exact: true }).click();
    await expect(page.getByText(sample, { exact: true }).first()).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  }
  await nav.getByRole("button", { name: "Sites", exact: true }).click();
  await page.getByRole("button", { name: "Add site", exact: true }).click();
  await page.getByLabel("Site name", { exact: true }).fill("Preview test site");
  await page.getByLabel("Address", { exact: true }).fill("Example address");
  await page.getByRole("button", { name: "Save", exact: false }).click();
  await expect(page.getByText("Preview test site", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Reset demo", exact: true }).click();
  await nav.getByRole("button", { name: "Sites", exact: true }).click();
  await expect(page.getByText("Preview test site", { exact: true })).toHaveCount(0);
  await expect(page.getByText("Harbor Heights", { exact: true })).toBeVisible();
  expect(errors).toEqual([]);
  expect(external).toEqual([]);
});
