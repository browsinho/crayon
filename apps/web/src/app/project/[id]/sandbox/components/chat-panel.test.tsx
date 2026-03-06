import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { ChatPanel } from "./chat-panel";
import { useSandboxChat } from "@/hooks/use-sandbox-chat";
import { vi } from "vitest";

// Mock the hook
vi.mock("@/hooks/use-sandbox-chat");

describe("ChatPanel", () => {
  const mockSendMessage = vi.fn();
  const mockClearHistory = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();

    // Mock scrollIntoView
    Element.prototype.scrollIntoView = vi.fn();
    (useSandboxChat as ReturnType<typeof vi.fn>).mockReturnValue({
      messages: [],
      isProcessing: false,
      currentToolCall: null,
      sendMessage: mockSendMessage,
      clearHistory: mockClearHistory,
      error: null,
    });
  });

  test("renders welcome message when empty", () => {
    render(<ChatPanel sandboxId="test" />);
    expect(screen.getByText(/Welcome to AI Assistant/i)).toBeInTheDocument();
  });

  test("sends message on Enter key", async () => {
    render(<ChatPanel sandboxId="test" />);
    const textarea = screen.getByPlaceholderText(/Type a message/i);

    fireEvent.change(textarea, { target: { value: "Hello" } });
    fireEvent.keyDown(textarea, { key: "Enter", shiftKey: false });

    await waitFor(() => {
      expect(mockSendMessage).toHaveBeenCalledWith("Hello");
    });
  });

  test("allows newline with Shift+Enter", () => {
    render(<ChatPanel sandboxId="test" />);
    const textarea = screen.getByPlaceholderText(/Type a message/i);

    fireEvent.change(textarea, { target: { value: "Hello" } });
    fireEvent.keyDown(textarea, { key: "Enter", shiftKey: true });

    expect(mockSendMessage).not.toHaveBeenCalled();
  });

  test("disables input while processing", () => {
    (useSandboxChat as ReturnType<typeof vi.fn>).mockReturnValue({
      messages: [],
      isProcessing: true,
      currentToolCall: null,
      sendMessage: mockSendMessage,
      clearHistory: mockClearHistory,
      error: null,
    });

    render(<ChatPanel sandboxId="test" />);

    const textarea = screen.getByPlaceholderText(/Processing/i);
    expect(textarea).toBeDisabled();
  });

  test("displays error message", () => {
    (useSandboxChat as ReturnType<typeof vi.fn>).mockReturnValue({
      messages: [],
      isProcessing: false,
      currentToolCall: null,
      sendMessage: mockSendMessage,
      clearHistory: mockClearHistory,
      error: "Test error message",
    });

    render(<ChatPanel sandboxId="test" />);
    expect(screen.getByText("Test error message")).toBeInTheDocument();
  });

  test("calls clearHistory when clear button is clicked", () => {
    (useSandboxChat as ReturnType<typeof vi.fn>).mockReturnValue({
      messages: [
        {
          id: "1",
          role: "user",
          content: "Hello",
          timestamp: new Date(),
        },
      ],
      isProcessing: false,
      currentToolCall: null,
      sendMessage: mockSendMessage,
      clearHistory: mockClearHistory,
      error: null,
    });

    render(<ChatPanel sandboxId="test" />);

    // Find the clear button by looking for buttons in the header
    const buttons = screen.getAllByRole("button");
    const clearButton = buttons.find((button) =>
      button.innerHTML.includes("trash")
    );
    expect(clearButton).toBeDefined();
    fireEvent.click(clearButton!);

    expect(mockClearHistory).toHaveBeenCalled();
  });

  test("sends suggested prompt when clicked", async () => {
    render(<ChatPanel sandboxId="test" />);

    const suggestedButton = screen.getByText("Change the page title");
    fireEvent.click(suggestedButton);

    await waitFor(() => {
      expect(mockSendMessage).toHaveBeenCalledWith("Change the page title");
    });
  });

  test("displays user and assistant messages", () => {
    (useSandboxChat as ReturnType<typeof vi.fn>).mockReturnValue({
      messages: [
        {
          id: "1",
          role: "user",
          content: "Hello",
          timestamp: new Date(),
        },
        {
          id: "2",
          role: "assistant",
          content: "Hi there!",
          timestamp: new Date(),
        },
      ],
      isProcessing: false,
      currentToolCall: null,
      sendMessage: mockSendMessage,
      clearHistory: mockClearHistory,
      error: null,
    });

    render(<ChatPanel sandboxId="test" />);

    expect(screen.getByText("Hello")).toBeInTheDocument();
    expect(screen.getByText("Hi there!")).toBeInTheDocument();
  });
});
