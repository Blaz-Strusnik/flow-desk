import { INestApplication } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import cookieParser from "cookie-parser";
import request from "supertest";
import { AppModule } from "../src/app.module.js";

describe("Card move / reorder (e2e)", () => {
  let app: INestApplication;
  let token: string;
  let boardId: string;
  let listAId: string;
  let listBId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication();
    app.use(cookieParser());
    await app.init();

    const server = app.getHttpServer();
    const suffix = Date.now();
    const registerRes = await request(server)
      .post("/auth/register")
      .send({ email: `card-move-${suffix}@example.com`, password: "password123", name: "Card Mover" })
      .expect(201);
    token = registerRes.body.accessToken;

    const wsRes = await request(server)
      .post("/workspaces")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "Move Test Workspace" })
      .expect(201);

    const boardRes = await request(server)
      .post(`/workspaces/${wsRes.body.id}/boards`)
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "Move Test Board" })
      .expect(201);
    boardId = boardRes.body.id;

    const listA = await request(server)
      .post(`/boards/${boardId}/lists`)
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "A" })
      .expect(201);
    listAId = listA.body.id;

    const listB = await request(server)
      .post(`/boards/${boardId}/lists`)
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "B" })
      .expect(201);
    listBId = listB.body.id;
  });

  afterAll(async () => {
    await app.close();
  });

  async function createCard(listId: string, title: string) {
    const res = await request(app.getHttpServer())
      .post(`/lists/${listId}/cards`)
      .set("Authorization", `Bearer ${token}`)
      .send({ title })
      .expect(201);
    return res.body as { id: string; position: number };
  }

  async function boardOrder(): Promise<Record<string, string[]>> {
    const res = await request(app.getHttpServer())
      .get(`/boards/${boardId}`)
      .set("Authorization", `Bearer ${token}`)
      .expect(200);
    const order: Record<string, string[]> = {};
    for (const list of res.body.lists) {
      order[list.id] = list.cards.map((c: { title: string }) => c.title);
    }
    return order;
  }

  it("appends new cards to the bottom of a list in creation order", async () => {
    const c1 = await createCard(listAId, "Card 1");
    const c2 = await createCard(listAId, "Card 2");
    const c3 = await createCard(listAId, "Card 3");

    expect(c2.position).toBeGreaterThan(c1.position);
    expect(c3.position).toBeGreaterThan(c2.position);

    const order = await boardOrder();
    expect(order[listAId]).toEqual(["Card 1", "Card 2", "Card 3"]);
  });

  it("moves a card between two neighbors within the same list", async () => {
    const server = app.getHttpServer();
    const order = await boardOrder();
    expect(order[listAId]).toEqual(["Card 1", "Card 2", "Card 3"]);

    // Move "Card 3" between "Card 1" and "Card 2".
    const cards = await request(server)
      .get(`/boards/${boardId}`)
      .set("Authorization", `Bearer ${token}`)
      .expect(200);
    const listACards = cards.body.lists.find((l: { id: string }) => l.id === listAId).cards;
    const [card1, card2, card3] = listACards;

    await request(server)
      .patch(`/cards/${card3.id}/move`)
      .set("Authorization", `Bearer ${token}`)
      .send({ listId: listAId, beforeId: card1.id, afterId: card2.id })
      .expect(200);

    const newOrder = await boardOrder();
    expect(newOrder[listAId]).toEqual(["Card 1", "Card 3", "Card 2"]);
  });

  it("moves a card across lists, appending to the target list", async () => {
    const server = app.getHttpServer();
    const cards = await request(server)
      .get(`/boards/${boardId}`)
      .set("Authorization", `Bearer ${token}`)
      .expect(200);
    const listACards = cards.body.lists.find((l: { id: string }) => l.id === listAId).cards;
    const cardToMove = listACards[0];

    await request(server)
      .patch(`/cards/${cardToMove.id}/move`)
      .set("Authorization", `Bearer ${token}`)
      .send({ listId: listBId })
      .expect(200);

    const order = await boardOrder();
    expect(order[listBId]).toEqual([cardToMove.title]);
    expect(order[listAId]).not.toContain(cardToMove.title);
  });

  it("transparently rebalances when repeated inserts exhaust float precision between two neighbors", async () => {
    const server = app.getHttpServer();

    // Two fresh cards in listB with a normal gap between them.
    const top = await createCard(listBId, "Top");
    const bottom = await createCard(listBId, "Bottom");

    // Repeatedly insert a new card directly below "Top" and above the
    // previous insert — the worst case for fractional indexing, halving
    // the remaining gap each time — until the server has to rebalance.
    const insertedTitles: string[] = [];
    let nearestNeighborId = bottom.id;
    for (let i = 0; i < 60; i++) {
      const title = `Squeeze ${i}`;
      const card = await createCard(listBId, title);
      await request(server)
        .patch(`/cards/${card.id}/move`)
        .set("Authorization", `Bearer ${token}`)
        .send({ listId: listBId, beforeId: top.id, afterId: nearestNeighborId })
        .expect(200);
      insertedTitles.unshift(title);
      nearestNeighborId = card.id;
    }

    const order = await boardOrder();
    // Order must be preserved (Top, then all squeezed cards, then Bottom)
    // regardless of whether a server-side rebalance happened along the way.
    // listB may already contain cards from an earlier test (moved in from
    // listA), so only assert on the tail this test actually controls.
    const expectedTail = ["Top", ...insertedTitles, "Bottom"];
    expect(order[listBId].slice(-expectedTail.length)).toEqual(expectedTail);
  }, 30000);
});
