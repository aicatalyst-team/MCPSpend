// Pricing per million tokens (USD) — updated May 2026
const MODEL_PRICING: Record<string, { input: number; output: number }> = {
  'claude-opus-4-7':      { input: 15.00, output: 75.00 },
  'claude-opus-4-6':      { input: 15.00, output: 75.00 },
  'claude-sonnet-4-6':    { input: 3.00,  output: 15.00 },
  'claude-haiku-4-5':     { input: 0.80,  output: 4.00  },
  'gpt-4o':               { input: 2.50,  output: 10.00 },
  'gpt-4o-mini':          { input: 0.15,  output: 0.60  },
  'gpt-4-turbo':          { input: 10.00, output: 30.00 },
  'gemini-1.5-pro':       { input: 1.25,  output: 5.00  },
  'gemini-2.0-flash':     { input: 0.075, output: 0.30  },
}

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
