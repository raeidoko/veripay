import type { AIProvider } from './aiLayer.ts';

export const DOTS3_MODEL = 'dots-studio/dots-3-note-preview:free';
export const OPENROUTER_CHAT_URL = 'https://openrouter.ai/api/v1/chat/completions';

/** Prepare the API contract without transmitting any data. */
export function prepareDots3Request(
  { task, system, input }: Pick<Parameters<AIProvider['generate']>[0], 'task' | 'system' | 'input'>,
  model = DOTS3_MODEL,
) {
  return {
    model,
    stream: false,
    max_tokens: 2048,
    temperature: 0.1,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: JSON.stringify({ task, facts: input }) },
    ],
  };
}

/** Validate the provider envelope before existing task-specific validation. */
export function readDots3Response(data: unknown): string {
  const record = data as { error?: unknown; choices?: { finish_reason?: string; message?: { refusal?: unknown; content?: unknown } }[] } | null;
  const choice = record?.choices?.[0];
  if (record?.error || choice?.finish_reason !== 'stop' || choice?.message?.refusal ||
      typeof choice?.message?.content !== 'string' || !choice.message.content.trim()) {
    throw new Error('OpenRouter returned an incomplete or empty reply');
  }
  return choice.message.content;
}

/** Credentials stay on the server; shared AI-layer validation and timeouts apply. */
export function createOpenRouterProvider(
  config: { apiKey: string; model?: string },
  request: typeof fetch = fetch,
): AIProvider {
  const apiKey = config.apiKey.trim();
  if (!apiKey) throw new Error('OPENROUTER_API_KEY is required');
  const model = config.model?.trim() || DOTS3_MODEL;
  return {
    modelVersion: `openrouter:${model}`,
    async generate(input) {
      const response = await request(OPENROUTER_CHAT_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify(prepareDots3Request(input, model)),
        signal: input.signal,
        redirect: 'error',
      });
      // Never include upstream bodies or credentials in errors/logs.
      if (!response.ok) throw new Error(`OpenRouter request failed (${response.status})`);
      return readDots3Response(await response.json());
    },
  };
}

export function configuredAIProvider(env: NodeJS.ProcessEnv = process.env): AIProvider | undefined {
  if ((env.AI_PROVIDER?.trim().toLowerCase() || 'openrouter') !== 'openrouter' || !env.OPENROUTER_API_KEY?.trim()) return undefined;
  return createOpenRouterProvider({ apiKey: env.OPENROUTER_API_KEY, model: env.OPENROUTER_MODEL });
}
