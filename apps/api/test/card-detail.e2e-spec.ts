import { INestApplication } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import cookieParser from "cookie-parser";
import request from "supertest";
import { AppModule } from "../src/app.module.js";

// Regression coverage for a real bug: GET /cards/:id returned Prisma's raw
// join shape (card.labels[].label, card.members[].user) instead of the
// flat LabelDto[]/UserDto[] the CardDetailDto contract promises, crashing
// the frontend the first time a card actually had a label or an assignee.
describe("Card detail assembly (e2e)", () => {
  let app: INestApplication;
  let ownerToken: string;
  let memberToken: string;
  let memberUserId: string;
  let boardId: string;
  let cardId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication();
    app.use(cookieParser());
    await app.init();

    const server = app.getHttpServer();
    const suffix = Date.now();

    const ownerRes = await request(server)
      .post("/auth/register")
      .send({ email: `card-detail-owner-${suffix}@example.com`, password: "password123", name: "Owner" })
      .expect(201);
    ownerToken = ownerRes.body.accessToken;

    const memberRes = await request(server)
      .post("/auth/register")
      .send({ email: `card-detail-member-${suffix}@example.com`, password: "password123", name: "Assignee" })
      .expect(201);
    memberToken = memberRes.body.accessToken;
    const memberMe = await request(server)
      .get("/users/me")
      .set("Authorization", `Bearer ${memberToken}`)
      .expect(200);
    memberUserId = memberMe.body.id;

    const wsRes = await request(server)
      .post("/workspaces")
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ name: "Card Detail Workspace" })
      .expect(201);

    await request(server)
      .post(`/workspaces/${wsRes.body.id}/members`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ email: memberMe.body.email })
      .expect(201);

    const boardRes = await request(server)
      .post(`/workspaces/${wsRes.body.id}/boards`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ name: "Card Detail Board" })
      .expect(201);
    boardId = boardRes.body.id;

    await request(server)
      .post(`/boards/${boardId}/members`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ userId: memberUserId, role: "EDITOR" })
      .expect(201);

    const listRes = await request(server)
      .post(`/boards/${boardId}/lists`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ name: "List A" })
      .expect(201);

    const cardRes = await request(server)
      .post(`/lists/${listRes.body.id}/cards`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ title: "Card with label, assignee, comment" })
      .expect(201);
    cardId = cardRes.body.id;
  });

  afterAll(async () => {
    await app.close();
  });

  it("returns flat LabelDto[]/UserDto[] shapes for labels/members, and a nested user on each comment", async () => {
    const server = app.getHttpServer();

    const labelRes = await request(server)
      .post(`/boards/${boardId}/labels`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ name: "Bug", color: "#ff0000" })
      .expect(201);

    await request(server)
      .post(`/cards/${cardId}/labels`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ labelId: labelRes.body.id })
      .expect(201);

    await request(server)
      .post(`/cards/${cardId}/members`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ userId: memberUserId })
      .expect(201);

    await request(server)
      .post(`/cards/${cardId}/comments`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ body: "Looking into this" })
      .expect(201);

    const detail = await request(server)
      .get(`/cards/${cardId}`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .expect(200);

    // labels: flat LabelDto[], not raw CardLabel join rows.
    expect(detail.body.labels).toEqual([
      expect.objectContaining({ id: labelRes.body.id, name: "Bug", color: "#ff0000" }),
    ]);

    // members: flat UserDto[] (this is exactly what crashed the frontend —
    // member.name must exist directly, not only at member.user.name).
    expect(detail.body.members).toEqual([expect.objectContaining({ id: memberUserId, name: "Assignee" })]);
    expect(detail.body.members[0].name).toBe("Assignee");

    // comments: each one carries its author as a nested user object.
    expect(detail.body.comments).toHaveLength(1);
    expect(detail.body.comments[0].user).toEqual(expect.objectContaining({ name: "Owner" }));
  });

  // Regression: DELETE /cards/:id/members/:userId and .../labels/:labelId
  // returned 200 with an empty body. The frontend's apiFetch only treated
  // 204 as body-less, so res.json() threw on the empty 200, the mutation
  // silently rejected, and the UI never updated even though the backend
  // deletion had actually succeeded — "can't delete assignee".
  it("returns 204 (not 200-with-empty-body) when unassigning a member or detaching a label", async () => {
    const server = app.getHttpServer();

    const labelRes = await request(server)
      .post(`/boards/${boardId}/labels`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ name: "Regression", color: "#00ff00" })
      .expect(201);

    await request(server)
      .post(`/cards/${cardId}/labels`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ labelId: labelRes.body.id })
      .expect(201);
    await request(server)
      .post(`/cards/${cardId}/members`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ userId: memberUserId })
      .expect(201);

    await request(server)
      .delete(`/cards/${cardId}/labels/${labelRes.body.id}`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .expect(204);
    await request(server)
      .delete(`/cards/${cardId}/members/${memberUserId}`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .expect(204);

    const detail = await request(server)
      .get(`/cards/${cardId}`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .expect(200);
    expect(detail.body.labels.find((l: { id: string }) => l.id === labelRes.body.id)).toBeUndefined();
    expect(detail.body.members.find((m: { id: string }) => m.id === memberUserId)).toBeUndefined();
  });

  it("persists startDate and dueDate independently, and clears them with null", async () => {
    const server = app.getHttpServer();

    const patched = await request(server)
      .patch(`/cards/${cardId}`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ startDate: "2026-03-10T00:00:00.000Z", dueDate: "2026-03-15T00:00:00.000Z" })
      .expect(200);
    expect(new Date(patched.body.startDate).toISOString()).toBe("2026-03-10T00:00:00.000Z");
    expect(new Date(patched.body.dueDate).toISOString()).toBe("2026-03-15T00:00:00.000Z");

    // Detail endpoint exposes the new field too.
    const detail = await request(server)
      .get(`/cards/${cardId}`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .expect(200);
    expect(new Date(detail.body.startDate).toISOString()).toBe("2026-03-10T00:00:00.000Z");

    // Clearing only startDate leaves dueDate intact.
    const cleared = await request(server)
      .patch(`/cards/${cardId}`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ startDate: null })
      .expect(200);
    expect(cleared.body.startDate).toBeNull();
    expect(new Date(cleared.body.dueDate).toISOString()).toBe("2026-03-15T00:00:00.000Z");
  });
});
