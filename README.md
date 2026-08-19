# makinuki/companion-extension

Manifest V3 browser extension that gives MakiNuki web pages zero-CORS network
access. Pages relay `fetch` requests through the extension background service
worker, which runs native `fetch()` with full headers and target-domain
cookies.

## Install

1. Open `chrome://extensions`
2. Enable "Developer mode"
3. "Load unpacked" -> this directory

After install, open the extension popup and click "Connect (grant host
access)". The grant is requested once via `optional_host_permissions`; until
then the bridge reports itself unavailable.

## Wire protocol

Pages and the extension never talk directly: the content script (`src/bridge.js`)
is injected into every page and forwards `window.postMessage` traffic to the
background worker via `chrome.runtime.sendMessage`.

### Page -> extension (window.postMessage)

```js
window.postMessage({
  source: "makinuki-page",
  type: "makinuki:request",
  id: "uuid-1",
  method: "GET",
  url: "https://api.mangadex.org/manga?limit=1",
  headers: { "User-Agent": "..." },
  body: null,
  responseType: "text"        // "text" (default) or "arraybuffer"
}, "*")
```

### Extension -> page

```js
{
  source: "makinuki-extension",
  type: "makinuki:response",
  id: "uuid-1",
  ok: true,
  status: 200,
  headers: { "content-type": "application/json" },
  body: "{\"result\":\"ok\"}",
  bodyBase64: undefined      // set when responseType was "arraybuffer"
}
```

Failure responses carry `ok: false`, `status: 0` and an `error` string.

### Availability handshake

Page posts `{ source: "makinuki-page", type: "makinuki:ping" }`; the bridge
pings the background worker and answers `{ source: "makinuki-extension",
type: "makinuki:pong" }` only if the worker is alive. `src/client.js` is a
reference page-side client implementing the handshake and request/response
correlation; `@makinuki/runtime-web` implements the same protocol.

## Security

- The content script only accepts messages from the same window
  (`event.source === window`) and only on our channel.
- The background worker only accepts messages from its own content scripts
  (`sender.tab` present) and rejects anything else.
- URLs are validated to `http(s)` only.
- Hop-by-hop headers (`host`, `content-length`) are stripped before fetching.
- GET/HEAD bodies are dropped; other methods may carry a string body.

## Notes

- `responseType: "arraybuffer"` returns image bytes base64-encoded in
  `bodyBase64`. Image delivery through the extension is meant for
  header-protected images (PageItem.headers); unencumbered images go direct
  from the CDN.
