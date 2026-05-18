# Manual Test Checklist

## Server

- `pnpm dev` starts without errors.
- `GET /health` returns `ok: true`.
- `openAiConfigured` is `true` after `.env` is configured.

## Alexa Simulator

- `open clever chatbot` returns the welcome prompt.
- `ask clever chatbot what is the tallest mountain` returns an AI answer.
- A follow-up question in the same session uses recent context.
- `help` explains the phrasing.
- `stop` ends the session.

## Physical Device

- Device or Alexa app is signed into the same Amazon account as the Developer Console.
- Skill testing is enabled in the Developer Console.
- Local server and HTTPS tunnel are both running.
- `Alexa, open clever chatbot` launches the skill.
- `ask what is the tallest mountain` gets an answer.
- `ask how high is it` works as a context-aware follow-up.
- `stop` ends cleanly.

## Failure Paths

- Missing `OPENAI_API_KEY` produces a spoken setup error.
- Stopping the tunnel produces a reachable-endpoint error in Alexa.
- Stopping the local server produces a local connection failure through the tunnel.
