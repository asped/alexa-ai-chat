import OpenAI from 'openai';

import { DEFAULT_OPENAI_MODEL } from './config.js';
import type { ChatMessage, ChatProvider } from './conversation.js';
import { sanitizeForSpeech } from './conversation.js';

export const VOICE_INSTRUCTIONS = [
  'You are a helpful chatbot speaking through an Alexa skill.',
  'Answer conversationally and concisely.',
  'Keep responses under about 90 spoken words unless the user asks for detail.',
  'Avoid Markdown formatting, tables, footnotes, URLs unless necessary, and visual-only wording.',
  'If you are unsure, say so briefly and offer a useful next step.'
].join(' ');

type ResponsesClient = {
  responses: {
    create(input: {
      model: string;
      instructions: string;
      input: Array<{ role: ChatMessage['role']; content: string }>;
      max_output_tokens: number;
      store: boolean;
    }): Promise<{ output_text?: string | null }>;
  };
};

export class MissingOpenAIKeyError extends Error {
  constructor() {
    super('OPENAI_API_KEY is not configured.');
    this.name = 'MissingOpenAIKeyError';
  }
}

export class MissingProviderKeyError extends Error {
  constructor(
    public readonly provider: string,
    public readonly envVar: string
  ) {
    super(`${envVar} is not configured for ${provider}.`);
    this.name = 'MissingProviderKeyError';
  }
}

export type OpenAIChatProviderOptions = {
  apiKey?: string;
  model?: string;
  client?: ResponsesClient;
  instructions?: string;
};

export class OpenAIChatProvider implements ChatProvider {
  private readonly apiKey?: string;
  private readonly model: string;
  private readonly injectedClient?: ResponsesClient;
  private readonly instructions: string;
  private client?: ResponsesClient;

  constructor(options: OpenAIChatProviderOptions = {}) {
    this.apiKey = options.apiKey;
    this.model = options.model ?? DEFAULT_OPENAI_MODEL;
    this.injectedClient = options.client;
    this.instructions = options.instructions ?? VOICE_INSTRUCTIONS;
  }

  async reply(messages: ChatMessage[]): Promise<string> {
    const client = this.getClient();
    const response = await client.responses.create({
      model: this.model,
      instructions: this.instructions,
      input: messages.map((message) => ({
        role: message.role,
        content: message.content
      })),
      max_output_tokens: 350,
      store: false
    });

    const output = sanitizeForSpeech(response.output_text ?? '');
    if (!output) {
      throw new Error('OpenAI returned an empty response.');
    }

    return output;
  }

  private getClient(): ResponsesClient {
    if (this.injectedClient) {
      return this.injectedClient;
    }

    if (!this.apiKey) {
      throw new MissingProviderKeyError('OpenAI', 'OPENAI_API_KEY');
    }

    this.client ??= new OpenAI({ apiKey: this.apiKey });
    return this.client;
  }
}
