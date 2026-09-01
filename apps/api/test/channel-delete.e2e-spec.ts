import { INestApplication } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import cookieParser from "cookie-parser";
import request from "supertest";
import { AppModule } from "../src/app.module.js";

describe("Channel delete (e2e)", () => {
  let app: INestApplication;
  let ownerToken: string;
  let memberToken: string;
  let workspaceId: string;
  let channelId: string;

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
    ownerToken = await register(`chan-delete-owner-${suffix}@example.com`);
    memberToken = await register(`chan-delete-member-${suffix}@example.com`);

    const server = app.getHttpServer();
    const wsRes = await request(server)
      .post("/workspaces")
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ name: "Channel Delete Test Workspace" })
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

    const channelRes = await request(server)
      .post(`/workspaces/${workspaceId}/channels`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ name: "delete-me", isPrivate: false })
      .expect(201);
    channelId = channelRes.body.id;

    await request(server)
      .post(`/channels/${channelId}/messages`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ body: "hello" })
      .expect(201);
  });

  afterAll(async () => {
    await app.close();
  });

  it("forbids a non-member entirely from deleting the channel", async () => {
    const outsiderToken = await register(`chan-delete-outsider-${Date.now()}@example.com`);
    await request(app.getHttpServer())
      .delete(`/workspaces/${workspaceId}/channels/${channelId}`)
      .set("Authorization", `Bearer ${outsiderToken}`)
      .expect(404);
  });

  it("forbids a plain MEMBER from deleting the channel", async () => {
    await request(app.getHttpServer())
      .delete(`/workspaces/${workspaceId}/channels/${channelId}`)
      .set("Authorization", `Bearer ${memberToken}`)
      .expect(403);
  });

  it("lets an OWNER delete the channel, cascading to its messages and members", async () => {
    const server = app.getHttpServer();

    await request(server)
      .delete(`/workspaces/${workspaceId}/channels/${channelId}`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .expect(204);

    await request(server)
      .get(`/channels/${channelId}/messages`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .expect(404);

    const list = await request(server)
      .get(`/workspaces/${workspaceId}/channels`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .expect(200);
    expect(list.body.some((c: { id: string }) => c.id === channelId)).toBe(false);
  });
});
