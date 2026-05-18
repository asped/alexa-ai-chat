import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { IntentRequest, RequestEnvelope } from 'ask-sdk-model';

import { buildSkill, getOutputSpeechText } from '../src/alexaSkill.js';
import type { ChatProvider } from '../src/conversation.js';
import { MissingProviderKeyError } from '../src/openaiClient.js';

describe('Alexa skill', () => {
  it('welcomes users on launch', async () => {
    const skill = buildSkill(fakeProvider('unused'));

    const response = await skill.invoke(launchRequest());

    assert.match(getOutputSpeechText(response.response) ?? '', /Welcome to AI chat/);
    assert.notEqual(response.response.shouldEndSession, true);
  });

  it('sends the user query and keeps the session open', async () => {
    const provider = recordingProvider('Mount Everest is the tallest mountain above sea level.');
    const skill = buildSkill(provider);

    const response = await skill.invoke(chatIntent('what is the tallest mountain'));

    assert.deepEqual(provider.calls[0], [
      { role: 'user', content: 'what is the tallest mountain' }
    ]);
    assert.match(getOutputSpeechText(response.response) ?? '', /Mount Everest/);
    assert.notEqual(response.response.shouldEndSession, true);
    assert.deepEqual(response.sessionAttributes, {
      history: [
        { role: 'user', content: 'what is the tallest mountain' },
        { role: 'assistant', content: 'Mount Everest is the tallest mountain above sea level.' }
      ]
    });
  });

  it('includes prior session history for follow-up questions', async () => {
    const provider = recordingProvider('It is 8,849 meters high.');
    const skill = buildSkill(provider);

    await skill.invoke(
      chatIntent('how high is it', {
        history: [
          { role: 'user', content: 'what is the tallest mountain' },
          { role: 'assistant', content: 'Mount Everest is the tallest mountain above sea level.' }
        ]
      })
    );

    assert.deepEqual(provider.calls[0], [
      { role: 'user', content: 'what is the tallest mountain' },
      { role: 'assistant', content: 'Mount Everest is the tallest mountain above sea level.' },
      { role: 'user', content: 'how high is it' }
    ]);
  });

  it('prompts again when the query slot is missing', async () => {
    const provider = recordingProvider('unused');
    const skill = buildSkill(provider);

    const response = await skill.invoke(chatIntent(undefined));

    assert.equal(provider.calls.length, 0);
    assert.match(getOutputSpeechText(response.response) ?? '', /did not catch/);
  });

  it('explains missing OpenAI configuration', async () => {
    const skill = buildSkill({
      reply: async () => {
        throw new MissingProviderKeyError('OpenAI', 'OPENAI_API_KEY');
      }
    });

    const response = await skill.invoke(chatIntent('hello'));

    assert.match(getOutputSpeechText(response.response) ?? '', /OpenAI API key is not configured/);
  });

  it('ends the session on stop', async () => {
    const skill = buildSkill(fakeProvider('unused'));

    const response = await skill.invoke(intentRequest('AMAZON.StopIntent'));

    assert.match(getOutputSpeechText(response.response) ?? '', /Goodbye/);
    assert.equal(response.response.shouldEndSession, true);
  });
});

function fakeProvider(answer: string): ChatProvider {
  return recordingProvider(answer);
}

function recordingProvider(answer: string): ChatProvider & { calls: unknown[][] } {
  const calls: unknown[][] = [];
  return {
    calls,
    reply: async (messages) => {
      calls.push(messages);
      return answer;
    }
  };
}

function launchRequest(): RequestEnvelope {
  return {
    version: '1.0',
    session: {
      new: true,
      sessionId: 'session-id',
      application: { applicationId: 'amzn1.ask.skill.test' },
      user: { userId: 'user-id' }
    },
    context: {
      System: {
        application: { applicationId: 'amzn1.ask.skill.test' },
        user: { userId: 'user-id' },
        device: {
          deviceId: 'device-id',
          supportedInterfaces: {}
        },
        apiEndpoint: 'https://api.amazonalexa.com'
      }
    },
    request: {
      type: 'LaunchRequest',
      requestId: 'request-id',
      timestamp: new Date().toISOString(),
      locale: 'en-US'
    }
  };
}

function chatIntent(query?: string, sessionAttributes?: Record<string, unknown>): RequestEnvelope {
  const envelope = intentRequest('ChatIntent', sessionAttributes) as RequestEnvelope & {
    request: IntentRequest;
  };
  envelope.request = {
    ...envelope.request,
    intent: {
      name: 'ChatIntent',
      confirmationStatus: 'NONE',
      slots: query
        ? {
            Query: {
              name: 'Query',
              value: query,
              confirmationStatus: 'NONE'
            }
          }
        : {}
    }
  };
  return envelope;
}

function intentRequest(
  intentName: string,
  sessionAttributes?: Record<string, unknown>
): RequestEnvelope {
  return {
    version: '1.0',
    session: {
      new: false,
      sessionId: 'session-id',
      application: { applicationId: 'amzn1.ask.skill.test' },
      user: { userId: 'user-id' },
      attributes: sessionAttributes
    },
    context: {
      System: {
        application: { applicationId: 'amzn1.ask.skill.test' },
        user: { userId: 'user-id' },
        device: {
          deviceId: 'device-id',
          supportedInterfaces: {}
        },
        apiEndpoint: 'https://api.amazonalexa.com'
      }
    },
    request: {
      type: 'IntentRequest',
      requestId: 'request-id',
      timestamp: new Date().toISOString(),
      locale: 'en-US',
      dialogState: 'COMPLETED',
      intent: {
        name: intentName,
        confirmationStatus: 'NONE'
      }
    }
  };
}
