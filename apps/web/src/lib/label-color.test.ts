import { describe, expect, it } from "vitest";
import { readableTextColor } from "./label-color";

describe("readableTextColor", () => {
  it("uses white text on dark colors", () => {
    expect(readableTextColor("#ef4444")).toBe("#ffffff"); // red
    expect(readableTextColor("#3b82f6")).toBe("#ffffff"); // blue
    expect(readableTextColor("#000000")).toBe("#ffffff");
  });

  it("uses black text on light colors", () => {
    expect(readableTextColor("#eab308")).toBe("#000000"); // yellow
    expect(readableTextColor("#ffffff")).toBe("#000000");
  });

  it("accepts shorthand hex and a missing leading hash", () => {
    expect(readableTextColor("fff")).toBe("#000000");
    expect(readableTextColor("000")).toBe("#ffffff");
  });

  it("falls back to white text for unparseable input", () => {
    expect(readableTextColor("not-a-color")).toBe("#ffffff");
  });
});
