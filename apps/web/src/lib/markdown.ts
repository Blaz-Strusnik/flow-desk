/**
 * Minimal, safe markdown-ish rendering for chat messages: escapes all raw
 * text first, then layers on a small set of transformations — so the only
 * real HTML in the output is what we generate, never anything from the
 * message body itself.
 */
export function renderMessageMarkdown(text: string): string {
  const escaped = text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  return escaped
    .replace(
      /```([\s\S]+?)```/g,
      (_, code: string) => `<pre class="rounded bg-muted p-2 text-xs overflow-x-auto"><code>${code}</code></pre>`
    )
    .replace(/`([^`]+)`/g, '<code class="rounded bg-muted px-1 py-0.5 text-xs">$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/\*([^*]+)\*/g, "<em>$1</em>")
    .replace(/@(\w[\w-]*)/g, '<span class="font-medium text-primary">@$1</span>')
    .replace(/\n/g, "<br/>");
}
