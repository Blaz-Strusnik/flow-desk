import { INestApplication } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import cookieParser from "cookie-parser";
import request from "supertest";
import { AppModule } from "../src/app.module.js";

async function registerAndGetToken(
  server: Parameters<typeof request>[0],
  email: string
): Promise<string> {
  const res = await request(server)
    .post("/auth/register")
    .send({ email, password: "password123", name: "Test User" })
    .expect(201);
  return res.body.accessToken as string;
}

describe("Board access control (e2e)", () => {
  let app: INestApplication;
  let ownerToken: string;
  let outsiderToken: string;
  let workspaceId: string;
  let boardId: string;
  let listId: string;
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
    ownerToken = await registerAndGetToken(server, `board-owner-${suffix}@example.com`);
    outsiderToken = await registerAndGetToken(server, `board-outsider-${suffix}@example.com`);

    const wsRes = await request(server)
      .post("/workspaces")
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ name: "Access Test Workspace" })
      .expect(201);
    workspaceId = wsRes.body.id;

    const boardRes = await request(server)
      .post(`/workspaces/${workspaceId}/boards`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ name: "Access Test Board" })
      .expect(201);
    boardId = boardRes.body.id;

    const listRes = await request(server)
      .post(`/boards/${boardId}/lists`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ name: "List A" })
      .expect(201);
    listId = listRes.body.id;

    const cardRes = await request(server)
      .post(`/lists/${listId}/cards`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ title: "Card A" })
      .expect(201);
    cardId = cardRes.body.id;
  });

  afterAll(async () => {
    await app.close();
  });

  it("lets the owner (a board member) read and mutate the board", async () => {
    const server = app.getHttpServer();
    await request(server)
      .get(`/boards/${boardId}`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .expect(200);

    await request(server)
      .patch(`/cards/${cardId}`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ title: "Renamed" })
      .expect(200);
  });

  it("a workspace member who is NOT a board member gets 404 on every board/list/card endpoint", async () => {
    const server = app.getHttpServer();

    // Make the outsider a workspace member (but never a board member) —
    // this is exactly the case the two-layer access model must block.
    await request(server)
      .post(`/workspaces/${workspaceId}/members`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ email: (await getOutsiderEmail()) })
      .expect(201);

    await request(server)
      .get(`/boards/${boardId}`)
      .set("Authorization", `Bearer ${outsiderToken}`)
      .expect(404);

    await request(server)
      .post(`/boards/${boardId}/lists`)
      .set("Authorization", `Bearer ${outsiderToken}`)
      .send({ name: "Sneaky List" })
      .expect(404);

    await request(server)
      .post(`/lists/${listId}/cards`)
      .set("Authorization", `Bearer ${outsiderToken}`)
      .send({ title: "Sneaky Card" })
      .expect(404);

    await request(server)
      .get(`/cards/${cardId}`)
      .set("Authorization", `Bearer ${outsiderToken}`)
      .expect(404);

    await request(server)
      .patch(`/cards/${cardId}`)
      .set("Authorization", `Bearer ${outsiderToken}`)
      .send({ title: "hacked" })
      .expect(404);

    await request(server)
      .patch(`/cards/${cardId}/move`)
      .set("Authorization", `Bearer ${outsiderToken}`)
      .send({ listId })
      .expect(404);

    async function getOutsiderEmail() {
      const me = await request(server)
        .get("/users/me")
        .set("Authorization", `Bearer ${outsiderToken}`)
        .expect(200);
      return me.body.email as string;
    }
  });

  it("a totally unauthenticated caller gets 401, not 404, before board membership is even checked", async () => {
    const server = app.getHttpServer();
    await request(server).get(`/boards/${boardId}`).expect(401);
  });

  it("a VIEWER-role board member can read but not mutate cards/lists", async () => {
    const server = app.getHttpServer();
    const viewerToken = await request(server)
      .post("/auth/register")
      .send({ email: `board-viewer-${Date.now()}@example.com`, password: "password123", name: "Viewer" })
      .expect(201)
      .then((res) => res.body.accessToken as string);

    const viewerMe = await request(server)
      .get("/users/me")
      .set("Authorization", `Bearer ${viewerToken}`)
      .expect(200);

    await request(server)
      .post(`/workspaces/${workspaceId}/members`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ email: viewerMe.body.email })
      .expect(201);

    await request(server)
      .post(`/boards/${boardId}/members`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ userId: viewerMe.body.id, role: "VIEWER" })
      .expect(201);

    // Read access works.
    await request(server)
      .get(`/boards/${boardId}`)
      .set("Authorization", `Bearer ${viewerToken}`)
      .expect(200);

    // Every mutation is forbidden for a VIEWER.
    await request(server)
      .post(`/boards/${boardId}/lists`)
      .set("Authorization", `Bearer ${viewerToken}`)
      .send({ name: "Viewer's List" })
      .expect(403);

    await request(server)
      .post(`/lists/${listId}/cards`)
      .set("Authorization", `Bearer ${viewerToken}`)
      .send({ title: "Viewer's Card" })
      .expect(403);

    await request(server)
      .patch(`/cards/${cardId}`)
      .set("Authorization", `Bearer ${viewerToken}`)
      .send({ title: "hacked by viewer" })
      .expect(403);
  });
});
