import { expect, test } from "@playwright/test";

// Regression coverage (real browser) for three bugs found in manual use:
// no UI to invite a workspace member, no UI to create a label, and
// unassigning a card member silently did nothing (backend returned 200
// with an empty body instead of 204, which broke the frontend's fetch
// wrapper).
test("invite a workspace member, create+attach a label, assign and unassign a member", async ({
  page,
  request,
}) => {
  const suffix = Date.now();
  const ownerEmail = `e2e-owner-${suffix}@example.com`;
  const inviteeEmail = `e2e-invitee-${suffix}@example.com`;

  // Register the invitee up front via the API so they exist to be invited
  // (invite-by-email only works for already-registered users).
  await request.post("http://localhost:3001/auth/register", {
    data: { email: inviteeEmail, password: "password123", name: "Invitee Person" },
  });

  await page.goto("/register");
  await page.getByLabel("Name").fill("Owner Person");
  await page.getByLabel("Email").fill(ownerEmail);
  await page.getByLabel("Password").fill("password123");
  await page.getByRole("button", { name: "Sign up" }).click();
  await expect(page).toHaveURL(/\/workspaces/);

  await page.getByRole("button", { name: "New workspace" }).click();
  await page.getByLabel("Name").fill("E2E Workflows Workspace");
  await page.getByRole("button", { name: "Create" }).click();
  await page.getByText("E2E Workflows Workspace").click();
  await expect(page).toHaveURL(/\/w\//);

  // --- Invite a workspace member ---
  await page.getByRole("button", { name: "Invite" }).click();
  await page.getByLabel("Email").fill(inviteeEmail);
  await page.getByRole("button", { name: "Add to workspace" }).click();
  await expect(page.getByText("Invitee Person")).toBeVisible();
  await expect(page.getByText(inviteeEmail)).toBeVisible();

  // --- Board/list/card setup ---
  await page.getByRole("button", { name: "New board" }).click();
  await page.getByLabel("Name").fill("E2E Workflows Board");
  await page.getByRole("button", { name: "Create" }).click();
  await page.getByText("E2E Workflows Board").click();
  await expect(page).toHaveURL(/\/boards\//);

  await page.getByRole("button", { name: /Add list/i }).click();
  await page.getByPlaceholder("List name").fill("To Do");
  await page.getByRole("button", { name: "Add list", exact: true }).click();
  await expect(page.getByText("To Do")).toBeVisible();

  const todoColumn = page.getByRole("group", { name: "List: To Do" });
  await todoColumn.getByRole("button", { name: /Add card/i }).click();
  await page.getByPlaceholder("Card title").fill("Investigate the bug");
  await page.getByRole("button", { name: "Add", exact: true }).click();
  await page.getByText("Investigate the bug").click();

  // --- Create and attach a label ---
  await page.getByRole("button", { name: "New label" }).click();
  await page.getByPlaceholder("Label name").fill("Urgent");
  await page.getByRole("button", { name: "Create", exact: true }).click();
  await expect(page.getByText("Urgent")).toBeVisible();

  // Toggle it onto the card.
  await page.getByText("Urgent").click();

  // Reload to confirm the label attachment persisted server-side. The card
  // modal re-opens automatically (it's driven by a ?card= URL param), so
  // there's no need to click the card again.
  await page.reload();
  const urgentBadge = page.getByText("Urgent");
  await expect(urgentBadge).toBeVisible();

  // --- Assign and then unassign the owner themselves (always a board member) ---
  await expect(page.getByText("Nobody assigned yet.")).toBeVisible();
  await page.getByRole("button", { name: /\+ Owner Person/ }).click();
  await expect(page.getByText("Nobody assigned yet.")).not.toBeVisible();

  // Reload to confirm the assignment persisted, then unassign.
  await page.reload();
  const assigneeBadge = page.locator('[data-slot="badge"]', { hasText: "Owner Person" });
  await expect(assigneeBadge).toBeVisible();
  await assigneeBadge.locator("button").click();

  // This is the actual regression: before the fix, this never disappeared
  // because the DELETE response's empty body made the mutation reject.
  await expect(page.getByText("Nobody assigned yet.")).toBeVisible();

  // Reload to confirm the unassignment actually persisted server-side.
  await page.reload();
  await expect(page.getByText("Nobody assigned yet.")).toBeVisible();
});
