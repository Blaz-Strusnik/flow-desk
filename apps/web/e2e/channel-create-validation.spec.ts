import { expect, test } from "@playwright/test";

// Regression: typing a channel name with characters outside lowercase
// letters/numbers/hyphens (e.g. punctuation) used to be sent straight to
// the backend, which rejected it with 400 — and the create button's
// onClick had no try/catch, so the rejection surfaced as an unhandled
// promise rejection (a Next.js dev "Runtime Error" overlay), not a normal
// in-app error. The input now strips disallowed characters as you type,
// and any remaining failure (e.g. a duplicate name) shows a toast instead.
test("channel name input strips invalid characters and duplicate names show a toast, not a crash", async ({
  page,
}) => {
  const suffix = Date.now();
  const email = `e2e-channel-validation-${suffix}@example.com`;

  await page.goto("/register");
  await page.getByLabel("Name").fill("Channel Validation Tester");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill("password123");
  await page.getByRole("button", { name: "Sign up" }).click();
  await expect(page).toHaveURL(/\/workspaces/);

  await page.getByRole("button", { name: "New workspace" }).click();
  await page.getByLabel("Name").fill("Channel Validation Workspace");
  await page.getByRole("button", { name: "Create" }).click();
  await page.getByText("Channel Validation Workspace").click();
  await expect(page).toHaveURL(/\/w\//);

  await page.getByRole("button", { name: "New channel" }).click();
  await page.getByLabel("Name").fill("General Discussion!");
  await expect(page.getByLabel("Name")).toHaveValue("general-discussion");
  await page.getByRole("button", { name: "Create" }).click();
  await expect(page.getByText("general-discussion")).toBeVisible();

  // Creating a second channel with the same (sanitized) name should show a
  // toast, not crash the page.
  await page.getByRole("button", { name: "New channel" }).click();
  await page.getByLabel("Name").fill("General Discussion!");
  await page.getByRole("button", { name: "Create" }).click();
  await expect(page.getByText("A channel with that name already exists")).toBeVisible();

  // The page must still be interactive (no unhandled-rejection crash) — the
  // create dialog is still open and can be dismissed normally.
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).not.toBeVisible();
});
