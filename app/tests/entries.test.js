const request = require("supertest");
const app = require("../src/app");

// Each test group gets a fresh app state
beforeEach(() => {
  const entries = require("../src/routes/entries");
  // reset the in-memory store between tests
  jest.resetModules();
});

describe("GET /health", () => {
  it("returns status ok", async () => {
    const res = await request(app).get("/health");
    expect(res.statusCode).toBe(200);
    expect(res.body.status).toBe("ok");
  });
});

describe("POST /entries", () => {
  it("adds a new food entry", async () => {
    const res = await request(app)
      .post("/entries")
      .send({ name: "Rice", calories: 300 });
    expect(res.statusCode).toBe(201);
    expect(res.body.name).toBe("Rice");
    expect(res.body.calories).toBe(300);
    expect(res.body.id).toBeDefined();
  });

  it("rejects missing name", async () => {
    const res = await request(app)
      .post("/entries")
      .send({ calories: 300 });
    expect(res.statusCode).toBe(400);
  });

  it("rejects missing calories", async () => {
    const res = await request(app)
      .post("/entries")
      .send({ name: "Rice" });
    expect(res.statusCode).toBe(400);
  });

  it("rejects negative calories", async () => {
    const res = await request(app)
      .post("/entries")
      .send({ name: "Rice", calories: -100 });
    expect(res.statusCode).toBe(400);
  });
});

describe("GET /entries", () => {
  it("returns a list of entries", async () => {
    await request(app).post("/entries").send({ name: "Rice", calories: 300 });
    const res = await request(app).get("/entries");
    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThan(0);
  });
});

describe("GET /entries/total", () => {
  it("returns the sum of all calories", async () => {
    await request(app).post("/entries").send({ name: "Rice", calories: 300 });
    await request(app).post("/entries").send({ name: "Chicken", calories: 200 });
    const res = await request(app).get("/entries/total");
    expect(res.statusCode).toBe(200);
    expect(res.body.total).toBeGreaterThanOrEqual(500);
  });
});

describe("DELETE /entries/:id", () => {
  it("deletes an existing entry", async () => {
    const created = await request(app)
      .post("/entries")
      .send({ name: "Banana", calories: 90 });
    const id = created.body.id;
    const res = await request(app).delete(`/entries/${id}`);
    expect(res.statusCode).toBe(204);
  });

  it("returns 404 for a non-existent entry", async () => {
    const res = await request(app).delete("/entries/9999");
    expect(res.statusCode).toBe(404);
  });
});
