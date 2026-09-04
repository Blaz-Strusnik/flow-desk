import { INestApplication } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import cookieParser from "cookie-parser";
import request from "supertest";
import { AppModule } from "../src/app.module.js";

async function register(
  server: Parameters<typeof request>[0],
  email: string
): Promise<{ token: string; id: string; email: string }> {
  const res = await request(server)
    .post("/auth/register")
    .send({ email, password: "password123", name: "Test User" })
    .expect(201);
  const token = res.body.accessToken as string;
  const me = await request(server).get("/users/me").set("Authorization", `Bearer ${token}`).expect(200);
  return { token, id: me.body.id as string, email: me.body.email as string };
}

describe("Workspace member removal (e2e)", () => {
  let app: INestApplication;
  let server: Parameters<typeof request>[0];
  let owner: Awaited<ReturnType<typeof register>>;
  let member: Awaited<ReturnType<typeof register>>;
  let admin: Awaited<ReturnType<typeof register>>;
  let workspaceId: string;
  let boardId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication();
    app.use(cookieParser());
    await app.init();
    server = app.getHttpServer();

    const suffix = Date.now();
    owner = await register(server, `ws-rm-owner-${suffix}@example.com`);
    member = await register(server, `ws-rm-member-${suffix}@example.com`);
    admin = await register(server, `ws-rm-admin-${suffix}@example.com`);

    workspaceId = (
      await request(server)
        .post("/workspaces")
        .set("Authorization", `Bearer ${owner.token}`)
        .send({ name: "Removal Test Workspace" })
        .expect(201)
    ).body.id;

    boardId = (
      await request(server)
        .post(`/workspaces/${workspaceId}/boards`)
        .set("Authorization", `Bearer ${owner.token}`)
        .send({ name: "Removal Test Board" })
        .expect(201)
    ).body.id;

    for (const u of [member, admin]) {
      await request(server)
        .post(`/workspaces/${workspaceId}/members`)
        .set("Authorization", `Bearer ${owner.token}`)
        .send({ email: u.email })
        .expect(201);
    }

    // Give `member` an explicit BoardMember row too — removal must tear it
    // down, otherwise it would keep granting board access.
    await request(server)
      .post(`/boards/${boardId}/members`)
      .set("Authorization", `Bearer ${owner.token}`)
      .send({ userId: member.id, role: "VIEWER" })
      .expect(201);
  });

  afterAll(async () => {
    await app.close();
  });

  it("a plain MEMBER cannot remove another member", async () => {
    await request(server)
      .delete(`/workspaces/${workspaceId}/members/${admin.id}`)
      .set("Authorization", `Bearer ${member.token}`)
      .expect(403);
  });

  it("a non-member cannot remove anyone", async () => {
    const stranger = await register(server, `ws-rm-stranger-${Date.now()}@example.com`);
    await request(server)
      .delete(`/workspaces/${workspaceId}/members/${member.id}`)
      .set("Authorization", `Bearer ${stranger.token}`)
      .expect(404);
  });

  it("the workspace owner cannot be removed", async () => {
    await request(server)
      .delete(`/workspaces/${workspaceId}/members/${owner.id}`)
      .set("Authorization", `Bearer ${owner.token}`)
      .expect(403);
  });

  it("the OWNER removes a member, revoking all board access including an explicit BoardMember row", async () => {
    // Sanity: the member can reach the board beforehand.
    await request(server)
      .get(`/boards/${boardId}`)
      .set("Authorization", `Bearer ${member.token}`)
      .expect(200);

    await request(server)
      .delete(`/workspaces/${workspaceId}/members/${member.id}`)
      .set("Authorization", `Bearer ${owner.token}`)
      .expect(204);

    // Workspace and board are both unreachable now.
    await request(server)
      .get(`/workspaces/${workspaceId}`)
      .set("Authorization", `Bearer ${member.token}`)
      .expect(404);
    await request(server)
      .get(`/boards/${boardId}`)
      .set("Authorization", `Bearer ${member.token}`)
      .expect(404);

    // And they're gone from the member list.
    const list = await request(server)
      .get(`/workspaces/${workspaceId}/members`)
      .set("Authorization", `Bearer ${owner.token}`)
      .expect(200);
    expect(list.body.some((m: { userId: string }) => m.userId === member.id)).toBe(false);
  });

  it("removing someone who is not a member 404s", async () => {
    await request(server)
      .delete(`/workspaces/${workspaceId}/members/${member.id}`)
      .set("Authorization", `Bearer ${owner.token}`)
      .expect(404);
  });
});
