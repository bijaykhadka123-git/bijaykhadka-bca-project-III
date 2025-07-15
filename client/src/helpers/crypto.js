// Hardcoded RSA algorithm for text encryption/decryption
// Emojis and Unicode characters are left as-is (no encryption)

// RSA parameters (hardcoded for demo)
const P = 61;
const Q = 53;
const N = P * Q; // 3233
const PHI = (P - 1) * (Q - 1); // 3120
const E = 17;
const D = 2753; // E*D % PHI = 1

// Modular exponentiation for RSA
function modPow(base, exponent, modulus) {
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
function encryptMessage(text) {
  if (!text) return '';
  let encrypted = '';
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    if (code >= 32 && code <= 126) {
      // Encrypt ASCII text with RSA
      const enc = modPow(code, E, N);
      encrypted += '#' + enc + ';';
    } else {
      // Leave emojis and Unicode as-is
      encrypted += text[i];
    }
  }
  return encrypted;
}

// Decrypt RSA encrypted text, leave emojis as-is
function decryptMessage(text) {
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
        const dec = modPow(enc, D, N);
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

// Real HMAC-SHA256 using Web Crypto API
const HMAC_KEY = 'my-frontend-demo-key'; // For demo only, do not use in production

async function getKey() {
  const enc = new TextEncoder();
  return await window.crypto.subtle.importKey(
    'raw',
    enc.encode(HMAC_KEY),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify']
  );
}

async function signHMAC(msg) {
  const key = await getKey();
  const enc = new TextEncoder();
  const sig = await window.crypto.subtle.sign(
    'HMAC',
    key,
    enc.encode(msg)
  );
  // Convert ArrayBuffer to hex string
  return Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, '0')).join('');
}

async function verifyHMAC(msg, sig) {
  const key = await getKey();
  const enc = new TextEncoder();
  const expectedSig = await signHMAC(msg);
  return expectedSig === sig;
}

// Export functions for client-side use
export {
  encryptMessage,
  decryptMessage,
  signHMAC,
  verifyHMAC
}; 