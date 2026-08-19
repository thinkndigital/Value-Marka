import { describe, expect, it } from "vitest";
import {
  decryptSessionToken,
  encryptSessionToken,
} from "@/server/auth/token";

describe("session token", () => {
  it("round-trips a payload through sign and verify", async () => {
    const token = await encryptSessionToken({ sessionId: "session-123" });
    const payload = await decryptSessionToken(token);
    expect(payload?.sessionId).toBe("session-123");
  });

  it("rejects a tampered token", async () => {
    const token = await encryptSessionToken({ sessionId: "session-123" });
    const tampered = token.slice(0, -4) + "aaaa";
    const payload = await decryptSessionToken(tampered);
    expect(payload).toBeNull();
  });

  it("rejects garbage input instead of throwing", async () => {
    await expect(decryptSessionToken("not-a-jwt")).resolves.toBeNull();
  });

  it("returns null for an undefined token", async () => {
    await expect(decryptSessionToken(undefined)).resolves.toBeNull();
  });
});
