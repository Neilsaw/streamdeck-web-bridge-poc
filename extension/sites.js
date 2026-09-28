// 「どの URL で」「何をするか」の定義。自分のサイトに合わせるときは主にここを書き換える。
//
// - urlPattern: location.href がこれに一致するページでのみ run() が動く。
//   manifest.json の content_scripts.matches（拡張がそもそも読み込まれる範囲）より
//   狭く絞るためのもの。両方を合わせて変更すること。
// - run(payload, dom): ブリッジから届いたデータで DOM を操作する。
//   payload は Stream Deck が叩いた URL のクエリ（?text=...&foo=...）がそのまま入ったオブジェクト。
//   失敗したら例外を投げる（ブリッジに failed として返る）。

const SITES = [
  {
    name: "Google 検索",
    // トップ（/）と検索結果（/search?q=...）だけ。/maps などでは動かない
    urlPattern: /^https:\/\/www\.google\.(com|co\.jp)\/(search)?([?#]|$)/,

    async run(payload, dom) {
      if (!payload.text) throw new Error("text がありません");

      // 調査結果（docs/02-dom-investigation.md）:
      // - 検索欄は <textarea name="q">。id は難読化されていて変わるので使わない
      // - トップページでも検索結果ページでも同じセレクタで取れる
      // - 「Google 検索」ボタンは同じ name で複数あり非表示のものもあるので、
      //   ボタンを探してクリックするより form を送信する方が確実
      const box = await dom.waitFor('textarea[name="q"]');
      dom.setValue(box, payload.text);
      box.form.requestSubmit();
    },
  },

  // 例: 処方画面なら、薬剤名・日数などを別々の欄に入れて「追加」を押す、のような形になる。
  // {
  //   name: "処方入力",
  //   urlPattern: /^https:\/\/emr\.example\.jp\/patients\/\d+\/prescriptions/,
  //   async run(payload, dom) {
  //     dom.setValue(await dom.waitFor('input[name="drugName"]'), payload.drug);
  //     dom.setValue(await dom.waitFor('input[name="days"]'), payload.days);
  //     dom.click(await dom.waitFor('button[data-testid="add-prescription"]'));
  //   },
  // },
];
