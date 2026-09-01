import { expect, test } from "@playwright/test";

// Full golden path: register -> create workspace -> create board -> create
// card -> drag card between lists -> open chat -> send a message.
test("register, board, card drag, and chat", async ({ page }) => {
  const suffix = Date.now();
  const email = `e2e-${suffix}@example.com`;

  await page.goto("/register");
  await page.getByLabel("Name").fill("E2E Tester");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill("password123");
  await page.getByRole("button", { name: "Sign up" }).click();

  await expect(page).toHaveURL(/\/workspaces/);

  await page.getByRole("button", { name: "New workspace" }).click();
  await page.getByLabel("Name").fill("E2E Workspace");
  await page.getByRole("button", { name: "Create" }).click();

  await page.getByText("E2E Workspace").click();
  await expect(page).toHaveURL(/\/w\//);

  await page.getByRole("button", { name: "New board" }).click();
  await page.getByLabel("Name").fill("E2E Board");
  await page.getByRole("button", { name: "Create" }).click();

  await page.getByText("E2E Board").click();
  await expect(page).toHaveURL(/\/boards\//);

  // Create two lists.
  await page.getByRole("button", { name: /Add list/i }).click();
  await page.getByPlaceholder("List name").fill("To Do");
  await page.getByRole("button", { name: "Add list", exact: true }).click();

  await page.getByRole("button", { name: /Add list/i }).click();
  await page.getByPlaceholder("List name").fill("Done");
  await page.getByRole("button", { name: "Add list", exact: true }).click();

  await expect(page.getByText("To Do")).toBeVisible();
  await expect(page.getByText("Done")).toBeVisible();

  // Create a card in "To Do".
  const todoColumn = page.getByRole("group", { name: "List: To Do" });
  await todoColumn.getByRole("button", { name: /Add card/i }).click();
  await page.getByPlaceholder("Card title").fill("Write the report");
  await page.getByRole("button", { name: "Add", exact: true }).click();

  await expect(page.getByText("Write the report")).toBeVisible();

  // Drag the card from "To Do" into "Done".
  const card = page.getByText("Write the report");
  const doneColumn = page.getByRole("group", { name: "List: Done" });
  const cardBox = await card.boundingBox();
  const targetBox = await doneColumn.boundingBox();
  if (cardBox && targetBox) {
    await page.mouse.move(cardBox.x + cardBox.width / 2, cardBox.y + cardBox.height / 2);
    await page.mouse.down();
    await page.mouse.move(targetBox.x + targetBox.width / 2, targetBox.y + targetBox.height / 2, {
      steps: 10,
    });
    await page.mouse.up();
  }

  // Reload to confirm the move persisted server-side, not just optimistic local state.
  await page.reload();
  await expect(doneColumn.getByText("Write the report")).toBeVisible();

  // Chat: create a channel and send a message.
  await page.getByRole("button", { name: "New channel" }).click();
  await page.getByLabel("Name").fill("general");
  await page.getByRole("button", { name: "Create" }).click();

  await page.getByText("general").click();
  await expect(page).toHaveURL(/\/channels\//);

  await page.getByPlaceholder(/Message/).fill("Hello from Playwright");
  await page.getByRole("button", { name: "Send" }).click();

  await expect(page.getByText("Hello from Playwright")).toBeVisible();
});
