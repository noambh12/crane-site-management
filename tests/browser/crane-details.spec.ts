import { test, expect } from "@playwright/test";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
for (const source of ["development", "offline"]) {
  test(`crane details show related data, empty states and editable records (${source})`, async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", error => errors.push(error.message));
    const url = source === "development" ? "http://127.0.0.1:3000/preview" : pathToFileURL(resolve("preview-dist/CraneOps-preview.html")).href;
    await page.goto(url);
    await test.step("Open the crane and verify related records", async () => {
    await page.getByRole("navigation").getByRole("button", { name: "Cranes", exact: true }).click();
    await page.getByRole("button", { name: "View details for Tower Alpha", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Tower Alpha", exact: true })).toBeVisible();
    await expect(page.getByRole("region", { name: "Crane specifications" }).getByText("DEMO-001", { exact: true })).toBeVisible();
    await expect(page.getByRole("region", { name: "Assigned site" }).getByText("Harbor Heights", { exact: true })).toBeVisible();
    const faults = page.getByRole("region", { name: "Faults for this crane" });
    await expect(faults.getByText("Cabin light replacement", { exact: true })).toBeVisible();
    await expect(faults.getByText("Hydraulic pressure warning", { exact: true })).toHaveCount(0);
    const maintenance = page.getByRole("region", { name: "Maintenance for this crane" });
    await expect(maintenance.getByText("Monthly safety inspection", { exact: true })).toBeVisible();
    await expect(maintenance.getByText("Hydraulic system service", { exact: true })).toHaveCount(0);
    await expect(page.getByRole("region", { name: "Crane activity" }).getByText("Crane record created", { exact: true })).toBeVisible();
    });
    await test.step("Edit the crane and verify its refreshed activity", async () => {
    await page.getByRole("button", { name: "Edit crane", exact: true }).click();
    await page.getByLabel("Crane name", { exact: true }).fill("Tower Alpha Updated");
    await page.getByRole("button", { name: "Save", exact: false }).click();
    await expect(page.getByRole("heading", { name: "Tower Alpha Updated", exact: true })).toBeVisible();
    await expect(page.getByRole("region", { name: "Crane activity" }).getByText("Crane record updated", { exact: true })).toBeVisible();
    });
    await test.step("Return to the list and verify an unassigned crane", async () => {
    await page.getByRole("button", { name: "Back to cranes", exact: false }).click();
    await page.getByRole("button", { name: "View details for Tower Charlie", exact: true }).click();
    await expect(page.getByText("No construction site assigned.", { exact: true })).toBeVisible();
    await expect(page.getByText("No faults reported for this crane.", { exact: true })).toBeVisible();
    await expect(page.getByText("No maintenance tasks scheduled for this crane.", { exact: true })).toBeVisible();
    await expect(page.getByText("No activity recorded for this crane.", { exact: true })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.getByRole("navigation").getByRole("button", { name: "Dashboard", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Fleet overview" })).toBeVisible();
    });
    expect(errors).toEqual([]);
  });
}
