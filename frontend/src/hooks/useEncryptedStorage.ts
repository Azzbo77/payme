import { useState, useCallback, useEffect } from "react";
import { encrypt, decrypt, isEncryptionSupported } from "../utils/encryption";

interface EncryptedStorageItem {
  ciphertext: string;
  iv: string;
  salt: string;
  version: number; // For future compatibility
}

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
        const item = localStorage.getItem(key);
        if (item) {
          return JSON.parse(item);
        }
        return initialValue;
      }

      // Try to get encrypted value
      const item = localStorage.getItem(key);
      if (!item) {
        return initialValue;
      }

      try {
        const parsed = JSON.parse(item) as EncryptedStorageItem;
        // Check if it looks like an encrypted item
        if (parsed.ciphertext && parsed.iv && parsed.version) {
          // Return marker that we need to decrypt
          return { __encrypted: true, __data: parsed } as any;
        }
      } catch {
        // Not encrypted, assume it's plain JSON
        return JSON.parse(item);
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
          localStorage.setItem(key, JSON.stringify(valueToStore));
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
            localStorage.setItem(key, JSON.stringify(item));
            setStoredValue(valueToStore);
            setDecryptedValue(valueToStore);
          })
          .catch((error) => {
            console.error("Failed to encrypt and store value:", error);
            // Fall back to unencrypted
            localStorage.setItem(key, JSON.stringify(valueToStore));
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
