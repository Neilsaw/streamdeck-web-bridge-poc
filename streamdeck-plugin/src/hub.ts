// Chrome 拡張との WebSocket 接続を束ねる部分。
// bridge/server.mjs の WebSocket 側と同じプロトコル・同じポートなので、拡張は変更せずにそのまま使える。
// （bridge/server.mjs と同時には起動できない。ポートがぶつかる）

import streamDeck from "@elgato/streamdeck";
import { randomUUID } from "node:crypto";
import { WebSocket, WebSocketServer } from "ws";

const PORT = 50002;
// 拡張が動くサイトのオリジン。extension/manifest.json の matches と揃える。
const ALLOWED_ORIGINS = ["https://www.google.com", "https://www.google.co.jp"];
const ACK_TIMEOUT_MS = 3000;

export type Payload = Record<string, string>;
export type Ack = { status: string; detail?: string; url?: string };

type Pending = { acks: Ack[]; expected: number; finish: () => void };

const clients = new Map<WebSocket, { url: string | null }>();
const pending = new Map<string, Pending>();

export function startHub(): void {
  const wss = new WebSocketServer({
    host: "127.0.0.1",
    port: PORT,
    verifyClient: ({ origin }: { origin: string }) =>
      ALLOWED_ORIGINS.includes(origin),
  });

  wss.on("listening", () =>
    streamDeck.logger.info(`WebSocket 待ち受け: ws://127.0.0.1:${PORT}`),
  );
  wss.on("error", (e) => {
    // 多くは bridge/server.mjs が起動したままでポートが使われている
    streamDeck.logger.error(`WebSocket を開けません: ${e.message}`);
  });

  wss.on("connection", (ws) => {
    clients.set(ws, { url: null });
    streamDeck.logger.info(`接続 (${clients.size} タブ)`);

    ws.on("message", (data) => {
      let msg;
      try {
        msg = JSON.parse(data.toString());
      } catch {
        return;
      }
      if (msg.type === "hello") {
        clients.get(ws)!.url = msg.url;
      }
      if (msg.type === "ack") {
        const p = pending.get(msg.id);
        if (!p) return;
        p.acks.push({ status: msg.status, detail: msg.detail, url: msg.url });
        if (p.acks.length >= p.expected) p.finish();
      }
    });

    ws.on("close", () => {
      clients.delete(ws);
      streamDeck.logger.info(`切断 (${clients.size} タブ)`);
    });
  });
}

/** 全タブに送り、全員の返事かタイムアウトまで待つ。どのタブが実行するかは拡張側が判断する。 */
export function broadcast(payload: Payload): Promise<Ack[]> {
  const id = randomUUID();
  const targets = [...clients.keys()];
  if (targets.length === 0) {
    return Promise.resolve([{ status: "no-client", detail: "拡張が未接続" }]);
  }
  return new Promise((resolve) => {
    const entry: Pending = {
      acks: [],
      expected: targets.length,
      finish: () => {},
    };
    const timer = setTimeout(() => entry.finish(), ACK_TIMEOUT_MS);
    entry.finish = () => {
      clearTimeout(timer);
      pending.delete(id);
      resolve(entry.acks);
    };
    pending.set(id, entry);
    for (const ws of targets)
      ws.send(JSON.stringify({ type: "fill", id, payload }));
  });
}
