import { describe, expect, it } from "vitest";
import { generate } from "./backend-generator.js";
import type { APIRoute, DataSchema } from "@crayon/types";

function createRoute(overrides: Partial<APIRoute> = {}): APIRoute {
  return {
    method: "GET",
    path: "/api/users",
    pattern: "list",
    examples: [],
    ...overrides,
  };
}

function createSchema(entity: string, fields: DataSchema["fields"] = []): DataSchema {
  return {
    entity,
    fields,
    relationships: [],
  };
}

describe("generate", () => {
  describe("project structure", () => {
    it("generates all required project files", async () => {
      const routes = [createRoute()];
      const result = await generate(routes, []);

      const filePaths = result.files.map(f => f.path);

      expect(filePaths).toContain("package.json");
      expect(filePaths).toContain("tsconfig.json");
      expect(filePaths).toContain("src/server.ts");
      expect(filePaths).toContain("src/db.ts");
      expect(filePaths).toContain("src/types.ts");
      expect(filePaths).toContain("src/seed.ts");
    });

    it("generates valid package.json with Express dependencies", async () => {
      const routes = [createRoute()];
      const result = await generate(routes, []);

      const pkgFile = result.files.find(f => f.path === "package.json");
      expect(pkgFile).toBeDefined();

      const pkg = JSON.parse(pkgFile!.content);
      expect(pkg.dependencies.express).toBeDefined();
      expect(pkg.dependencies["better-sqlite3"]).toBeDefined();
      expect(pkg.dependencies.cors).toBeDefined();
      expect(pkg.scripts.start).toBeDefined();
      expect(pkg.scripts.dev).toBeDefined();
    });

    it("generates valid tsconfig.json", async () => {
      const routes = [createRoute()];
      const result = await generate(routes, []);

      const tsConfig = result.files.find(f => f.path === "tsconfig.json");
      expect(tsConfig).toBeDefined();

      const config = JSON.parse(tsConfig!.content);
      expect(config.compilerOptions.strict).toBe(true);
      expect(config.compilerOptions.module).toBe("ESNext");
    });
  });

  describe("route generation", () => {
    it("generates route file for each entity", async () => {
      const routes = [
        createRoute({ path: "/api/users", pattern: "list" }),
        createRoute({ path: "/api/products", pattern: "list" }),
      ];
      const result = await generate(routes, []);

      const filePaths = result.files.map(f => f.path);
      expect(filePaths).toContain("src/routes/users.ts");
      expect(filePaths).toContain("src/routes/products.ts");
    });

    it("groups routes by entity", async () => {
      const routes = [
        createRoute({ method: "GET", path: "/api/users", pattern: "list" }),
        createRoute({ method: "GET", path: "/api/users/:userId", pattern: "get" }),
        createRoute({ method: "POST", path: "/api/users", pattern: "create" }),
      ];
      const result = await generate(routes, []);

      expect(result.entities).toEqual(["users"]);
      expect(result.files.filter(f => f.path.includes("routes/"))).toHaveLength(1);
    });

    it("generates list route handler", async () => {
      const routes = [createRoute({ method: "GET", path: "/api/users", pattern: "list" })];
      const result = await generate(routes, []);

      const routeFile = result.files.find(f => f.path === "src/routes/users.ts");
      expect(routeFile).toBeDefined();
      expect(routeFile!.content).toContain('router.get("/users"');
      expect(routeFile!.content).toContain('db.getAll("users")');
    });

    it("generates get route handler", async () => {
      const routes = [createRoute({ method: "GET", path: "/api/users/:userId", pattern: "get" })];
      const result = await generate(routes, []);

      const routeFile = result.files.find(f => f.path === "src/routes/users.ts");
      expect(routeFile).toBeDefined();
      expect(routeFile!.content).toContain('router.get("/users/:userId"');
      expect(routeFile!.content).toContain('db.get("users"');
      expect(routeFile!.content).toContain("status(404)");
    });

    it("generates create route handler", async () => {
      const routes = [createRoute({ method: "POST", path: "/api/users", pattern: "create" })];
      const result = await generate(routes, []);

      const routeFile = result.files.find(f => f.path === "src/routes/users.ts");
      expect(routeFile).toBeDefined();
      expect(routeFile!.content).toContain('router.post("/users"');
      expect(routeFile!.content).toContain('db.insert("users"');
      expect(routeFile!.content).toContain("crypto.randomUUID()");
      expect(routeFile!.content).toContain("status(201)");
    });

    it("generates update route handler", async () => {
      const routes = [createRoute({ method: "PUT", path: "/api/users/:userId", pattern: "update" })];
      const result = await generate(routes, []);

      const routeFile = result.files.find(f => f.path === "src/routes/users.ts");
      expect(routeFile).toBeDefined();
      expect(routeFile!.content).toContain('router.put("/users/:userId"');
      expect(routeFile!.content).toContain('db.update("users"');
      expect(routeFile!.content).toContain("status(404)");
    });

    it("generates delete route handler", async () => {
      const routes = [createRoute({ method: "DELETE", path: "/api/users/:userId", pattern: "delete" })];
      const result = await generate(routes, []);

      const routeFile = result.files.find(f => f.path === "src/routes/users.ts");
      expect(routeFile).toBeDefined();
      expect(routeFile!.content).toContain('router.delete("/users/:userId"');
      expect(routeFile!.content).toContain('db.delete("users"');
      expect(routeFile!.content).toContain("status(204)");
    });

    it("generates custom route handler with example response", async () => {
      const routes = [
        createRoute({
          method: "GET",
          path: "/api/stats",
          pattern: "custom",
          examples: [{ response: { count: 42, active: true } }],
        }),
      ];
      const result = await generate(routes, []);

      const routeFile = result.files.find(f => f.path === "src/routes/stats.ts");
      expect(routeFile).toBeDefined();
      expect(routeFile!.content).toContain("count");
      expect(routeFile!.content).toContain("42");
    });
  });

  describe("server generation", () => {
    it("generates server with entity routers mounted", async () => {
      const routes = [
        createRoute({ path: "/api/users" }),
        createRoute({ path: "/api/products" }),
      ];
      const result = await generate(routes, []);

      const serverFile = result.files.find(f => f.path === "src/server.ts");
      expect(serverFile).toBeDefined();
      expect(serverFile!.content).toContain('import { router as usersRouter }');
      expect(serverFile!.content).toContain('import { router as productsRouter }');
      expect(serverFile!.content).toContain('app.use("/api", usersRouter)');
      expect(serverFile!.content).toContain('app.use("/api", productsRouter)');
    });

    it("includes health check endpoint", async () => {
      const routes = [createRoute()];
      const result = await generate(routes, []);

      const serverFile = result.files.find(f => f.path === "src/server.ts");
      expect(serverFile).toBeDefined();
      expect(serverFile!.content).toContain('app.get("/health"');
      expect(serverFile!.content).toContain('status: "ok"');
    });

    it("includes error handler", async () => {
      const routes = [createRoute()];
      const result = await generate(routes, []);

      const serverFile = result.files.find(f => f.path === "src/server.ts");
      expect(serverFile).toBeDefined();
      expect(serverFile!.content).toContain("app.use((err: Error");
      expect(serverFile!.content).toContain("status(500)");
    });

    it("includes CORS and JSON middleware", async () => {
      const routes = [createRoute()];
      const result = await generate(routes, []);

      const serverFile = result.files.find(f => f.path === "src/server.ts");
      expect(serverFile).toBeDefined();
      expect(serverFile!.content).toContain("app.use(cors())");
      expect(serverFile!.content).toContain("app.use(express.json())");
    });
  });

  describe("database generation", () => {
    it("generates db.ts with CRUD operations", async () => {
      const routes = [createRoute()];
      const result = await generate(routes, []);

      const dbFile = result.files.find(f => f.path === "src/db.ts");
      expect(dbFile).toBeDefined();
      expect(dbFile!.content).toContain("getAll<T>(");
      expect(dbFile!.content).toContain("get<T>(");
      expect(dbFile!.content).toContain("insert<T extends");
      expect(dbFile!.content).toContain("update<T extends");
      expect(dbFile!.content).toContain("delete(");
      expect(dbFile!.content).toContain("seed<T extends");
    });

    it("uses SQLite with WAL mode", async () => {
      const routes = [createRoute()];
      const result = await generate(routes, []);

      const dbFile = result.files.find(f => f.path === "src/db.ts");
      expect(dbFile).toBeDefined();
      expect(dbFile!.content).toContain("better-sqlite3");
      expect(dbFile!.content).toContain("journal_mode = WAL");
    });

    it("creates tables dynamically", async () => {
      const routes = [createRoute()];
      const result = await generate(routes, []);

      const dbFile = result.files.find(f => f.path === "src/db.ts");
      expect(dbFile).toBeDefined();
      expect(dbFile!.content).toContain("CREATE TABLE IF NOT EXISTS");
      expect(dbFile!.content).toContain("ensureTable");
    });
  });

  describe("type generation", () => {
    it("generates entity interfaces from schemas", async () => {
      const routes = [createRoute({ path: "/api/users" })];
      const schemas = [
        createSchema("user", [
          { name: "id", type: "string", nullable: false, example: "123" },
          { name: "name", type: "string", nullable: false, example: "John" },
          { name: "email", type: "string", format: "email", nullable: false, example: "john@example.com" },
        ]),
      ];
      const result = await generate(routes, schemas);

      const typesFile = result.files.find(f => f.path === "src/types.ts");
      expect(typesFile).toBeDefined();
      expect(typesFile!.content).toContain("export interface User");
      expect(typesFile!.content).toContain("id: string");
      expect(typesFile!.content).toContain("name: string");
      expect(typesFile!.content).toContain("email: string");
    });

    it("handles nullable fields", async () => {
      const routes = [createRoute({ path: "/api/users" })];
      const schemas = [
        createSchema("user", [
          { name: "id", type: "string", nullable: false, example: "123" },
          { name: "bio", type: "string", nullable: true, example: null },
        ]),
      ];
      const result = await generate(routes, schemas);

      const typesFile = result.files.find(f => f.path === "src/types.ts");
      expect(typesFile).toBeDefined();
      expect(typesFile!.content).toContain("bio?: string");
    });

    it("generates fallback interface when no schema", async () => {
      const routes = [createRoute({ path: "/api/users" })];
      const result = await generate(routes, []);

      const typesFile = result.files.find(f => f.path === "src/types.ts");
      expect(typesFile).toBeDefined();
      expect(typesFile!.content).toContain("export interface User");
      expect(typesFile!.content).toContain("id: string");
      expect(typesFile!.content).toContain("[key: string]: unknown");
    });

    it("handles different field types", async () => {
      const routes = [createRoute({ path: "/api/items" })];
      const schemas = [
        createSchema("item", [
          { name: "id", type: "string", nullable: false, example: "123" },
          { name: "count", type: "number", nullable: false, example: 42 },
          { name: "active", type: "boolean", nullable: false, example: true },
          { name: "createdAt", type: "date", nullable: false, example: "2024-01-01" },
          { name: "tags", type: "array", nullable: false, example: [] },
          { name: "metadata", type: "object", nullable: false, example: {} },
        ]),
      ];
      const result = await generate(routes, schemas);

      const typesFile = result.files.find(f => f.path === "src/types.ts");
      expect(typesFile).toBeDefined();
      expect(typesFile!.content).toContain("count: number");
      expect(typesFile!.content).toContain("active: boolean");
      expect(typesFile!.content).toContain("createdAt: string");
      expect(typesFile!.content).toContain("tags: unknown[]");
      expect(typesFile!.content).toContain("metadata: Record<string, unknown>");
    });
  });

  describe("seed data generation", () => {
    it("extracts seed data from list examples", async () => {
      const routes = [
        createRoute({
          path: "/api/users",
          pattern: "list",
          examples: [
            {
              response: [
                { id: "1", name: "Alice" },
                { id: "2", name: "Bob" },
              ],
            },
          ],
        }),
      ];
      const result = await generate(routes, []);

      const seedFile = result.files.find(f => f.path === "src/seed.ts");
      expect(seedFile).toBeDefined();
      expect(seedFile!.content).toContain('db.seed("users"');
      expect(seedFile!.content).toContain("Alice");
      expect(seedFile!.content).toContain("Bob");
    });

    it("extracts seed data from get examples", async () => {
      const routes = [
        createRoute({
          path: "/api/users/:userId",
          pattern: "get",
          examples: [
            { response: { id: "1", name: "Alice" } },
          ],
        }),
      ];
      const result = await generate(routes, []);

      const seedFile = result.files.find(f => f.path === "src/seed.ts");
      expect(seedFile).toBeDefined();
      expect(seedFile!.content).toContain("Alice");
    });

    it("deduplicates seed data by id", async () => {
      const routes = [
        createRoute({
          path: "/api/users",
          pattern: "list",
          examples: [
            {
              response: [
                { id: "1", name: "Alice" },
                { id: "1", name: "Alice Updated" },
              ],
            },
          ],
        }),
      ];
      const result = await generate(routes, []);

      const seedFile = result.files.find(f => f.path === "src/seed.ts");
      expect(seedFile).toBeDefined();
      // Should only contain one Alice entry
      const aliceMatches = seedFile!.content.match(/Alice/g);
      expect(aliceMatches).toHaveLength(1);
    });

    it("handles empty examples gracefully", async () => {
      const routes = [createRoute({ examples: [] })];
      const result = await generate(routes, []);

      const seedFile = result.files.find(f => f.path === "src/seed.ts");
      expect(seedFile).toBeDefined();
      expect(seedFile!.content).toContain("No seed data");
    });
  });

  describe("return values", () => {
    it("returns list of entities", async () => {
      const routes = [
        createRoute({ path: "/api/users" }),
        createRoute({ path: "/api/products" }),
        createRoute({ path: "/api/orders" }),
      ];
      const result = await generate(routes, []);

      expect(result.entities).toContain("users");
      expect(result.entities).toContain("products");
      expect(result.entities).toContain("orders");
    });

    it("returns list of route paths", async () => {
      const routes = [
        createRoute({ method: "GET", path: "/api/users", pattern: "list" }),
        createRoute({ method: "POST", path: "/api/users", pattern: "create" }),
        createRoute({ method: "GET", path: "/api/users/:userId", pattern: "get" }),
      ];
      const result = await generate(routes, []);

      expect(result.routes).toContain("GET /api/users");
      expect(result.routes).toContain("POST /api/users");
      expect(result.routes).toContain("GET /api/users/:userId");
    });
  });

  describe("edge cases", () => {
    it("handles empty routes array", async () => {
      const result = await generate([], []);

      expect(result.files.length).toBeGreaterThan(0);
      expect(result.entities).toEqual([]);
      expect(result.routes).toEqual([]);
    });

    it("handles routes without api prefix", async () => {
      const routes = [createRoute({ path: "/users" })];
      const result = await generate(routes, []);

      expect(result.entities).toContain("users");
    });

    it("handles nested routes", async () => {
      const routes = [
        createRoute({ path: "/api/users/:userId/posts", pattern: "list" }),
      ];
      const result = await generate(routes, []);

      expect(result.entities).toContain("users");
    });

    it("handles routes with version prefix", async () => {
      const routes = [createRoute({ path: "/api/v1/users" })];
      const result = await generate(routes, []);

      expect(result.entities).toContain("users");
    });

    it("handles PATCH method", async () => {
      const routes = [createRoute({ method: "PATCH", path: "/api/users/:userId", pattern: "update" })];
      const result = await generate(routes, []);

      const routeFile = result.files.find(f => f.path === "src/routes/users.ts");
      expect(routeFile).toBeDefined();
      expect(routeFile!.content).toContain("router.patch");
    });

    it("converts plural entity names to singular for interfaces", async () => {
      const routes = [createRoute({ path: "/api/categories" })];
      const result = await generate(routes, []);

      const typesFile = result.files.find(f => f.path === "src/types.ts");
      expect(typesFile).toBeDefined();
      expect(typesFile!.content).toContain("export interface Category");
    });

    it("handles entities ending in -ies", async () => {
      const routes = [createRoute({ path: "/api/companies" })];
      const result = await generate(routes, []);

      const typesFile = result.files.find(f => f.path === "src/types.ts");
      expect(typesFile).toBeDefined();
      expect(typesFile!.content).toContain("export interface Company");
    });
  });
});
