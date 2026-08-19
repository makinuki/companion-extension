// MakiNuki Companion - page-side client (reference implementation).
// Mirrors the protocol implemented by @makinuki/runtime-web's companion
// transport. Drop this into any page (or use the SDK) to talk to the
// extension over window.postMessage.

(function (global) {
  const PAGE_SOURCE = "makinuki-page";
  const EXT_SOURCE = "makinuki-extension";
  const CHANNEL = "makinuki:request";
  const PING = "makinuki:ping";
  const REQUEST_TIMEOUT = 60000;

  let available = false;
  const pending = new Map();

  function request(method, url, headers, body, responseType) {
    return new Promise((resolve, reject) => {
      if (!available) {
        reject(new Error("companion extension not connected"));
        return;
      }
      const id = crypto.randomUUID();
      const timer = setTimeout(() => {
        pending.delete(id);
        reject(new Error("companion request timed out"));
      }, REQUEST_TIMEOUT);
      pending.set(id, { resolve, reject, timer });
      window.postMessage(
        { source: PAGE_SOURCE, type: CHANNEL, id, method, url, headers, body, responseType },
        "*",
      );
    });
  }

  window.addEventListener("message", (event) => {
    if (event.source !== window) return;
    const data = event.data;
    if (!data || typeof data !== "object" || data.source !== EXT_SOURCE) return;
    if (data.type === "makinuki:pong") {
      available = true;
      return;
    }
    if (data.type !== "makinuki:response") return;
    const entry = pending.get(data.id);
    if (!entry) return;
    clearTimeout(entry.timer);
    pending.delete(data.id);
    if (!data.ok || data.status === 0) {
      entry.reject(new Error(data.error || `companion request failed (status ${data.status})`));
      return;
    }
    entry.resolve({
      status: data.status,
      headers: data.headers || {},
      body: data.body,
      bodyBase64: data.bodyBase64,
    });
  });

  global.MakiNukiCompanion = {
    detect: () =>
      new Promise((resolve) => {
        window.postMessage({ source: PAGE_SOURCE, type: PING }, "*");
        setTimeout(() => resolve(available), 500);
      }),
    get available() {
      return available;
    },
    request,
  };
})(typeof globalThis !== "undefined" ? globalThis : window);