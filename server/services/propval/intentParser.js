import { INTENTS, INTENT_RULES } from './intentDefinitions.js';
import { parseEntities } from './entityParser.js';

const scoreMessage = (message) => {
  let best = null;

  for (const rule of INTENT_RULES) {
    const matches = rule.patterns.filter((pattern) => pattern.test(message));
    if (matches.length === 0) {
      continue;
    }

    const score = rule.priority * 100 + matches.length;
    if (!best || score > best.score) {
      best = { intent: rule.intent, score, matchedPatterns: matches.length };
    }
  }

  return best;
};

/**
 * Resolves the single best intent for a normalized message. Messages that match
 * no rule become UNKNOWN, which PropVal answers with its capability summary
 * instead of guessing.
 */
export const detectIntent = (message) => {
  const scored = scoreMessage(message);
  if (!scored) {
    return { intent: INTENTS.UNKNOWN, matchedPatterns: 0 };
  }
  return { intent: scored.intent, matchedPatterns: scored.matchedPatterns };
};

/**
 * Stage one of the pipeline: message in, intent plus entities out.
 */
export const parseMessage = (rawMessage) => {
  const { message, entities, amenityKeywords } = parseEntities(rawMessage);
  const { intent, matchedPatterns } = detectIntent(message);

  return {
    normalized: message,
    intent,
    matchedPatterns,
    entities,
    amenityKeywords,
  };
};
