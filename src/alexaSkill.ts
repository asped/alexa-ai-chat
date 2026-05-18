import * as Alexa from 'ask-sdk-core';
import type { ErrorHandler, HandlerInput, RequestHandler, Skill } from 'ask-sdk-core';
import type { Response } from 'ask-sdk-model';
import type { IntentRequest } from 'ask-sdk-model';

import { DEFAULT_MAX_HISTORY_MESSAGES } from './config.js';
import type { ChatMessage, ChatProvider } from './conversation.js';
import { appendMessage } from './conversation.js';
import { MissingProviderKeyError } from './openaiClient.js';

type SessionAttributes = {
  history?: ChatMessage[];
};

export type AlexaSkillOptions = {
  maxHistoryMessages?: number;
};

export function buildSkill(provider: ChatProvider, options: AlexaSkillOptions = {}): Skill {
  const maxHistoryMessages = options.maxHistoryMessages ?? DEFAULT_MAX_HISTORY_MESSAGES;

  const LaunchRequestHandler: RequestHandler = {
    canHandle(handlerInput) {
      return Alexa.getRequestType(handlerInput.requestEnvelope) === 'LaunchRequest';
    },
    handle(handlerInput) {
      const speech =
        'Welcome to AI chat. Ask me a question by saying, ask, followed by what you want to know.';
      return handlerInput.responseBuilder.speak(speech).reprompt('What would you like to ask?').getResponse();
    }
  };

  const ChatIntentHandler: RequestHandler = {
    canHandle(handlerInput) {
      return isIntent(handlerInput, 'ChatIntent');
    },
    async handle(handlerInput) {
      const query = getQuery(handlerInput);
      if (!query) {
        const speech = 'I did not catch the question. Try saying, ask why the sky is blue.';
        return handlerInput.responseBuilder.speak(speech).reprompt('What would you like to ask?').getResponse();
      }

      const sessionAttributes = getSessionAttributes(handlerInput);
      const historyWithQuestion = appendMessage(
        sessionAttributes.history ?? [],
        { role: 'user', content: query },
        maxHistoryMessages
      );

      try {
        const answer = await provider.reply(historyWithQuestion);
        sessionAttributes.history = appendMessage(
          historyWithQuestion,
          { role: 'assistant', content: answer },
          maxHistoryMessages
        );
        handlerInput.attributesManager.setSessionAttributes(sessionAttributes);

        return handlerInput.responseBuilder.speak(answer).reprompt('What else would you like to ask?').getResponse();
      } catch (error) {
        const speech =
          error instanceof MissingProviderKeyError
            ? `The ${error.provider} API key is not configured yet. Add ${error.envVar} to the environment, restart the server, and try again.`
            : 'Sorry, I could not get an AI response right now. Please try again in a moment.';

        if (!(error instanceof MissingProviderKeyError)) {
          console.error('ChatIntent failed', error);
        }
        return handlerInput.responseBuilder.speak(speech).reprompt('You can ask another question.').getResponse();
      }
    }
  };

  const HelpIntentHandler: RequestHandler = {
    canHandle(handlerInput) {
      return isIntent(handlerInput, 'AMAZON.HelpIntent');
    },
    handle(handlerInput) {
      const speech = 'Ask me a question by saying, ask, then your question. For example, ask what causes thunder.';
      return handlerInput.responseBuilder.speak(speech).reprompt('What would you like to ask?').getResponse();
    }
  };

  const FallbackIntentHandler: RequestHandler = {
    canHandle(handlerInput) {
      return isIntent(handlerInput, 'AMAZON.FallbackIntent');
    },
    handle(handlerInput) {
      const speech = 'I can chat about almost anything. Try saying, ask why the sky is blue.';
      return handlerInput.responseBuilder.speak(speech).reprompt('What would you like to ask?').getResponse();
    }
  };

  const CancelAndStopIntentHandler: RequestHandler = {
    canHandle(handlerInput) {
      return isIntent(handlerInput, 'AMAZON.CancelIntent') || isIntent(handlerInput, 'AMAZON.StopIntent');
    },
    handle(handlerInput) {
      return handlerInput.responseBuilder.speak('Goodbye.').withShouldEndSession(true).getResponse();
    }
  };

  const SessionEndedRequestHandler: RequestHandler = {
    canHandle(handlerInput) {
      return Alexa.getRequestType(handlerInput.requestEnvelope) === 'SessionEndedRequest';
    },
    handle(handlerInput) {
      return handlerInput.responseBuilder.getResponse();
    }
  };

  const GenericErrorHandler: ErrorHandler = {
    canHandle() {
      return true;
    },
    handle(handlerInput, error) {
      console.error('Unhandled skill error', error);
      return handlerInput.responseBuilder
        .speak('Sorry, something went wrong. Please try again.')
        .reprompt('Please ask another question.')
        .getResponse();
    }
  };

  return Alexa.SkillBuilders.custom()
    .addRequestHandlers(
      LaunchRequestHandler,
      ChatIntentHandler,
      HelpIntentHandler,
      FallbackIntentHandler,
      CancelAndStopIntentHandler,
      SessionEndedRequestHandler
    )
    .addErrorHandlers(GenericErrorHandler)
    .create();
}

function isIntent(handlerInput: HandlerInput, intentName: string): boolean {
  return (
    Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest' &&
    Alexa.getIntentName(handlerInput.requestEnvelope) === intentName
  );
}

function getQuery(handlerInput: HandlerInput): string | undefined {
  const request = handlerInput.requestEnvelope.request as IntentRequest;
  return request.intent.slots?.Query?.value?.trim();
}

function getSessionAttributes(handlerInput: HandlerInput): SessionAttributes {
  return handlerInput.attributesManager.getSessionAttributes() as SessionAttributes;
}

export function getOutputSpeechText(response: Response): string | undefined {
  const speech = response.outputSpeech;
  if (!speech) {
    return undefined;
  }

  if (speech.type === 'SSML') {
    return speech.ssml;
  }

  return speech.text;
}
