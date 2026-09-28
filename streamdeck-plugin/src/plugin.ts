import streamDeck from "@elgato/streamdeck";

import { SendToWeb } from "./actions/send-to-web";
import { startHub } from "./hub";

// ログは com.example.webbridge.sdPlugin/logs/ に出る
streamDeck.logger.setLevel("info");

// Chrome 拡張からの WebSocket 接続を受け付け始める（プラグインが動いている間ずっと）
startHub();

streamDeck.actions.registerAction(new SendToWeb());
streamDeck.connect();
