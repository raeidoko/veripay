import type { AIProvider } from './aiLayer.ts';

export function createAnthropicProvider(apiKey: string, model: string, request: typeof fetch = fetch): AIProvider {
  return {
    modelVersion: model,
    async generate({ task, system, input, signal }) {
      const response = await request('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2026-10-21' },
        body: JSON.stringify({ model, max_tokens: 2048, system, messages: [{ role: 'user', content: JSON.stringify({ task, facts: input }) }] }),
        signal,
        redirect: 'error',
      });
      if (!response.ok) throw new Error(`Anthropic request failed (${response.status})`);
      const data = await response.json() as { model?: string; stop_reason?: string; content?: { type: string; text?: string }[] };
      const text = data.content?.filter(block => block.type === 'text').map(block => block.text).join('');
      if (data.stop_reason !== 'end_turn' || !data.model?.startsWith('claude-') || !text?.trim()) {
        throw new Error('Anthropic returned an incomplete or empty reply');
      }
      return { text, modelVersion: data.model };
    },
  };
}
