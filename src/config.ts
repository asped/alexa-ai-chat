export const DEFAULT_PORT = 3000;
export const DEFAULT_OPENAI_MODEL = 'gpt-5.4-mini';
export const DEFAULT_CLAUDE_MODEL = 'claude-sonnet-4-6';
export const DEFAULT_GEMINI_MODEL = 'gemini-2.5-flash';
export const DEFAULT_PERPLEXITY_MODEL = 'sonar';
export const DEFAULT_MAX_HISTORY_MESSAGES = 12;
export const DEFAULT_CLAUDE_WEB_SEARCH_MAX_USES = 3;

export type AiProviderName = 'openai' | 'claude' | 'gemini' | 'perplexity';

export type AppConfig = {
  port: number;
  host: string;
  aiProvider: AiProviderName;
  openAiApiKey?: string;
  openAiModel: string;
  anthropicApiKey?: string;
  claudeModel: string;
  claudeWebSearch: boolean;
  claudeWebSearchMaxUses: number;
  geminiApiKey?: string;
  geminiModel: string;
  perplexityApiKey?: string;
  perplexityModel: string;
  maxHistoryMessages: number;
};

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  return {
    port: Number.parseInt(env.PORT ?? `${DEFAULT_PORT}`, 10),
    host: env.HOST ?? '127.0.0.1',
    aiProvider: parseAiProvider(env.AI_PROVIDER),
    openAiApiKey: env.OPENAI_API_KEY,
    openAiModel: env.OPENAI_MODEL ?? DEFAULT_OPENAI_MODEL,
    anthropicApiKey: env.ANTHROPIC_API_KEY,
    claudeModel: env.CLAUDE_MODEL ?? DEFAULT_CLAUDE_MODEL,
    claudeWebSearch: parseBoolean(env.CLAUDE_WEB_SEARCH),
    claudeWebSearchMaxUses: parsePositiveInt(
      env.CLAUDE_WEB_SEARCH_MAX_USES,
      DEFAULT_CLAUDE_WEB_SEARCH_MAX_USES
    ),
    geminiApiKey: env.GEMINI_API_KEY,
    geminiModel: env.GEMINI_MODEL ?? DEFAULT_GEMINI_MODEL,
    perplexityApiKey: env.PERPLEXITY_API_KEY,
    perplexityModel: env.PERPLEXITY_MODEL ?? DEFAULT_PERPLEXITY_MODEL,
    maxHistoryMessages: Number.parseInt(
      env.MAX_HISTORY_MESSAGES ?? `${DEFAULT_MAX_HISTORY_MESSAGES}`,
      10
    )
  };
}

function parseAiProvider(value: string | undefined): AiProviderName {
  if (value === 'claude' || value === 'gemini' || value === 'perplexity' || value === 'openai') {
    return value;
  }

  return 'openai';
}

function parseBoolean(value: string | undefined): boolean {
  return value === 'true' || value === '1' || value === 'yes';
}

function parsePositiveInt(value: string | undefined, fallback: number): number {
  const parsed = Number.parseInt(value ?? '', 10);
  if (!Number.isFinite(parsed) || parsed < 1) {
    return fallback;
  }

  return parsed;
}
