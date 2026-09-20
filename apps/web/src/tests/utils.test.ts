import { describe, expect, it } from "vitest";
import { cn, formatBytes, formatRelativeTime } from "@/lib/utils";
import { linkifyCitations } from "@/components/chat/message-bubble";

describe("cn", () => {
  it("merges class names and resolves Tailwind conflicts", () => {
    expect(cn("px-2", "px-4")).toBe("px-4");
    expect(cn("text-sm", undefined, "font-bold")).toBe("text-sm font-bold");
  });
});

describe("formatBytes", () => {
  it("formats bytes, kilobytes, and megabytes appropriately", () => {
    expect(formatBytes(500)).toBe("500 B");
    expect(formatBytes(2048)).toBe("2.0 KB");
    expect(formatBytes(5 * 1024 * 1024)).toBe("5.0 MB");
  });
});

describe("formatRelativeTime", () => {
  it("returns 'just now' for very recent timestamps", () => {
    const now = new Date().toISOString();
    expect(formatRelativeTime(now)).toBe("just now");
  });

  it("returns a minutes-ago string for timestamps within the hour", () => {
    const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    expect(formatRelativeTime(fiveMinAgo)).toBe("5m ago");
  });
});

describe("linkifyCitations", () => {
  it("converts bare numeric citation markers into citation links", () => {
    const input = "Auth is handled here [1] and validated here [2].";
    const output = linkifyCitations(input);
    expect(output).toBe("Auth is handled here [[1]](citation:1) and validated here [[2]](citation:2).");
  });

  it("does not touch bracketed text that isn't a pure number", () => {
    const input = "See [the docs](https://example.com) for more.";
    expect(linkifyCitations(input)).toBe(input);
  });

  it("leaves content with no citations unchanged", () => {
    const input = "No citations here.";
    expect(linkifyCitations(input)).toBe(input);
  });
});
