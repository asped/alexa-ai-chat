import 'dotenv/config';

import express from 'express';
import { ExpressAdapter } from 'ask-sdk-express-adapter';
import type { RequestEnvelope } from 'ask-sdk-model';

import {
  createChatProvider,
  getConfiguredModel,
  isConfiguredProviderReady
} from './aiProviders.js';
import { buildSkill } from './alexaSkill.js';
import { loadConfig } from './config.js';

const config = loadConfig();
const app = express();
const provider = createChatProvider(config);
const skill = buildSkill(provider, {
  maxHistoryMessages: config.maxHistoryMessages
});
const adapter = new ExpressAdapter(skill, true, true);

app.get('/health', (_request, response) => {
  response.json({
    ok: true,
    provider: config.aiProvider,
    providerConfigured: isConfiguredProviderReady(config),
    openAiConfigured: Boolean(config.openAiApiKey),
    model: getConfiguredModel(config),
    claudeWebSearch: config.aiProvider === 'claude' ? config.claudeWebSearch : undefined
  });
});

app.get('/alexa', (_request, response) => {
  response
    .type('text/plain')
    .send('Alexa Chat endpoint is running. Alexa sends signed POST requests to this URL.');
});

app.post('/dev/alexa', express.json({ limit: '1mb' }), async (request, response) => {
  try {
    const result = await skill.invoke(request.body as RequestEnvelope);
    response.json({
      ...result,
      debug: {
        provider: config.aiProvider,
        model: getConfiguredModel(config),
        claudeWebSearch: config.aiProvider === 'claude' ? config.claudeWebSearch : undefined
      }
    });
  } catch (error) {
    console.error('Dev Alexa request failed', error);
    response.status(400).json({
      error: error instanceof Error ? error.message : 'Invalid Alexa request envelope.'
    });
  }
});

app.post('/alexa', adapter.getRequestHandlers());

app.listen(config.port, config.host, () => {
  console.log(`Alexa Chat skill listening on http://${config.host}:${config.port}`);
  console.log('Expose POST /alexa through an HTTPS tunnel for Alexa Developer Console testing.');
});
