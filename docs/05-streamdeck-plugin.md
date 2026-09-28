# 05. Stream Deck プラグイン版（bridge 内蔵）

`streamdeck-plugin/` は、bridge の役割を **Stream Deck プラグインの中に入れた版** です。
Stream Deck アプリが起動していればプラグインも動いているので、bridge を別に起動する必要がありません。

```
bridge 版:     Stream Deck ─HTTP→ bridge（別プロセス）─WebSocket→ 拡張
プラグイン版:  Stream Deck プラグイン（= bridge）───────WebSocket→ 拡張
```

拡張（`extension/`）は **そのまま** 使えます。接続先のポート（50002）とメッセージの形式が同じだからです。

## bridge 版との違い

|              | bridge 版                        | プラグイン版                                    |
| ------------ | -------------------------------- | ----------------------------------------------- |
| 起動         | `npm start` が必要               | 不要（Stream Deck と一緒に動く）                |
| 送る値の設定 | ボタンの URL のクエリに書く      | ボタンの設定欄（テキスト・追加項目）に書く      |
| 結果の表示   | curl の JSON                     | ボタンに ✓（成功）/ ⚠（失敗）が出る             |
| HTTP の口    | あり（他から叩かれる対策が要る） | なし                                            |
| 作り         | 素の JavaScript、ビルド不要      | 公式テンプレート準拠の TypeScript、ビルドが必要 |

**bridge 版とプラグイン版は同時に起動できません**（同じポートを使うため）。どちらか一方にしてください。

## 必要なもの

- Stream Deck アプリ **7.1 以上**
- Node.js（公式は 24 以上を推奨。ビルドに使うだけで、プラグインの実行には Stream Deck 内蔵の Node が使われる）
- Stream Deck CLI: `npm install -g @elgato/cli`

## 動かす

```bash
cd streamdeck-plugin
npm install
npm run build                                   # src/ → com.example.webbridge.sdPlugin/bin/plugin.js
streamdeck link com.example.webbridge.sdPlugin  # Stream Deck に開発中のプラグインとして登録（初回のみ）
streamdeck restart com.example.webbridge        # 再起動して読み込ませる
```

1. Stream Deck アプリの右側のアクション一覧に「Web Bridge (PoC)」→「Web に送る」が出るので、ボタンに配置
2. ボタンを選び、下の設定欄に入力
   - **テキスト**: `hello`（拡張側では `payload.text`）
   - **追加項目**: `名前=値` を 1 行に 1 つ（例: `drug=ロキソニン錠60mg`）。拡張側では `payload.drug` のように読める
3. Chrome で Google を開き、右下の丸が緑になっていることを確認
4. ボタンを押す → 検索欄に入って検索され、ボタンに ✓ が出れば成功

開発中は `npm run watch` にしておくと、`src/` を保存するたびにビルドしてプラグインを再起動します。

## ファイル構成

| パス                                                 | 役割                                                                                                        |
| ---------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `src/plugin.ts`                                      | 入口。WebSocket の待ち受けを始め、アクションを登録して Stream Deck につなぐ                                 |
| `src/hub.ts`                                         | 拡張との WebSocket（`bridge/server.mjs` の WebSocket 部分と同じ役割）。**`ALLOWED_ORIGINS` はここにもある** |
| `src/actions/send-to-web.ts`                         | 「Web に送る」ボタン。押されたら設定値を payload にして送り、結果を ✓ / ⚠ で表示                            |
| `com.example.webbridge.sdPlugin/manifest.json`       | プラグインの定義（名前、アクション、必要な Stream Deck のバージョンなど）                                   |
| `com.example.webbridge.sdPlugin/ui/send-to-web.html` | ボタンの設定欄。`setting="..."` の名前が `settings` のキーになる                                            |
| `rollup.config.mjs` / `tsconfig.json`                | `streamdeck create` が生成するものと同じビルド設定                                                          |

`bin/`（ビルド結果）と `logs/` は git に含めていません。

## うまくいかないとき

- **ログを見る**: `com.example.webbridge.sdPlugin/logs/com.example.webbridge.0.log`
  - `WebSocket を開けません: ... EADDRINUSE` → bridge 版（`npm start`）が起動したまま。止めてから `streamdeck restart com.example.webbridge`
  - `接続 (n タブ)` が出ない → 拡張がつながっていない（対象ページを開いているか、`ALLOWED_ORIGINS` にそのサイトがあるか）
- **ボタンに ⚠ が出る**: ログの `skipped` / `failed` / `no-client` の行を見る。意味は [04-stream-deck.md の表](04-stream-deck.md#動作確認のコツ) と同じ
- **デバッガでつなぐ**: manifest の `Nodejs.Debug` が `enabled` なので、VS Code の「Attach to Plugin」（`.vscode/launch.json`）でブレークポイントを置ける

## 配布するとき

`streamdeck pack com.example.webbridge.sdPlugin` で `.streamDeckPlugin` ファイルができ、ダブルクリックでインストールできます。
配布する前に、UUID（`com.example.webbridge`）を自分のドメインを逆にしたもの（例: `jp.co.yourclinic.webbridge`）に変えてください。変える場所は `.sdPlugin` フォルダ名、manifest.json の `UUID` と各アクションの `UUID`、`send-to-web.ts` の `@action`、`rollup.config.mjs` の `sdPlugin`、`package.json` の `watch` です。

## 参考

- Stream Deck SDK ドキュメント: https://docs.elgato.com/streamdeck/sdk/introduction/getting-started
- 設定欄の部品（sdpi-components）: https://sdpi-components.dev/docs/components
