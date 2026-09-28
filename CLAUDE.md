# CLAUDE.md

このリポジトリは「Stream Deck → ローカル bridge → Chrome 拡張 → 特定 Web ページの DOM 操作」の学習用 PoC。
利用者はこれを土台に、自分の業務サイト（例: 処方入力画面）向けに作り替える。会話は日本語で行う。

## 構成

- `bridge/server.mjs` — Node。`GET /send?<query>` を受け、クエリをそのまま `payload` にして WebSocket で全タブへ送る。各タブの ack を最大 3 秒集めて JSON で返す。`GET /status` で接続中タブ一覧。ポート 50002、127.0.0.1 のみ
- `extension/` — Manifest V3、ビルド不要の素の JavaScript。`dom-helpers.js` → `sites.js` → `content.js` の順に読み込まれ、グローバルを共有する
  - `sites.js` の `SITES` 配列が「どの URL（`urlPattern`）で何をするか（`run(payload, dom)`）」の定義。**サイト対応の変更は基本ここだけ**
  - `content.js` は bridge との接続・再接続・タブの可視判定・ack 返却
- `streamdeck-plugin/` — bridge を内蔵した Stream Deck プラグイン版（SDK `@elgato/streamdeck` 3、`streamdeck create` のテンプレート準拠の TypeScript + rollup）。`src/hub.ts` が `bridge/server.mjs` の WebSocket 側と同じプロトコル・同じポート 50002 を実装しているので、拡張は共通。**プロトコルを変えるときは `bridge/server.mjs` と `src/hub.ts` の両方を直す**。bridge 版と同時には起動できない。ビルドは `cd streamdeck-plugin && npm run build`、型チェックは `npx tsc --noEmit`、manifest 検証は `npx streamdeck validate com.example.webbridge.sdPlugin`
- `docs/` — 解説（仕組み / DOM 調査 / 応用 / Stream Deck 設定 / プラグイン版）

## プロトコル（JSON）

| 方向          | メッセージ                                                                                 |
| ------------- | ------------------------------------------------------------------------------------------ |
| 拡張 → bridge | `{"type":"hello","url":"<location.href>"}`                                                 |
| bridge → 拡張 | `{"type":"fill","id":"<uuid>","payload":{...query}}`                                       |
| 拡張 → bridge | `{"type":"ack","id":"<uuid>","status":"done\|skipped\|failed","detail":"...","url":"..."}` |

## サイトを追加・変更するときの約束

1. **URL・オリジンの定義をそろえる**: `extension/manifest.json` の `matches`、`extension/sites.js` の `urlPattern`、`bridge/server.mjs` と `streamdeck-plugin/src/hub.ts` の `ALLOWED_ORIGINS`
2. **セレクタは Claude in Chrome で実物を調べてから決める**。推測で書かない。自動生成っぽい id / class（`#ti6dpd`, `.css-1x2y3z`, `#mui-12`）は使わず、`name` / `data-testid` / `aria-label` を優先。一致数と可視性も確認する（手順は `docs/02-dom-investigation.md`）
3. 値の入力は `dom.setValue`（ネイティブ setter + input/change イベント）を使う。`el.value =` の直接代入はしない
4. **調査・動作確認中に、対象サイトの登録・送信・削除ボタンを押さない**。押す処理を `run()` に入れる場合もユーザーに確認し、最初はコメントアウトで渡す
5. ログイン・パスワード入力はユーザーが行う
6. `extension/` と `bridge/` にはビルドツールや依存を増やさない（学習用なのでビルド不要を保つ）

## 動作確認

```bash
cd bridge && npm install && npm start       # bridge 起動
curl "http://127.0.0.1:50002/status"        # 接続中タブ
curl "http://127.0.0.1:50002/send?text=hello"
```

拡張の変更後は `chrome://extensions` で更新 → 対象ページを再読み込み、をユーザーに依頼する（拡張の再読み込みは Claude in Chrome からはできない）。
`run()` のロジックは、拡張に入れる前に Claude in Chrome の JavaScript 実行で対象ページ上で試せる。
