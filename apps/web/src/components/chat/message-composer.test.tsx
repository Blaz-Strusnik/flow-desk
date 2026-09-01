import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { apiFetch } from "@/lib/api-client";
import { MessageComposer } from "./message-composer";

vi.mock("@/lib/api-client", () => ({
  apiFetch: vi.fn(),
}));

const members = [
  { userId: "u1", user: { id: "u1", name: "Alice", email: "alice@example.com", avatarUrl: null } },
  { userId: "u2", user: { id: "u2", name: "Bob", email: "bob@example.com", avatarUrl: null } },
];

function renderComposer(onSend = vi.fn(), onTyping = vi.fn()) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <MessageComposer channelId="channel-1" onSend={onSend} onTyping={onTyping} />
    </QueryClientProvider>
  );
  return { onSend, onTyping };
}

describe("MessageComposer", () => {
  beforeEach(() => {
    vi.mocked(apiFetch).mockResolvedValue(members);
  });

  it("sends the trimmed message body on Enter", async () => {
    const { onSend } = renderComposer();
    const textarea = screen.getByPlaceholderText(/Message/);

    await userEvent.type(textarea, "  hello world  ");
    await userEvent.keyboard("{Enter}");

    expect(onSend).toHaveBeenCalledWith("hello world");
  });

  it("does not send on Shift+Enter (newline instead)", async () => {
    const { onSend } = renderComposer();
    const textarea = screen.getByPlaceholderText(/Message/);

    await userEvent.type(textarea, "line one{Shift>}{Enter}{/Shift}line two");

    expect(onSend).not.toHaveBeenCalled();
    expect(textarea).toHaveValue("line one\nline two");
  });

  it("does not send an empty or whitespace-only message", async () => {
    const { onSend } = renderComposer();
    const textarea = screen.getByPlaceholderText(/Message/);

    await userEvent.type(textarea, "   ");
    await userEvent.keyboard("{Enter}");

    expect(onSend).not.toHaveBeenCalled();
  });

  it("shows mention suggestions filtered by the text after @, and inserts one on click", async () => {
    renderComposer();
    const textarea = screen.getByPlaceholderText(/Message/);

    await userEvent.type(textarea, "hey @al");

    const suggestion = await screen.findByText("Alice");
    await userEvent.click(suggestion);

    expect(textarea).toHaveValue("hey @Alice ");
  });

  it("calls onTyping as the user types", async () => {
    const { onTyping } = renderComposer();
    await userEvent.type(screen.getByPlaceholderText(/Message/), "h");
    expect(onTyping).toHaveBeenCalled();
  });
});
