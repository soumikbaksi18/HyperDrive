export type NewsSentiment = 'up' | 'down' | 'neutral';

const POSITIVE = new Set([
  'gain',
  'gains',
  'gained',
  'rise',
  'rises',
  'rose',
  'rally',
  'surge',
  'soar',
  'beat',
  'beats',
  'record',
  'growth',
  'upgrade',
  'upgraded',
  'bullish',
  'strong',
  'profit',
  'profits',
  'outperform',
]);

const NEGATIVE = new Set([
  'fall',
  'falls',
  'fell',
  'drop',
  'drops',
  'dropped',
  'decline',
  'declines',
  'declined',
  'crash',
  'plunge',
  'slump',
  'miss',
  'misses',
  'cut',
  'cuts',
  'downgrade',
  'downgraded',
  'bearish',
  'weak',
  'loss',
  'losses',
  'lawsuit',
  'probe',
  'ban',
]);

export const MONAD_TOPIC_TERMS = [
  'monad',
  'monad labs',
  'monad chain',
  'monad mainnet',
  'tokenized stock',
  'tokenized equity',
  'tokenized share',
  'xstock',
  'on-chain equity',
  'blockchain stock',
];

const CATEGORY_KEYWORDS: Record<string, string[]> = {
  Monad: MONAD_TOPIC_TERMS,
  Earnings: ['earnings', 'eps', 'revenue', 'guidance', 'quarter', 'q1', 'q2', 'q3', 'q4', 'profit', 'results'],
  Regulation: [
    'sec',
    'regulation',
    'regulatory',
    'lawsuit',
    'court',
    'compliance',
    'antitrust',
    'fine',
    'investigation',
    'fed',
    'policy',
  ],
  Technology: [
    'ai',
    'chip',
    'semiconductor',
    'cloud',
    'software',
    'product',
    'launch',
    'innovation',
    'platform',
    'data center',
  ],
  Macro: ['inflation', 'jobs', 'gdp', 'rates', 'yield', 'treasury', 'recession', 'tariff', 'trade war', 'cpi'],
};

const HIGH_IMPACT_WORDS = new Set([
  'crash',
  'surge',
  'record',
  'billion',
  'lawsuit',
  'sec',
  'earnings',
  'guidance',
  'downgrade',
  'upgrade',
  'halt',
  'bankruptcy',
]);

const CREDIBLE_SOURCES = ['bloomberg', 'reuters', 'cnbc', 'wsj', 'financial times', 'marketwatch', 'nasdaq', 'forbes'];

function tokenize(text: string) {
  return text.toLowerCase().match(/[a-z']+/g) ?? [];
}

export function classifyCategory(text: string): string {
  const t = text.toLowerCase();
  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    if (keywords.some((kw) => t.includes(kw))) return category;
  }
  return 'Markets';
}

export function getSentiment(headline: string, summary = ''): NewsSentiment {
  const tokens = tokenize(`${headline} ${summary}`);
  let score = 0;
  for (const token of tokens) {
    if (POSITIVE.has(token)) score += 1;
    if (NEGATIVE.has(token)) score -= 1;
  }
  if (score >= 2) return 'up';
  if (score <= -2) return 'down';
  return 'neutral';
}

export function analyzeText(text: string) {
  const tokens = tokenize(text);
  let pos = 0;
  let neg = 0;
  for (const token of tokens) {
    if (POSITIVE.has(token)) pos += 1;
    if (NEGATIVE.has(token)) neg += 1;
  }
  const compound = pos - neg;
  let sentiment: NewsSentiment = 'neutral';
  if (compound >= 2) sentiment = 'up';
  else if (compound <= -2) sentiment = 'down';
  return {
    sentiment,
    scores: { positive: pos, negative: neg, compound },
  };
}

export function calculateImpact(title: string, summary: string, source: string): number {
  const text = `${title} ${summary}`.toLowerCase();
  const sentiment = getSentiment(title, summary);
  let base = sentiment === 'neutral' ? 5 : 6;
  if (sentiment === 'up' || sentiment === 'down') base += 0.5;
  for (const word of HIGH_IMPACT_WORDS) {
    if (text.includes(word)) base += 0.6;
  }
  const sourceLower = source.toLowerCase();
  if (CREDIBLE_SOURCES.some((name) => sourceLower.includes(name))) base += 0.4;
  return Math.round(Math.min(10, Math.max(1, base)) * 10) / 10;
}
