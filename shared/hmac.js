// shared/hmac.js

class HmacHelper {
  static K = [
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
  ];

  static rightRotate(n, x) {
    return (x >>> n) | (x << (32 - n));
  }

  static sha256(ascii) {
    let maxWord = Math.pow(2, 32);
    let result = '';

    let words = [],
      asciiBitLength = ascii.length * 8;

    let i, j;
    for (i = 0; i < ascii.length; i++) {
      words[i >> 2] |= ascii.charCodeAt(i) << (24 - (i % 4) * 8);
    }
    words[ascii.length >> 2] |= 0x80 << (24 - (ascii.length % 4) * 8);
    words[((ascii.length + 64 >> 9) << 4) + 15] = asciiBitLength;

    let w = new Array(64);
    let H = [
      0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a,
      0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19
    ];

    for (let block = 0; block < words.length; block += 16) {
      let oldH = H.slice(0);

      for (i = 0; i < 16; i++) w[i] = words[block + i] | 0;
      for (i = 16; i < 64; i++) {
        let s0 = this.rightRotate(7, w[i - 15]) ^ this.rightRotate(18, w[i - 15]) ^ (w[i - 15] >>> 3);
        let s1 = this.rightRotate(17, w[i - 2]) ^ this.rightRotate(19, w[i - 2]) ^ (w[i - 2] >>> 10);
        w[i] = (w[i - 16] + s0 + w[i - 7] + s1) | 0;
      }

      let a = H[0], b = H[1], c = H[2], d = H[3], e = H[4], f = H[5], g = H[6], h = H[7];

      for (i = 0; i < 64; i++) {
        let S1 = this.rightRotate(6, e) ^ this.rightRotate(11, e) ^ this.rightRotate(25, e);
        let ch = (e & f) ^ (~e & g);
        let temp1 = (h + S1 + ch + this.K[i] + w[i]) | 0;
        let S0 = this.rightRotate(2, a) ^ this.rightRotate(13, a) ^ this.rightRotate(22, a);
        let maj = (a & b) ^ (a & c) ^ (b & c);
        let temp2 = (S0 + maj) | 0;

        h = g;
        g = f;
        f = e;
        e = (d + temp1) | 0;
        d = c;
        c = b;
        b = a;
        a = (temp1 + temp2) | 0;
      }

      H[0] = (H[0] + a) | 0;
      H[1] = (H[1] + b) | 0;
      H[2] = (H[2] + c) | 0;
      H[3] = (H[3] + d) | 0;
      H[4] = (H[4] + e) | 0;
      H[5] = (H[5] + f) | 0;
      H[6] = (H[6] + g) | 0;
      H[7] = (H[7] + h) | 0;
    }

    for (i = 0; i < H.length; i++) {
      for (j = 3; j + 1; j--) {
        let b = (H[i] >> (j * 8)) & 255;
        result += ((b >> 4).toString(16)) + ((b & 0xf).toString(16));
      }
    }
    return result;
  }

  static toBytes(str) {
    let bytes = [];
    for (let i = 0; i < str.length; ++i) {
      bytes.push(str.charCodeAt(i));
    }
    return bytes;
  }

  static toStr(bytes) {
    return String.fromCharCode.apply(null, bytes);
  }

  static xorBytes(a, b) {
    let res = [];
    for (let i = 0; i < a.length; i++) {
      res.push(a[i] ^ b[i]);
    }
    return res;
  }

  static padKey(key, blockSize) {
    let keyBytes = this.toBytes(key);
    if (keyBytes.length > blockSize) {
      keyBytes = this.toBytes(this.sha256(key));
    }
    if (keyBytes.length < blockSize) {
      while (keyBytes.length < blockSize) keyBytes.push(0);
    }
    return keyBytes;
  }

  static generateHmac(message) {
    const blockSize = 64; // 512 bits = 64 bytes
    const HMAC_SECRET = 'hardcoded-hmac-secret-key'; // Hardcoded for demo, matches client
    let key = this.padKey(HMAC_SECRET, blockSize);

    let o_key_pad = this.xorBytes(key, Array(blockSize).fill(0x5c));
    let i_key_pad = this.xorBytes(key, Array(blockSize).fill(0x36));

    let innerHash = this.sha256(this.toStr(i_key_pad) + message);
    let hmac = this.sha256(this.toStr(o_key_pad) + innerHash);
    return hmac;
  }

  static verifyHmac(message, hmac) {
    return this.generateHmac(message) === hmac;
  }
}

// CommonJS export
module.exports = HmacHelper; 