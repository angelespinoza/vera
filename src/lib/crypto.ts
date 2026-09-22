import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

/**
 * Cifrado de secretos server-side (secret keys de wallets custodiales).
 * AES-256-GCM con IV aleatorio por operación. Requiere WALLET_ENCRYPTION_KEY
 * en .env: 32 bytes en base64 (genera una con `openssl rand -base64 32`).
 */

const ALGORITHM = "aes-256-gcm";

function getKey(): Buffer {
  const base64Key = process.env.WALLET_ENCRYPTION_KEY;
  if (!base64Key) {
    throw new Error("WALLET_ENCRYPTION_KEY no está configurada.");
  }
  const key = Buffer.from(base64Key, "base64");
  if (key.length !== 32) {
    throw new Error("WALLET_ENCRYPTION_KEY debe decodificar a 32 bytes (AES-256).");
  }
  return key;
}

/** Devuelve un string "iv:authTag:ciphertext" (todo en base64). */
export function encryptSecret(plaintext: string): string {
  const key = getKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return [iv.toString("base64"), authTag.toString("base64"), ciphertext.toString("base64")].join(":");
}

export function decryptSecret(payload: string): string {
  const key = getKey();
  const [ivB64, authTagB64, ciphertextB64] = payload.split(":");
  if (!ivB64 || !authTagB64 || !ciphertextB64) {
    throw new Error("Formato de secreto cifrado inválido.");
  }
  const decipher = createDecipheriv(ALGORITHM, key, Buffer.from(ivB64, "base64"));
  decipher.setAuthTag(Buffer.from(authTagB64, "base64"));
  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(ciphertextB64, "base64")),
    decipher.final(),
  ]);
  return plaintext.toString("utf8");
}
