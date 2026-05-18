export type ChatRole = 'user' | 'assistant';

export type ChatMessage = {
  role: ChatRole;
  content: string;
};

export type ChatProvider = {
  reply(messages: ChatMessage[]): Promise<string>;
};

export function appendMessage(
  history: ChatMessage[],
  message: ChatMessage,
  maxMessages: number
): ChatMessage[] {
  const safeMessage = {
    ...message,
    content: message.content.trim().slice(0, 2000)
  };

  return [...history, safeMessage].slice(-maxMessages);
}

export function sanitizeForSpeech(text: string): string {
  return text
    .replace(/```[\s\S]*?```/g, 'I have a code example, but it may be easier to read on screen.')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/^\s{0,3}#{1,6}\s+/gm, '')
    .replace(/^\s*[-*]\s+/gm, '')
    .replace(/\[(.*?)\]\((.*?)\)/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();
}
