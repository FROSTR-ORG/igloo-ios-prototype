/**
 * Crypto polyfill for React Native using expo-crypto.
 * Must be imported before any code that uses @noble/hashes.
 *
 * IMPORTANT: This unconditionally sets getRandomValues to ensure the expo-crypto
 * implementation is used. React Native may have a crypto object that exists but
 * doesn't have a working getRandomValues, causing errors like:
 * "crypto.getRandomValues must be defined"
 */
import { getRandomValues } from 'expo-crypto';

// Helper to set up crypto polyfill on a target object
function polyfillCrypto(target: typeof globalThis) {
  if (!target.crypto) {
    // @ts-expect-error - Polyfilling crypto object
    target.crypto = {};
  }
  // Always set getRandomValues - don't check if it exists because
  // RN's native crypto object may exist but not work properly
  // @ts-expect-error - Polyfilling getRandomValues
  target.crypto.getRandomValues = getRandomValues;
}

// Polyfill on all possible global objects
if (typeof global !== 'undefined') {
  polyfillCrypto(global as typeof globalThis);
}
if (typeof globalThis !== 'undefined') {
  polyfillCrypto(globalThis);
}
