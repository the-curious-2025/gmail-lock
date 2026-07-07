# Gmail Lock

A Chrome extension (Manifest V3) that puts a password lock screen in front of
Gmail — but only on the computer(s) you choose to enable it on.

Built for a home computer that's shared with non-technical family members.
It's a privacy screen, not a security product: uninstalling the extension is
an acceptable way to bypass it.

## Features

- **Gmail only.** The content script matches exactly `https://mail.google.com/*`
  and never touches any other site.
- **Full-screen lock.** Opening a Gmail tab shows a blurred, dimmed overlay
  that blocks scrolling and clicks until the correct password is entered.
- **No timeouts, no repeat prompts.** Unlock once and the tab stays
  unlocked — including through refreshes — for as long as it stays open.
  Closing the tab is what asks for the password again.
- **This computer only.** Protection is controlled by a flag in
  `chrome.storage.local` (never `chrome.storage.sync`), so enabling it on
  your home PC does not enable it on your office PC, even though Chrome
  syncs the extension itself to both.
- **Hashed password.** The password is never stored as plain text — only its
  SHA-256 hash (via the Web Crypto API) is saved, and only the hash is ever
  compared.
- **Settings page.** Toggle protection for the current computer, change the
  password, or reset it back to the default.

## Install (load unpacked)

1. Unzip this project.
2. Open `chrome://extensions` in Chrome.
3. Turn on **Developer mode** (top right).
4. Click **Load unpacked** and select the `gmail-lock` folder.
5. Click the extension icon → **Open settings**.
6. Turn on **Protection on this computer**.

Repeat step 5–6 on any other computer where you *do* want Gmail locked. Skip
it anywhere you don't — like a work computer — even if Chrome sync installs
the extension there automatically.

## Using it

- Default password: `0148`
- Change it any time from the extension's settings page (right-click the
  toolbar icon → **Options**, or click the icon → **Open settings**).
- Forgot your custom password? Use **Reset to default (0148)** on the
  settings page, then set a new one.

## How the "unlock once per tab" behavior works

Once you unlock a tab, it's marked unlocked in that tab's `sessionStorage`
(scoped to this tab and to `mail.google.com`). `sessionStorage` survives
page refreshes and normal in-app navigation, but is automatically cleared
the moment the tab is closed — so refreshing Gmail does **not** ask for the
password again, only closing the tab (or opening Gmail in a new tab) does.
The stored entry is keyed to the password's hash, so changing the password
also forces a fresh unlock.

## Project structure

```
gmail-lock/
├── manifest.json        Manifest V3 config
├── background.js        First-run setup (default password + protection flag)
├── content.js            Injects the lock screen into Gmail (Shadow DOM)
├── style.css              Lock screen stylesheet (source of truth, mirrored
│                           inline in content.js for Shadow DOM isolation)
├── options.html/.css/.js Settings page
├── popup.html/.js        Toolbar popup (quick status + link to settings)
├── icons/                 16 / 48 / 128px extension icons
├── assets/                 Design tokens reference
└── README.md
```

## Why a Shadow DOM?

The lock screen is mounted inside a **closed Shadow DOM**, attached directly
to `<html>`. That means:

- Gmail's CSS can't bleed into the lock screen, and the lock screen's CSS
  can't bleed into Gmail.
- Gmail's own scripts can't reach into the lock screen's markup through
  `document.querySelector` and tamper with it.

## Permissions

Only `storage` is requested — used exclusively for
`chrome.storage.local` (password hash + the per-computer enabled flag).
Nothing is sent over the network and nothing is read from any site other
than `mail.google.com`.

## Design

Dark "cyber security" theme — background `#05080C`, accent `#83CEF4`,
glassmorphism panels, soft glow, and a scanning-shield motif on the lock
screen. See `assets/design-tokens.md` for the full palette and motion spec.
