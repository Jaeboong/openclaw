import type { APIEmbed } from "discord-api-types/v10";

export const DISCORD_EMBED_DESCRIPTION_LIMIT = 4096;

const DEFAULT_COLOR = 0xffffff;
const SECTION_CONFIG: Record<string, { color: number; emoji: string }> = {
  분석: { color: 0x57f287, emoji: "🔍" },
  결론: { color: 0x3498db, emoji: "📌" },
  주의: { color: 0xed4245, emoji: "⚠️" },
  에러: { color: 0xed4245, emoji: "⚠️" },
  질문: { color: 0xfee75c, emoji: "❓" },
  로그: { color: 0x99aab5, emoji: "📋" },
};

type ParsedResponseSection = {
  label?: string;
  color: number;
  emoji?: string;
  body: string;
};

export type DiscordResponseEmbedMessage = {
  embeds: APIEmbed[];
};

function stripLeadingNonLetters(value: string): string {
  return value.replace(/^[^\p{Letter}\p{Number}]+/u, "").trim();
}

function parseDiscordResponseSections(text: string): ParsedResponseSection[] {
  const sections: ParsedResponseSection[] = [];
  const lines = text.split("\n");
  let label: string | undefined;
  let color = DEFAULT_COLOR;
  let emoji: string | undefined;
  let buffer: string[] = [];
  let inCodeBlock = false;

  const flush = () => {
    const body = buffer.join("\n").trim();
    if (body) {
      sections.push({ label, color, emoji, body });
    }
  };

  for (const line of lines) {
    if (line.trim().startsWith("```")) {
      inCodeBlock = !inCodeBlock;
      buffer.push(line);
      continue;
    }

    if (!inCodeBlock && /^##\s+\S/u.test(line)) {
      const headerText = line.replace(/^##\s+/u, "").trim();
      const stripped = stripLeadingNonLetters(headerText);
      const matched = SECTION_CONFIG[stripped];
      if (matched) {
        flush();
        label = stripped;
        color = matched.color;
        emoji = matched.emoji;
        buffer = [];
        continue;
      }
    }

    buffer.push(line);
  }

  flush();
  return sections;
}

function splitEmbedDescription(text: string): string[] {
  if (text.length <= DISCORD_EMBED_DESCRIPTION_LIMIT) {
    return [text];
  }

  const chunks: string[] = [];
  let remaining = text;
  while (remaining.length > DISCORD_EMBED_DESCRIPTION_LIMIT) {
    let splitAt = remaining.lastIndexOf("\n", DISCORD_EMBED_DESCRIPTION_LIMIT);
    if (splitAt <= 0) {
      splitAt = DISCORD_EMBED_DESCRIPTION_LIMIT;
    }
    const chunk = remaining.slice(0, splitAt).trim();
    if (chunk) {
      chunks.push(chunk);
    }
    remaining = remaining.slice(splitAt).trim();
  }
  if (remaining) {
    chunks.push(remaining);
  }
  return chunks;
}

function buildTitle(section: ParsedResponseSection): string | undefined {
  if (!section.label || !section.emoji) {
    return undefined;
  }
  return `${section.emoji} ${section.label}`;
}

export function buildDiscordResponseEmbedMessages(text: string): DiscordResponseEmbedMessage[] {
  const sections = parseDiscordResponseSections(text);
  const messages: DiscordResponseEmbedMessage[] = [];

  for (const section of sections) {
    const title = buildTitle(section);
    const chunks = splitEmbedDescription(section.body);
    for (const description of chunks) {
      messages.push({
        embeds: [
          {
            ...(title ? { title } : {}),
            color: section.color,
            description,
          },
        ],
      });
    }
  }

  return messages;
}
