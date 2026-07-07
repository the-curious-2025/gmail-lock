/**
 * Gmail Lock — options.js
 * ------------------------
 * Reads and writes protection state to chrome.storage.local:
 *   - enabled: boolean, whether Gmail Lock is active on THIS computer.
 *   - passwordHash: SHA-256 hex digest of the current password.
 *
 * Everything here talks to storage.local, never storage.sync, so a
 * setting made on one computer never travels to another one via Chrome
 * Sync — only the extension code itself syncs, not this state.
 */

const DEFAULT_PASSWORD = "1234";
const MIN_PASSWORD_LENGTH = 4;

const enabledToggle = document.getElementById("enabled-toggle");
const statusDot = document.getElementById("status-dot");
const statusText = document.getElementById("status-text");

const passwordForm = document.getElementById("password-form");
const newPasswordInput = document.getElementById("new-password");
const confirmPasswordInput = document.getElementById("confirm-password");
const passwordMessage = document.getElementById("password-message");
const resetBtn = document.getElementById("reset-btn");

async function sha256Hex(text) {
  const bytes = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function getLocal(keys) {
  return new Promise((resolve) => chrome.storage.local.get(keys, resolve));
}

function setLocal(items) {
  return new Promise((resolve) => chrome.storage.local.set(items, resolve));
}

function renderStatus(enabled) {
  enabledToggle.checked = Boolean(enabled);
  statusDot.classList.toggle("on", Boolean(enabled));
  statusDot.classList.toggle("off", !enabled);
  statusText.textContent = enabled
    ? "Protection is ON for this computer"
    : "Protection is OFF for this computer";
}

function showMessage(el, text, type) {
  el.textContent = text;
  el.hidden = false;
  el.classList.remove("success", "error");
  el.classList.add(type);
}

function hideMessage(el) {
  el.hidden = true;
  el.classList.remove("success", "error");
}

async function loadInitialState() {
  const { enabled } = await getLocal(["enabled"]);
  renderStatus(Boolean(enabled));
}

enabledToggle.addEventListener("change", async () => {
  const enabled = enabledToggle.checked;
  await setLocal({ enabled });
  renderStatus(enabled);
});

passwordForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  hideMessage(passwordMessage);

  const next = newPasswordInput.value;
  const confirm = confirmPasswordInput.value;

  if (next.length < MIN_PASSWORD_LENGTH) {
    showMessage(
      passwordMessage,
      `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`,
      "error"
    );
    return;
  }

  if (next !== confirm) {
    showMessage(passwordMessage, "Passwords don't match. Try again.", "error");
    return;
  }

  const passwordHash = await sha256Hex(next);
  await setLocal({ passwordHash });

  newPasswordInput.value = "";
  confirmPasswordInput.value = "";
  showMessage(passwordMessage, "Password saved.", "success");
});

resetBtn.addEventListener("click", async () => {
  hideMessage(passwordMessage);
  const passwordHash = await sha256Hex(DEFAULT_PASSWORD);
  await setLocal({ passwordHash });
  newPasswordInput.value = "";
  confirmPasswordInput.value = "";
  showMessage(passwordMessage, `Password reset to the default (${DEFAULT_PASSWORD}).`, "success");
});

loadInitialState();
