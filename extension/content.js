// コンテンツスクリプト本体。manifest.json の matches に一致するページに読み込まれる。
// ローカルのブリッジ（bridge/server.mjs）に WebSocket でつなぎ、届いた指示を sites.js の run() に渡す。

const BRIDGE_URL = "ws://127.0.0.1:50002";
const RECONNECT_MS = 3000;

let socket = null;
const badge = createBadge();

function connect() {
  socket = new WebSocket(BRIDGE_URL);

  socket.addEventListener("open", () => {
    setBadge(true);
    send({ type: "hello", url: location.href });
  });

  socket.addEventListener("close", () => {
    // ブリッジが起動していない・再起動したときは、ここで待ってつなぎ直す
    setBadge(false);
    setTimeout(connect, RECONNECT_MS);
  });

  socket.addEventListener("message", async (event) => {
    const msg = JSON.parse(event.data);
    if (msg.type !== "fill") return;
    const result = await handleFill(msg.payload);
    send({ type: "ack", id: msg.id, url: location.href, ...result });
  });
}

async function handleFill(payload) {
  // 複数タブで開いているとき、見えていないタブは何もしない
  if (document.visibilityState !== "visible") {
    return { status: "skipped", detail: "タブが非表示" };
  }
  const site = SITES.find((s) => s.urlPattern.test(location.href));
  if (!site) {
    return { status: "skipped", detail: "対象外の URL" };
  }
  try {
    await site.run(payload, dom);
    console.log(`[bridge] ${site.name}: 入力しました`, payload);
    return { status: "done", detail: site.name };
  } catch (e) {
    console.error(`[bridge] ${site.name}: 失敗`, e);
    return { status: "failed", detail: String(e.message || e) };
  }
}

function send(obj) {
  if (socket && socket.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify(obj));
  }
}

// 画面右下の小さな丸。緑 = ブリッジに接続中、灰 = 未接続。動作確認用。
function createBadge() {
  const el = document.createElement("div");
  el.title = "Stream Deck Web Bridge";
  Object.assign(el.style, {
    position: "fixed",
    right: "8px",
    bottom: "8px",
    width: "12px",
    height: "12px",
    borderRadius: "50%",
    zIndex: 2147483647,
    pointerEvents: "none",
  });
  document.body.appendChild(el);
  return el;
}

function setBadge(connected) {
  badge.style.background = connected ? "#22c55e" : "#9ca3af";
  badge.title = connected ? "ブリッジ接続中" : "ブリッジ未接続";
}

setBadge(false);
connect();
