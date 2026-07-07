/**
 * Gmail Lock — content.js
 * ------------------------
 * Runs at document_start on https://mail.google.com/*.
 *
 * Behavior:
 *  - Reads { enabled, passwordHash } from chrome.storage.local (LOCAL only,
 *    never storage.sync — this is what makes protection "this computer only",
 *    since chrome.storage.sync would follow the user's Google account to
 *    every machine Chrome is signed into).
 *  - If protection isn't enabled on this computer, does nothing and Gmail
 *    loads normally.
 *  - If enabled, mounts a full-screen lock overlay inside a closed Shadow
 *    DOM so Gmail's styles/scripts can't see or interfere with it (and it
 *    can't leak styles into Gmail either).
 *  - The overlay blocks scrolling and pointer events to the page behind it
 *    and blurs Gmail via backdrop-filter until the correct password is
 *    entered (verified by comparing a SHA-256 hash, never the raw text).
 *  - There is deliberately no timeout and no re-prompting on every load:
 *    once unlocked, this tab is marked unlocked in sessionStorage (scoped
 *    to this tab + origin), which survives refreshes and in-page
 *    navigation but is cleared the moment the tab is closed. So refreshing
 *    Gmail does NOT ask again — only closing the tab and reopening it does.
 */

(() => {
  "use strict";

  // Keep this in sync with style.css — see the note at the top of that file.
  const LOCK_CSS = `
:host, * { box-sizing: border-box; }

.gmlk-overlay {
  position: fixed;
  inset: 0;
  z-index: 2147483647;
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
  animation: gmlk-fade-in 0.35s ease-out;
  pointer-events: auto;
}
.gmlk-overlay.gmlk-fade-out { animation: gmlk-fade-out 0.4s ease-in forwards; pointer-events: none; }
.gmlk-backdrop {
  position: absolute; inset: 0;
  background: rgba(5, 8, 12, 0.72);
  backdrop-filter: blur(22px) saturate(120%);
  -webkit-backdrop-filter: blur(22px) saturate(120%);
}
.gmlk-bg-grid {
  position: absolute; inset: 0; opacity: 0.35;
  background-image:
    linear-gradient(rgba(131, 206, 244, 0.06) 1px, transparent 1px),
    linear-gradient(90deg, rgba(131, 206, 244, 0.06) 1px, transparent 1px);
  background-size: 42px 42px;
  mask-image: radial-gradient(circle at 50% 40%, black, transparent 75%);
}
.gmlk-panel {
  position: relative;
  width: min(360px, 88vw);
  padding: 40px 32px 32px;
  border-radius: 24px;
  background: linear-gradient(180deg, rgba(15, 22, 30, 0.85), rgba(9, 13, 18, 0.85));
  border: 1px solid rgba(131, 206, 244, 0.18);
  box-shadow: 0 0 0 1px rgba(131, 206, 244, 0.04), 0 24px 60px rgba(0, 0, 0, 0.55), 0 0 40px rgba(131, 206, 244, 0.08);
  backdrop-filter: blur(6px);
  -webkit-backdrop-filter: blur(6px);
  text-align: center;
  color: #e7f3fa;
  animation: gmlk-rise 0.45s cubic-bezier(0.16, 1, 0.3, 1);
}
.gmlk-panel.gmlk-shake { animation: gmlk-shake 0.45s cubic-bezier(0.36, 0.07, 0.19, 0.97); }
.gmlk-shield {
  position: relative; width: 64px; height: 64px; margin: 0 auto 20px;
  display: flex; align-items: center; justify-content: center;
  border-radius: 16px;
  background: radial-gradient(circle at 50% 30%, rgba(131, 206, 244, 0.16), rgba(131, 206, 244, 0.02));
  border: 1px solid rgba(131, 206, 244, 0.3);
  overflow: hidden;
}
.gmlk-shield svg { width: 30px; height: 30px; position: relative; z-index: 2; }
.gmlk-shield::after {
  content: ""; position: absolute; left: -100%; top: 0; width: 60%; height: 100%;
  background: linear-gradient(90deg, transparent, rgba(131, 206, 244, 0.5), transparent);
  animation: gmlk-scan 2.6s ease-in-out infinite;
}
.gmlk-eyebrow {
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 11px; letter-spacing: 0.18em; text-transform: uppercase;
  color: #83cef4; opacity: 0.75; margin: 0 0 8px;
}
.gmlk-title { font-size: 22px; font-weight: 600; margin: 0 0 6px; letter-spacing: -0.01em; color: #f2f9fd; }
.gmlk-subtitle { font-size: 13.5px; color: #7d94a3; margin: 0 0 26px; }
.gmlk-form { display: flex; flex-direction: column; gap: 14px; }
.gmlk-input-wrap { position: relative; }
.gmlk-input {
  width: 100%; padding: 13px 16px; font-size: 20px; letter-spacing: 0.4em; text-align: center;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  color: #f2f9fd; background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(131, 206, 244, 0.2); border-radius: 12px; outline: none;
  transition: border-color 0.2s ease, box-shadow 0.2s ease, background 0.2s ease;
}
.gmlk-input::placeholder {
  letter-spacing: normal; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  color: #4d626f; font-size: 13px;
}
.gmlk-input:focus {
  border-color: rgba(131, 206, 244, 0.7); background: rgba(131, 206, 244, 0.05);
  box-shadow: 0 0 0 4px rgba(131, 206, 244, 0.12), 0 0 20px rgba(131, 206, 244, 0.15);
}
.gmlk-error { font-size: 12.5px; color: #ff6b7a; margin: -4px 0 0; min-height: 16px; transition: opacity 0.15s ease; }
.gmlk-error[hidden] { display: none; }
.gmlk-btn {
  margin-top: 4px; padding: 13px 16px; font-size: 14px; font-weight: 600; letter-spacing: 0.02em;
  color: #05080c; background: linear-gradient(180deg, #9adcff, #83cef4);
  border: none; border-radius: 12px; cursor: pointer;
  transition: transform 0.15s ease, box-shadow 0.2s ease, filter 0.2s ease;
  box-shadow: 0 8px 24px rgba(131, 206, 244, 0.25);
}
.gmlk-btn:hover { filter: brightness(1.06); box-shadow: 0 10px 28px rgba(131, 206, 244, 0.35); }
.gmlk-btn:active { transform: scale(0.97); }
.gmlk-footer { margin-top: 22px; font-size: 11px; color: #445560; letter-spacing: 0.03em; }
@keyframes gmlk-fade-in { from { opacity: 0; } to { opacity: 1; } }
@keyframes gmlk-fade-out { from { opacity: 1; } to { opacity: 0; } }
@keyframes gmlk-rise { from { opacity: 0; transform: translateY(14px) scale(0.98); } to { opacity: 1; transform: translateY(0) scale(1); } }
@keyframes gmlk-shake {
  10%, 90% { transform: translateX(-1px); }
  20%, 80% { transform: translateX(2px); }
  30%, 50%, 70% { transform: translateX(-6px); }
  40%, 60% { transform: translateX(6px); }
}
@keyframes gmlk-scan { 0% { left: -60%; } 100% { left: 130%; } }
@media (prefers-reduced-motion: reduce) {
  .gmlk-overlay, .gmlk-panel, .gmlk-shield::after { animation: none !important; }
}
`;

  const SHIELD_SVG = `
    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M12 2L4 5v6c0 5 3.4 9.4 8 11 4.6-1.6 8-6 8-11V5l-8-3z" stroke="#83CEF4" stroke-width="1.4" fill="rgba(131,206,244,0.08)"/>
      <rect x="9" y="11" width="6" height="5" rx="1.2" stroke="#83CEF4" stroke-width="1.3" fill="none"/>
      <path d="M10 11V9.3a2 2 0 0 1 4 0V11" stroke="#83CEF4" stroke-width="1.3" fill="none"/>
    </svg>
  `;

  /** Hash arbitrary text with SHA-256 and return a lowercase hex string. */
  async function sha256Hex(text) {
    const bytes = new TextEncoder().encode(text);
    const digest = await crypto.subtle.digest("SHA-256", bytes);
    return Array.from(new Uint8Array(digest))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  }

  // sessionStorage is scoped to this tab and this origin: it survives page
  // refreshes and in-page navigation, but is wiped the moment the tab (or
  // window) is closed. That's exactly the behavior we want — stay unlocked
  // through refreshes, re-lock only when the Gmail tab is actually closed.
  // Keyed by the password's hash so a password change forces a fresh
  // unlock instead of honoring a stale session.
  const SESSION_KEY = "gmailLockUnlockedHash";

  function isUnlockedThisSession(passwordHash) {
    try {
      return sessionStorage.getItem(SESSION_KEY) === passwordHash;
    } catch (err) {
      return false; // sessionStorage unavailable — fail safe, show the lock.
    }
  }

  function markUnlockedThisSession(passwordHash) {
    try {
      sessionStorage.setItem(SESSION_KEY, passwordHash);
    } catch (err) {
      // Ignore — worst case the next refresh asks for the password again.
    }
  }

  function getLocalStorage(keys) {
    return new Promise((resolve) => {
      chrome.storage.local.get(keys, resolve);
    });
  }

  function mountLockScreen(passwordHash) {
    const host = document.createElement("div");
    host.id = "gmail-lock-host";
    (document.documentElement || document.body).appendChild(host);

    // Closed shadow root: page scripts (and Gmail itself) cannot reach in
    // via document.querySelector or similar, which keeps the lock screen
    // isolated even though it lives inside the Gmail page.
    const shadow = host.attachShadow({ mode: "closed" });

    const styleEl = document.createElement("style");
    styleEl.textContent = LOCK_CSS;
    shadow.appendChild(styleEl);

    const wrap = document.createElement("div");
    wrap.innerHTML = `
      <div class="gmlk-overlay">
        <div class="gmlk-backdrop"></div>
        <div class="gmlk-bg-grid"></div>
        <div class="gmlk-panel">
          <div class="gmlk-shield">${SHIELD_SVG}</div>
          <p class="gmlk-eyebrow">Restricted Access</p>
          <h1 class="gmlk-title">Gmail is locked</h1>
          <p class="gmlk-subtitle">Enter the password to continue</p>
          <form class="gmlk-form" autocomplete="off">
            <div class="gmlk-input-wrap">
              <input
                class="gmlk-input"
                type="password"
                inputmode="numeric"
                placeholder="Password"
                autocomplete="off"
                autocapitalize="off"
                spellcheck="false"
              />
            </div>
            <p class="gmlk-error" hidden>Incorrect password. Try again.</p>
            <button type="submit" class="gmlk-btn">Unlock</button>
          </form>
          <p class="gmlk-footer">Protected on this computer</p>
        </div>
      </div>
    `;
    shadow.appendChild(wrap);

    const overlay = shadow.querySelector(".gmlk-overlay");
    const panel = shadow.querySelector(".gmlk-panel");
    const form = shadow.querySelector(".gmlk-form");
    const input = shadow.querySelector(".gmlk-input");
    const errorEl = shadow.querySelector(".gmlk-error");

    // Freeze the page behind the overlay: no scrolling, no reaching Gmail
    // with the keyboard/wheel while locked. Click-through is already
    // prevented because the overlay covers the full viewport and sits at
    // the top of the stacking context.
    const docEl = document.documentElement;
    const previousOverflow = docEl.style.overflow;
    docEl.style.overflow = "hidden";

    const blockWhileLocked = (event) => {
      // Events originating inside our own shadow tree are retargeted to
      // `host` once they cross the shadow boundary (composed events like
      // keydown/wheel retarget at each shadow-root boundary). Without this
      // check, this listener would swallow every keystroke typed into the
      // password field itself, since it fires on window in the capture
      // phase before the input ever sees the event.
      if (event.target === host) return;
      event.stopPropagation();
      event.preventDefault();
    };
    const blockedEvents = ["keydown", "wheel", "touchmove"];
    blockedEvents.forEach((type) => {
      window.addEventListener(type, blockWhileLocked, { capture: true, passive: false });
    });

    // Let the fade-in finish, then focus the input for a quick unlock.
    input.focus();
    window.setTimeout(() => input.focus(), 80);

    // Gmail's own scripts sometimes autofocus their own search bar as the
    // page finishes loading, which can steal focus away from the password
    // field right after we set it — keystrokes then land nowhere (they're
    // correctly blocked from reaching Gmail, but never reach our input
    // either). Reclaim focus any time it lands outside the lock screen
    // while it's still showing.
    const reclaimFocus = (event) => {
      if (event.target !== host) {
        input.focus();
      }
    };
    document.addEventListener("focusin", reclaimFocus, true);

    function showError() {
      errorEl.hidden = false;
      panel.classList.remove("gmlk-shake");
      // Force reflow so the shake animation can replay on repeated misses.
      void panel.offsetWidth;
      panel.classList.add("gmlk-shake");
      input.value = "";
      input.focus();
    }

    function unlock() {
      markUnlockedThisSession(passwordHash);
      blockedEvents.forEach((type) => {
        window.removeEventListener(type, blockWhileLocked, { capture: true });
      });
      document.removeEventListener("focusin", reclaimFocus, true);
      docEl.style.overflow = previousOverflow;
      overlay.classList.add("gmlk-fade-out");
      window.setTimeout(() => host.remove(), 420);
    }

    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const attempt = input.value;
      if (!attempt) return;
      const attemptHash = await sha256Hex(attempt);
      if (attemptHash === passwordHash) {
        unlock();
      } else {
        showError();
      }
    });

    // Typing again after a failed attempt should clear the error state.
    input.addEventListener("input", () => {
      if (!errorEl.hidden) errorEl.hidden = true;
    });

    // Enter submits the form explicitly (in addition to the button),
    // so pressing Enter unlocks without ever touching the mouse.
    input.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        form.requestSubmit();
      }
    });
  }

  async function init() {
    const { enabled, passwordHash } = await getLocalStorage(["enabled", "passwordHash"]);
    // Not enabled on this computer, or never configured — leave Gmail alone.
    if (!enabled || !passwordHash) return;
    // Already unlocked this tab this session (e.g. a refresh) — skip the
    // prompt. A brand-new tab has no sessionStorage entry yet, so it still
    // asks for the password.
    if (isUnlockedThisSession(passwordHash)) return;
    mountLockScreen(passwordHash);
  }

  init();
})();
