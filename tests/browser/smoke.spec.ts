import { test, expect } from "@playwright/test";
test("missing environment shows actionable setup without crashing", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("http://127.0.0.1:3000");
  await expect(
    page.getByRole("heading", { name: "Connect your Supabase project" }),
  ).toBeVisible();
  await expect(page.getByText("Copy", { exact: false })).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  expect(errors).toEqual([]);
});
test("login and registration render and validate on desktop and mobile", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("http://127.0.0.1:3001");
  await expect(
    page.getByRole("heading", { name: "Welcome back" }),
  ).toBeVisible();
  await expect(page.getByLabel("Work email")).toBeVisible();
  await page
    .getByRole("button", { name: "Create account", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Create your account" }),
  ).toBeVisible();
  await page.getByLabel("Work email").fill("test@example.test");
  await page.getByLabel("Password", { exact: true }).fill("short");
  expect(
    await page
      .getByLabel("Password", { exact: true })
      .evaluate(
        (el: HTMLInputElement) =>
          el.validity.tooShort || el.value.length < el.minLength,
      ),
  ).toBe(true);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  expect(errors).toEqual([]);
});
