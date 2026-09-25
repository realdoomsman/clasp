import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import type { Address, Hex } from "viem";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";

/**
 * Custodial wallet keys for Google accounts. A key only exists in plaintext
 * inside the request that uses it; at rest it is AES-256-GCM encrypted with
 * the master key from CUSTODY_MASTER_KEY (Railway variable, never in the
 * database). The wallet address is bound in as authenticated data.
 */

const KEY_VERSION = 1;

export type SealedKey = { address: Address; iv: Buffer; cipher: Buffer; version: number };

export function createSealedKey(masterKey: Buffer): SealedKey {
  const privateKey = generatePrivateKey();
  const { address } = privateKeyToAccount(privateKey);
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", masterKey, iv);
  cipher.setAAD(Buffer.from(address.toLowerCase()));
  const body = Buffer.concat([cipher.update(Buffer.from(privateKey.slice(2), "hex")), cipher.final()]);
  return { address, iv, cipher: Buffer.concat([body, cipher.getAuthTag()]), version: KEY_VERSION };
}

export function openSealedKey(masterKey: Buffer, sealed: SealedKey): Hex {
  if (sealed.version !== KEY_VERSION) throw new Error(`unknown custody key version ${sealed.version}`);
  const decipher = createDecipheriv("aes-256-gcm", masterKey, sealed.iv);
  decipher.setAAD(Buffer.from(sealed.address.toLowerCase()));
  decipher.setAuthTag(sealed.cipher.subarray(sealed.cipher.length - 16));
  const raw = Buffer.concat([decipher.update(sealed.cipher.subarray(0, sealed.cipher.length - 16)), decipher.final()]);
  const privateKey = `0x${raw.toString("hex")}` as Hex;
  if (privateKeyToAccount(privateKey).address.toLowerCase() !== sealed.address.toLowerCase()) {
    throw new Error("custody key does not match its address");
  }
  return privateKey;
}
