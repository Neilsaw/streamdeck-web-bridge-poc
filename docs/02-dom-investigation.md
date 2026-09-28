# 02. 画面（DOM）の調べ方 — Claude in Chrome を使う

自動入力で一番大事なのは **「どの要素を」「どう指定するか」（セレクタ）** です。
ここでは Claude Code から Claude in Chrome（Chrome を操作する拡張）を使って調べる方法を説明します。

## 準備

- Chrome に [Claude in Chrome](https://claude.com/chrome) 拡張を入れ、Claude Code から使える状態にする（Claude Code で `/chrome` を実行すると接続状態を確認できます）
- 調べたい画面にログインしておく（ログインや認証情報の入力は自分で行う）

## 調査の流れ（Google 検索での実例）

このリポジトリの `sites.js` を作ったときに実際に行った調査です。Claude Code に次のように頼みました。

```
Claude in Chrome で https://www.google.com/ を開いて、
検索欄と「Google 検索」ボタンの DOM を調べて。
- タグ名、name / id / aria-label などの属性
- 同じ条件に一致する要素がいくつあるか、見えているか
- 所属する form の action
その上で、再読み込みしても変わらないセレクタを提案して。
```

Claude は次のようなことを行い、結果を返します。

1. ページを開き、アクセシビリティツリーから「検索欄」「送信ボタン」を探す
2. JavaScript をページ内で実行して属性を列挙する

```js
[...document.querySelectorAll('[name="q"]')].map((e) =>
  [
    e.tagName,
    e.id,
    e.getAttribute("role"),
    e.offsetParent !== null,
    e.form?.getAttribute("action"),
  ].join("|"),
);
// → "TEXTAREA|ti6dpd|combobox|true|/search"
```

分かったこと:

- 検索欄は `<input>` ではなく **`<textarea name="q">`**
- `id`（`ti6dpd` のような文字列）は **自動生成で変わる** ので使わない
- 「Google 検索」ボタン（`input[name="btnK"]`）は **2 つあり、片方は非表示** → クリックするより `form.requestSubmit()` で送信する方が確実

3. 候補のコードをその場で実行して確かめる

```js
const box = document.querySelector('textarea[name="q"]');
const setter = Object.getOwnPropertyDescriptor(
  HTMLTextAreaElement.prototype,
  "value",
).set;
setter.call(box, "テスト");
box.dispatchEvent(new Event("input", { bubbles: true }));
box.form.requestSubmit(); // → 検索結果ページに遷移した
```

ここまで確かめたものを `sites.js` の `run()` に書き写します。

## 良いセレクタの選び方

上から順に優先します。

| 優先 | 例                                              | 理由                                                             |
| ---- | ----------------------------------------------- | ---------------------------------------------------------------- |
| ◎    | `[data-testid="drug-name"]`                     | テスト用に付けられた属性。画面改修でも残りやすい                 |
| ◎    | `input[name="drugName"]`                        | フォーム送信に使う名前。変わるとサーバ側も困るので安定           |
| ○    | `[aria-label="薬剤名"]`、`label` との対応       | 画面の文言と対応しており読みやすい。文言変更には弱い             |
| △    | `#drugName`                                     | 意味のある id なら可。`#ti6dpd` / `#mui-12` のような自動生成は ✕ |
| ✕    | `.css-1x2y3z`、`div > div:nth-child(3) > input` | 見た目の変更・ビルドのたびに壊れる                               |

## Claude に頼むときの観点（そのまま使える依頼文）

```
Claude in Chrome で今開いている <画面名> を調べて。
目的: <薬剤名> 欄に値を入れ、<日数> 欄に値を入れ、<追加> ボタンを押したい。
それぞれの要素について:
- 安定したセレクタの候補（自動生成っぽい id / class は避ける）
- 同じセレクタに一致する要素の数と、見えているかどうか
- iframe の中にないか、shadow DOM の中にないか
- React / Vue などで作られていそうか（value 代入だけで反映されるか）
- 押した後に画面がどう変わるか（遷移 / モーダル / 一覧に行が増える）
候補のコードはページ上で実行して確かめて、結果を報告して。
実際の登録・送信ボタンは押さないで。
```

最後の一文が重要です。**調査中に本番データを登録してしまわない** よう、送信系の操作は人が確認するまで行わせないでください。
