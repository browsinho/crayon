import { describe, expect, it } from "vitest";
import { extract, parameterizePath } from "./api-route-extractor.js";
import type { NetworkCall } from "@crayon/types";

const createNetworkCall = (
  overrides: Partial<{
    method: string;
    url: string;
    requestBody: string;
    responseBody: string;
    status: number;
  }> = {}
): NetworkCall => ({
  id: `net-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
  timestamp: Date.now(),
  request: {
    method: overrides.method ?? "GET",
    url: overrides.url ?? "https://api.example.com/api/users",
    headers: { "Content-Type": "application/json" },
    body: overrides.requestBody,
  },
  response: {
    status: overrides.status ?? 200,
    headers: { "Content-Type": "application/json" },
    body: overrides.responseBody,
    contentType: "application/json",
  },
});

describe("parameterizePath", () => {
  it("parameterizes numeric IDs", () => {
    expect(parameterizePath("/users/123")).toBe("/users/:userId");
    expect(parameterizePath("/users/456/posts/789")).toBe(
      "/users/:userId/posts/:postId"
    );
  });

  it("parameterizes UUIDs", () => {
    expect(parameterizePath("/users/550e8400-e29b-41d4-a716-446655440000")).toBe(
      "/users/:userId"
    );
  });

  it("parameterizes MongoDB ObjectIds", () => {
    expect(parameterizePath("/users/507f1f77bcf86cd799439011")).toBe(
      "/users/:userId"
    );
  });

  it("parameterizes slug-with-id patterns", () => {
    expect(parameterizePath("/posts/my-blog-post-123")).toBe("/posts/:postId");
  });

  it("preserves non-dynamic segments", () => {
    expect(parameterizePath("/api/v1/users")).toBe("/api/v1/users");
    expect(parameterizePath("/users/profile")).toBe("/users/profile");
  });

  it("handles root path", () => {
    expect(parameterizePath("/")).toBe("/");
  });

  it("handles paths with query strings (extracts path only)", () => {
    expect(parameterizePath("/users/123")).toBe("/users/:userId");
  });

  it("handles singular resource names", () => {
    expect(parameterizePath("/user/123")).toBe("/user/:userId");
  });
});

describe("extract", () => {
  describe("route grouping", () => {
    it("groups calls by method and parameterized path", () => {
      const calls: NetworkCall[] = [
        createNetworkCall({ method: "GET", url: "https://api.example.com/users/1" }),
        createNetworkCall({ method: "GET", url: "https://api.example.com/users/2" }),
        createNetworkCall({ method: "GET", url: "https://api.example.com/users/3" }),
        createNetworkCall({ method: "POST", url: "https://api.example.com/users" }),
      ];

      const routes = extract(calls);

      expect(routes).toHaveLength(2);
      expect(routes.find((r) => r.method === "GET" && r.path === "/users/:userId")).toBeDefined();
      expect(routes.find((r) => r.method === "POST" && r.path === "/users")).toBeDefined();
    });

    it("correctly groups 10 network calls", () => {
      const calls: NetworkCall[] = [
        createNetworkCall({ method: "GET", url: "https://api.example.com/users", responseBody: "[]" }),
        createNetworkCall({ method: "GET", url: "https://api.example.com/users/1", responseBody: '{"id":1}' }),
        createNetworkCall({ method: "GET", url: "https://api.example.com/users/2", responseBody: '{"id":2}' }),
        createNetworkCall({
          method: "POST",
          url: "https://api.example.com/users",
          requestBody: '{"name":"John"}',
          responseBody: '{"id":3,"name":"John"}',
        }),
        createNetworkCall({ method: "PUT", url: "https://api.example.com/users/1", requestBody: '{"name":"Jane"}' }),
        createNetworkCall({ method: "DELETE", url: "https://api.example.com/users/2" }),
        createNetworkCall({ method: "GET", url: "https://api.example.com/posts", responseBody: "[]" }),
        createNetworkCall({ method: "GET", url: "https://api.example.com/posts/10", responseBody: '{"id":10}' }),
        createNetworkCall({ method: "POST", url: "https://api.example.com/posts", requestBody: '{"title":"Test"}', responseBody: '{"id":11}' }),
        createNetworkCall({ method: "PATCH", url: "https://api.example.com/posts/10", requestBody: '{"title":"Updated"}' }),
      ];

      const routes = extract(calls);

      // 9 unique routes: GET /users, GET /users/:userId, POST /users, PUT /users/:userId,
      // DELETE /users/:userId, GET /posts, GET /posts/:postId, POST /posts, PATCH /posts/:postId
      expect(routes).toHaveLength(9);

      const getUsersRoute = routes.find((r) => r.method === "GET" && r.path === "/users");
      expect(getUsersRoute).toBeDefined();
      expect(getUsersRoute?.pattern).toBe("list");

      const getUserRoute = routes.find((r) => r.method === "GET" && r.path === "/users/:userId");
      expect(getUserRoute).toBeDefined();
      expect(getUserRoute?.pattern).toBe("get");

      const postUsersRoute = routes.find((r) => r.method === "POST" && r.path === "/users");
      expect(postUsersRoute).toBeDefined();
      expect(postUsersRoute?.pattern).toBe("create");

      const putUserRoute = routes.find((r) => r.method === "PUT" && r.path === "/users/:userId");
      expect(putUserRoute).toBeDefined();
      expect(putUserRoute?.pattern).toBe("update");

      const deleteUserRoute = routes.find((r) => r.method === "DELETE" && r.path === "/users/:userId");
      expect(deleteUserRoute).toBeDefined();
      expect(deleteUserRoute?.pattern).toBe("delete");

      const getPostsRoute = routes.find((r) => r.method === "GET" && r.path === "/posts");
      expect(getPostsRoute).toBeDefined();
      expect(getPostsRoute?.pattern).toBe("list");

      const getPostRoute = routes.find((r) => r.method === "GET" && r.path === "/posts/:postId");
      expect(getPostRoute).toBeDefined();
      expect(getPostRoute?.pattern).toBe("get");

      const postPostsRoute = routes.find((r) => r.method === "POST" && r.path === "/posts");
      expect(postPostsRoute).toBeDefined();

      const patchPostRoute = routes.find((r) => r.method === "PATCH" && r.path === "/posts/:postId");
      expect(patchPostRoute).toBeDefined();
      expect(patchPostRoute?.pattern).toBe("update");
    });
  });

  describe("CRUD pattern detection", () => {
    it("detects list pattern: GET + array response", () => {
      const calls: NetworkCall[] = [
        createNetworkCall({
          method: "GET",
          url: "https://api.example.com/users",
          responseBody: JSON.stringify([{ id: 1 }, { id: 2 }]),
        }),
      ];

      const routes = extract(calls);

      expect(routes).toHaveLength(1);
      expect(routes[0].pattern).toBe("list");
    });

    it("detects get pattern: GET + /:id + object response", () => {
      const calls: NetworkCall[] = [
        createNetworkCall({
          method: "GET",
          url: "https://api.example.com/users/123",
          responseBody: JSON.stringify({ id: 123, name: "John" }),
        }),
      ];

      const routes = extract(calls);

      expect(routes).toHaveLength(1);
      expect(routes[0].pattern).toBe("get");
    });

    it("detects create pattern: POST + object response with id", () => {
      const calls: NetworkCall[] = [
        createNetworkCall({
          method: "POST",
          url: "https://api.example.com/users",
          requestBody: JSON.stringify({ name: "John" }),
          responseBody: JSON.stringify({ id: 1, name: "John" }),
        }),
      ];

      const routes = extract(calls);

      expect(routes).toHaveLength(1);
      expect(routes[0].pattern).toBe("create");
    });

    it("detects update pattern: PUT + /:id", () => {
      const calls: NetworkCall[] = [
        createNetworkCall({
          method: "PUT",
          url: "https://api.example.com/users/123",
          requestBody: JSON.stringify({ name: "Jane" }),
          responseBody: JSON.stringify({ id: 123, name: "Jane" }),
        }),
      ];

      const routes = extract(calls);

      expect(routes).toHaveLength(1);
      expect(routes[0].pattern).toBe("update");
    });

    it("detects update pattern: PATCH + /:id", () => {
      const calls: NetworkCall[] = [
        createNetworkCall({
          method: "PATCH",
          url: "https://api.example.com/users/123",
          requestBody: JSON.stringify({ name: "Jane" }),
        }),
      ];

      const routes = extract(calls);

      expect(routes).toHaveLength(1);
      expect(routes[0].pattern).toBe("update");
    });

    it("detects delete pattern: DELETE + /:id", () => {
      const calls: NetworkCall[] = [
        createNetworkCall({
          method: "DELETE",
          url: "https://api.example.com/users/123",
          status: 204,
        }),
      ];

      const routes = extract(calls);

      expect(routes).toHaveLength(1);
      expect(routes[0].pattern).toBe("delete");
    });

    it("returns custom pattern for non-standard operations", () => {
      const calls: NetworkCall[] = [
        createNetworkCall({
          method: "POST",
          url: "https://api.example.com/users/login",
          requestBody: JSON.stringify({ email: "test@example.com", password: "secret" }),
          responseBody: JSON.stringify({ token: "abc123" }),
        }),
      ];

      const routes = extract(calls);

      expect(routes).toHaveLength(1);
      expect(routes[0].pattern).toBe("custom");
    });
  });

  describe("schema extraction", () => {
    it("extracts request JSON schema", () => {
      const calls: NetworkCall[] = [
        createNetworkCall({
          method: "POST",
          url: "https://api.example.com/users",
          requestBody: JSON.stringify({ name: "John", age: 30, active: true }),
          responseBody: JSON.stringify({ id: 1 }),
        }),
      ];

      const routes = extract(calls);

      expect(routes[0].requestSchema).toBeDefined();
      expect(routes[0].requestSchema?.type).toBe("object");
      const properties = routes[0].requestSchema?.properties as Record<string, { type: string }>;
      expect(properties.name.type).toBe("string");
      expect(properties.age.type).toBe("integer");
      expect(properties.active.type).toBe("boolean");
    });

    it("extracts response JSON schema", () => {
      const calls: NetworkCall[] = [
        createNetworkCall({
          method: "GET",
          url: "https://api.example.com/users",
          responseBody: JSON.stringify([
            { id: 1, name: "John", email: "john@example.com" },
          ]),
        }),
      ];

      const routes = extract(calls);

      expect(routes[0].responseSchema).toBeDefined();
      expect(routes[0].responseSchema?.type).toBe("array");
      const items = routes[0].responseSchema?.items as { type: string; properties: Record<string, { type: string }> };
      expect(items.type).toBe("object");
      expect(items.properties.id.type).toBe("integer");
      expect(items.properties.name.type).toBe("string");
    });

    it("handles missing request body", () => {
      const calls: NetworkCall[] = [
        createNetworkCall({
          method: "GET",
          url: "https://api.example.com/users/123",
          responseBody: JSON.stringify({ id: 123 }),
        }),
      ];

      const routes = extract(calls);

      expect(routes[0].requestSchema).toBeUndefined();
    });

    it("handles missing response body", () => {
      const calls: NetworkCall[] = [
        createNetworkCall({
          method: "DELETE",
          url: "https://api.example.com/users/123",
          status: 204,
        }),
      ];

      const routes = extract(calls);

      expect(routes[0].responseSchema).toBeUndefined();
    });

    it("merges schemas from multiple calls", () => {
      const calls: NetworkCall[] = [
        createNetworkCall({
          method: "POST",
          url: "https://api.example.com/users",
          requestBody: JSON.stringify({ name: "John" }),
          responseBody: JSON.stringify({ id: 1, name: "John" }),
        }),
        createNetworkCall({
          method: "POST",
          url: "https://api.example.com/users",
          requestBody: JSON.stringify({ name: "Jane", email: "jane@example.com" }),
          responseBody: JSON.stringify({ id: 2, name: "Jane", email: "jane@example.com" }),
        }),
      ];

      const routes = extract(calls);

      expect(routes).toHaveLength(1);
      expect(routes[0].requestSchema).toBeDefined();
    });
  });

  describe("example extraction", () => {
    it("extracts examples from calls", () => {
      const calls: NetworkCall[] = [
        createNetworkCall({
          method: "POST",
          url: "https://api.example.com/users",
          requestBody: JSON.stringify({ name: "John" }),
          responseBody: JSON.stringify({ id: 1, name: "John" }),
        }),
      ];

      const routes = extract(calls);

      expect(routes[0].examples).toHaveLength(1);
      expect(routes[0].examples[0].request).toEqual({ name: "John" });
      expect(routes[0].examples[0].response).toEqual({ id: 1, name: "John" });
    });

    it("limits examples to 3", () => {
      const calls: NetworkCall[] = [
        createNetworkCall({
          method: "GET",
          url: "https://api.example.com/users/1",
          responseBody: JSON.stringify({ id: 1 }),
        }),
        createNetworkCall({
          method: "GET",
          url: "https://api.example.com/users/2",
          responseBody: JSON.stringify({ id: 2 }),
        }),
        createNetworkCall({
          method: "GET",
          url: "https://api.example.com/users/3",
          responseBody: JSON.stringify({ id: 3 }),
        }),
        createNetworkCall({
          method: "GET",
          url: "https://api.example.com/users/4",
          responseBody: JSON.stringify({ id: 4 }),
        }),
        createNetworkCall({
          method: "GET",
          url: "https://api.example.com/users/5",
          responseBody: JSON.stringify({ id: 5 }),
        }),
      ];

      const routes = extract(calls);

      expect(routes[0].examples.length).toBeLessThanOrEqual(3);
    });

    it("deduplicates identical responses", () => {
      const calls: NetworkCall[] = [
        createNetworkCall({
          method: "GET",
          url: "https://api.example.com/users/1",
          responseBody: JSON.stringify({ id: 1, status: "active" }),
        }),
        createNetworkCall({
          method: "GET",
          url: "https://api.example.com/users/1",
          responseBody: JSON.stringify({ id: 1, status: "active" }),
        }),
      ];

      const routes = extract(calls);

      expect(routes[0].examples).toHaveLength(1);
    });
  });

  describe("edge cases", () => {
    it("handles empty calls array", () => {
      const routes = extract([]);
      expect(routes).toEqual([]);
    });

    it("handles calls with invalid JSON bodies", () => {
      const calls: NetworkCall[] = [
        createNetworkCall({
          method: "GET",
          url: "https://api.example.com/users",
          responseBody: "not valid json",
        }),
      ];

      const routes = extract(calls);

      expect(routes).toHaveLength(1);
      expect(routes[0].responseSchema).toBeUndefined();
      expect(routes[0].examples).toHaveLength(0);
    });

    it("handles nested resource paths", () => {
      const calls: NetworkCall[] = [
        createNetworkCall({
          method: "GET",
          url: "https://api.example.com/users/123/posts/456",
          responseBody: JSON.stringify({ id: 456, userId: 123 }),
        }),
      ];

      const routes = extract(calls);

      expect(routes).toHaveLength(1);
      expect(routes[0].path).toBe("/users/:userId/posts/:postId");
    });

    it("handles different response types for same route pattern", () => {
      const calls: NetworkCall[] = [
        createNetworkCall({
          method: "GET",
          url: "https://api.example.com/data",
          responseBody: JSON.stringify({ type: "a", value: 1 }),
        }),
        createNetworkCall({
          method: "GET",
          url: "https://api.example.com/data",
          responseBody: JSON.stringify({ type: "b", extra: "field" }),
        }),
      ];

      const routes = extract(calls);

      expect(routes).toHaveLength(1);
    });

    it("handles MongoDB _id field for create detection", () => {
      const calls: NetworkCall[] = [
        createNetworkCall({
          method: "POST",
          url: "https://api.example.com/users",
          requestBody: JSON.stringify({ name: "John" }),
          responseBody: JSON.stringify({ _id: "507f1f77bcf86cd799439011", name: "John" }),
        }),
      ];

      const routes = extract(calls);

      expect(routes[0].pattern).toBe("create");
    });

    it("handles uuid field for create detection", () => {
      const calls: NetworkCall[] = [
        createNetworkCall({
          method: "POST",
          url: "https://api.example.com/users",
          requestBody: JSON.stringify({ name: "John" }),
          responseBody: JSON.stringify({ uuid: "550e8400-e29b-41d4-a716-446655440000", name: "John" }),
        }),
      ];

      const routes = extract(calls);

      expect(routes[0].pattern).toBe("create");
    });
  });
});
