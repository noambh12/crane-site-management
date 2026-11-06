import { test, expect } from "@playwright/test";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
test("standalone demo opens without a server and shows all five working screens", async ({ page }) => {
  const errors: string[] = [], network: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  page.on("request", request => { if (/^https?:/.test(request.url())) network.push(request.url()); });
  await page.goto(pathToFileURL(resolve("preview-dist/CraneOps-preview.html")).href);
  await expect(page.getByText("DEMO · מצב הדגמה", { exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Fleet overview" })).toBeVisible();
  const nav = page.getByRole("navigation");
  for (const [name, sample] of [["Cranes", "Tower Alpha"], ["Sites", "Harbor Heights"], ["Maintenance", "Hydraulic system service"], ["Faults", "Hydraulic pressure warning"]]) {
    await nav.getByRole("button", { name, exact: false }).click();
    await expect(page.getByText(sample, { exact: true }).first()).toBeVisible();
  }
  await nav.getByRole("button", { name: "Sites", exact: true }).click();
  await page.getByRole("button", { name: "Add site", exact: true }).click();
  await page.getByLabel("Site name", { exact: true }).fill("Offline demo site");
  await page.getByLabel("Address", { exact: true }).fill("Example address");
  await page.getByRole("button", { name: "Save", exact: false }).click();
  await expect(page.getByText("Offline demo site", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Reset demo", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Fleet overview" })).toBeVisible();
  expect(errors).toEqual([]);
  expect(network).toEqual([]);
});
