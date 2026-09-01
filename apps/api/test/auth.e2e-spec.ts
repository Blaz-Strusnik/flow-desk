import { INestApplication } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import cookieParser from "cookie-parser";
import request from "supertest";
import { AppModule } from "../src/app.module.js";

function extractRefreshCookie(setCookieHeader: string | string[] | undefined): string | null {
  const cookies = Array.isArray(setCookieHeader) ? setCookieHeader : setCookieHeader ? [setCookieHeader] : [];
  const cookie = cookies.find((c) => c.startsWith("refresh_token="));
  return cookie ? cookie.split(";")[0].split("=")[1] : null;
}

describe("Auth (e2e)", () => {
  let app: INestApplication;
  const email = `auth-test-${Date.now()}@example.com`;
  const password = "password123";

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.use(cookieParser());
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it("registers, logs in, refreshes, accesses a protected route, and logout invalidates the refresh token", async () => {
    const server = app.getHttpServer();
    const agent = request.agent(server);

    const registerRes = await agent
      .post("/auth/register")
      .send({ email, password, name: "Auth Test" })
      .expect(201);
    expect(registerRes.body.user.email).toBe(email);
    const firstAccessToken = registerRes.body.accessToken as string;
    expect(firstAccessToken).toBeTruthy();
    const originalRefreshCookie = extractRefreshCookie(registerRes.headers["set-cookie"]);
    expect(originalRefreshCookie).toBeTruthy();

    const meRes = await request(server)
      .get("/users/me")
      .set("Authorization", `Bearer ${firstAccessToken}`)
      .expect(200);
    expect(meRes.body.email).toBe(email);

    await request(server).get("/users/me").expect(401);

    // agent's cookie jar carries the refresh cookie from register automatically.
    const refreshRes = await agent.post("/auth/refresh").expect(200);
    const secondAccessToken = refreshRes.body.accessToken as string;
    expect(secondAccessToken).toBeTruthy();
    const rotatedRefreshCookie = extractRefreshCookie(refreshRes.headers["set-cookie"]);
    expect(rotatedRefreshCookie).toBeTruthy();
    expect(rotatedRefreshCookie).not.toBe(originalRefreshCookie);

    await request(server)
      .get("/users/me")
      .set("Authorization", `Bearer ${secondAccessToken}`)
      .expect(200);

    // Reusing the original (now-rotated-out) refresh cookie must fail —
    // this is the reuse-detection path, and it revokes every session.
    await request(server)
      .post("/auth/refresh")
      .set("Cookie", `refresh_token=${originalRefreshCookie}`)
      .expect(401);

    // Reuse-detection revoked the rotated cookie too.
    await agent.post("/auth/refresh").expect(401);
  });

  it("logs in with correct credentials and rejects a wrong password", async () => {
    const server = app.getHttpServer();

    const loginRes = await request(server)
      .post("/auth/login")
      .send({ email, password })
      .expect(200);
    expect(loginRes.body.user.email).toBe(email);

    await request(server)
      .post("/auth/login")
      .send({ email, password: "wrong-password" })
      .expect(401);
  });

  it("rejects duplicate registration for the same email", async () => {
    const server = app.getHttpServer();
    await request(server)
      .post("/auth/register")
      .send({ email, password, name: "Duplicate" })
      .expect(409);
  });

  it("logout revokes the refresh token so it can no longer be used", async () => {
    const server = app.getHttpServer();
    const agent = request.agent(server);
    const logoutEmail = `auth-logout-${Date.now()}@example.com`;

    await agent
      .post("/auth/register")
      .send({ email: logoutEmail, password, name: "Logout Test" })
      .expect(201);

    await agent.post("/auth/logout").expect(204);
    await agent.post("/auth/refresh").expect(401);
  });
});
