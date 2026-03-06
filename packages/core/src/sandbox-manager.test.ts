import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  SandboxManager,
  SandboxManagerError,
  createSandboxManager,
} from "./sandbox-manager.js";
import type Docker from "dockerode";

function createMockDocker() {
  return {
    ping: vi.fn().mockResolvedValue("OK"),
    getContainer: vi.fn(),
    createContainer: vi.fn(),
    listContainers: vi.fn(),
  };
}

function createMockContainer(options: {
  running?: boolean;
  exitCode?: number;
  restarting?: boolean;
  frontendPort?: number;
  backendPort?: number;
}) {
  const {
    running = false,
    exitCode = 0,
    restarting = false,
    frontendPort = 8080,
    backendPort = 8081,
  } = options;

  return {
    inspect: vi.fn().mockResolvedValue({
      State: {
        Running: running,
        Restarting: restarting,
        ExitCode: exitCode,
      },
      HostConfig: {
        PortBindings: {
          "3000/tcp": [{ HostPort: String(frontendPort) }],
          "3001/tcp": [{ HostPort: String(backendPort) }],
        },
      },
    }),
    start: vi.fn().mockResolvedValue(undefined),
    stop: vi.fn().mockResolvedValue(undefined),
  };
}

describe("createSandboxManager", () => {
  it("creates a SandboxManager instance", () => {
    const manager = createSandboxManager();
    expect(manager).toBeInstanceOf(SandboxManager);
  });

  it("accepts custom Docker client", () => {
    const mockDocker = createMockDocker();
    const manager = createSandboxManager({ docker: mockDocker as unknown as Docker });
    expect(manager).toBeInstanceOf(SandboxManager);
  });
});

describe("SandboxManager", () => {
  let mockDocker: ReturnType<typeof createMockDocker>;
  let manager: SandboxManager;

  beforeEach(() => {
    mockDocker = createMockDocker();
    manager = new SandboxManager({ docker: mockDocker as unknown as Docker });
  });

  describe("start", () => {
    it("returns running sandbox when container is already running", async () => {
      const mockContainer = createMockContainer({ running: true, frontendPort: 3010 });
      mockDocker.getContainer.mockReturnValue(mockContainer);

      const result = await manager.start("test-sandbox");

      expect(result.id).toBe("test-sandbox");
      expect(result.status).toBe("running");
      expect(result.ports.frontend).toBe(3010);
      expect(result.url).toBe("http://localhost:3010");
      expect(mockContainer.start).not.toHaveBeenCalled();
    });

    it("starts stopped container and returns sandbox", async () => {
      const mockContainer = createMockContainer({ running: false, frontendPort: 3020 });
      mockDocker.getContainer.mockReturnValue(mockContainer);

      // After start, the container should be running
      mockContainer.inspect
        .mockResolvedValueOnce({
          State: { Running: false, ExitCode: 0 },
          HostConfig: {
            PortBindings: {
              "3000/tcp": [{ HostPort: "3020" }],
              "3001/tcp": [{ HostPort: "3021" }],
            },
          },
        })
        .mockResolvedValue({
          State: { Running: true, ExitCode: 0 },
          HostConfig: {
            PortBindings: {
              "3000/tcp": [{ HostPort: "3020" }],
              "3001/tcp": [{ HostPort: "3021" }],
            },
          },
        });

      const result = await manager.start("test-sandbox");

      expect(result.id).toBe("test-sandbox");
      expect(result.status).toBe("running");
      expect(mockContainer.start).toHaveBeenCalled();
    });

    it("creates and starts new container when not found", async () => {
      const notFoundError = new Error("no such container");
      mockDocker.getContainer.mockReturnValue({
        inspect: vi.fn().mockRejectedValue(notFoundError),
      });
      mockDocker.listContainers.mockResolvedValue([]);

      const mockNewContainer = {
        id: "new-container-id",
        start: vi.fn().mockResolvedValue(undefined),
      };
      mockDocker.createContainer.mockResolvedValue(mockNewContainer);

      // Mock OS-level port availability check to always return true
      vi.spyOn(manager as unknown as { isPortAvailable: (port: number) => Promise<boolean> }, "isPortAvailable")
        .mockResolvedValue(true);

      const result = await manager.start("new-sandbox");

      expect(result.id).toBe("new-sandbox");
      expect(result.status).toBe("running");
      expect(mockDocker.createContainer).toHaveBeenCalledWith(
        expect.objectContaining({
          Image: "crayon-sandbox-new-sandbox",
          name: "crayon-sandbox-new-sandbox",
        })
      );
      expect(mockNewContainer.start).toHaveBeenCalled();
    });

    it("allocates correct ports for new container", async () => {
      const notFoundError = new Error("no such container");
      mockDocker.getContainer.mockReturnValue({
        inspect: vi.fn().mockRejectedValue(notFoundError),
      });
      mockDocker.listContainers.mockResolvedValue([]);

      const mockNewContainer = {
        id: "new-container-id",
        start: vi.fn().mockResolvedValue(undefined),
      };
      mockDocker.createContainer.mockResolvedValue(mockNewContainer);

      // Mock OS-level port availability check to always return true
      vi.spyOn(manager as unknown as { isPortAvailable: (port: number) => Promise<boolean> }, "isPortAvailable")
        .mockResolvedValue(true);

      const result = await manager.start("new-sandbox");

      expect(result.ports.frontend).toBe(8080);
      expect(result.ports.backend).toBe(8081);
    });

    it("allocates non-conflicting ports when others are in use", async () => {
      const notFoundError = new Error("no such container");
      mockDocker.getContainer.mockReturnValue({
        inspect: vi.fn().mockRejectedValue(notFoundError),
      });
      mockDocker.listContainers.mockResolvedValue([
        {
          Names: ["/crayon-sandbox-existing"],
          State: "running",
          Ports: [
            { PrivatePort: 3000, PublicPort: 8080 },
            { PrivatePort: 3001, PublicPort: 8081 },
          ],
        },
      ]);

      const mockNewContainer = {
        id: "new-container-id",
        start: vi.fn().mockResolvedValue(undefined),
      };
      mockDocker.createContainer.mockResolvedValue(mockNewContainer);

      // Mock OS-level port availability check to always return true
      vi.spyOn(manager as unknown as { isPortAvailable: (port: number) => Promise<boolean> }, "isPortAvailable")
        .mockResolvedValue(true);

      const result = await manager.start("new-sandbox");

      // Should skip 8080/8081 and use 8090/8091
      expect(result.ports.frontend).toBe(8090);
      expect(result.ports.backend).toBe(8091);
    });

    it("skips ports that are unavailable at OS level", async () => {
      const notFoundError = new Error("no such container");
      mockDocker.getContainer.mockReturnValue({
        inspect: vi.fn().mockRejectedValue(notFoundError),
      });
      mockDocker.listContainers.mockResolvedValue([]);

      const mockNewContainer = {
        id: "new-container-id",
        start: vi.fn().mockResolvedValue(undefined),
      };
      mockDocker.createContainer.mockResolvedValue(mockNewContainer);

      // Mock OS-level port availability: port 8080 is in use by another process
      const isPortAvailableSpy = vi.spyOn(
        manager as unknown as { isPortAvailable: (port: number) => Promise<boolean> },
        "isPortAvailable"
      );
      isPortAvailableSpy.mockImplementation(async (port: number) => {
        // Simulate port 8080 being in use by another process (e.g., dev server)
        return port !== 8080;
      });

      const result = await manager.start("new-sandbox");

      // Should skip 8080 (unavailable at OS level) and use 8090/8091
      expect(result.ports.frontend).toBe(8090);
      expect(result.ports.backend).toBe(8091);
    });

    it("throws SandboxManagerError on Docker error", async () => {
      const dockerError = new Error("Docker daemon not responding");
      mockDocker.getContainer.mockReturnValue({
        inspect: vi.fn().mockRejectedValue(dockerError),
      });

      await expect(manager.start("test")).rejects.toThrow(SandboxManagerError);
      await expect(manager.start("test")).rejects.toMatchObject({
        code: "DOCKER_ERROR",
      });
    });

    it("throws DOCKER_UNAVAILABLE when Docker ping fails", async () => {
      mockDocker.ping.mockRejectedValue(new Error("ECONNREFUSED"));

      await expect(manager.start("test")).rejects.toThrow(SandboxManagerError);
      await expect(manager.start("test")).rejects.toMatchObject({
        code: "DOCKER_UNAVAILABLE",
      });
    });
  });

  describe("stop", () => {
    it("stops running container", async () => {
      const mockContainer = createMockContainer({ running: true });
      mockDocker.getContainer.mockReturnValue(mockContainer);

      await manager.stop("test-sandbox");

      expect(mockContainer.stop).toHaveBeenCalled();
    });

    it("does nothing when container is already stopped", async () => {
      const mockContainer = createMockContainer({ running: false });
      mockDocker.getContainer.mockReturnValue(mockContainer);

      await manager.stop("test-sandbox");

      expect(mockContainer.stop).not.toHaveBeenCalled();
    });

    it("throws NOT_FOUND when container does not exist", async () => {
      const notFoundError = new Error("no such container");
      mockDocker.getContainer.mockReturnValue({
        inspect: vi.fn().mockRejectedValue(notFoundError),
      });

      await expect(manager.stop("nonexistent")).rejects.toThrow(SandboxManagerError);
      await expect(manager.stop("nonexistent")).rejects.toMatchObject({
        code: "NOT_FOUND",
      });
    });

    it("throws DOCKER_ERROR on other Docker errors", async () => {
      const dockerError = new Error("Docker error");
      mockDocker.getContainer.mockReturnValue({
        inspect: vi.fn().mockRejectedValue(dockerError),
      });

      await expect(manager.stop("test")).rejects.toThrow(SandboxManagerError);
      await expect(manager.stop("test")).rejects.toMatchObject({
        code: "DOCKER_ERROR",
      });
    });
  });

  describe("getStatus", () => {
    it("returns running status for running container", async () => {
      const mockContainer = createMockContainer({ running: true, frontendPort: 3000 });
      mockDocker.getContainer.mockReturnValue(mockContainer);

      const result = await manager.getStatus("test-sandbox");

      expect(result.id).toBe("test-sandbox");
      expect(result.status).toBe("running");
      expect(result.url).toBe("http://localhost:3000");
    });

    it("returns stopped status for stopped container", async () => {
      const mockContainer = createMockContainer({ running: false });
      mockDocker.getContainer.mockReturnValue(mockContainer);

      const result = await manager.getStatus("test-sandbox");

      expect(result.id).toBe("test-sandbox");
      expect(result.status).toBe("stopped");
      expect(result.url).toBeUndefined();
    });

    it("returns starting status for restarting container", async () => {
      const mockContainer = createMockContainer({ running: false, restarting: true });
      mockDocker.getContainer.mockReturnValue(mockContainer);

      const result = await manager.getStatus("test-sandbox");

      expect(result.status).toBe("starting");
    });

    it("returns error status for container with non-zero exit code", async () => {
      const mockContainer = createMockContainer({ running: false, exitCode: 1 });
      mockDocker.getContainer.mockReturnValue(mockContainer);

      const result = await manager.getStatus("test-sandbox");

      expect(result.status).toBe("error");
    });

    it("returns correct ports", async () => {
      const mockContainer = createMockContainer({
        running: true,
        frontendPort: 3020,
        backendPort: 3021,
      });
      mockDocker.getContainer.mockReturnValue(mockContainer);

      const result = await manager.getStatus("test-sandbox");

      expect(result.ports.frontend).toBe(3020);
      expect(result.ports.backend).toBe(3021);
    });

    it("throws NOT_FOUND when container does not exist", async () => {
      const notFoundError = new Error("no such container");
      mockDocker.getContainer.mockReturnValue({
        inspect: vi.fn().mockRejectedValue(notFoundError),
      });

      await expect(manager.getStatus("nonexistent")).rejects.toThrow(SandboxManagerError);
      await expect(manager.getStatus("nonexistent")).rejects.toMatchObject({
        code: "NOT_FOUND",
      });
    });
  });

  describe("list", () => {
    it("returns empty array when no sandboxes exist", async () => {
      mockDocker.listContainers.mockResolvedValue([]);

      const result = await manager.list();

      expect(result).toEqual([]);
    });

    it("returns all sandbox containers", async () => {
      mockDocker.listContainers.mockResolvedValue([
        {
          Names: ["/crayon-sandbox-sandbox1"],
          State: "running",
          Ports: [
            { PrivatePort: 3000, PublicPort: 3000 },
            { PrivatePort: 3001, PublicPort: 3001 },
          ],
        },
        {
          Names: ["/crayon-sandbox-sandbox2"],
          State: "exited",
          Ports: [
            { PrivatePort: 3000, PublicPort: 3010 },
            { PrivatePort: 3001, PublicPort: 3011 },
          ],
        },
      ]);

      const result = await manager.list();

      expect(result).toHaveLength(2);

      expect(result[0].id).toBe("sandbox1");
      expect(result[0].status).toBe("running");
      expect(result[0].ports.frontend).toBe(3000);
      expect(result[0].url).toBe("http://localhost:3000");

      expect(result[1].id).toBe("sandbox2");
      expect(result[1].status).toBe("stopped");
      expect(result[1].ports.frontend).toBe(3010);
      expect(result[1].url).toBeUndefined();
    });

    it("filters non-sandbox containers", async () => {
      mockDocker.listContainers.mockResolvedValue([
        {
          Names: ["/other-container"],
          State: "running",
          Ports: [],
        },
        {
          Names: ["/crayon-sandbox-valid"],
          State: "running",
          Ports: [
            { PrivatePort: 3000, PublicPort: 3000 },
            { PrivatePort: 3001, PublicPort: 3001 },
          ],
        },
      ]);

      const result = await manager.list();

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe("valid");
    });

    it("maps different container states correctly", async () => {
      mockDocker.listContainers.mockResolvedValue([
        {
          Names: ["/crayon-sandbox-running"],
          State: "running",
          Ports: [{ PrivatePort: 3000, PublicPort: 3000 }],
        },
        {
          Names: ["/crayon-sandbox-created"],
          State: "created",
          Ports: [],
        },
        {
          Names: ["/crayon-sandbox-dead"],
          State: "dead",
          Ports: [],
        },
        {
          Names: ["/crayon-sandbox-paused"],
          State: "paused",
          Ports: [],
        },
      ]);

      const result = await manager.list();

      expect(result.find(s => s.id === "running")?.status).toBe("running");
      expect(result.find(s => s.id === "created")?.status).toBe("starting");
      expect(result.find(s => s.id === "dead")?.status).toBe("error");
      expect(result.find(s => s.id === "paused")?.status).toBe("stopped");
    });

    it("throws DOCKER_ERROR on Docker errors", async () => {
      mockDocker.listContainers.mockRejectedValue(new Error("Docker error"));

      await expect(manager.list()).rejects.toThrow(SandboxManagerError);
      await expect(manager.list()).rejects.toMatchObject({
        code: "DOCKER_ERROR",
      });
    });

    it("throws DOCKER_UNAVAILABLE when Docker ping fails", async () => {
      mockDocker.ping.mockRejectedValue(new Error("ECONNREFUSED"));

      await expect(manager.list()).rejects.toThrow(SandboxManagerError);
      await expect(manager.list()).rejects.toMatchObject({
        code: "DOCKER_UNAVAILABLE",
      });
    });
  });
});

describe("SandboxManagerError", () => {
  it("has correct name and properties", () => {
    const error = new SandboxManagerError("Test error", "NOT_FOUND");

    expect(error.name).toBe("SandboxManagerError");
    expect(error.message).toBe("Test error");
    expect(error.code).toBe("NOT_FOUND");
  });

  it("is instance of Error", () => {
    const error = new SandboxManagerError("Test error", "DOCKER_ERROR");

    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(SandboxManagerError);
  });
});
