import { hash, verify, type Options } from "@node-rs/argon2";

// Tuned for a small VPS: ~50ms per hash.
// If you upgrade hardware, raise memoryCost first.
const OPTIONS: Options = {
  memoryCost: 19456, // 19 MiB
  timeCost: 2,
  outputLen: 32,
  parallelism: 1,
};

export function hashPassword(plain: string): Promise<string> {
  return hash(plain, OPTIONS);
}

export function verifyPassword(plain: string, encoded: string): Promise<boolean> {
  return verify(encoded, plain, OPTIONS);
}