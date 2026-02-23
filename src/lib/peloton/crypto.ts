import "server-only";

import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from "node:crypto";

const ENCRYPTION_ALGORITHM = "aes-256-gcm";
const ENCRYPTION_VERSION = "v1";
const IV_LENGTH_BYTES = 12;

function getEncryptionKey(): Buffer | null {
  const secret = process.env.PELOTON_CREDENTIALS_ENCRYPTION_KEY?.trim();
  if (!secret) return null;

  // Derive a stable 32-byte key from any provided secret string.
  return createHash("sha256").update(secret).digest();
}

export function hasPelotonEncryptionKey(): boolean {
  return getEncryptionKey() !== null;
}

export function encryptPelotonSecret(value: string): string {
  const key = getEncryptionKey();
  if (!key) {
    throw new Error("PELOTON_CREDENTIALS_ENCRYPTION_KEY is not configured");
  }

  const iv = randomBytes(IV_LENGTH_BYTES);
  const cipher = createCipheriv(ENCRYPTION_ALGORITHM, key, iv);
  const ciphertext = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return [
    ENCRYPTION_VERSION,
    iv.toString("base64"),
    authTag.toString("base64"),
    ciphertext.toString("base64"),
  ].join(".");
}

export function decryptPelotonSecret(payload: string): string {
  const key = getEncryptionKey();
  if (!key) {
    throw new Error("PELOTON_CREDENTIALS_ENCRYPTION_KEY is not configured");
  }

  const parts = payload.split(".");
  if (parts.length !== 4 || parts[0] !== ENCRYPTION_VERSION) {
    throw new Error("Invalid encrypted Peloton secret payload");
  }

  const iv = Buffer.from(parts[1], "base64");
  const authTag = Buffer.from(parts[2], "base64");
  const ciphertext = Buffer.from(parts[3], "base64");

  const decipher = createDecipheriv(ENCRYPTION_ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return plaintext.toString("utf8");
}

