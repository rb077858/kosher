// Offline-unlock crypto for the portal. Must stay byte-identical with AdminKeyManager.kt,
// kosherguard_admin.py and admin/index.html (same functions, copied as an ES module).
const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

export function base32Encode(bytes) {
  let bits = 0, value = 0, out = "";
  for (const byte of bytes) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += BASE32_ALPHABET[(value >>> (bits - 5)) & 0x1F];
      bits -= 5;
    }
  }
  if (bits > 0) out += BASE32_ALPHABET[(value << (5 - bits)) & 0x1F];
  return out;
}

export function base32Decode(code) {
  const cleaned = code.replace(/[-\s]/g, "").toUpperCase();
  let bits = 0, value = 0;
  const out = [];
  for (const ch of cleaned) {
    const idx = BASE32_ALPHABET.indexOf(ch);
    if (idx < 0) continue;
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 0xFF);
      bits -= 8;
    }
  }
  return new Uint8Array(out);
}

export function toRecoveryCode(bytes) {
  const raw = base32Encode(bytes);
  const groups = [];
  for (let i = 0; i < raw.length; i += 4) groups.push(raw.slice(i, i + 4));
  return groups.join("-");
}

/** A fresh 32-byte master secret, as a recovery code (the format the app and QR use). */
export function newMasterSecret() {
  return toRecoveryCode(crypto.getRandomValues(new Uint8Array(32)));
}

export function randomToken(bytes = 16) {
  return [...crypto.getRandomValues(new Uint8Array(bytes))].map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function hmacSha256(keyBytes, msgBytes) {
  const key = await crypto.subtle.importKey("raw", keyBytes, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return new Uint8Array(await crypto.subtle.sign("HMAC", key, msgBytes));
}

export async function computeUnlockCode(masterRecoveryCode, deviceLabel, challenge) {
  const deviceSecret = await hmacSha256(base32Decode(masterRecoveryCode), new TextEncoder().encode(deviceLabel));
  const digest = await hmacSha256(deviceSecret, new TextEncoder().encode(challenge));
  const offset = digest[digest.length - 1] & 0x0F;
  const binary =
    ((digest[offset] & 0x7F) << 24) |
    (digest[offset + 1] << 16) |
    (digest[offset + 2] << 8) |
    (digest[offset + 3]);
  return (binary % 100000000).toString().padStart(8, "0");
}
