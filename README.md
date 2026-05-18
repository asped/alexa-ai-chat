# Alexa ChatGPT Skill Prototype

Temporary local Alexa Custom Skill that forwards open-ended questions to OpenAI and keeps short session-only memory.

## What You Need

- Amazon Developer account: https://developer.amazon.com/alexa/console/ask
- OpenAI API key
- `pnpm`
- HTTPS tunnel such as ngrok or Cloudflare Tunnel
- Optional physical test device signed into the same Amazon account as the Alexa Developer Console

## Local Setup

```sh
pnpm install
cp .env.example .env
```

Edit `.env`:

```sh
AI_PROVIDER=openai
OPENAI_API_KEY=your_key_here
OPENAI_MODEL=gpt-5.4-mini
PORT=3000
HOST=127.0.0.1
```

## Provider Switcher

Choose the active AI provider with `AI_PROVIDER`:

```sh
AI_PROVIDER=openai
AI_PROVIDER=claude
AI_PROVIDER=gemini
AI_PROVIDER=perplexity
```

Set the matching API key and optional model:

```sh
OPENAI_API_KEY=...
OPENAI_MODEL=gpt-5.4-mini

ANTHROPIC_API_KEY=...
CLAUDE_MODEL=claude-sonnet-4-6
CLAUDE_WEB_SEARCH=true
CLAUDE_WEB_SEARCH_MAX_USES=3

GEMINI_API_KEY=...
GEMINI_MODEL=gemini-2.5-flash

PERPLEXITY_API_KEY=...
PERPLEXITY_MODEL=sonar
```

The `/health` endpoint shows the selected provider, selected model, and whether the matching API key is configured.

Claude web search is opt-in. When `AI_PROVIDER=claude` and `CLAUDE_WEB_SEARCH=true`, requests include Anthropic's server-side web search tool with `max_uses` from `CLAUDE_WEB_SEARCH_MAX_USES`. Your Anthropic organization must have web search enabled in the Claude Console, and Anthropic bills web search requests separately from token usage.

Start the local server:

```sh
pnpm dev
```

On macOS, `pnpm dev` exports certificates from your system keychains before starting Node. This lets Node trust company-managed HTTPS inspection certificates without disabling TLS validation. If you ever need the raw startup path, use `pnpm dev:plain`.

Run the local server in the background:

```sh
pnpm dev:bg
```

Check or stop the background server:

```sh
pnpm status
pnpm stop
```

Check health:

```sh
curl http://localhost:3000/health
```

Send a local unsigned Alexa-style test request:

```sh
curl -sS -X POST http://127.0.0.1:3001/dev/alexa \
  -H 'Content-Type: application/json' \
  -d '{"version":"1.0","session":{"new":true,"sessionId":"curl-session","application":{"applicationId":"amzn1.ask.skill.test"},"user":{"userId":"curl-user"}},"context":{"System":{"application":{"applicationId":"amzn1.ask.skill.test"},"user":{"userId":"curl-user"},"device":{"deviceId":"curl-device","supportedInterfaces":{}},"apiEndpoint":"https://api.amazonalexa.com"}},"request":{"type":"LaunchRequest","requestId":"curl-request","timestamp":"2026-05-18T13:00:00Z","locale":"en-US"}}'
```

Use `/dev/alexa` only for local curl tests. The real Alexa endpoint is `/alexa` and requires Amazon-signed `POST` requests.

## Expose The Alexa Endpoint

Alexa needs a public HTTPS URL. Use one tunnel and keep it running while testing.

Example with ngrok:

```sh
ngrok http 3000
```

Your Alexa endpoint will be:

```txt
https://YOUR-TUNNEL-DOMAIN/alexa
```

## Create The Alexa Skill

1. Open the Alexa Developer Console.
2. Create a new skill.
3. Choose **Custom** model.
4. Choose **Provision your own** backend resources.
5. Use invocation name: `ai chat`.
6. Open **Interaction Model > JSON Editor**.
7. Paste the contents of `skill-package/interactionModels/custom/en-US.json`.
8. Save and build the model.
9. Open **Endpoint**.
10. Select **HTTPS**.
11. Paste your tunnel endpoint URL ending in `/alexa`.
12. For SSL, choose the trusted certificate option for ngrok or Cloudflare Tunnel.
13. Save endpoint settings.

## Simulator Test

In the Alexa Developer Console test tab, enable testing and try:

```txt
open ai chat
ask ai chat what is the tallest mountain
ask why is the sky blue
stop
```

The local server and tunnel must both be running.

## Physical Device Test

Use an Echo device or the Alexa mobile app signed into the same Amazon account used in the Developer Console.

1. Keep `pnpm dev` running.
2. Keep the HTTPS tunnel running.
3. Make sure the skill is enabled for testing in the Developer Console.
4. Say: `Alexa, open ai chat`.
5. Say: `ask what is the tallest mountain`.
6. Ask a follow-up in the same session, such as: `ask how high is it`.
7. Say: `stop`.

If Alexa says the skill cannot be reached, check that the tunnel URL in the Endpoint page is current and ends with `/alexa`.

## Development Checks

```sh
pnpm typecheck
pnpm test
```

## Notes

- Memory is session-only. Closing the Alexa session clears the chat history.
- Responses are intentionally short for voice.
- This project is for temporary development/testing and is not store-submission hardened.
