const dot = document.getElementById("dot");
const statusText = document.getElementById("status-text");
const openSettingsBtn = document.getElementById("open-settings");

chrome.storage.local.get(["enabled"], ({ enabled }) => {
  dot.classList.toggle("on", Boolean(enabled));
  statusText.textContent = enabled
    ? "Protected on this computer"
    : "Not protected on this computer";
});

openSettingsBtn.addEventListener("click", () => {
  chrome.runtime.openOptionsPage();
});
