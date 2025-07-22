
const HmacHelper = require('./hmac');

class Crypto {
  // RSA parameters (hardcoded for demo)
  static P = 61;
  static Q = 53;
  static N = Crypto.P * Crypto.Q; // 3233
  static E = 17;
  static D = 2753; // E*D % PHI = 1

  // Modular exponentiation for RSA
  static modPow(base, exponent, modulus) {
    let result = 1;
    base = base % modulus;
    while (exponent > 0) {
      if (exponent % 2 === 1) result = (result * base) % modulus;
      exponent = Math.floor(exponent / 2);
      base = (base * base) % modulus;
    }
    return result;
  }

  // Encrypt text using RSA, leave emojis as-is
  static encryptMessage(text) {
    if (!text) return '';
    let encrypted = '';
    for (let i = 0; i < text.length; i++) {
      const code = text.charCodeAt(i);
      if (code >= 32 && code <= 126) {
        // Encrypt ASCII text with RSA
        const enc = Crypto.modPow(code, Crypto.E, Crypto.N);
        encrypted += '#' + enc + ';';
      } else {
        // Leave emojis and Unicode as-is
        encrypted += text[i];
      }
    }
    return encrypted;
  }

  // Decrypt RSA encrypted text, leave emojis as-is
  static decryptMessage(text) {
    if (!text) return '';
    let decrypted = '';
    let i = 0;
    while (i < text.length) {
      if (text[i] === '#') {
        let j = i + 1;
        let numStr = '';
        while (j < text.length && text[j] !== ';') {
          numStr += text[j];
          j++;
        }
        if (text[j] === ';') {
          const enc = parseInt(numStr);
          const dec = Crypto.modPow(enc, Crypto.D, Crypto.N);
          decrypted += String.fromCharCode(dec);
          i = j + 1;
        } else {
          // Malformed, just add #
          decrypted += '#';
          i++;
        }
      } else {
        decrypted += text[i];
        i++;
      }
    }
    return decrypted;
  }

  static signHMAC(msg) {
    return HmacHelper.generateHmac(msg);
  }

  static verifyHMAC(msg, sig) {
    return HmacHelper.generateHmac(msg) === sig;
  }
}

module.exports = Crypto; 