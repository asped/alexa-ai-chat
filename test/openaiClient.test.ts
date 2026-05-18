import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { MissingProviderKeyError, OpenAIChatProvider } from '../src/openaiClient.js';

describe('OpenAIChatProvider', () => {
  it('sends bounded voice-friendly requests to the Responses API', async () => {
    const calls: unknown[] = [];
    const create = async (input: unknown) => {
      calls.push(input);
      return {
        output_text: 'Sure! Mount Everest is the tallest mountain above sea level.'
      };
    };
    const provider = new OpenAIChatProvider({
      apiKey: 'test-key',
      model: 'gpt-test',
      client: {
        responses: { create }
      }
    });

    const answer = await provider.reply([
      { role: 'user', content: 'What is the tallest mountain?' }
    ]);

    assert.equal(answer, 'Sure! Mount Everest is the tallest mountain above sea level.');
    assert.deepEqual(calls, [{
      model: 'gpt-test',
      instructions: calls.length === 1 ? (calls[0] as { instructions: string }).instructions : '',
      input: [{ role: 'user', content: 'What is the tallest mountain?' }],
      max_output_tokens: 350,
      store: false
    }]);
    assert.match((calls[0] as { instructions: string }).instructions, /Alexa skill/);
  });

  it('strips speech-hostile Markdown from responses', async () => {
    const provider = new OpenAIChatProvider({
      client: {
        responses: {
          create: async () => ({
            output_text: '## Answer\n- Use `pnpm dev`.'
          })
        }
      }
    });

    const answer = await provider.reply([{ role: 'user', content: 'How do I run it?' }]);
    assert.equal(answer, 'Answer Use pnpm dev.');
  });

  it('throws a clear error when no API key or injected client is available', async () => {
    const provider = new OpenAIChatProvider();

    await assert.rejects(
      provider.reply([{ role: 'user', content: 'Hello' }]),
      MissingProviderKeyError
    );
  });

  it('throws when OpenAI returns no speakable text', async () => {
    const provider = new OpenAIChatProvider({
      client: {
        responses: {
          create: async () => ({ output_text: '' })
        }
      }
    });

    await assert.rejects(
      provider.reply([{ role: 'user', content: 'Hello' }]),
      /empty response/
    );
  });
});
