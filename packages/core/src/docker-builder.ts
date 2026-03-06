/**
 * Docker Builder - Packages generated sandbox into Docker container
 *
 * Creates Dockerfile and docker-compose.yml for running the sandbox.
 * Frontend and backend run in a single container exposing ports 3000 and 3001.
 */

import Docker from "dockerode";
import { z } from "zod";
import path from "path";
import fs from "fs/promises";
import fsSync from "fs";
import { Readable } from "stream";
import { pack as tarPack } from "tar-stream";
import { validateRelativeImports } from "./lovable-adapter.js";

export const DockerConfigSchema = z.object({
  sandboxId: z.string().min(1),
  frontendDir: z.string().min(1),
  backendDir: z.string().min(1),
  assetsDir: z.string().min(1),
});

export type DockerConfig = z.infer<typeof DockerConfigSchema>;

export interface BuildResult {
  imageId: string;
  imageName: string;
}

export interface ContainerInfo {
  containerId: string;
  containerName: string;
  ports: {
    frontend: number;
    backend: number;
  };
}

/**
 * Generate Dockerfile content for the sandbox
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function generateDockerfile(config: DockerConfig): string {
  return `FROM node:20-alpine
WORKDIR /app

# Copy frontend and backend
COPY frontend/ ./frontend/
COPY backend/ ./backend/

# Install frontend dependencies and build
RUN cd frontend && npm install --include=dev && npm run build

# Install backend dependencies (include dev for tsx)
RUN cd backend && npm install --include=dev

# Create start script
# Backend runs with tsx, frontend serves built files with serve
RUN npm install -g serve && \\
    echo '#!/bin/sh' > /app/start.sh && \\
    echo 'cd /app/backend && npm start &' >> /app/start.sh && \\
    echo 'cd /app/frontend && serve -s dist -l 3000' >> /app/start.sh && \\
    chmod +x /app/start.sh

# Expose ports
EXPOSE 3000 3001

# Start both services
CMD ["/bin/sh", "/app/start.sh"]
`;
}

/**
 * Generate docker-compose.yml content
 */
export function generateCompose(config: DockerConfig): string {
  const imageName = `crayon-sandbox-${config.sandboxId}`;

  return `version: '3.8'

services:
  sandbox:
    image: ${imageName}
    container_name: ${imageName}
    ports:
      - "3000:3000"
      - "3001:3001"
    environment:
      - NODE_ENV=production
    restart: unless-stopped
`;
}

/**
 * Create a tar archive stream from the sandbox directories
 */
async function createTarStream(config: DockerConfig): Promise<Readable> {
  const pack = tarPack();
  let fileCount = 0;

  const addDirectory = async (srcDir: string, destPrefix: string) => {
    try {
      const entries = await fs.readdir(srcDir, { withFileTypes: true });
      console.log(`[DockerBuilder] Reading ${entries.length} entries from ${srcDir}`);

      for (const entry of entries) {
        const srcPath = path.join(srcDir, entry.name);
        const destPath = path.join(destPrefix, entry.name);

        if (entry.isDirectory()) {
          await addDirectory(srcPath, destPath);
        } else if (entry.isFile()) {
          const content = await fs.readFile(srcPath);
          pack.entry({ name: destPath }, content);
          fileCount++;
          console.log(`[DockerBuilder] Added to tar: ${destPath} (${content.length} bytes)`);
        }
      }
    } catch (error) {
      // Directory doesn't exist or is empty, log it
      console.log(`[DockerBuilder] Could not read directory ${srcDir}:`, error instanceof Error ? error.message : error);
    }
  };

  // Add Dockerfile
  const dockerfile = generateDockerfile(config);
  pack.entry({ name: "Dockerfile" }, dockerfile);
  console.log("[DockerBuilder] Added Dockerfile to tar");

  // Add directories
  console.log("[DockerBuilder] Adding frontend files from:", config.frontendDir);
  await addDirectory(config.frontendDir, "frontend");

  console.log("[DockerBuilder] Adding backend files from:", config.backendDir);
  await addDirectory(config.backendDir, "backend");

  // Assets directory is optional - only add if it has files
  if (config.assetsDir) {
    console.log("[DockerBuilder] Adding assets files from:", config.assetsDir);
    await addDirectory(config.assetsDir, "assets");
  }

  pack.finalize();
  console.log(`[DockerBuilder] Tar stream finalized with ${fileCount} files`);

  return pack;
}

/**
 * Build Docker image from the sandbox
 */
export async function build(config: DockerConfig): Promise<string> {
  const validatedConfig = DockerConfigSchema.parse(config);
  const docker = new Docker();

  const imageName = `crayon-sandbox-${validatedConfig.sandboxId}`;

  console.log("[DockerBuilder] Starting build for image:", imageName);
  console.log("[DockerBuilder] Frontend dir:", validatedConfig.frontendDir);
  console.log("[DockerBuilder] Backend dir:", validatedConfig.backendDir);
  console.log("[DockerBuilder] Assets dir:", validatedConfig.assetsDir);

  // Create tar stream of the build context
  const tarStream = await createTarStream(validatedConfig);
  console.log("[DockerBuilder] Tar stream created");

  // Build the image
  const buildStream = await docker.buildImage(tarStream as NodeJS.ReadableStream, {
    t: imageName,
  });
  console.log("[DockerBuilder] Build stream started");

  // Wait for build to complete and capture output
  await new Promise<void>((resolve, reject) => {
    docker.modem.followProgress(
      buildStream,
      (err: Error | null, output: Array<{ stream?: string; error?: string; errorDetail?: { message: string } }>) => {
        if (err) {
          console.error("[DockerBuilder] Build error:", err);
          reject(err);
          return;
        }

        // Check for build errors in output
        const errors = output?.filter(item => item.error || item.errorDetail);
        if (errors && errors.length > 0) {
          const errorMsg = errors.map(e => e.error || e.errorDetail?.message).join("; ");
          console.error("[DockerBuilder] Build failed with errors:", errorMsg);
          reject(new Error(`Docker build failed: ${errorMsg}`));
          return;
        }

        console.log("[DockerBuilder] Build completed successfully");
        resolve();
      },
      (event: { stream?: string; status?: string; error?: string }) => {
        // Log progress events
        if (event.stream) {
          const line = event.stream.trim();
          if (line) {
            console.log("[DockerBuilder]", line);
          }
        }
        if (event.error) {
          console.error("[DockerBuilder] Error:", event.error);
        }
      }
    );
  });

  // Get the image ID
  const image = docker.getImage(imageName);
  const imageInfo = await image.inspect();

  console.log("[DockerBuilder] Image created with ID:", imageInfo.Id);
  return imageInfo.Id;
}

/**
 * Start a container from the built image
 */
export async function startContainer(
  sandboxId: string,
  frontendPort = 3000,
  backendPort = 3001
): Promise<ContainerInfo> {
  const docker = new Docker();
  const imageName = `crayon-sandbox-${sandboxId}`;
  const containerName = `crayon-sandbox-${sandboxId}`;

  // Check if container already exists and remove it
  try {
    const existing = docker.getContainer(containerName);
    const info = await existing.inspect();
    if (info.State.Running) {
      await existing.stop();
    }
    await existing.remove();
  } catch {
    // Container doesn't exist, continue
  }

  // Create the container
  const container = await docker.createContainer({
    Image: imageName,
    name: containerName,
    ExposedPorts: {
      "3000/tcp": {},
      "3001/tcp": {},
    },
    HostConfig: {
      PortBindings: {
        "3000/tcp": [{ HostPort: String(frontendPort) }],
        "3001/tcp": [{ HostPort: String(backendPort) }],
      },
    },
  });

  // Start the container
  await container.start();

  return {
    containerId: container.id,
    containerName,
    ports: {
      frontend: frontendPort,
      backend: backendPort,
    },
  };
}

/**
 * Stop a running container
 */
export async function stopContainer(sandboxId: string): Promise<void> {
  const docker = new Docker();
  const containerName = `crayon-sandbox-${sandboxId}`;

  const container = docker.getContainer(containerName);
  await container.stop();
}

/**
 * Remove a container
 */
export async function removeContainer(sandboxId: string): Promise<void> {
  const docker = new Docker();
  const containerName = `crayon-sandbox-${sandboxId}`;

  const container = docker.getContainer(containerName);

  // Try to stop first if running
  try {
    await container.stop();
  } catch {
    // Container might not be running
  }

  await container.remove();
}

/**
 * Check if Docker daemon is available
 */
export async function isDockerAvailable(): Promise<boolean> {
  try {
    const docker = new Docker();
    await docker.ping();
    return true;
  } catch {
    return false;
  }
}

/**
 * Get container status
 */
export async function getContainerStatus(
  sandboxId: string
): Promise<"running" | "stopped" | "not_found"> {
  const docker = new Docker();
  const containerName = `crayon-sandbox-${sandboxId}`;

  try {
    const container = docker.getContainer(containerName);
    const info = await container.inspect();
    return info.State.Running ? "running" : "stopped";
  } catch {
    return "not_found";
  }
}

/**
 * Generate Dockerfile content for frontend-only Vite/React projects
 */
export function generateFrontendOnlyDockerfile(): string {
  return `FROM node:20-alpine
WORKDIR /app

# Copy all files
COPY . .

# Install dependencies and build
RUN npm install --include=dev && npm run build

# Install serve for production
RUN npm install -g serve

# Expose port
EXPOSE 3000

# Serve the built files
CMD ["serve", "-s", "dist", "-l", "3000"]
`;
}

/**
 * Create a tar archive stream from a single directory for frontend-only builds
 */
async function createFrontendOnlyTarStream(projectDir: string): Promise<Readable> {
  const pack = tarPack();
  let fileCount = 0;

  const addDirectory = async (srcDir: string, destPrefix: string) => {
    try {
      const entries = await fs.readdir(srcDir, { withFileTypes: true });
      console.log(`[DockerBuilder] Reading ${entries.length} entries from ${srcDir}`);

      for (const entry of entries) {
        // Skip node_modules and dist directories
        if (entry.name === "node_modules" || entry.name === "dist") {
          console.log(`[DockerBuilder] Skipping directory: ${entry.name}`);
          continue;
        }

        const srcPath = path.join(srcDir, entry.name);
        const destPath = destPrefix ? path.join(destPrefix, entry.name) : entry.name;

        if (entry.isDirectory()) {
          await addDirectory(srcPath, destPath);
        } else if (entry.isFile()) {
          const content = await fs.readFile(srcPath);
          pack.entry({ name: destPath }, content);
          fileCount++;
          console.log(`[DockerBuilder] Added to tar: ${destPath} (${content.length} bytes)`);
        }
      }
    } catch (error) {
      console.log(`[DockerBuilder] Could not read directory ${srcDir}:`, error instanceof Error ? error.message : error);
    }
  };

  // Add Dockerfile
  const dockerfile = generateFrontendOnlyDockerfile();
  pack.entry({ name: "Dockerfile" }, dockerfile);
  console.log("[DockerBuilder] Added Dockerfile to tar");

  // Add all project files
  console.log("[DockerBuilder] Adding project files from:", projectDir);
  await addDirectory(projectDir, "");

  pack.finalize();
  console.log(`[DockerBuilder] Tar stream finalized with ${fileCount} files`);

  return pack;
}

/**
 * Read source files from project directory for validation
 */
function readSourceFilesForValidation(
  projectDir: string
): Array<{ path: string; content: string }> {
  const files: Array<{ path: string; content: string }> = [];
  const srcDir = path.join(projectDir, "src");

  if (!fsSync.existsSync(srcDir)) {
    return files;
  }

  const readDir = (dir: string, basePath: string = "src") => {
    const entries = fsSync.readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      const relativePath = path.join(basePath, entry.name);

      if (entry.isDirectory()) {
        readDir(fullPath, relativePath);
      } else if (/\.(tsx?|jsx?|css)$/.test(entry.name)) {
        const content = fsSync.readFileSync(fullPath, "utf-8");
        files.push({ path: relativePath, content });
      }
    }
  };

  readDir(srcDir);
  return files;
}

/**
 * Build Docker image from a frontend-only Vite/React project
 */
export async function buildFrontendOnly(sandboxId: string, projectDir: string): Promise<string> {
  const docker = new Docker();
  const imageName = `crayon-sandbox-${sandboxId}`;

  console.log("[DockerBuilder] Starting frontend-only build for image:", imageName);
  console.log("[DockerBuilder] Project dir:", projectDir);

  // Pre-build validation: Check for unresolved imports before attempting Docker build
  const files = readSourceFilesForValidation(projectDir);
  const importErrors = validateRelativeImports(files);

  if (importErrors.length > 0) {
    const errorDetails = importErrors.join("\n  - ");
    throw new Error(
      `Cannot build sandbox: Unresolved imports detected. ` +
      `This usually means the code generation was incomplete.\n  - ${errorDetails}`
    );
  }

  // Create tar stream of the build context
  const tarStream = await createFrontendOnlyTarStream(projectDir);
  console.log("[DockerBuilder] Tar stream created");

  // Build the image
  const buildStream = await docker.buildImage(tarStream as NodeJS.ReadableStream, {
    t: imageName,
  });
  console.log("[DockerBuilder] Build stream started");

  // Wait for build to complete and capture output
  await new Promise<void>((resolve, reject) => {
    docker.modem.followProgress(
      buildStream,
      (err: Error | null, output: Array<{ stream?: string; error?: string; errorDetail?: { message: string } }>) => {
        if (err) {
          console.error("[DockerBuilder] Build error:", err);
          reject(err);
          return;
        }

        // Check for build errors in output
        const errors = output?.filter(item => item.error || item.errorDetail);
        if (errors && errors.length > 0) {
          const errorMsg = errors.map(e => e.error || e.errorDetail?.message).join("; ");
          console.error("[DockerBuilder] Build failed with errors:", errorMsg);
          reject(new Error(`Docker build failed: ${errorMsg}`));
          return;
        }

        console.log("[DockerBuilder] Build completed successfully");
        resolve();
      },
      (event: { stream?: string; status?: string; error?: string }) => {
        // Log progress events
        if (event.stream) {
          const line = event.stream.trim();
          if (line) {
            console.log("[DockerBuilder]", line);
          }
        }
        if (event.error) {
          console.error("[DockerBuilder] Error:", event.error);
        }
      }
    );
  });

  // Get the image ID
  const image = docker.getImage(imageName);
  const imageInfo = await image.inspect();

  console.log("[DockerBuilder] Image created with ID:", imageInfo.Id);
  return imageInfo.Id;
}
