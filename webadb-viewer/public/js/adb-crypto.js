/**
 * ADB 认证所需的 RSA 密钥对生成和签名工具
 * 
 * 关键：ADB 的 AUTH_SIGNATURE 要求对 20 字节 token 做 PKCS#1 v1.5 签名，
 * 但 token 本身已经是 SHA-1 摘要（prehashed），不需要再哈希。
 * Web Crypto API 不支持 prehashed 模式，所以需要手动实现 RSA 签名。
 * 
 * 公钥格式参考 Android 源码:
 * https://android.googlesource.com/platform/system/core/+/refs/tags/android-10.0.0_r17/libcrypto_utils/android_pubkey.c
 */

const ADB_KEY_STORAGE = 'webadb_rsa_key';
const MODULUS_SIZE = 256; // 2048 bits = 256 bytes
const MODULUS_SIZE_WORDS = 64; // 256 / 4

// SHA-1 的 DigestInfo 前缀 (DER 编码)
const SHA1_DIGEST_INFO_PREFIX = new Uint8Array([
  0x30, 0x21, 0x30, 0x09, 0x06, 0x05, 0x2b, 0x0e,
  0x03, 0x02, 0x1a, 0x05, 0x00, 0x04, 0x14
]);

export class AdbKeyStore {
  constructor() {
    this.keyPair = null;
  }

  /**
   * 获取或生成 RSA 密钥对
   */
  async getKey() {
    if (this.keyPair) return this.keyPair;

    const stored = localStorage.getItem(ADB_KEY_STORAGE);
    if (stored) {
      try {
        const data = JSON.parse(stored);
        const jwkPrivate = JSON.parse(data.jwkPrivate);
        const jwkPublic = JSON.parse(data.jwk);
        this.keyPair = { jwkPrivate, jwkPublic };
        return this.keyPair;
      } catch (e) {
        console.warn('加载存储的密钥失败，重新生成', e);
        localStorage.removeItem(ADB_KEY_STORAGE);
      }
    }

    // 生成密钥对（用 Web Crypto 生成，但签名时手动做）
    const key = await crypto.subtle.generateKey(
      {
        name: 'RSASSA-PKCS1-v1_5',
        modulusLength: 2048,
        publicExponent: new Uint8Array([0x01, 0x00, 0x01]),
        hash: 'SHA-1'
      },
      true, ['sign', 'verify']
    );

    const jwkPrivate = await crypto.subtle.exportKey('jwk', key.privateKey);
    const jwkPublic = await crypto.subtle.exportKey('jwk', key.publicKey);

    localStorage.setItem(ADB_KEY_STORAGE, JSON.stringify({
      jwkPrivate: JSON.stringify(jwkPrivate),
      jwk: JSON.stringify(jwkPublic)
    }));

    this.keyPair = { jwkPrivate, jwkPublic };
    return this.keyPair;
  }

  /**
   * 对 ADB token 做 RSA PKCS#1 v1.5 签名（prehashed SHA-1）
   * token 是 20 字节，已经是 SHA-1 摘要，不需要再哈希
   */
  async sign(tokenData) {
    const key = await this.getKey();
    const { n: nB64, d: dB64 } = key.jwkPrivate;

    const n = bytesToBigInt(base64UrlToBytes(nB64));
    const d = bytesToBigInt(base64UrlToBytes(dB64));
    const token = new Uint8Array(tokenData);

    // 构建 PKCS#1 v1.5 签名块:
    // 0x00 0x01 [0xFF padding] 0x00 [DigestInfo prefix] [token/hash]
    const tLen = SHA1_DIGEST_INFO_PREFIX.length + token.length; // 15 + 20 = 35
    const padLen = MODULUS_SIZE - tLen - 3; // 256 - 35 - 3 = 218

    const em = new Uint8Array(MODULUS_SIZE);
    let offset = 0;
    em[offset++] = 0x00;
    em[offset++] = 0x01;
    for (let i = 0; i < padLen; i++) {
      em[offset++] = 0xFF;
    }
    em[offset++] = 0x00;
    em.set(SHA1_DIGEST_INFO_PREFIX, offset);
    offset += SHA1_DIGEST_INFO_PREFIX.length;
    em.set(token, offset);

    // RSA 签名: signature = em^d mod n
    const m = bytesToBigInt(em);
    const sig = modPow(m, d, n);

    // 转为 256 字节大端序
    return bigIntToBE(sig, MODULUS_SIZE).buffer;
  }

  /**
   * 获取 ADB 格式的公钥 payload
   */
  async getPublicKeyPayload() {
    const key = await this.getKey();
    const { n: nB64, e: eB64 } = key.jwkPublic;

    const nBytes = base64UrlToBytes(nB64);
    const eBytes = base64UrlToBytes(eB64);

    const n = bytesToBigInt(nBytes);
    const e = bytesToBigInt(eBytes);

    // n0inv = -(n mod 2^32)^(-1) mod 2^32
    const mod32 = 1n << 32n;
    const n0 = n % mod32;
    const n0inv_pos = modInverse(n0, mod32);
    const n0inv = (mod32 - n0inv_pos) % mod32;

    // rr = (2^(MODULUS_SIZE*8))^2 mod n
    const R = 1n << BigInt(MODULUS_SIZE * 8);
    const rr = (R * R) % n;

    // 构建 524 字节结构体
    const struct = new ArrayBuffer(4 + 4 + MODULUS_SIZE + MODULUS_SIZE + 4);
    const view = new DataView(struct);
    const bytes = new Uint8Array(struct);

    let offset = 0;
    view.setUint32(offset, MODULUS_SIZE_WORDS, true); offset += 4;
    view.setUint32(offset, Number(n0inv), true); offset += 4;
    bytes.set(bigIntToLE(n, MODULUS_SIZE), offset); offset += MODULUS_SIZE;
    bytes.set(bigIntToLE(rr, MODULUS_SIZE), offset); offset += MODULUS_SIZE;
    view.setUint32(offset, Number(e), true);

    const b64 = bufferToBase64(struct);
    const payload = b64 + ' webadb@browser\0';
    return new TextEncoder().encode(payload);
  }
}

/**
 * 模幂运算: base^exp mod mod（快速幂）
 */
function modPow(base, exp, mod) {
  let result = 1n;
  base = base % mod;
  while (exp > 0n) {
    if (exp & 1n) {
      result = (result * base) % mod;
    }
    exp >>= 1n;
    base = (base * base) % mod;
  }
  return result;
}

/**
 * 模逆元: a^(-1) mod m
 */
function modInverse(a, m) {
  a = ((a % m) + m) % m;
  let [old_r, r] = [a, m];
  let [old_s, s] = [1n, 0n];
  while (r !== 0n) {
    const q = old_r / r;
    [old_r, r] = [r, old_r - q * r];
    [old_s, s] = [s, old_s - q * s];
  }
  return ((old_s % m) + m) % m;
}

/**
 * BigInt 转小端序字节数组
 */
function bigIntToLE(value, length) {
  const result = new Uint8Array(length);
  let v = value;
  for (let i = 0; i < length; i++) {
    result[i] = Number(v & 0xFFn);
    v >>= 8n;
  }
  return result;
}

/**
 * BigInt 转大端序字节数组
 */
function bigIntToBE(value, length) {
  const result = new Uint8Array(length);
  let v = value;
  for (let i = length - 1; i >= 0; i--) {
    result[i] = Number(v & 0xFFn);
    v >>= 8n;
  }
  return result;
}

/**
 * 字节数组（大端序）转 BigInt
 */
function bytesToBigInt(bytes) {
  let result = 0n;
  for (let i = 0; i < bytes.length; i++) {
    result = (result << 8n) | BigInt(bytes[i]);
  }
  return result;
}

function base64UrlToBytes(b64url) {
  let b64 = b64url.replace(/-/g, '+').replace(/_/g, '/');
  while (b64.length % 4) b64 += '=';
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function bufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}
