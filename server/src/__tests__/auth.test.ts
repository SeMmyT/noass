import { describe, it, expect, beforeEach } from "vitest";
import {
  isAllowedEmail, generateMagicToken, verifyMagicToken,
  createSession, validateSession, deleteSession, _resetForTests,
} from "../auth";

beforeEach(() => {
  _resetForTests();
});

describe("isAllowedEmail", () => {
  it("accepts semmytrane@gmail.com", () => {
    expect(isAllowedEmail("semmytrane@gmail.com")).toBe(true);
  });

  it("accepts case-insensitive", () => {
    expect(isAllowedEmail("SemmyTrane@Gmail.Com")).toBe(true);
  });

  it("accepts with whitespace", () => {
    expect(isAllowedEmail("  semmytrane@gmail.com  ")).toBe(true);
  });

  it("rejects other emails", () => {
    expect(isAllowedEmail("hacker@evil.com")).toBe(false);
    expect(isAllowedEmail("admin@semmy.dev")).toBe(false);
    expect(isAllowedEmail("")).toBe(false);
  });
});

describe("magic tokens", () => {
  it("generates token for allowed email", () => {
    const token = generateMagicToken("semmytrane@gmail.com");
    expect(token).toBeTruthy();
    expect(token!.length).toBe(64); // 32 bytes hex
  });

  it("returns null for disallowed email", () => {
    expect(generateMagicToken("other@gmail.com")).toBeNull();
  });

  it("verifies valid token", () => {
    const token = generateMagicToken("semmytrane@gmail.com")!;
    const email = verifyMagicToken(token);
    expect(email).toBe("semmytrane@gmail.com");
  });

  it("token is single-use", () => {
    const token = generateMagicToken("semmytrane@gmail.com")!;
    expect(verifyMagicToken(token)).toBe("semmytrane@gmail.com");
    expect(verifyMagicToken(token)).toBeNull();
  });

  it("rejects invalid token", () => {
    expect(verifyMagicToken("bogus")).toBeNull();
  });
});

describe("sessions", () => {
  it("creates and validates session", () => {
    const id = createSession();
    expect(id.length).toBe(64);
    expect(validateSession(id)).toBe(true);
  });

  it("rejects unknown session", () => {
    expect(validateSession("nonexistent")).toBe(false);
  });

  it("rejects undefined", () => {
    expect(validateSession(undefined)).toBe(false);
  });

  it("deleteSession invalidates", () => {
    const id = createSession();
    expect(validateSession(id)).toBe(true);
    deleteSession(id);
    expect(validateSession(id)).toBe(false);
  });
});
