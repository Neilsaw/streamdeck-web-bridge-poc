import streamDeck, {
  action,
  KeyDownEvent,
  SingletonAction,
} from "@elgato/streamdeck";

import { broadcast, type Payload } from "../hub";

/**
 * ボタンごとの設定（ui/send-to-web.html の setting 名と対応）。
 * - text:   payload.text になる
 * - fields: 「名前=値」を 1 行に 1 つ。payload に追加される（処方の薬剤名・日数など）
 */
type SendSettings = {
  text?: string;
  fields?: string;
};

/** 押すと、設定した値を Chrome 拡張に送るボタン。 */
@action({ UUID: "com.example.webbridge.send" })
export class SendToWeb extends SingletonAction<SendSettings> {
  override async onKeyDown(ev: KeyDownEvent<SendSettings>): Promise<void> {
    const payload = toPayload(ev.payload.settings);
    if (Object.keys(payload).length === 0) {
      streamDeck.logger.warn("送る値が設定されていません");
      await ev.action.showAlert();
      return;
    }

    const acks = await broadcast(payload);
    acks.forEach((a) =>
      streamDeck.logger.info(`${a.status}: ${a.detail ?? ""} ${a.url ?? ""}`),
    );

    // 1 つでも done なら成功（✓）、それ以外は失敗（⚠）をボタンに表示
    if (acks.some((a) => a.status === "done")) {
      await ev.action.showOk();
    } else {
      await ev.action.showAlert();
    }
  }
}

function toPayload(settings: SendSettings): Payload {
  const payload: Payload = {};
  if (settings.text) payload.text = settings.text;
  for (const line of (settings.fields ?? "").split(/\r?\n/)) {
    const i = line.indexOf("=");
    if (i <= 0) continue;
    payload[line.slice(0, i).trim()] = line.slice(i + 1).trim();
  }
  return payload;
}
