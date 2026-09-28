// ローカルのブリッジ。Stream Deck（や curl）からの HTTP を受けて、
// Chrome 拡張（WebSocket でつないでくる）に中継する。
//
//   Stream Deck ──HTTP GET /send?text=...──▶ このサーバ ──WebSocket──▶ 拡張（ページ内）
//                ◀──────── 結果 JSON ──────────────────────  ack ◀──┘
//
// 起動: npm start   （ポートは環境変数 PORT、既定 50002）

import http from "node:http";
import { randomUUID } from "node:crypto";
import { WebSocketServer } from "ws";

const PORT = Number(process.env.PORT || 50002);
// 拡張が動くサイトのオリジン。manifest.json の matches と揃える。
// ここにないオリジンからの WebSocket 接続は断る（任意のサイトが盗み聞きできないように）。
const ALLOWED_ORIGINS = (
  process.env.ALLOWED_ORIGINS ||
  "https://www.google.com,https://www.google.co.jp"
).split(",");
// 設定すると /send に ?token=... が必須になる（任意）
const TOKEN = process.env.BRIDGE_TOKEN || "";
const ACK_TIMEOUT_MS = 3000;

/** 接続中の拡張（= 開いているタブ）。ws -> { url } */
const clients = new Map();
/** 返事待ち。id -> { acks, expected, resolve } */
const pending = new Map();

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);

  // ブラウザ上の Web ページから localhost を叩かれるのを防ぐ。
  // ブラウザのリクエストには Sec-Fetch-Site が付くが、Stream Deck や curl には付かない。
  const site = req.headers["sec-fetch-site"];
  if (site && site !== "none") return reply(res, 403, { error: "forbidden" });
  if (TOKEN && url.searchParams.get("token") !== TOKEN) {
    return reply(res, 401, { error: "token が違います" });
  }

  if (url.pathname === "/status") {
    return reply(res, 200, { clients: [...clients.values()] });
  }

  if (url.pathname === "/send") {
    const payload = Object.fromEntries(url.searchParams);
    delete payload.token;
    return broadcast(payload).then((acks) => {
      const done = acks.some((a) => a.status === "done");
      reply(res, done ? 200 : 409, { payload, acks });
    });
  }

  reply(res, 404, { error: "GET /send?text=... または GET /status" });
});

const wss = new WebSocketServer({
  server,
  verifyClient: ({ origin }) => ALLOWED_ORIGINS.includes(origin),
});

wss.on("connection", (ws, req) => {
  clients.set(ws, { origin: req.headers.origin, url: null });
  log(`接続 (${clients.size} タブ)`);

  ws.on("message", (data) => {
    let msg;
    try {
      msg = JSON.parse(data.toString());
    } catch {
      return;
    }
    if (msg.type === "hello") {
      clients.get(ws).url = msg.url;
      log(`  └ ${msg.url}`);
    }
    if (msg.type === "ack") {
      const p = pending.get(msg.id);
      if (!p) return;
      p.acks.push({ status: msg.status, detail: msg.detail, url: msg.url });
      if (p.acks.length >= p.expected) p.resolve();
    }
  });

  ws.on("close", () => {
    clients.delete(ws);
    log(`切断 (${clients.size} タブ)`);
  });
});

/** 全タブに送り、全員の返事かタイムアウトまで待つ。どのタブが実行するかは拡張側が判断する。 */
function broadcast(payload) {
  const id = randomUUID();
  const targets = [...clients.keys()];
  log(`送信 ${JSON.stringify(payload)} → ${targets.length} タブ`);
  if (targets.length === 0) {
    return Promise.resolve([{ status: "no-client", detail: "拡張が未接続" }]);
  }
  return new Promise((resolve) => {
    const entry = { acks: [], expected: targets.length, resolve: () => {} };
    const finish = () => {
      clearTimeout(timer);
      pending.delete(id);
      entry.acks.forEach((a) => log(`  └ ${a.status}: ${a.detail}`));
      resolve(entry.acks);
    };
    const timer = setTimeout(finish, ACK_TIMEOUT_MS);
    entry.resolve = finish;
    pending.set(id, entry);
    for (const ws of targets)
      ws.send(JSON.stringify({ type: "fill", id, payload }));
  });
}

function reply(res, status, body) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(body, null, 2));
}

function log(message) {
  console.log(`[${new Date().toLocaleTimeString()}] ${message}`);
}

// 127.0.0.1 のみで待ち受ける（LAN 内の他の PC からは届かない）
server.listen(PORT, "127.0.0.1", () => {
  log(`ブリッジ起動: http://127.0.0.1:${PORT}`);
  log(`試す: curl "http://127.0.0.1:${PORT}/send?text=hello"`);
});
