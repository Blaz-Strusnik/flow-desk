import { INestApplication } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import cookieParser from "cookie-parser";
import request from "supertest";
import { AppModule } from "../src/app.module.js";

describe("Workspace delete (e2e)", () => {
  let app: INestApplication;
  let ownerToken: string;
  let memberToken: string;
  let workspaceId: string;
  let boardId: string;

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
      .send({ email: `ws-delete-owner-${suffix}@example.com`, password: "password123", name: "Owner" })
      .expect(201);
    ownerToken = ownerRes.body.accessToken;

    const memberRes = await request(server)
      .post("/auth/register")
      .send({ email: `ws-delete-member-${suffix}@example.com`, password: "password123", name: "Member" })
      .expect(201);
    memberToken = memberRes.body.accessToken;
    const memberMe = await request(server)
      .get("/users/me")
      .set("Authorization", `Bearer ${memberToken}`)
      .expect(200);

    const wsRes = await request(server)
      .post("/workspaces")
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ name: "Delete Me Workspace" })
      .expect(201);
    workspaceId = wsRes.body.id;

    await request(server)
      .post(`/workspaces/${workspaceId}/members`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ email: memberMe.body.email })
      .expect(201);

    const boardRes = await request(server)
      .post(`/workspaces/${workspaceId}/boards`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ name: "Board In Deleted Workspace" })
      .expect(201);
    boardId = boardRes.body.id;
  });

  afterAll(async () => {
    await app.close();
  });

  it("forbids a non-OWNER workspace member (e.g. MEMBER role) from deleting the workspace", async () => {
    await request(app.getHttpServer())
      .delete(`/workspaces/${workspaceId}`)
      .set("Authorization", `Bearer ${memberToken}`)
      .expect(403);
  });

  it("forbids a non-member entirely from deleting the workspace", async () => {
    const server = app.getHttpServer();
    const outsiderRes = await request(server)
      .post("/auth/register")
      .send({ email: `ws-delete-outsider-${Date.now()}@example.com`, password: "password123", name: "Outsider" })
      .expect(201);

    await request(server)
      .delete(`/workspaces/${workspaceId}`)
      .set("Authorization", `Bearer ${outsiderRes.body.accessToken}`)
      .expect(404);
  });

  it("lets the OWNER delete the workspace, cascading to its boards", async () => {
    const server = app.getHttpServer();

    await request(server)
      .delete(`/workspaces/${workspaceId}`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .expect(204);

    // The workspace itself is gone (member guard now reports 404 for everyone).
    await request(server)
      .get(`/workspaces/${workspaceId}`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .expect(404);

    // Its board cascaded away too — board membership check now 404s.
    await request(server)
      .get(`/boards/${boardId}`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .expect(404);
  });
});
