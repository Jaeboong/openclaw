import { describe, expect, it } from "vitest";
import {
  buildDiscordResponseEmbedMessages,
  DISCORD_EMBED_DESCRIPTION_LIMIT,
} from "./discord-response-sections.js";

describe("buildDiscordResponseEmbedMessages", () => {
  it("renders plain text as a neutral embed", () => {
    const messages = buildDiscordResponseEmbedMessages("간단한 답변이야.");

    expect(messages).toEqual([
      {
        embeds: [
          {
            color: 0xffffff,
            description: "간단한 답변이야.",
          },
        ],
      },
    ]);
  });

  it("renders known section headings with titles and colors", () => {
    const messages = buildDiscordResponseEmbedMessages("## 주의\n확인 필요\n\n## 로그\n처리됨");

    expect(messages).toEqual([
      {
        embeds: [
          {
            title: "⚠️ 주의",
            color: 0xed4245,
            description: "확인 필요",
          },
        ],
      },
      {
        embeds: [
          {
            title: "📋 로그",
            color: 0x99aab5,
            description: "처리됨",
          },
        ],
      },
    ]);
  });

  it("splits long content at Discord embed description limits", () => {
    const messages = buildDiscordResponseEmbedMessages(
      "x".repeat(DISCORD_EMBED_DESCRIPTION_LIMIT + 10),
    );

    expect(messages).toHaveLength(2);
    expect(messages[0]?.embeds[0]?.description).toHaveLength(DISCORD_EMBED_DESCRIPTION_LIMIT);
    expect(messages[1]?.embeds[0]?.description).toHaveLength(10);
  });
});
