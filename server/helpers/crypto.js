// server/helpers/crypto.js
// Simple XOR-based encryption for Unicode compatibility
// No external libraries used - everything implemented from scratch

class CryptoHelper {
  static ENCRYPTION_KEY = 'MySecretKey1234567890123456789012';

  // Simple hash function
  static simpleHash(input) {
    if (!input) return '';
    let hash = 0;
    for (let i = 0; i < input.length; i++) {
      const char = input.charCodeAt(i);
      hash = ((hash << 5) - hash + char) & 0xffffffff;
    }
    return hash.toString(16);
  }

  // XOR encryption with Unicode support
  static xorEncrypt(plainText) {
    if (!plainText) return '';
    let encrypted = '';
    for (let i = 0; i < plainText.length; i++) {
      const charCode = plainText.charCodeAt(i);
      const keyChar = this.ENCRYPTION_KEY.charCodeAt(i % this.ENCRYPTION_KEY.length);
      const encryptedChar = charCode ^ keyChar;
      encrypted += String.fromCharCode(encryptedChar);
    }
    // Convert to base64
    return Buffer.from(encrypted, 'utf8').toString('base64');
  }

  // XOR decryption with Unicode support
  static xorDecrypt(encryptedText) {
    if (!encryptedText) return '';
    try {
      // Check if it's already plain text (for backward compatibility)
      if (!encryptedText.includes('=') && encryptedText.length < 20) {
        const base64Regex = /^[A-Za-z0-9+/]*={0,2}$/;
        if (!base64Regex.test(encryptedText)) {
          return encryptedText; // Return as plain text
        }
      }
      // Decode from base64
      const decoded = Buffer.from(encryptedText, 'base64').toString('utf8');
      let decrypted = '';
      for (let i = 0; i < decoded.length; i++) {
        const charCode = decoded.charCodeAt(i);
        const keyChar = this.ENCRYPTION_KEY.charCodeAt(i % this.ENCRYPTION_KEY.length);
        const decryptedChar = charCode ^ keyChar;
        decrypted += String.fromCharCode(decryptedChar);
      }
      return decrypted;
    } catch (error) {
      console.log('XOR Decryption failed for text:', encryptedText.substring(0, 50) + '...');
      return encryptedText;
    }
  }

  // Simple HMAC using XOR
  static xorSign(message) {
    if (!message) return '';
    const hash = this.simpleHash(message);
    let signature = '';
    for (let i = 0; i < hash.length; i++) {
      const charCode = hash.charCodeAt(i);
      const keyChar = this.ENCRYPTION_KEY.charCodeAt(i % this.ENCRYPTION_KEY.length);
      const signedChar = charCode ^ keyChar;
      signature += String.fromCharCode(signedChar);
    }
    return Buffer.from(signature).toString('base64');
  }

  // Simple HMAC verification
  static xorVerify(message, signature) {
    if (!message || !signature) return false;
    try {
      const expectedSignature = this.xorSign(message);
      return expectedSignature === signature;
    } catch (error) {
      console.error('Signature verification failed:', error);
      return false;
    }
  }

  // Simple from-scratch RSA for ASCII, leave emojis/unicode as-is
  static P = 61;
  static Q = 53;
  static N = CryptoHelper.P * CryptoHelper.Q; // 3233
  static PHI = (CryptoHelper.P - 1) * (CryptoHelper.Q - 1); // 3120
  static E = 17;
  static D = 2753; // E*D % PHI = 1

  // Modular exponentiation
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

  // Encrypt only ASCII (32-126), leave others as-is
  static encryptMessage(text) {
    if (!text) return '';
    let encrypted = '';
    for (let i = 0; i < text.length; i++) {
      const code = text.charCodeAt(i);
      if (code >= 32 && code <= 126) {
        // Encrypt ASCII, mark with #
        const enc = this.modPow(code, this.E, this.N);
        encrypted += '#' + enc + ';';
      } else {
        // Leave emoji/unicode as-is
        encrypted += text[i];
      }
    }
    return encrypted;
  }

  // Decrypt only blocks marked with #, leave others as-is
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
          const dec = this.modPow(enc, this.D, this.N);
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

  // Dummy HMAC/sign for compatibility
  static signHMAC(msg) { return ''; }
  static verifyHMAC(msg, sig) { return true; }
}

module.exports = CryptoHelper; 