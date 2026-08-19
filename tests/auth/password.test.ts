import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword } from "@/server/auth/password";

describe("password hashing", () => {
  it("verifies a correct password against its hash", async () => {
    const hash = await hashPassword("Correct-Horse-1");
    await expect(verifyPassword("Correct-Horse-1", hash)).resolves.toBe(true);
  });

  it("rejects an incorrect password", async () => {
    const hash = await hashPassword("Correct-Horse-1");
    await expect(verifyPassword("wrong-password-1", hash)).resolves.toBe(
      false,
    );
  });

  it("salts hashes so the same password never hashes identically twice", async () => {
    const [a, b] = await Promise.all([
      hashPassword("same-password-1"),
      hashPassword("same-password-1"),
    ]);
    expect(a).not.toBe(b);
  });

  it("never stores the plain-text password in the hash", async () => {
    const hash = await hashPassword("super-secret-1");
    expect(hash).not.toContain("super-secret-1");
  });
});
