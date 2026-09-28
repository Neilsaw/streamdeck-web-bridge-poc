# 03. 自分のサイト向けに作り替える

## 変更する 3 か所（プラグイン版なら 4 か所）

例: `https://emr.example.jp/patients/123/prescriptions` の処方画面に対応する場合。

### 1. `extension/manifest.json` — 読み込むサイト

```json
"matches": ["https://emr.example.jp/*"]
```

### 2. `bridge/server.mjs` — 接続を受け付けるオリジン

`ALLOWED_ORIGINS` の既定値を書き換えるか、起動時に指定します。プラグイン版を使う場合は `streamdeck-plugin/src/hub.ts` の `ALLOWED_ORIGINS` を書き換えて `npm run build` します。

```bash
ALLOWED_ORIGINS=https://emr.example.jp npm start
```

### 3. `extension/sites.js` — 動かす URL と処理

```js
{
  name: "処方入力",
  urlPattern: /^https:\/\/emr\.example\.jp\/patients\/\d+\/prescriptions/,
  async run(payload, dom) {
    dom.setValue(await dom.waitFor('input[name="drugName"]'), payload.drug);
    dom.setValue(await dom.waitFor('input[name="days"]'), payload.days);
    // まずは押さずに、人が確認して押す形から始めるのがおすすめ
    // dom.click(await dom.waitFor('button[data-testid="add"]'));
  },
},
```

Stream Deck からは `http://127.0.0.1:50002/send?drug=ロキソニン錠60mg&days=7` のように、欄ごとにクエリを付けて送ります（クエリ名は自由に決めてよい）。

### 変更後の反映

- `extension/` を変えたら `chrome://extensions` で拡張の **更新（↻）** を押し、対象ページを **再読み込み**
- `bridge/` を変えたら `npm start` をやり直す

## よくある難所

| 症状                                                 | 原因と対処                                                                                                                                                                                                                           |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 値は見えるのに、保存すると空になる                   | 画面のフレームワークが変更を検知していない。`dom.setValue` を使っているか確認。それでも駄目なら `keydown` / `keyup` / `blur` イベントも送る、`document.execCommand("insertText", false, text)` を試す                                |
| 要素が見つからない（`failed: 要素が見つかりません`） | 画面の描画が遅い → `waitFor` の待ち時間を延ばす。**iframe の中** → `manifest.json` に `"all_frames": true` を追加し、`urlPattern` を iframe 側の URL に合わせる。**shadow DOM の中** → `host.shadowRoot.querySelector(...)` でたどる |
| 入力欄が `<div contenteditable>`（リッチエディタ）   | `setValue` は使えない。要素に `focus()` してから `document.execCommand("insertText", false, text)`、またはエディタ固有の API を調べる                                                                                                |
| オートコンプリートで候補から選ばないと確定しない     | 値を入れた後、候補リストが出るのを `waitFor` で待ち、該当する候補を `click` する                                                                                                                                                     |
| SPA で URL が変わっても反応しない                    | `run()` 実行時に毎回 `location.href` を見ているので基本は問題ない。ページ遷移直後で要素がまだない場合は `waitFor` で待つ                                                                                                             |
| 丸が灰色のまま                                       | bridge が起動していない / `ALLOWED_ORIGINS` にそのサイトがない（bridge のログに何も出ない）/ Chrome のローカルネットワークアクセスの確認を拒否した（サイト設定から許可し直す）                                                       |

## デバッグ

- 拡張のログは **対象ページの DevTools（F12）→ Console** に `[bridge]` 付きで出ます
- `/status` で接続中のタブ一覧が見られます: `curl http://127.0.0.1:50002/status`
- `run()` の中身は、先に DevTools の Console や Claude in Chrome で 1 行ずつ試してから書くと早いです

## この PoC にないもの（必要に応じて足す）

- 複数の Stream Deck ボタンで別々の処理をしたい → クエリに `action=xxx` を付け、`run()` の中で分岐するか、`SITES` に `action` の条件を足す
- 拡張のアイコン・ポップアップ・設定画面
- ビルドツール（TypeScript など）。この PoC は素の JavaScript でビルド不要にしています
