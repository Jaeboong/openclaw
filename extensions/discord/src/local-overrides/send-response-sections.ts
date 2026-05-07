import {
  buildDiscordResponseEmbedMessages,
  type DiscordResponseEmbedMessage,
} from "./response-sections.js";

export async function sendDiscordResponseSectionMessages(params: {
  readonly text: string;
  readonly sendEmbed: (message: DiscordResponseEmbedMessage) => Promise<void>;
}): Promise<boolean> {
  const messages = buildDiscordResponseEmbedMessages(params.text);
  if (messages.length === 0) {
    return false;
  }

  for (const message of messages) {
    await params.sendEmbed(message);
  }

  return true;
}
