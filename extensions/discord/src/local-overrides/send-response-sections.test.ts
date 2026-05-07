import { describe, expect, it } from "vitest";
import type { DiscordResponseEmbedMessage } from "./response-sections.js";
import { sendDiscordResponseSectionMessages } from "./send-response-sections.js";

describe("sendDiscordResponseSectionMessages", () => {
  it("returns false when text has no embeddable content", async () => {
    const sent: DiscordResponseEmbedMessage[] = [];

    await expect(
      sendDiscordResponseSectionMessages({
        text: "",
        sendEmbed: async (message) => {
          sent.push(message);
        },
      }),
    ).resolves.toBe(false);

    expect(sent).toEqual([]);
  });

  it("sends response sections as embed messages", async () => {
    const sent: DiscordResponseEmbedMessage[] = [];

    await expect(
      sendDiscordResponseSectionMessages({
        text: "## 결론\n처리됨\n\n## 로그\n기록됨",
        sendEmbed: async (message) => {
          sent.push(message);
        },
      }),
    ).resolves.toBe(true);

    expect(sent).toHaveLength(2);
    expect(sent.map((message) => message.embeds[0]?.title)).toEqual(["📌 결론", "📋 로그"]);
  });
});
