import type { AppConfig } from './config.js';
import type { ChatMessage, ChatProvider } from './conversation.js';
import { sanitizeForSpeech } from './conversation.js';
import {
  MissingProviderKeyError,
  OpenAIChatProvider,
  VOICE_INSTRUCTIONS
} from './openaiClient.js';

type FetchFn = typeof fetch;

type HttpProviderOptions = {
  apiKey?: string;
  model: string;
  fetchFn?: FetchFn;
  instructions?: string;
  webSearch?: boolean;
  webSearchMaxUses?: number;
};

export function createChatProvider(config: AppConfig): ChatProvider {
  switch (config.aiProvider) {
    case 'claude':
      return new ClaudeChatProvider({
        apiKey: config.anthropicApiKey,
        model: config.claudeModel,
        webSearch: config.claudeWebSearch,
        webSearchMaxUses: config.claudeWebSearchMaxUses
      });
    case 'gemini':
      return new GeminiChatProvider({
        apiKey: config.geminiApiKey,
        model: config.geminiModel
      });
    case 'perplexity':
      return new PerplexityChatProvider({
        apiKey: config.perplexityApiKey,
        model: config.perplexityModel
      });
    case 'openai':
    default:
      return new OpenAIChatProvider({
        apiKey: config.openAiApiKey,
        model: config.openAiModel
      });
  }
}

export function getConfiguredModel(config: AppConfig): string {
  switch (config.aiProvider) {
    case 'claude':
      return config.claudeModel;
    case 'gemini':
      return config.geminiModel;
    case 'perplexity':
      return config.perplexityModel;
    case 'openai':
    default:
      return config.openAiModel;
  }
}

export function isConfiguredProviderReady(config: AppConfig): boolean {
  switch (config.aiProvider) {
    case 'claude':
      return Boolean(config.anthropicApiKey);
    case 'gemini':
      return Boolean(config.geminiApiKey);
    case 'perplexity':
      return Boolean(config.perplexityApiKey);
    case 'openai':
    default:
      return Boolean(config.openAiApiKey);
  }
}

export class ClaudeChatProvider implements ChatProvider {
  private readonly apiKey?: string;
  private readonly model: string;
  private readonly fetchFn: FetchFn;
  private readonly instructions: string;
  private readonly webSearch: boolean;
  private readonly webSearchMaxUses: number;

  constructor(options: HttpProviderOptions) {
    this.apiKey = options.apiKey;
    this.model = options.model;
    this.fetchFn = options.fetchFn ?? fetch;
    this.instructions = options.instructions ?? VOICE_INSTRUCTIONS;
    this.webSearch = options.webSearch ?? false;
    this.webSearchMaxUses = options.webSearchMaxUses ?? 3;
  }

  async reply(messages: ChatMessage[]): Promise<string> {
    if (!this.apiKey) {
      throw new MissingProviderKeyError('Claude', 'ANTHROPIC_API_KEY');
    }

    const response = await this.fetchFn('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': this.apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: this.model,
        max_tokens: 350,
        system: this.instructions,
        messages: messages.map((message) => ({
          role: message.role,
          content: message.content
        })),
        ...(this.webSearch
          ? {
              tools: [
                {
                  type: 'web_search_20250305',
                  name: 'web_search',
                  max_uses: this.webSearchMaxUses
                }
              ]
            }
          : {})
      })
    });

    const json = await parseProviderJson(response, 'Claude');
    const text = json.content
      ?.filter((part: { type?: string }) => part.type === 'text')
      .map((part: { text?: string }) => part.text ?? '')
      .join(' ');

    return parseOutputText(text, 'Claude');
  }
}

export class GeminiChatProvider implements ChatProvider {
  private readonly apiKey?: string;
  private readonly model: string;
  private readonly fetchFn: FetchFn;
  private readonly instructions: string;

  constructor(options: HttpProviderOptions) {
    this.apiKey = options.apiKey;
    this.model = options.model.replace(/^models\//, '');
    this.fetchFn = options.fetchFn ?? fetch;
    this.instructions = options.instructions ?? VOICE_INSTRUCTIONS;
  }

  async reply(messages: ChatMessage[]): Promise<string> {
    if (!this.apiKey) {
      throw new MissingProviderKeyError('Gemini', 'GEMINI_API_KEY');
    }

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
      this.model
    )}:generateContent`;
    const response = await this.fetchFn(url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-goog-api-key': this.apiKey
      },
      body: JSON.stringify({
        system_instruction: {
          parts: [{ text: this.instructions }]
        },
        contents: messages.map((message) => ({
          role: message.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: message.content }]
        })),
        generationConfig: {
          maxOutputTokens: 350
        }
      })
    });

    const json = await parseProviderJson(response, 'Gemini');
    const text = json.candidates?.[0]?.content?.parts
      ?.map((part: { text?: string }) => part.text ?? '')
      .join(' ');

    return parseOutputText(text, 'Gemini');
  }
}

export class PerplexityChatProvider implements ChatProvider {
  private readonly apiKey?: string;
  private readonly model: string;
  private readonly fetchFn: FetchFn;
  private readonly instructions: string;

  constructor(options: HttpProviderOptions) {
    this.apiKey = options.apiKey;
    this.model = options.model;
    this.fetchFn = options.fetchFn ?? fetch;
    this.instructions = options.instructions ?? VOICE_INSTRUCTIONS;
  }

  async reply(messages: ChatMessage[]): Promise<string> {
    if (!this.apiKey) {
      throw new MissingProviderKeyError('Perplexity', 'PERPLEXITY_API_KEY');
    }

    const response = await this.fetchFn('https://api.perplexity.ai/v1/sonar', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${this.apiKey}`,
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        model: this.model,
        messages: [
          { role: 'system', content: this.instructions },
          ...messages.map((message) => ({
            role: message.role,
            content: message.content
          }))
        ],
        max_tokens: 350
      })
    });

    const json = await parseProviderJson(response, 'Perplexity');
    return parseOutputText(json.choices?.[0]?.message?.content, 'Perplexity');
  }
}

async function parseProviderJson(response: Response, provider: string): Promise<Record<string, any>> {
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`${provider} API request failed (${response.status}): ${body.slice(0, 500)}`);
  }

  return (await response.json()) as Record<string, any>;
}

function parseOutputText(text: string | undefined, provider: string): string {
  const output = sanitizeForSpeech(text ?? '');
  if (!output) {
    throw new Error(`${provider} returned an empty response.`);
  }

  return output;
}
