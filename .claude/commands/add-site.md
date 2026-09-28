---
description: 新しいサイト（画面）への自動入力を追加する。Claude in Chrome で DOM を調べてから sites.js を書く
argument-hint: <対象画面の URL> と、やりたいこと
---

対象: $ARGUMENTS

次の順で進めてください。各段階の終わりに結果を日本語で短く報告し、次に進んでよいか確認すること。

## 1. 要件の確認

- 対象画面の URL（どこまでの範囲で動かすか。例: 同じドメインの処方画面だけ）
- 入れたい値と、Stream Deck から送るクエリ名（例: `drug`, `days`）
- 最後にボタンを押すか（押す場合も、最初は押さない版で確認することを提案する）

不明な点があれば先に質問する。

## 2. DOM の調査（Claude in Chrome）

`docs/02-dom-investigation.md` の観点で調べる。

- ユーザーに対象画面をログイン済みで開いてもらい、そのタブを使う
- 入力欄・ボタンごとに、安定したセレクタ候補・一致数・可視性・iframe / shadow DOM の有無・フレームワーク（React 等）を調べる
- 候補コードをページ上で実行して、値が入り画面が認識することを確かめる（`dom-helpers.js` の `setValue` と同じ方法で）
- **登録・送信・削除などのボタンは押さない**

調査結果を表にして報告する。

## 3. 実装

`CLAUDE.md` の「サイトを追加・変更するときの約束」に従う。

- `extension/sites.js` の `SITES` に追加（調査で分かったことをコメントに残す）
- `extension/manifest.json` の `matches`
- `bridge/server.mjs` の `ALLOWED_ORIGINS` 既定値と `streamdeck-plugin/src/hub.ts` の `ALLOWED_ORIGINS`
- 必要なら `extension/dom-helpers.js` に汎用の部品を足す（サイト固有の処理は `sites.js` 側に置く）

## 4. 動作確認の案内

ユーザーに次を依頼する:

1. `chrome://extensions` で拡張を更新 → 対象画面を再読み込み → 右下の丸が緑になることを確認
2. bridge を再起動（`bridge/` を変えた場合）
3. 実行する curl コマンド（日本語は URL エンコード済みのもの）を提示する
4. Stream Deck のボタンに設定する URL を提示する
