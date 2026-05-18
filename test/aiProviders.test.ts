import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  ClaudeChatProvider,
  GeminiChatProvider,
  PerplexityChatProvider,
  createChatProvider,
  getConfiguredModel,
  isConfiguredProviderReady
} from '../src/aiProviders.js';
import {
  DEFAULT_CLAUDE_MODEL,
  DEFAULT_GEMINI_MODEL,
  DEFAULT_OPENAI_MODEL,
  DEFAULT_PERPLEXITY_MODEL,
  loadConfig
} from '../src/config.js';
import { MissingProviderKeyError, OpenAIChatProvider } from '../src/openaiClient.js';

describe('provider switcher', () => {
  it('defaults to OpenAI and reports the selected model', () => {
    const config = loadConfig({});

    assert.equal(config.aiProvider, 'openai');
    assert.equal(getConfiguredModel(config), DEFAULT_OPENAI_MODEL);
    assert.equal(isConfiguredProviderReady(config), false);
    assert.ok(createChatProvider(config) instanceof OpenAIChatProvider);
  });

  it('selects Claude, Gemini, and Perplexity from AI_PROVIDER', () => {
    const claude = loadConfig({ AI_PROVIDER: 'claude', ANTHROPIC_API_KEY: 'key' });
    const gemini = loadConfig({ AI_PROVIDER: 'gemini', GEMINI_API_KEY: 'key' });
    const perplexity = loadConfig({ AI_PROVIDER: 'perplexity', PERPLEXITY_API_KEY: 'key' });

    assert.equal(getConfiguredModel(claude), DEFAULT_CLAUDE_MODEL);
    assert.equal(getConfiguredModel(gemini), DEFAULT_GEMINI_MODEL);
    assert.equal(getConfiguredModel(perplexity), DEFAULT_PERPLEXITY_MODEL);
    assert.equal(isConfiguredProviderReady(claude), true);
    assert.ok(createChatProvider(claude) instanceof ClaudeChatProvider);
    assert.ok(createChatProvider(gemini) instanceof GeminiChatProvider);
    assert.ok(createChatProvider(perplexity) instanceof PerplexityChatProvider);
  });
});

describe('ClaudeChatProvider', () => {
  it('calls the Messages API and parses text blocks', async () => {
    const calls: Array<{ url: string; init: RequestInit }> = [];
    const provider = new ClaudeChatProvider({
      apiKey: 'anthropic-key',
      model: 'claude-test',
      fetchFn: async (url, init) => {
        calls.push({ url: String(url), init: init ?? {} });
        return jsonResponse({
          content: [{ type: 'text', text: 'Hello from Claude.' }]
        });
      }
    });

    const answer = await provider.reply([{ role: 'user', content: 'hello' }]);

    assert.equal(answer, 'Hello from Claude.');
    assert.equal(calls[0]?.url, 'https://api.anthropic.com/v1/messages');
    assert.equal((calls[0]?.init.headers as Record<string, string>)['x-api-key'], 'anthropic-key');
    assert.equal(JSON.parse(String(calls[0]?.init.body)).model, 'claude-test');
  });

  it('adds the web search server tool when enabled', async () => {
    const calls: Array<{ url: string; init: RequestInit }> = [];
    const provider = new ClaudeChatProvider({
      apiKey: 'anthropic-key',
      model: 'claude-test',
      webSearch: true,
      webSearchMaxUses: 2,
      fetchFn: async (url, init) => {
        calls.push({ url: String(url), init: init ?? {} });
        return jsonResponse({
          content: [{ type: 'text', text: 'Fresh answer.' }]
        });
      }
    });

    await provider.reply([{ role: 'user', content: 'what happened today?' }]);

    assert.deepEqual(JSON.parse(String(calls[0]?.init.body)).tools, [
      {
        type: 'web_search_20250305',
        name: 'web_search',
        max_uses: 2
      }
    ]);
  });

  it('requires ANTHROPIC_API_KEY', async () => {
    const provider = new ClaudeChatProvider({ model: 'claude-test' });

    await assert.rejects(provider.reply([{ role: 'user', content: 'hello' }]), MissingProviderKeyError);
  });
});

describe('GeminiChatProvider', () => {
  it('calls generateContent and maps assistant history to model role', async () => {
    const calls: Array<{ url: string; init: RequestInit }> = [];
    const provider = new GeminiChatProvider({
      apiKey: 'gemini-key',
      model: 'models/gemini-test',
      fetchFn: async (url, init) => {
        calls.push({ url: String(url), init: init ?? {} });
        return jsonResponse({
          candidates: [
            {
              content: {
                parts: [{ text: 'Hello from Gemini.' }]
              }
            }
          ]
        });
      }
    });

    const answer = await provider.reply([
      { role: 'user', content: 'hello' },
      { role: 'assistant', content: 'hi' },
      { role: 'user', content: 'again' }
    ]);

    const body = JSON.parse(String(calls[0]?.init.body));
    assert.equal(answer, 'Hello from Gemini.');
    assert.equal(
      calls[0]?.url,
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-test:generateContent'
    );
    assert.equal((calls[0]?.init.headers as Record<string, string>)['x-goog-api-key'], 'gemini-key');
    assert.deepEqual(
      body.contents.map((content: { role: string }) => content.role),
      ['user', 'model', 'user']
    );
  });
});

describe('PerplexityChatProvider', () => {
  it('calls the Sonar API and parses chat completions format', async () => {
    const calls: Array<{ url: string; init: RequestInit }> = [];
    const provider = new PerplexityChatProvider({
      apiKey: 'perplexity-key',
      model: 'sonar-test',
      fetchFn: async (url, init) => {
        calls.push({ url: String(url), init: init ?? {} });
        return jsonResponse({
          choices: [{ message: { content: 'Hello from Perplexity.' } }]
        });
      }
    });

    const answer = await provider.reply([{ role: 'user', content: 'hello' }]);
    const body = JSON.parse(String(calls[0]?.init.body));

    assert.equal(answer, 'Hello from Perplexity.');
    assert.equal(calls[0]?.url, 'https://api.perplexity.ai/v1/sonar');
    assert.equal((calls[0]?.init.headers as Record<string, string>).authorization, 'Bearer perplexity-key');
    assert.equal(body.messages[0].role, 'system');
    assert.equal(body.model, 'sonar-test');
  });
});

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json' }
  });
}
