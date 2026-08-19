// MakiNuki Companion - background service worker.
// Executes native fetch() (no CORS) for requests relayed by the content
// script bridge, including target-domain cookies and custom headers.

const CHANNEL = "makinuki:request";
const PING = "makinuki:ping";
const EXT_SOURCE = "makinuki-extension";

function validRequestUrl(url) {
  if (typeof url !== "string") return false;
  try {
    const u = new URL(url);
    return u.protocol === "https:" || u.protocol === "http:";
  } catch {
    return false;
  }
}

function serializeHeaders(headers) {
  const out = {};
  headers.forEach((value, key) => {
    out[key] = value;
  });
  return out;
}

function bytesToBase64(bytes) {
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

async function handleRequest(message, sender) {
  if (!sender || !sender.tab) {
    return { source: EXT_SOURCE, type: "makinuki:response", id: message.id, ok: false, status: 0, error: "rejected: not from a content script" };
  }
  if (message.type !== CHANNEL) {
    return { source: EXT_SOURCE, type: "makinuki:response", id: message.id, ok: false, status: 0, error: "rejected: unknown message type" };
  }
  if (!validRequestUrl(message.url)) {
    return { source: EXT_SOURCE, type: "makinuki:response", id: message.id, ok: false, status: 0, error: "rejected: invalid url" };
  }

  const init = {
    method: typeof message.method === "string" ? message.method : "GET",
    credentials: "include",
  };
  const headers = message.headers && typeof message.headers === "object" ? message.headers : {};
  const lower = new Headers(headers);
  lower.delete("host");
  lower.delete("content-length");
  if (lower.size > 0) init.headers = lower;
  if (message.body !== undefined && message.body !== null && message.method !== "GET" && message.method !== "HEAD") {
    init.body = String(message.body);
  }

  try {
    const res = await fetch(message.url, init);
    const resHeaders = serializeHeaders(res.headers);
    const binary = message.responseType === "arraybuffer";
    const bodyBytes = binary ? new Uint8Array(await res.arrayBuffer()) : null;
    const body = binary ? null : await res.text();
    return {
      source: EXT_SOURCE,
      type: "makinuki:response",
      id: message.id,
      ok: res.ok,
      status: res.status,
      headers: resHeaders,
      body,
      bodyBase64: binary ? bytesToBase64(bodyBytes) : undefined,
    };
  } catch (err) {
    return {
      source: EXT_SOURCE,
      type: "makinuki:response",
      id: message.id,
      ok: false,
      status: 0,
      error: `fetch failed: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message && message.type === PING) {
    sendResponse({ type: "makinuki:pong" });
    return false;
  }
  handleRequest(message, sender).then(sendResponse);
  return true;
});