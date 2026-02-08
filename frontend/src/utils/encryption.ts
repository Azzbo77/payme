/**
 * Encryption utilities for sensitive data using Web Crypto API
 * Uses AES-256-GCM for authenticated encryption
 */

const APP_SECRET = "payme-app-encryption-salt"; // Non-sensitive salt, ok to be in code

interface EncryptedData {
  ciphertext: string;
  iv: string;
  salt: string;
}

/**
 * Derive encryption key from user ID and optional passphrase
 */
async function deriveKey(userId: number, passphrase?: string): Promise<CryptoKey> {
  // Combine app secret with user ID and optional passphrase
  const combined = `${APP_SECRET}:${userId}${passphrase ? `:${passphrase}` : ""}`;
  
  // Convert to buffer
  const encoder = new TextEncoder();
  const data = encoder.encode(combined);
  
  // Hash with SHA-256
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  
  // Import as encryption key
  const key = await crypto.subtle.importKey(
    "raw",
    hashBuffer,
    { name: "AES-GCM" },
    false, // Not extractable for security
    ["encrypt", "decrypt"]
  );
  
  return key;
}

/**
 * Encrypt data with AES-256-GCM
 */
export async function encrypt(
  data: unknown,
  userId: number,
  passphrase?: string
): Promise<EncryptedData> {
  try {
    const key = await deriveKey(userId, passphrase);
    
    // Generate random IV (96 bits for GCM)
    const iv = crypto.getRandomValues(new Uint8Array(12));
    
    // Convert data to JSON and then to bytes
    const jsonString = JSON.stringify(data);
    const encoder = new TextEncoder();
    const plaintext = encoder.encode(jsonString);
    
    // Encrypt with AES-256-GCM
    const cipherBuffer = await crypto.subtle.encrypt(
      {
        name: "AES-GCM",
        iv: iv,
      },
      key,
      plaintext
    );
    
    // Convert to base64 for storage
    const ciphertext = btoa(
      String.fromCharCode.apply(null, Array.from(new Uint8Array(cipherBuffer)))
    );
    const ivString = btoa(String.fromCharCode.apply(null, Array.from(iv)));
    
    return {
      ciphertext,
      iv: ivString,
      salt: APP_SECRET, // Store salt reference (not critical)
    };
  } catch (error) {
    console.error("Encryption failed:", error);
    throw new Error("Failed to encrypt data");
  }
}

/**
 * Decrypt data encrypted with encrypt()
 */
export async function decrypt(
  encrypted: EncryptedData,
  userId: number,
  passphrase?: string
): Promise<unknown> {
  try {
    const key = await deriveKey(userId, passphrase);
    
    // Convert from base64
    const cipherBytes = Uint8Array.from(
      atob(encrypted.ciphertext),
      (c) => c.charCodeAt(0)
    );
    const iv = Uint8Array.from(
      atob(encrypted.iv),
      (c) => c.charCodeAt(0)
    );
    
    // Decrypt
    const decryptedBuffer = await crypto.subtle.decrypt(
      {
        name: "AES-GCM",
        iv: iv,
      },
      key,
      cipherBytes
    );
    
    // Convert back to JSON
    const decoder = new TextDecoder();
    const jsonString = decoder.decode(decryptedBuffer);
    const data = JSON.parse(jsonString);
    
    return data;
  } catch (error) {
    console.error("Decryption failed:", error);
    throw new Error("Failed to decrypt data - passphrase may be incorrect");
  }
}

/**
 * Check if browser supports Web Crypto API
 */
export function isEncryptionSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.crypto !== "undefined" &&
    typeof window.crypto.subtle !== "undefined"
  );
}
