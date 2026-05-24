// Pricing per million tokens (USD) — updated May 2026.
//
// Format: cost = (inputTokens / 1_000_000) * input + (outputTokens / 1_000_000) * output.
// Numbers reflect provider public list pricing at the time of update; volume
// discounts, batch APIs, and enterprise contracts aren't modeled (we'd need
// the customer's invoice for that, out of scope for an estimator).
//
// Lookup is exact on the model string. When a model isn't in this table we
// fall back to DEFAULT_PRICING (Claude Sonnet 4.6 baseline — middle of the
// road, slightly pessimistic for cheap models, conservative for expensive ones).
const MODEL_PRICING: Record<string, { input: number; output: number }> = {
  // Anthropic Claude (claude.com/pricing)
  'claude-opus-4-7':      { input: 15.00, output: 75.00 },
  'claude-opus-4-6':      { input: 15.00, output: 75.00 },
  'claude-opus-4':        { input: 15.00, output: 75.00 },
  'claude-sonnet-4-6':    { input: 3.00,  output: 15.00 },
  'claude-sonnet-4-5':    { input: 3.00,  output: 15.00 },
  'claude-sonnet-4':      { input: 3.00,  output: 15.00 },
  'claude-3-5-sonnet':    { input: 3.00,  output: 15.00 },
  'claude-haiku-4-5':     { input: 0.80,  output: 4.00  },
  'claude-haiku-4':       { input: 0.80,  output: 4.00  },
  'claude-3-5-haiku':     { input: 0.80,  output: 4.00  },
  // OpenAI (openai.com/pricing)
  'gpt-4o':               { input: 2.50,  output: 10.00 },
  'gpt-4o-mini':          { input: 0.15,  output: 0.60  },
  'gpt-4-turbo':          { input: 10.00, output: 30.00 },
  'gpt-4':                { input: 30.00, output: 60.00 },
  'gpt-3.5-turbo':        { input: 0.50,  output: 1.50  },
  'o1':                   { input: 15.00, output: 60.00 },
  'o1-mini':              { input: 1.10,  output: 4.40  },
  'o3':                   { input: 15.00, output: 60.00 },
  'o3-mini':              { input: 1.10,  output: 4.40  },
  // Google Gemini (ai.google.dev/pricing)
  'gemini-2.0-pro':       { input: 1.25,  output: 5.00  },
  'gemini-1.5-pro':       { input: 1.25,  output: 5.00  },
  'gemini-2.0-flash':     { input: 0.075, output: 0.30  },
  'gemini-1.5-flash':     { input: 0.075, output: 0.30  },
  // xAI Grok (x.ai/pricing)
  'grok-2':               { input: 2.00,  output: 10.00 },
  'grok-2-mini':          { input: 0.20,  output: 1.00  },
  // DeepSeek (platform.deepseek.com/api-docs/pricing)
  'deepseek-chat':        { input: 0.27,  output: 1.10  },
  'deepseek-reasoner':    { input: 0.55,  output: 2.19  },
  // Mistral (mistral.ai/pricing)
  'mistral-large':        { input: 2.00,  output: 6.00  },
  'mistral-small':        { input: 0.20,  output: 0.60  },
  // Meta Llama (per-token pricing varies by provider — Groq/Together baseline)
  'llama-3.3-70b':        { input: 0.59,  output: 0.79  },
  'llama-3.1-405b':       { input: 5.00,  output: 16.00 },
  'llama-3.1-70b':        { input: 0.59,  output: 0.79  },
  'llama-3.1-8b':         { input: 0.05,  output: 0.08  },
  // Inferred from popular synonyms
  'sonnet':               { input: 3.00,  output: 15.00 },
  'opus':                 { input: 15.00, output: 75.00 },
  'haiku':                { input: 0.80,  output: 4.00  },
  // MCP-stdio passthrough — proxy can't see the model, treat as Sonnet baseline
  'mcp-stdio':            { input: 3.00,  output: 15.00 },
  'mcp-http':             { input: 3.00,  output: 15.00 },
}

// Falls back to Claude Sonnet pricing if model isn't in the table — middle-
// of-road USD/token, slightly pessimistic for cheap models like Haiku/Flash
// and slightly conservative for premium models like Opus/o1.
const DEFAULT_PRICING = { input: 3.00, output: 15.00 }

export function calculateCost(model: string, inputTokens: number, outputTokens: number): number {
  const pricing = MODEL_PRICING[model] ?? DEFAULT_PRICING
  const inputCost = (inputTokens / 1_000_000) * pricing.input
  const outputCost = (outputTokens / 1_000_000) * pricing.output
  return Math.round((inputCost + outputCost) * 1_000_000) / 1_000_000
}

export function getModelPricing(model: string) {
  return MODEL_PRICING[model] ?? DEFAULT_PRICING
}

/** Public snapshot of every modelled price — surfaced via /api/public/pricing-models
 *  so customers can audit our cost math against their actual provider invoices. */
export function getAllModelPricing(): Array<{ model: string; inputPer1M: number; outputPer1M: number }> {
  return Object.entries(MODEL_PRICING)
    .map(([model, p]) => ({ model, inputPer1M: p.input, outputPer1M: p.output }))
    .sort((a, b) => a.model.localeCompare(b.model))
}
