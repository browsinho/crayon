import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

// Create mock objects that will be used by the mock module
const mockPage = {
  goto: vi.fn(),
};

const mockContext = {
  pages: vi.fn(),
  newPage: vi.fn(),
};

const mockBrowser = {
  contexts: vi.fn(),
};

const mockSessions = {
  create: vi.fn(),
  delete: vi.fn(),
};

const mockBrowserConnect = {
  connect: vi.fn(),
};

// Mock the module - the factory will be called when the module is imported
vi.mock("anchorbrowser", () => ({
  default: class MockAnchorClient {
    sessions = mockSessions;
    browser = mockBrowserConnect;
  },
}));

// Import after mock is set up
import {
  BrowserSessionManager,
  BrowserSessionError,
  createSession,
} from "./browser-session.js";

function resetMocks() {
  mockPage.goto.mockReset();
  mockPage.goto.mockResolvedValue(undefined);

  mockContext.pages.mockReset();
  mockContext.pages.mockReturnValue([mockPage]);
  mockContext.newPage.mockReset();
  mockContext.newPage.mockResolvedValue(mockPage);

  mockBrowser.contexts.mockReset();
  mockBrowser.contexts.mockReturnValue([mockContext]);

  mockBrowserConnect.connect.mockReset();
  mockBrowserConnect.connect.mockResolvedValue(mockBrowser);

  mockSessions.create.mockReset();
  mockSessions.create.mockResolvedValue({
    data: {
      id: "test-session-123",
      cdp_url: "wss://connect.anchorbrowser.io/test-session-123",
      live_view_url: "https://live.anchorbrowser.io/test-session-123",
    },
  });

  mockSessions.delete.mockReset();
  mockSessions.delete.mockResolvedValue({ data: { status: "deleted" } });
}

describe("BrowserSessionManager", () => {
  let manager: BrowserSessionManager;

  beforeEach(() => {
    resetMocks();
    manager = new BrowserSessionManager({ apiKey: "test-api-key" });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("createSession", () => {
    it("creates a session and returns valid session object", async () => {
      const session = await manager.createSession();

      expect(session).toEqual({
        id: "test-session-123",
        status: "active",
        cdpUrl: "wss://connect.anchorbrowser.io/test-session-123",
        liveViewUrl: "https://live.anchorbrowser.io/test-session-123",
      });
    });

    it("creates a session with options", async () => {
      await manager.createSession({
        initialUrl: "https://example.com",
        recording: true,
        proxy: {
          active: true,
          type: "anchor_residential",
          countryCode: "us",
        },
        timeout: {
          maxDuration: 10,
          idleTimeout: 5,
        },
      });

      expect(mockSessions.create).toHaveBeenCalledWith({
        session: {
          initial_url: "https://example.com",
          recording: { active: true },
          proxy: {
            active: true,
            type: "anchor_residential",
            country_code: "us",
          },
          timeout: {
            max_duration: 10,
            idle_timeout: 5,
          },
        },
      });
    });

    it("tracks session in internal state", async () => {
      const session = await manager.createSession();
      const retrieved = manager.getSession(session.id);

      expect(retrieved).toEqual(session);
    });

    it("throws BrowserSessionError on API failure", async () => {
      mockSessions.create.mockRejectedValueOnce(new Error("API Error"));

      await expect(manager.createSession()).rejects.toThrow(BrowserSessionError);
    });

    it("throws BrowserSessionError with correct message on API failure", async () => {
      mockSessions.create.mockRejectedValueOnce(new Error("API Error"));

      await expect(manager.createSession()).rejects.toThrow(
        "Failed to create session"
      );
    });
  });

  describe("navigate", () => {
    it("navigates to URL successfully", async () => {
      const session = await manager.createSession();

      await manager.navigate(session.id, "https://example.com");

      expect(mockBrowserConnect.connect).toHaveBeenCalledWith(session.id);
      expect(mockPage.goto).toHaveBeenCalledWith("https://example.com", {
        waitUntil: "domcontentloaded",
      });
    });

    it("throws error for non-existent session", async () => {
      await expect(
        manager.navigate("non-existent", "https://example.com")
      ).rejects.toThrow(BrowserSessionError);
    });

    it("throws error with correct message for non-existent session", async () => {
      await expect(
        manager.navigate("non-existent", "https://example.com")
      ).rejects.toThrow("Session not found");
    });

    it("throws error for inactive session", async () => {
      const session = await manager.createSession();
      await manager.closeSession(session.id);

      await expect(
        manager.navigate(session.id, "https://example.com")
      ).rejects.toThrow("Session not found");
    });

    it("updates session status to error on navigation failure", async () => {
      const session = await manager.createSession();

      mockPage.goto.mockRejectedValueOnce(new Error("Navigation failed"));

      await expect(
        manager.navigate(session.id, "https://example.com")
      ).rejects.toThrow(BrowserSessionError);

      const retrieved = manager.getSession(session.id);
      expect(retrieved?.status).toBe("error");
    });

    it("creates new page if none exists", async () => {
      const session = await manager.createSession();

      mockContext.pages.mockReturnValueOnce([]);

      await manager.navigate(session.id, "https://example.com");

      expect(mockContext.newPage).toHaveBeenCalled();
    });
  });

  describe("closeSession", () => {
    it("closes session and updates status", async () => {
      const session = await manager.createSession();

      await manager.closeSession(session.id);

      expect(mockSessions.delete).toHaveBeenCalledWith(session.id);
      expect(manager.getSession(session.id)).toBeUndefined();
    });

    it("throws error for non-existent session", async () => {
      await expect(manager.closeSession("non-existent")).rejects.toThrow(
        BrowserSessionError
      );
    });

    it("throws error with correct message for non-existent session", async () => {
      await expect(manager.closeSession("non-existent")).rejects.toThrow(
        "Session not found"
      );
    });

    it("throws BrowserSessionError on API failure", async () => {
      const session = await manager.createSession();

      mockSessions.delete.mockRejectedValueOnce(new Error("API Error"));

      await expect(manager.closeSession(session.id)).rejects.toThrow(
        BrowserSessionError
      );

      const retrieved = manager.getSession(session.id);
      expect(retrieved?.status).toBe("error");
    });
  });

  describe("getSession", () => {
    it("returns undefined for non-existent session", () => {
      expect(manager.getSession("non-existent")).toBeUndefined();
    });

    it("returns session for existing session", async () => {
      const session = await manager.createSession();
      const retrieved = manager.getSession(session.id);

      expect(retrieved).toEqual(session);
    });
  });

  describe("closeAllSessions", () => {
    it("closes all sessions", async () => {
      mockSessions.create
        .mockResolvedValueOnce({
          data: {
            id: "session-1",
            cdp_url: "wss://connect.anchorbrowser.io/session-1",
          },
        })
        .mockResolvedValueOnce({
          data: {
            id: "session-2",
            cdp_url: "wss://connect.anchorbrowser.io/session-2",
          },
        });

      await manager.createSession();
      await manager.createSession();

      await manager.closeAllSessions();

      expect(mockSessions.delete).toHaveBeenCalledTimes(2);
      expect(manager.getSession("session-1")).toBeUndefined();
      expect(manager.getSession("session-2")).toBeUndefined();
    });

    it("throws error if any session fails to close", async () => {
      mockSessions.create
        .mockResolvedValueOnce({
          data: {
            id: "session-1",
            cdp_url: "wss://connect.anchorbrowser.io/session-1",
          },
        })
        .mockResolvedValueOnce({
          data: {
            id: "session-2",
            cdp_url: "wss://connect.anchorbrowser.io/session-2",
          },
        });

      await manager.createSession();
      await manager.createSession();

      mockSessions.delete.mockRejectedValueOnce(new Error("API Error"));

      await expect(manager.closeAllSessions()).rejects.toThrow(
        BrowserSessionError
      );
    });
  });
});

describe("BrowserSessionError", () => {
  it("creates error with message", () => {
    const error = new BrowserSessionError("Test error");
    expect(error.message).toBe("Test error");
    expect(error.name).toBe("BrowserSessionError");
  });

  it("creates error with cause", () => {
    const cause = new Error("Original error");
    const error = new BrowserSessionError("Test error", cause);
    expect(error.cause).toBe(cause);
  });
});

describe("createSession helper", () => {
  beforeEach(() => {
    resetMocks();
  });

  it("creates manager and session", async () => {
    const { manager, session } = await createSession({
      apiKey: "test-api-key",
    });

    expect(manager).toBeInstanceOf(BrowserSessionManager);
    expect(session).toEqual({
      id: "test-session-123",
      status: "active",
      cdpUrl: "wss://connect.anchorbrowser.io/test-session-123",
      liveViewUrl: "https://live.anchorbrowser.io/test-session-123",
    });
  });

  it("passes options to createSession", async () => {
    await createSession(
      { apiKey: "test-api-key" },
      { initialUrl: "https://example.com" }
    );

    expect(mockSessions.create).toHaveBeenCalledWith({
      session: {
        initial_url: "https://example.com",
      },
    });
  });
});
