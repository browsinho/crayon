/**
 * Backend Generator - Generates mock API server from extracted routes
 *
 * Generates Express server with:
 * - All extracted routes
 * - Recorded response structure
 * - SQLite for data storage
 * - CRUD operations on entities
 */

import type { APIRoute, DataSchema } from "@crayon/types";

export interface GeneratedBackendFile {
  path: string;
  content: string;
}

export interface GeneratedBackend {
  files: GeneratedBackendFile[];
  routes: string[];
  entities: string[];
}

interface EntityRoutes {
  entity: string;
  routes: APIRoute[];
}

/**
 * Extract entity name from route path
 * e.g., /api/users/:userId -> users
 *       /api/products/:productId/reviews -> products
 */
function extractEntityFromPath(path: string): string | null {
  const segments = path.split("/").filter(Boolean);

  for (let i = 0; i < segments.length; i++) {
    const segment = segments[i];
    // Skip api prefix
    if (segment === "api" || segment === "v1" || segment === "v2") continue;
    // Skip parameter segments
    if (segment.startsWith(":")) continue;
    // Return the first meaningful segment (entity name)
    return segment;
  }

  return null;
}

/**
 * Group routes by entity
 */
function groupRoutesByEntity(routes: APIRoute[]): EntityRoutes[] {
  const entityMap = new Map<string, APIRoute[]>();

  for (const route of routes) {
    const entity = extractEntityFromPath(route.path);
    if (!entity) continue;

    if (!entityMap.has(entity)) {
      entityMap.set(entity, []);
    }
    entityMap.get(entity)!.push(route);
  }

  return Array.from(entityMap.entries()).map(([entity, routes]) => ({
    entity,
    routes,
  }));
}

/**
 * Convert entity name to singular form
 */
function toSingular(name: string): string {
  if (name.endsWith("ies")) {
    return name.slice(0, -3) + "y";
  }
  if (name.endsWith("es") && !name.endsWith("ses") && !name.endsWith("xes")) {
    return name.slice(0, -2);
  }
  if (name.endsWith("s") && !name.endsWith("ss")) {
    return name.slice(0, -1);
  }
  return name;
}

/**
 * Convert string to PascalCase
 */
function toPascalCase(str: string): string {
  return str
    .split(/[-_]/)
    .map(part => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join("");
}

/**
 * Generate entity interface from schema
 */
function generateEntityInterface(entity: string, schema: DataSchema | undefined): string {
  const pascalEntity = toPascalCase(toSingular(entity));

  if (!schema || schema.fields.length === 0) {
    return `export interface ${pascalEntity} {
  id: string;
  [key: string]: unknown;
}`;
  }

  const fields = schema.fields.map(field => {
    let tsType: string;
    switch (field.type) {
      case "string":
        tsType = "string";
        break;
      case "number":
        tsType = "number";
        break;
      case "boolean":
        tsType = "boolean";
        break;
      case "date":
        tsType = "string";
        break;
      case "array":
        tsType = "unknown[]";
        break;
      case "object":
        tsType = "Record<string, unknown>";
        break;
      default:
        tsType = "unknown";
    }

    const optional = field.nullable ? "?" : "";
    return `  ${field.name}${optional}: ${tsType};`;
  });

  // Ensure id field exists
  const hasId = schema.fields.some(f => f.name === "id");
  if (!hasId) {
    fields.unshift("  id: string;");
  }

  return `export interface ${pascalEntity} {
${fields.join("\n")}
}`;
}

/**
 * Generate Express route handler for a route
 */
function generateRouteHandler(route: APIRoute, entity: string): string {
  const singularEntity = toSingular(entity);
  const method = route.method.toLowerCase();
  const path = route.path.replace(/^\/api/, "");

  // Get example response if available
  const exampleResponse = route.examples[0]?.response;
  const exampleResponseStr = exampleResponse
    ? JSON.stringify(exampleResponse, null, 2).replace(/\n/g, "\n    ")
    : "{}";

  switch (route.pattern) {
    case "list":
      return `router.${method}("${path}", (req, res) => {
  const items = db.getAll("${entity}");
  res.json(items);
});`;

    case "get":
      return `router.${method}("${path}", (req, res) => {
  const id = req.params.${singularEntity}Id ?? req.params.id;
  const item = db.get("${entity}", id);
  if (!item) {
    return res.status(404).json({ error: "Not found" });
  }
  res.json(item);
});`;

    case "create":
      return `router.${method}("${path}", (req, res) => {
  const id = crypto.randomUUID();
  const item = { id, ...req.body };
  db.insert("${entity}", item);
  res.status(201).json(item);
});`;

    case "update":
      return `router.${method}("${path}", (req, res) => {
  const id = req.params.${singularEntity}Id ?? req.params.id;
  const existing = db.get("${entity}", id);
  if (!existing) {
    return res.status(404).json({ error: "Not found" });
  }
  const updated = { ...existing, ...req.body, id };
  db.update("${entity}", id, updated);
  res.json(updated);
});`;

    case "delete":
      return `router.${method}("${path}", (req, res) => {
  const id = req.params.${singularEntity}Id ?? req.params.id;
  const existing = db.get("${entity}", id);
  if (!existing) {
    return res.status(404).json({ error: "Not found" });
  }
  db.delete("${entity}", id);
  res.status(204).send();
});`;

    case "custom":
    default:
      return `router.${method}("${path}", (req, res) => {
  // Custom route - returning recorded response structure
  res.json(${exampleResponseStr});
});`;
  }
}

/**
 * Generate entity router file
 */
function generateEntityRouter(entityRoutes: EntityRoutes): string {
  const { entity, routes } = entityRoutes;

  const handlers = routes.map(route => generateRouteHandler(route, entity)).join("\n\n");

  return `import { Router } from "express";
import crypto from "crypto";
import { db } from "../db.js";

export const router = Router();

${handlers}
`;
}

/**
 * Generate db.ts file
 */
function generateDbFile(): string {
  return `import Database from "better-sqlite3";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath = path.join(__dirname, "..", "data.sqlite");

const sqlite = new Database(dbPath);

// Enable WAL mode for better concurrency
sqlite.pragma("journal_mode = WAL");

// Create tables on first run
const initTable = (tableName: string) => {
  sqlite.exec(\`
    CREATE TABLE IF NOT EXISTS \${tableName} (
      id TEXT PRIMARY KEY,
      data TEXT NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  \`);
};

export const db = {
  ensureTable(tableName: string) {
    initTable(tableName);
  },

  getAll<T>(tableName: string): T[] {
    this.ensureTable(tableName);
    const stmt = sqlite.prepare(\`SELECT data FROM \${tableName}\`);
    const rows = stmt.all() as { data: string }[];
    return rows.map(row => JSON.parse(row.data) as T);
  },

  get<T>(tableName: string, id: string): T | undefined {
    this.ensureTable(tableName);
    const stmt = sqlite.prepare(\`SELECT data FROM \${tableName} WHERE id = ?\`);
    const row = stmt.get(id) as { data: string } | undefined;
    return row ? (JSON.parse(row.data) as T) : undefined;
  },

  insert<T extends { id: string }>(tableName: string, item: T): void {
    this.ensureTable(tableName);
    const stmt = sqlite.prepare(\`
      INSERT INTO \${tableName} (id, data) VALUES (?, ?)
    \`);
    stmt.run(item.id, JSON.stringify(item));
  },

  update<T extends { id: string }>(tableName: string, id: string, item: T): void {
    this.ensureTable(tableName);
    const stmt = sqlite.prepare(\`
      UPDATE \${tableName} SET data = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?
    \`);
    stmt.run(JSON.stringify(item), id);
  },

  delete(tableName: string, id: string): void {
    this.ensureTable(tableName);
    const stmt = sqlite.prepare(\`DELETE FROM \${tableName} WHERE id = ?\`);
    stmt.run(id);
  },

  seed<T extends { id: string }>(tableName: string, items: T[]): void {
    this.ensureTable(tableName);
    const existing = this.getAll(tableName);
    if (existing.length > 0) return;

    for (const item of items) {
      this.insert(tableName, item);
    }
  },
};
`;
}

/**
 * Generate server.ts file
 */
function generateServerFile(entities: string[]): string {
  const imports = entities
    .map(entity => `import { router as ${entity}Router } from "./routes/${entity}.js";`)
    .join("\n");

  const routeMounts = entities
    .map(entity => `app.use("/api", ${entity}Router);`)
    .join("\n");

  return `import express from "express";
import cors from "cors";
${imports}

const app = express();
const PORT = process.env.PORT ?? 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Routes
${routeMounts}

// Health check
app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

// Error handler
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error(err.stack);
  res.status(500).json({ error: "Internal server error" });
});

app.listen(PORT, () => {
  console.log(\`Server running on http://localhost:\${PORT}\`);
});

export { app };
`;
}

/**
 * Generate package.json
 */
function generatePackageJson(): string {
  return JSON.stringify(
    {
      name: "generated-backend",
      version: "1.0.0",
      type: "module",
      scripts: {
        start: "tsx src/server.ts",
        dev: "tsx watch src/server.ts",
        build: "tsc",
      },
      dependencies: {
        "better-sqlite3": "^9.4.3",
        cors: "^2.8.5",
        express: "^4.18.2",
      },
      devDependencies: {
        "@types/better-sqlite3": "^7.6.9",
        "@types/cors": "^2.8.17",
        "@types/express": "^4.17.21",
        "@types/node": "^20.11.5",
        tsx: "^4.7.0",
        typescript: "^5.3.3",
      },
    },
    null,
    2
  );
}

/**
 * Generate tsconfig.json
 */
function generateTsConfig(): string {
  return JSON.stringify(
    {
      compilerOptions: {
        target: "ES2022",
        module: "ESNext",
        moduleResolution: "bundler",
        esModuleInterop: true,
        strict: true,
        skipLibCheck: true,
        outDir: "./dist",
        rootDir: "./src",
      },
      include: ["src/**/*"],
    },
    null,
    2
  );
}

/**
 * Extract seed data from route examples
 */
function extractSeedData(routes: APIRoute[]): unknown[] {
  const seedItems: unknown[] = [];
  const seenIds = new Set<string>();

  for (const route of routes) {
    if (route.pattern === "list") {
      for (const example of route.examples) {
        const response = example.response;
        if (Array.isArray(response)) {
          for (const item of response) {
            if (typeof item === "object" && item !== null) {
              const id = (item as Record<string, unknown>).id ??
                         (item as Record<string, unknown>)._id;
              if (id && !seenIds.has(String(id))) {
                seenIds.add(String(id));
                seedItems.push({ ...item as object, id: String(id) });
              }
            }
          }
        }
      }
    } else if (route.pattern === "get" || route.pattern === "create") {
      for (const example of route.examples) {
        const response = example.response;
        if (typeof response === "object" && response !== null && !Array.isArray(response)) {
          const id = (response as Record<string, unknown>).id ??
                     (response as Record<string, unknown>)._id;
          if (id && !seenIds.has(String(id))) {
            seenIds.add(String(id));
            seedItems.push({ ...response as object, id: String(id) });
          }
        }
      }
    }
  }

  return seedItems;
}

/**
 * Generate seed.ts file
 */
function generateSeedFile(entityRoutes: EntityRoutes[]): string {
  const seedDataBlocks: string[] = [];

  for (const { entity, routes } of entityRoutes) {
    const seedData = extractSeedData(routes);
    if (seedData.length > 0) {
      const dataStr = JSON.stringify(seedData, null, 2);
      seedDataBlocks.push(`db.seed("${entity}", ${dataStr});`);
    }
  }

  if (seedDataBlocks.length === 0) {
    return `import { db } from "./db.js";

// No seed data available from recorded responses
console.log("No seed data to insert");
`;
  }

  return `import { db } from "./db.js";

// Seed data extracted from recorded API responses
${seedDataBlocks.join("\n\n")}

console.log("Seed data inserted successfully");
`;
}

/**
 * Generate backend from API routes and schemas
 */
export async function generate(
  routes: APIRoute[],
  schemas: DataSchema[]
): Promise<GeneratedBackend> {
  const files: GeneratedBackendFile[] = [];
  const entityRouteGroups = groupRoutesByEntity(routes);
  const entities = entityRouteGroups.map(e => e.entity);

  // Create schema lookup
  const schemaMap = new Map<string, DataSchema>();
  for (const schema of schemas) {
    schemaMap.set(schema.entity.toLowerCase(), schema);
  }

  // Generate package.json
  files.push({
    path: "package.json",
    content: generatePackageJson(),
  });

  // Generate tsconfig.json
  files.push({
    path: "tsconfig.json",
    content: generateTsConfig(),
  });

  // Generate db.ts
  files.push({
    path: "src/db.ts",
    content: generateDbFile(),
  });

  // Generate server.ts
  files.push({
    path: "src/server.ts",
    content: generateServerFile(entities),
  });

  // Generate route files for each entity
  for (const entityRoute of entityRouteGroups) {
    const routerContent = generateEntityRouter(entityRoute);
    files.push({
      path: `src/routes/${entityRoute.entity}.ts`,
      content: routerContent,
    });
  }

  // Generate types file
  const typeDefinitions = entities.map(entity => {
    const schema = schemaMap.get(entity.toLowerCase()) ?? schemaMap.get(toSingular(entity).toLowerCase());
    return generateEntityInterface(entity, schema);
  });

  files.push({
    path: "src/types.ts",
    content: typeDefinitions.join("\n\n") + "\n",
  });

  // Generate seed file
  files.push({
    path: "src/seed.ts",
    content: generateSeedFile(entityRouteGroups),
  });

  // Collect all route paths
  const routePaths = routes.map(r => `${r.method} ${r.path}`);

  return {
    files,
    routes: routePaths,
    entities,
  };
}
