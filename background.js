/**
 * Gmail Lock — background.js (MV3 service worker)
 * -------------------------------------------------
 * The service worker's only job is first-run setup: it makes sure
 * chrome.storage.local has a password hash and a protection flag before
 * anything else runs. Everything else (locking, unlocking, settings) is
 * handled by content.js and options.js directly against storage.local.
 *
 * Protection starts OFF by default. This is deliberate: installing the
 * extension (or having Chrome sync it to another machine) must never
 * silently lock Gmail somewhere the user didn't ask for. The user turns
 * protection on for a specific computer from the settings page.
 */

const DEFAULT_PASSWORD = "1234";

async function sha256Hex(text) {
  const bytes = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function ensureDefaults() {
  const existing = await new Promise((resolve) => {
    chrome.storage.local.get(["enabled", "passwordHash"], resolve);
  });

  const toSet = {};

  if (typeof existing.enabled !== "boolean") {
    toSet.enabled = false;
  }

  if (typeof existing.passwordHash !== "string" || !existing.passwordHash) {
    toSet.passwordHash = await sha256Hex(DEFAULT_PASSWORD);
  }

  if (Object.keys(toSet).length > 0) {
    chrome.storage.local.set(toSet);
  }
}

chrome.runtime.onInstalled.addListener(() => {
  ensureDefaults();
});

// Belt-and-suspenders: also check on browser startup in case storage.local
// was ever cleared without a fresh install event firing.
chrome.runtime.onStartup.addListener(() => {
  ensureDefaults();
});
