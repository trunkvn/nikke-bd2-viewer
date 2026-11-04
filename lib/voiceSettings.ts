import { createSetting } from "./createSetting";

/** "on" | "off" */
export const voiceEnabledSetting = createSetting("nikke-viewer:voice", "on");
/** Ngôn ngữ ưa thích; nếu nhân vật không có thì dùng ngôn ngữ đầu tiên có sẵn. */
export const voiceLangSetting = createSetting("nikke-viewer:voice-lang", "ja");
