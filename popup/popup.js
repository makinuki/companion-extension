const statusEl = document.getElementById("status");
const connectBtn = document.getElementById("connect");

const ALL_ORIGINS = ["<all_urls>"];

function setStatus(text, ok) {
  statusEl.textContent = text;
  statusEl.style.color = ok ? "#4ec9a5" : "#ff6b6b";
}

async function refresh() {
  const granted = await chrome.permissions.contains({ origins: ALL_ORIGINS });
  if (granted) {
    setStatus("Connected. The bridge can fetch any source domain.", true);
    connectBtn.disabled = true;
    connectBtn.textContent = "Connected";
  } else {
    setStatus("Not connected. Grant host access to enable the bridge.");
    connectBtn.disabled = false;
    connectBtn.textContent = "Connect (grant host access)";
  }
}

connectBtn.addEventListener("click", async () => {
  const granted = await chrome.permissions.request({ origins: ALL_ORIGINS });
  if (granted) {
    setStatus("Connected. The bridge can fetch any source domain.", true);
    connectBtn.disabled = true;
  } else {
    setStatus("Grant declined. The bridge stays inactive.", false);
  }
});

refresh();