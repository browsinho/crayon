import type { APIRoute, APIRoutePattern, NetworkCall } from "@crayon/types";

interface RouteGroup {
  method: string;
  pathPattern: string;
  calls: NetworkCall[];
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const NUMERIC_ID_REGEX = /^\d+$/;
const MONGO_ID_REGEX = /^[0-9a-f]{24}$/i;
const SLUG_WITH_ID_REGEX = /^[a-z0-9-]+-\d+$/i;

const isDynamicSegment = (segment: string): boolean => {
  if (NUMERIC_ID_REGEX.test(segment)) return true;
  if (UUID_REGEX.test(segment)) return true;
  if (MONGO_ID_REGEX.test(segment)) return true;
  if (SLUG_WITH_ID_REGEX.test(segment)) return true;
  return false;
};

export const parameterizePath = (urlPath: string): string => {
  const segments = urlPath.split("/");
  const parameterized = segments.map((segment, index) => {
    if (!segment) return segment;
    if (!isDynamicSegment(segment)) return segment;

    const prevSegment = segments[index - 1];
    if (prevSegment) {
      const singular = prevSegment.endsWith("s")
        ? prevSegment.slice(0, -1)
        : prevSegment;
      return `:${singular}Id`;
    }
    return ":id";
  });
  return parameterized.join("/");
};

const extractPath = (url: string): string => {
  try {
    const parsed = new URL(url);
    return parsed.pathname;
  } catch {
    return url.startsWith("/") ? url.split("?")[0] : `/${url.split("?")[0]}`;
  }
};

const hasIdSegment = (path: string): boolean => {
  return path.includes(":") && path.includes("Id");
};

const parseJsonSafely = (body: string | undefined): unknown => {
  if (!body) return undefined;
  try {
    return JSON.parse(body);
  } catch {
    return undefined;
  }
};

const isArray = (value: unknown): value is unknown[] => {
  return Array.isArray(value);
};

const isObject = (value: unknown): value is Record<string, unknown> => {
  return typeof value === "object" && value !== null && !Array.isArray(value);
};

const hasIdField = (obj: unknown): boolean => {
  if (!isObject(obj)) return false;
  return "id" in obj || "_id" in obj || "uuid" in obj;
};

const detectPattern = (
  method: string,
  path: string,
  calls: NetworkCall[]
): APIRoutePattern => {
  const upperMethod = method.toUpperCase();
  const hasId = hasIdSegment(path);

  if (upperMethod === "GET") {
    if (hasId) {
      return "get";
    }
    for (const call of calls) {
      const responseBody = parseJsonSafely(call.response.body);
      if (isArray(responseBody)) {
        return "list";
      }
    }
    return "custom";
  }

  if (upperMethod === "POST") {
    for (const call of calls) {
      const responseBody = parseJsonSafely(call.response.body);
      if (isObject(responseBody) && hasIdField(responseBody)) {
        return "create";
      }
    }
    return "custom";
  }

  if (upperMethod === "PUT" || upperMethod === "PATCH") {
    if (hasId) {
      return "update";
    }
    return "custom";
  }

  if (upperMethod === "DELETE") {
    if (hasId) {
      return "delete";
    }
    return "custom";
  }

  return "custom";
};

const inferJsonSchema = (value: unknown): Record<string, unknown> => {
  if (value === null) {
    return { type: "null" };
  }

  if (typeof value === "string") {
    return { type: "string" };
  }

  if (typeof value === "number") {
    return Number.isInteger(value) ? { type: "integer" } : { type: "number" };
  }

  if (typeof value === "boolean") {
    return { type: "boolean" };
  }

  if (isArray(value)) {
    if (value.length === 0) {
      return { type: "array", items: {} };
    }
    return {
      type: "array",
      items: inferJsonSchema(value[0]),
    };
  }

  if (isObject(value)) {
    const properties: Record<string, unknown> = {};
    const required: string[] = [];

    for (const [key, val] of Object.entries(value)) {
      properties[key] = inferJsonSchema(val);
      if (val !== null && val !== undefined) {
        required.push(key);
      }
    }

    return {
      type: "object",
      properties,
      required: required.length > 0 ? required : undefined,
    };
  }

  return {};
};

const mergeSchemas = (
  schemas: Record<string, unknown>[]
): Record<string, unknown> | undefined => {
  if (schemas.length === 0) return undefined;
  if (schemas.length === 1) return schemas[0];

  const firstSchema = schemas[0];
  if (firstSchema.type !== "object") return firstSchema;

  const mergedProperties: Record<string, unknown> = {};
  const allKeys = new Set<string>();
  const requiredCounts = new Map<string, number>();

  for (const schema of schemas) {
    if (schema.type !== "object") continue;
    const props = schema.properties as Record<string, unknown> | undefined;
    if (!props) continue;

    for (const key of Object.keys(props)) {
      allKeys.add(key);
      if (!mergedProperties[key]) {
        mergedProperties[key] = props[key];
      }
    }

    const required = schema.required as string[] | undefined;
    if (required) {
      for (const key of required) {
        requiredCounts.set(key, (requiredCounts.get(key) || 0) + 1);
      }
    }
  }

  const required = Array.from(requiredCounts.entries())
    .filter(([, count]) => count === schemas.length)
    .map(([key]) => key);

  return {
    type: "object",
    properties: mergedProperties,
    required: required.length > 0 ? required : undefined,
  };
};

const extractSchemas = (
  calls: NetworkCall[]
): {
  requestSchema?: Record<string, unknown>;
  responseSchema?: Record<string, unknown>;
} => {
  const requestSchemas: Record<string, unknown>[] = [];
  const responseSchemas: Record<string, unknown>[] = [];

  for (const call of calls) {
    const requestBody = parseJsonSafely(call.request.body);
    if (requestBody !== undefined) {
      requestSchemas.push(inferJsonSchema(requestBody));
    }

    const responseBody = parseJsonSafely(call.response.body);
    if (responseBody !== undefined) {
      responseSchemas.push(inferJsonSchema(responseBody));
    }
  }

  return {
    requestSchema: mergeSchemas(requestSchemas),
    responseSchema: mergeSchemas(responseSchemas),
  };
};

const extractExamples = (
  calls: NetworkCall[]
): { request?: unknown; response: unknown }[] => {
  const examples: { request?: unknown; response: unknown }[] = [];
  const seenResponses = new Set<string>();

  for (const call of calls) {
    const responseBody = parseJsonSafely(call.response.body);
    if (responseBody === undefined) continue;

    const responseKey = JSON.stringify(responseBody);
    if (seenResponses.has(responseKey)) continue;
    seenResponses.add(responseKey);

    const requestBody = parseJsonSafely(call.request.body);
    examples.push({
      request: requestBody,
      response: responseBody,
    });

    if (examples.length >= 3) break;
  }

  return examples;
};

const groupCalls = (calls: NetworkCall[]): RouteGroup[] => {
  const groups = new Map<string, RouteGroup>();

  for (const call of calls) {
    const path = extractPath(call.request.url);
    const pathPattern = parameterizePath(path);
    const method = call.request.method.toUpperCase();
    const key = `${method}:${pathPattern}`;

    if (!groups.has(key)) {
      groups.set(key, {
        method,
        pathPattern,
        calls: [],
      });
    }

    groups.get(key)!.calls.push(call);
  }

  return Array.from(groups.values());
};

export const extract = (calls: NetworkCall[]): APIRoute[] => {
  const groups = groupCalls(calls);
  const routes: APIRoute[] = [];

  for (const group of groups) {
    const pattern = detectPattern(group.method, group.pathPattern, group.calls);
    const schemas = extractSchemas(group.calls);
    const examples = extractExamples(group.calls);

    routes.push({
      method: group.method,
      path: group.pathPattern,
      pattern,
      requestSchema: schemas.requestSchema,
      responseSchema: schemas.responseSchema,
      examples,
    });
  }

  return routes;
};
