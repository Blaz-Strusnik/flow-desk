import { expect, test } from "@playwright/test";

// Regression coverage for three missing delete features: card, list, and
// workspace. Card/list delete endpoints already existed on the backend but
// had no frontend UI; workspace delete didn't exist at all (added net-new).
test("delete a card, delete a list, then delete the whole workspace", async ({ page }) => {
  const suffix = Date.now();
  const email = `e2e-delete-${suffix}@example.com`;

  await page.goto("/register");
  await page.getByLabel("Name").fill("Delete Tester");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill("password123");
  await page.getByRole("button", { name: "Sign up" }).click();
  await expect(page).toHaveURL(/\/workspaces/);

  await page.getByRole("button", { name: "New workspace" }).click();
  await page.getByLabel("Name").fill("Delete Test Workspace");
  await page.getByRole("button", { name: "Create" }).click();
  await page.getByText("Delete Test Workspace").click();
  await expect(page).toHaveURL(/\/w\//);

  await page.getByRole("button", { name: "New board" }).click();
  await page.getByLabel("Name").fill("Delete Test Board");
  await page.getByRole("button", { name: "Create" }).click();
  await page.getByText("Delete Test Board").click();
  await expect(page).toHaveURL(/\/boards\//);

  await page.getByRole("button", { name: /Add list/i }).click();
  await page.getByPlaceholder("List name").fill("Temporary List");
  await page.getByRole("button", { name: "Add list", exact: true }).click();
  await expect(page.getByText("Temporary List")).toBeVisible();

  const tempColumn = page.getByRole("group", { name: "List: Temporary List" });
  await tempColumn.getByRole("button", { name: /Add card/i }).click();
  await page.getByPlaceholder("Card title").fill("Delete me");
  await page.getByRole("button", { name: "Add", exact: true }).click();
  await expect(page.getByText("Delete me")).toBeVisible();

  // --- Delete the card ---
  await page.getByText("Delete me").click();
  await page.getByRole("button", { name: "Delete card" }).click();
  await page.getByRole("button", { name: "Delete", exact: true }).click();
  await expect(page.getByText("Delete me")).not.toBeVisible();

  // --- Delete the list ---
  await tempColumn.getByRole("button", { name: "List options" }).click();
  await page.getByText("Delete list").click();
  await page.getByRole("button", { name: "Delete list" }).click();
  await expect(page.getByRole("group", { name: "List: Temporary List" })).not.toBeVisible();

  // Reload to confirm both deletions persisted server-side.
  await page.reload();
  await expect(page.getByRole("group", { name: "List: Temporary List" })).not.toBeVisible();
  await expect(page.getByText("Delete me")).not.toBeVisible();

  // --- Delete the whole workspace ---
  const workspaceIdMatch = /\/w\/([^/]+)/.exec(page.url());
  if (!workspaceIdMatch) throw new Error(`Could not extract workspaceId from URL: ${page.url()}`);
  await page.goto(`/w/${workspaceIdMatch[1]}`);
  await page.getByRole("button", { name: "Delete workspace" }).click();
  await page.getByLabel(/Type/).fill("Delete Test Workspace");
  await page.getByRole("button", { name: "Delete permanently" }).click();
  await expect(page).toHaveURL(/\/workspaces$/);
  await expect(page.getByText("Delete Test Workspace")).not.toBeVisible();
});

// Regression coverage for a fourth missing delete feature: channels had no
// delete affordance anywhere (backend or frontend) until this was added.
test("delete a channel from the workspace sidebar", async ({ page }) => {
  const suffix = Date.now();
  const email = `e2e-delete-channel-${suffix}@example.com`;

  await page.goto("/register");
  await page.getByLabel("Name").fill("Channel Delete Tester");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill("password123");
  await page.getByRole("button", { name: "Sign up" }).click();
  await expect(page).toHaveURL(/\/workspaces/);

  await page.getByRole("button", { name: "New workspace" }).click();
  await page.getByLabel("Name").fill("Channel Delete Test Workspace");
  await page.getByRole("button", { name: "Create" }).click();
  await page.getByText("Channel Delete Test Workspace").click();
  await expect(page).toHaveURL(/\/w\//);

  await page.getByRole("button", { name: "New channel" }).click();
  await page.getByLabel("Name").fill("temp-channel");
  await page.getByRole("button", { name: "Create" }).click();
  await expect(page.getByText("temp-channel")).toBeVisible();

  const channelRow = page.getByRole("link", { name: /temp-channel/ }).locator("..");
  await channelRow.hover();
  await page.getByRole("button", { name: "Delete channel temp-channel" }).click();
  await page.getByRole("button", { name: "Delete channel", exact: true }).click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await expect(page.getByRole("link", { name: /temp-channel/ })).not.toBeVisible();

  // Reload to confirm the deletion persisted server-side.
  await page.reload();
  await expect(page.getByRole("link", { name: /temp-channel/ })).not.toBeVisible();
});
