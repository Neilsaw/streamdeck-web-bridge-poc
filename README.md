# Stream Deck Web Bridge (PoC)

Stream Deck のボタンから、**特定の Web ページの入力欄にデータを流し込んで操作する** 仕組みの学習用サンプルです。
例として「Google の検索欄に文字列を入れて検索を実行する」までを動かします。

実運用品ではなく、仕組みを理解して **Claude Code と一緒に自分のサイト向けに作り替える** ための最小構成です。

```
┌────────────┐  HTTP GET              ┌──────────────┐  WebSocket   ┌──────────────────────────┐
│ Stream Deck │ ─/send?text=...──────▶ │ bridge       │ ───────────▶ │ Chrome 拡張              │
│ (ボタン)    │ ◀──── 結果 JSON ─────── │ (Node, 50002)│ ◀── ack ──── │ (対象ページ内で DOM 操作) │
└────────────┘                         └──────────────┘              └──────────────────────────┘
```

## なぜこの形なのか

- **Web ページの中身（DOM）を書き換えられるのはブラウザ内のコードだけ** → Chrome 拡張のコンテンツスクリプトを使う
- **Stream Deck はブラウザ内のコードを直接呼べない** → 間にローカルの小さなサーバ（bridge）を置く。Stream Deck は URL を叩くだけ
- **拡張は特定の URL でだけ動く** → `manifest.json` の `matches` と `sites.js` の `urlPattern` で二重に絞る

詳しくは [docs/01-architecture.md](docs/01-architecture.md)。

## 動かしてみる（5 分）

必要なもの: Node.js 20 以上、Google Chrome

### 1. bridge を起動

```bash
cd bridge
npm install
npm start
```

`ブリッジ起動: http://127.0.0.1:50002` と出れば OK。このウィンドウは開いたままにする。

### 2. 拡張を Chrome に読み込む

1. Chrome で `chrome://extensions` を開く
2. 右上の「デベロッパー モード」をオン
3. 「パッケージ化されていない拡張機能を読み込む」→ このリポジトリの `extension/` フォルダを選ぶ

### 3. Google を開く

`https://www.google.com/` を開くと、画面右下に小さな丸が出ます。

- 緑: bridge に接続中
- 灰: 未接続（bridge が起動しているか確認）

Chrome が「このサイトにローカル ネットワーク上のデバイスへのアクセスを許可しますか」のような確認を出した場合は **許可** してください（https のサイトから `127.0.0.1` へつなぐため）。

### 4. 送ってみる

別のターミナルから:

```bash
curl "http://127.0.0.1:50002/send?text=hello"
```

Google の検索欄に `hello` が入り、検索が実行されれば成功です。curl には結果が JSON で返ります。

```json
{
  "payload": { "text": "hello" },
  "acks": [
    {
      "status": "done",
      "detail": "Google 検索",
      "url": "https://www.google.com/"
    }
  ]
}
```

### 5. Stream Deck から送る

[docs/04-stream-deck.md](docs/04-stream-deck.md) を参照。ボタンに上の URL を設定するだけです。

## bridge を起動せずに使う（Stream Deck プラグイン版）

bridge の役割を Stream Deck プラグインの中に入れた版を `streamdeck-plugin/` に用意しています。Stream Deck アプリと一緒に動くので別の起動は不要で、送る値はボタンの設定欄に書き、結果はボタンに ✓ / ⚠ で表示されます。拡張はそのまま使えます。
手順は [docs/05-streamdeck-plugin.md](docs/05-streamdeck-plugin.md)。仕組みの理解には、1 段ずつ確かめられる bridge 版から始めるのがおすすめです。

## ファイル構成

| パス                       | 役割                                                                          |
| -------------------------- | ----------------------------------------------------------------------------- |
| `bridge/server.mjs`        | HTTP を受けて WebSocket で拡張へ中継するローカルサーバ                        |
| `extension/manifest.json`  | 拡張の定義。`matches` で **どのサイトに読み込むか** を決める                  |
| `extension/sites.js`       | **どの URL で何をするか** の定義。自分のサイト向けに主に書き換えるのはここ    |
| `extension/dom-helpers.js` | 値の入力・クリック・要素待ちなど、DOM 操作の共通部品                          |
| `extension/content.js`     | bridge との接続と、届いた指示を `sites.js` に渡す本体（通常は触らなくてよい） |
| `streamdeck-plugin/`       | bridge を内蔵した Stream Deck プラグイン版（TypeScript、要ビルド）            |
| `docs/`                    | 仕組みの解説、DOM の調べ方、自分のサイトへの応用手順、プラグイン版の手順      |
| `CLAUDE.md`                | Claude Code 向けの説明（このリポジトリで Claude Code を開くと読まれる）       |

## 自分のサイトで使うには

Claude Code でこのリポジトリを開き、次のように頼むのが一番早いです。

```
/add-site https://対象サイトのURL
処方画面の「薬剤名」「日数」欄に値を入れて「追加」ボタンを押したい
```

`/add-site` は `.claude/commands/add-site.md` にある手順書で、Claude in Chrome で画面を調べる → `sites.js` と `manifest.json` を書き換える → 動作確認、の順に進めます。
手で進める場合は [docs/02-dom-investigation.md](docs/02-dom-investigation.md) → [docs/03-adapt-to-your-site.md](docs/03-adapt-to-your-site.md) の順に読んでください。

## 注意

- 学習用の PoC です。電子カルテ・処方など **誤入力が危険な画面** に使う場合は、送信ボタンまで自動で押さず「入力だけして人が確認して押す」形から始めることを強く勧めます
- 対象サイトの利用規約で自動操作が禁止されていないか確認してください
- セキュリティ上の配慮は [docs/01-architecture.md#セキュリティ](docs/01-architecture.md#セキュリティ) にまとめています
