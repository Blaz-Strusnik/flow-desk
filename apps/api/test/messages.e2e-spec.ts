import { INestApplication } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import cookieParser from "cookie-parser";
import request from "supertest";
import { AppModule } from "../src/app.module.js";

describe("Channels & Messages (e2e)", () => {
  let app: INestApplication;
  let ownerToken: string;
  let memberToken: string;
  let outsiderToken: string;
  let workspaceId: string;
  let publicChannelId: string;
  let privateChannelId: string;

  async function register(email: string) {
    const res = await request(app.getHttpServer())
      .post("/auth/register")
      .send({ email, password: "password123", name: "Test User" })
      .expect(201);
    return res.body.accessToken as string;
  }

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication();
    app.use(cookieParser());
    await app.init();

    const suffix = Date.now();
    ownerToken = await register(`chat-owner-${suffix}@example.com`);
    memberToken = await register(`chat-member-${suffix}@example.com`);
    outsiderToken = await register(`chat-outsider-${suffix}@example.com`);

    const server = app.getHttpServer();
    const wsRes = await request(server)
      .post("/workspaces")
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ name: "Chat Test Workspace" })
      .expect(201);
    workspaceId = wsRes.body.id;

    const memberMe = await request(server)
      .get("/users/me")
      .set("Authorization", `Bearer ${memberToken}`)
      .expect(200);

    await request(server)
      .post(`/workspaces/${workspaceId}/members`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ email: memberMe.body.email })
      .expect(201);

    const publicRes = await request(server)
      .post(`/workspaces/${workspaceId}/channels`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ name: "general", isPrivate: false })
      .expect(201);
    publicChannelId = publicRes.body.id;

    const privateRes = await request(server)
      .post(`/workspaces/${workspaceId}/channels`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ name: "secret", isPrivate: true })
      .expect(201);
    privateChannelId = privateRes.body.id;
  });

  afterAll(async () => {
    await app.close();
  });

  it("lazily joins a workspace member to a public channel on first read", async () => {
    const server = app.getHttpServer();
    const memberMe = await request(server)
      .get("/users/me")
      .set("Authorization", `Bearer ${memberToken}`)
      .expect(200);

    await request(server)
      .get(`/channels/${publicChannelId}/messages`)
      .set("Authorization", `Bearer ${memberToken}`)
      .expect(200);

    const members = await request(server)
      .get(`/channels/${publicChannelId}/members`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .expect(200);
    expect(members.body.some((m: { userId: string }) => m.userId === memberMe.body.id)).toBe(true);
  });

  it("denies a non-workspace-member access to a public channel", async () => {
    await request(app.getHttpServer())
      .get(`/channels/${publicChannelId}/messages`)
      .set("Authorization", `Bearer ${outsiderToken}`)
      .expect(404);
  });

  it("denies a workspace member (without an explicit invite) access to a private channel", async () => {
    await request(app.getHttpServer())
      .get(`/channels/${privateChannelId}/messages`)
      .set("Authorization", `Bearer ${memberToken}`)
      .expect(404);
  });

  it("allows access to a private channel after an explicit invite", async () => {
    const server = app.getHttpServer();
    const memberMe = await request(server)
      .get("/users/me")
      .set("Authorization", `Bearer ${memberToken}`)
      .expect(200);

    await request(server)
      .post(`/channels/${privateChannelId}/members`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ userId: memberMe.body.id })
      .expect(201);

    await request(server)
      .get(`/channels/${privateChannelId}/messages`)
      .set("Authorization", `Bearer ${memberToken}`)
      .expect(200);
  });

  it("paginates messages with a cursor, returning them in chronological order", async () => {
    const server = app.getHttpServer();
    for (let i = 0; i < 5; i++) {
      await request(server)
        .post(`/channels/${publicChannelId}/messages`)
        .set("Authorization", `Bearer ${ownerToken}`)
        .send({ body: `Message ${i}` })
        .expect(201);
    }

    const firstPage = await request(server)
      .get(`/channels/${publicChannelId}/messages?limit=3`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .expect(200);
    expect(firstPage.body.messages).toHaveLength(3);
    expect(firstPage.body.nextCursor).toBeTruthy();
    // Ascending (chronological) order within the page.
    const bodies = firstPage.body.messages.map((m: { body: string }) => m.body);
    expect(bodies).toEqual(["Message 2", "Message 3", "Message 4"]);

    const secondPage = await request(server)
      .get(`/channels/${publicChannelId}/messages?limit=3&cursor=${firstPage.body.messages[0].id}`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .expect(200);
    const secondBodies = secondPage.body.messages.map((m: { body: string }) => m.body);
    expect(secondBodies).toEqual(["Message 0", "Message 1"]);
    expect(secondPage.body.nextCursor).toBeNull();
  });

  it("rejects creating a second channel with the same name in the same workspace", async () => {
    await request(app.getHttpServer())
      .post(`/workspaces/${workspaceId}/channels`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ name: "general", isPrivate: false })
      .expect(409);
  });

  it("rejects a channel name with characters outside lowercase letters, numbers, and hyphens", async () => {
    await request(app.getHttpServer())
      .post(`/workspaces/${workspaceId}/channels`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ name: "Not Valid!", isPrivate: false })
      .expect(400);
  });

  it("notifies a mentioned channel member", async () => {
    const server = app.getHttpServer();
    const memberMe = await request(server)
      .get("/users/me")
      .set("Authorization", `Bearer ${memberToken}`)
      .expect(200);

    await request(server)
      .post(`/channels/${publicChannelId}/messages`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ body: `hey @${memberMe.body.name} welcome` })
      .expect(201);

    const notifications = await request(server)
      .get("/notifications")
      .set("Authorization", `Bearer ${memberToken}`)
      .expect(200);
    expect(notifications.body.some((n: { type: string }) => n.type === "MENTION")).toBe(true);
  });
});
