// DOM 操作の小道具。sites.js の run() から `dom.xxx` として使う。
// どのサイトでも共通に使えるものだけをここに置く。

const dom = {
  /**
   * セレクタに一致する要素が現れるまで待つ（SPA や遅延描画の画面向け）。
   * timeoutMs を過ぎたら例外を投げる。
   */
  async waitFor(selector, timeoutMs = 3000) {
    const started = Date.now();
    while (Date.now() - started < timeoutMs) {
      const el = document.querySelector(selector);
      if (el) return el;
      await new Promise((r) => setTimeout(r, 100));
    }
    throw new Error(`要素が見つかりません: ${selector}`);
  },

  /**
   * input / textarea に値を入れて、画面側に「入力された」と気づかせる。
   *
   * `el.value = "..."` だけだと React / Vue などの画面は変更を検知せず、
   * 送信時に空のまま扱われることがある。ブラウザ本来の value セッターで
   * 値を入れてから input / change イベントを発火させるのが定石。
   */
  setValue(el, value) {
    const proto =
      el instanceof HTMLTextAreaElement
        ? HTMLTextAreaElement.prototype
        : HTMLInputElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(proto, "value").set;
    el.focus();
    setter.call(el, value);
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
  },

  /** <select> の選択肢を表示テキストで選ぶ。 */
  selectByText(selectEl, text) {
    const option = [...selectEl.options].find((o) => o.text.trim() === text);
    if (!option) throw new Error(`選択肢がありません: ${text}`);
    selectEl.value = option.value;
    selectEl.dispatchEvent(new Event("change", { bubbles: true }));
  },

  /** ボタンやリンクをクリックする。 */
  click(el) {
    el.click();
  },
};
