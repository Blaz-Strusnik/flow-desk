import { describe, expect, it } from "vitest";
import { renderMessageMarkdown } from "./markdown";

describe("renderMessageMarkdown", () => {
  it("escapes raw HTML in the message body so it can never inject real markup", () => {
    const html = renderMessageMarkdown("<script>alert('xss')</script>");
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
  });

  it("escapes HTML even when it's adjacent to markdown syntax", () => {
    const html = renderMessageMarkdown("**bold** <img src=x onerror=alert(1)>");
    expect(html).toContain("<strong>bold</strong>");
    expect(html).not.toContain("<img");
    expect(html).toContain("&lt;img");
  });

  it("renders bold, italic, and inline code", () => {
    expect(renderMessageMarkdown("**bold**")).toBe("<strong>bold</strong>");
    expect(renderMessageMarkdown("*italic*")).toBe("<em>italic</em>");
    expect(renderMessageMarkdown("`code`")).toContain("<code");
    expect(renderMessageMarkdown("`code`")).toContain(">code</code>");
  });

  it("renders fenced code blocks", () => {
    const html = renderMessageMarkdown("```const x = 1;```");
    expect(html).toContain("<pre");
    expect(html).toContain("const x = 1;");
  });

  it("highlights @mentions", () => {
    const html = renderMessageMarkdown("hello @Bob");
    expect(html).toContain('<span class="font-medium text-primary">@Bob</span>');
  });

  it("converts newlines to <br/>", () => {
    expect(renderMessageMarkdown("line1\nline2")).toBe("line1<br/>line2");
  });
});
