// MakiNuki Companion - content script bridge.
// Relays window.postMessage traffic from the page to the extension
// background service worker and back. Runs on every page; only
// handles messages originating from the same window with our channel.

const PAGE_SOURCE = "makinuki-page";
const EXT_SOURCE = "makinuki-extension";
const CHANNEL = "makinuki:request";
const PING = "makinuki:ping";

function validRequestUrl(url) {
  if (typeof url !== "string") return false;
  try {
    const u = new URL(url);
    return u.protocol === "https:" || u.protocol === "http:";
  } catch {
    return false;
  }
}

function postToPage(message) {
  window.postMessage(message, "*");
}

async function forwardToBackground(message) {
  const response = await chrome.runtime.sendMessage(message);
  return response;
}

window.addEventListener("message", (event) => {
  if (event.source !== window) return;
  const data = event.data;
  if (!data || typeof data !== "object" || data.source !== PAGE_SOURCE) return;

  if (data.type === PING) {
    forwardToBackground({ type: PING })
      .then(() => postToPage({ source: EXT_SOURCE, type: "makinuki:pong" }))
      .catch(() => {
        // background unreachable - no pong
      });
    return;
  }

  if (data.type !== CHANNEL) return;
  if (!validRequestUrl(data.url)) {
    postToPage({
      source: EXT_SOURCE,
      type: "makinuki:response",
      id: data.id,
      ok: false,
      status: 0,
      error: "rejected: invalid url",
    });
    return;
  }

  forwardToBackground(data)
    .then((response) => {
      if (response && response.type === "makinuki:response") {
        postToPage({ ...response, source: EXT_SOURCE });
      } else {
        postToPage({
          source: EXT_SOURCE,
          type: "makinuki:response",
          id: data.id,
          ok: false,
          status: 0,
          error: "rejected: no background response",
        });
      }
    })
    .catch(() => {
      postToPage({
        source: EXT_SOURCE,
        type: "makinuki:response",
        id: data.id,
        ok: false,
        status: 0,
        error: "rejected: background unreachable",
      });
    });
});