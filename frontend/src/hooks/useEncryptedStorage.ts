import { useState, useCallback, useEffect } from "react";
import { encrypt, decrypt, isEncryptionSupported } from "../utils/encryption";
import {
  setInCache,
  getFromCache,
} from "../utils/lruCache";

interface EncryptedStorageItem {
  ciphertext: string;
  iv: string;
  salt: string;
  version: number; // For future compatibility
}

// LRU cache configuration for encrypted storage
const LRU_CONFIG = {
  maxItems: 100, // Allow up to 100 items (portfolio items)
  maxSizeBytes: 10 * 1024 * 1024, // 10MB max storage
  namespace: "encrypted_storage",
};

/**
 * Hook for encrypted localStorage with optional passphrase support
 * Automatically encrypts on write, decrypts on read
 */
export function useEncryptedStorage<T>(
  key: string,
  initialValue: T,
  userId?: number | null,
  passphrase?: string
): [T, (value: T | ((val: T) => T)) => void] {
  const [storedValue, setStoredValue] = useState<T>(() => {
    try {
      // If no crypto support or no user ID, fall back to unencrypted
      if (!isEncryptionSupported() || !userId) {
        const item = getFromCache(key, LRU_CONFIG);
        if (item !== null) {
          return typeof item === "string" ? JSON.parse(item) : (item as T);
        }
        return initialValue;
      }

      // Try to get encrypted value
      const item = getFromCache(key, LRU_CONFIG);
      if (item === null) {
        return initialValue;
      }

      try {
        const parsed =
          typeof item === "string" ? JSON.parse(item) : item;
        // Check if it looks like an encrypted item
        if (parsed?.ciphertext && parsed?.iv && parsed?.version) {
          // Return marker that we need to decrypt
          return { __encrypted: true, __data: parsed } as any;
        }
      } catch {
        // Not encrypted, assume it's plain JSON
        return typeof item === "string" ? JSON.parse(item) : (item as T);
      }

      return initialValue;
    } catch (error) {
      console.error("Failed to read from encrypted storage:", error);
      return initialValue;
    }
  });

  // Handle lazy decryption
  const [decryptedValue, setDecryptedValue] = useState<T>(storedValue);

  useEffect(() => {
    if (
      !isEncryptionSupported() ||
      !userId ||
      !storedValue ||
      typeof storedValue !== "object"
    ) {
      setDecryptedValue(storedValue);
      return;
    }

    const value = storedValue as any;
    if (value.__encrypted && value.__data) {
      // Decrypt asynchronously
      decrypt(value.__data, userId, passphrase)
        .then((decrypted) => {
          setDecryptedValue(decrypted as T);
        })
        .catch((error) => {
          console.error("Decryption error:", error);
          setDecryptedValue(storedValue);
        });
    } else {
      setDecryptedValue(storedValue);
    }
  }, [storedValue, userId, passphrase]);

  const setValue = useCallback(
    (value: T | ((val: T) => T)) => {
      try {
        const valueToStore = value instanceof Function ? value(decryptedValue) : value;

        // If no crypto support or no user ID, store unencrypted
        if (!isEncryptionSupported() || !userId) {
          setInCache(key, valueToStore, LRU_CONFIG);
          setStoredValue(valueToStore);
          setDecryptedValue(valueToStore);
          return;
        }

        // Encrypt and store
        encrypt(valueToStore, userId, passphrase)
          .then((encrypted) => {
            const item: EncryptedStorageItem = {
              ...encrypted,
              version: 1,
            };
            setInCache(key, item, LRU_CONFIG);
            setStoredValue(valueToStore);
            setDecryptedValue(valueToStore);
          })
          .catch((error) => {
            console.error("Failed to encrypt and store value:", error);
            // Fall back to unencrypted
            setInCache(key, valueToStore, LRU_CONFIG);
            setStoredValue(valueToStore);
            setDecryptedValue(valueToStore);
          });
      } catch (error) {
        console.error("Failed to set encrypted storage value:", error);
      }
    },
    [decryptedValue, key, userId, passphrase]
  );

  return [decryptedValue, setValue];
}
