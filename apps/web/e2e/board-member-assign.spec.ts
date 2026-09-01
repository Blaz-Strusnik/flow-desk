import { expect, test } from "@playwright/test";

// Regression: adding someone other than the board's creator as a card
// assignee was impossible — they'd never appear in the "add assignee"
// picker because there was no UI to add a *board* member at all (only
// the auto-owner ever had one), even though they'd already been invited
// to the workspace.
test("a workspace member added to the board can then be assigned to a card", async ({ page, request }) => {
  const suffix = Date.now();
  const ownerEmail = `e2e-board-owner-${suffix}@example.com`;
  const teammateEmail = `e2e-board-teammate-${suffix}@example.com`;

  await request.post("http://localhost:3001/auth/register", {
    data: { email: teammateEmail, password: "password123", name: "Teammate Person" },
  });

  await page.goto("/register");
  await page.getByLabel("Name").fill("Owner Person");
  await page.getByLabel("Email").fill(ownerEmail);
  await page.getByLabel("Password").fill("password123");
  await page.getByRole("button", { name: "Sign up" }).click();
  await expect(page).toHaveURL(/\/workspaces/);

  await page.getByRole("button", { name: "New workspace" }).click();
  await page.getByLabel("Name").fill("Assign Test Workspace");
  await page.getByRole("button", { name: "Create" }).click();
  await page.getByText("Assign Test Workspace").click();
  await expect(page).toHaveURL(/\/w\//);

  await page.getByRole("button", { name: "Invite" }).click();
  await page.getByLabel("Email").fill(teammateEmail);
  await page.getByRole("button", { name: "Add to workspace" }).click();
  await expect(page.getByText("Teammate Person")).toBeVisible();

  await page.getByRole("button", { name: "New board" }).click();
  await page.getByLabel("Name").fill("Assign Test Board");
  await page.getByRole("button", { name: "Create" }).click();
  await page.getByText("Assign Test Board").click();
  await expect(page).toHaveURL(/\/boards\//);

  // Add the teammate to the board itself — this is the missing step.
  await page.getByRole("button", { name: "Members" }).click();
  await page.getByRole("button", { name: /Add/ }).click();
  await expect(page.getByText("Everyone in this workspace already has access")).toBeVisible();
  await page.keyboard.press("Escape");

  await page.getByRole("button", { name: /Add list/i }).click();
  await page.getByPlaceholder("List name").fill("To Do");
  await page.getByRole("button", { name: "Add list", exact: true }).click();

  const todoColumn = page.getByRole("group", { name: "List: To Do" });
  await todoColumn.getByRole("button", { name: /Add card/i }).click();
  await page.getByPlaceholder("Card title").fill("Pair on this");
  await page.getByRole("button", { name: "Add", exact: true }).click();
  await page.getByText("Pair on this").click();

  // The teammate must now be offered as an assignee, not just the owner.
  await expect(page.getByRole("button", { name: /\+ Teammate Person/ })).toBeVisible();
  await page.getByRole("button", { name: /\+ Teammate Person/ }).click();

  await page.reload();
  await expect(page.getByText("Teammate Person")).toBeVisible();
});

// Regression: a workspace member who had NOT been added to the board via
// the separate "Members" dialog never showed up as a card assignee
// candidate at all — the only way to assign anyone but yourself was to
// know about that dialog first. Assigning now offers every workspace
// member directly and adds them to the board on click, in one step.
test("a workspace member never added to the board can be assigned directly from the card", async ({
  page,
  request,
}) => {
  const suffix = Date.now();
  const ownerEmail = `e2e-direct-assign-owner-${suffix}@example.com`;
  const teammateEmail = `e2e-direct-assign-teammate-${suffix}@example.com`;

  await request.post("http://localhost:3001/auth/register", {
    data: { email: teammateEmail, password: "password123", name: "Direct Teammate" },
  });

  await page.goto("/register");
  await page.getByLabel("Name").fill("Direct Owner");
  await page.getByLabel("Email").fill(ownerEmail);
  await page.getByLabel("Password").fill("password123");
  await page.getByRole("button", { name: "Sign up" }).click();
  await expect(page).toHaveURL(/\/workspaces/);

  await page.getByRole("button", { name: "New workspace" }).click();
  await page.getByLabel("Name").fill("Direct Assign Workspace");
  await page.getByRole("button", { name: "Create" }).click();
  await page.getByText("Direct Assign Workspace").click();
  await expect(page).toHaveURL(/\/w\//);

  await page.getByRole("button", { name: "Invite" }).click();
  await page.getByLabel("Email").fill(teammateEmail);
  await page.getByRole("button", { name: "Add to workspace" }).click();
  await expect(page.getByText("Direct Teammate")).toBeVisible();

  await page.getByRole("button", { name: "New board" }).click();
  await page.getByLabel("Name").fill("Direct Assign Board");
  await page.getByRole("button", { name: "Create" }).click();
  await page.getByText("Direct Assign Board").click();
  await expect(page).toHaveURL(/\/boards\//);

  // Note: the "Members" dialog is never opened here — the teammate is only
  // a workspace member, not yet a board member.

  await page.getByRole("button", { name: /Add list/i }).click();
  await page.getByPlaceholder("List name").fill("To Do");
  await page.getByRole("button", { name: "Add list", exact: true }).click();

  const todoColumn = page.getByRole("group", { name: "List: To Do" });
  await todoColumn.getByRole("button", { name: /Add card/i }).click();
  await page.getByPlaceholder("Card title").fill("Assign directly");
  await page.getByRole("button", { name: "Add", exact: true }).click();
  await page.getByText("Assign directly").click();

  await expect(page.getByRole("button", { name: /\+ Direct Teammate/ })).toBeVisible();
  await page.getByRole("button", { name: /\+ Direct Teammate/ }).click();

  await page.reload();
  await expect(page.getByText("Direct Teammate")).toBeVisible();

  // The card modal reopens on reload (URL carries ?card=); close it so it
  // doesn't intercept the click below.
  await page.keyboard.press("Escape");

  // The one-click assign should also have added them to the board.
  await page.getByRole("button", { name: "Members" }).click();
  await expect(page.getByText("Direct Teammate")).toBeVisible();
});
