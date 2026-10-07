import { AMENITY_VOCABULARY, SEARCH_STOP_WORDS } from './intentDefinitions.js';

const NUMBER_WORDS = {
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  eleven: 11,
  twelve: 12,
  couple: 2,
  pair: 2,
};

const UNIT_MULTIPLIERS = [
  { pattern: /^(crores?|cr)$/i, multiplier: 10000000 },
  { pattern: /^(lakhs?|lacs?|lac)$/i, multiplier: 100000 },
];

const UPPER_COMPARATOR = /\b(under|below|less than|lower than|up to|within|cheaper than|maximum|max|not more than)\b/;
const LOWER_COMPARATOR = /\b(above|over|more than|at least|minimum|min|starting from|starting at|not less than)\b/;

const BEDROOM_PATTERN = new RegExp(
  `\\b(\\d+|${Object.keys(NUMBER_WORDS).join('|')})\\s*-?\\s*(bhk|bed|beds|bedroom|bedrooms)\\b`,
  'i',
);
const BATHROOM_PATTERN = new RegExp(
  `\\b(\\d+|${Object.keys(NUMBER_WORDS).join('|')})\\s*-?\\s*(bath|baths|bathroom|bathrooms)\\b`,
  'i',
);

const PRICE_UNIT = '(?:crores?|cr|lakhs?|lacs?|lac)';
const BETWEEN_PATTERN = new RegExp(
  `\\bbetween\\s+(\\d+(?:\\.\\d+)?)\\s*(${PRICE_UNIT})?\\s*(?:-|–|to)?\\s*(?:and|-|to)\\s+(\\d+(?:\\.\\d+)?)\\s*(${PRICE_UNIT})?`,
  'i',
);
const LEADING_AMOUNT = new RegExp(`^(?<value>\\d+(?:\\.\\d+)?)\\s*(?<unit>${PRICE_UNIT})`, 'i');
const LEADING_PLAIN_AMOUNT = /^(?<value>\d{6,})\b/;
const BARE_AMOUNT = new RegExp(`(?:^|\\s)(?<value>\\d+(?:\\.\\d+)?)\\s*(?<unit>${PRICE_UNIT})`, 'i');
const COMPARATOR_PATTERN = new RegExp(`${UPPER_COMPARATOR.source}|${LOWER_COMPARATOR.source}`, 'gi');

const AREA_PATTERN = /(\d+(?:\.\d+)?)\s*(sq\.?\s?ft|sqft|square\s+(?:feet|foot)|sq\s?yards?)/gi;

const PROPERTY_TYPE_PATTERNS = [
  { pattern: /\b(flat|flats|apartment|apartments)\b/i, value: 'apartment' },
  { pattern: /\b(villa|villas)\b/i, value: 'villa' },
  { pattern: /\b(house|houses|home|homes)\b/i, value: 'house' },
  { pattern: /\b(plot|plots|land)\b/i, value: 'plot' },
];

const GEO_PREPOSITION = /\b(?:in|near|around|within|at)\s+/gi;
const STOP_WORDS = new Set(SEARCH_STOP_WORDS);
const PLACE_ALLOWED = /^[a-z][a-z0-9 .'-]*$/i;

const PROPERTY_ID_PATTERN = /\b([0-9a-f]{24})\b/i;

const escapeRegExp = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export const normalizeMessage = (message) =>
  String(message)
    .toLowerCase()
    .replace(/['\u2019`]/g, "'")
    .replace(/\s+/g, ' ')
    .trim();

const readCount = (raw) => {
  const token = raw.toLowerCase();
  if (/^\d+$/.test(token)) {
    return Number(token);
  }
  return NUMBER_WORDS[token] ?? null;
};

const unitMultiplier = (unit) => {
  if (!unit) {
    return null;
  }
  return UNIT_MULTIPLIERS.find((entry) => entry.pattern.test(unit.trim()))?.multiplier ?? null;
};

const readAmount = (text) => {
  const withUnit = LEADING_AMOUNT.exec(text);
  if (withUnit) {
    const multiplier = unitMultiplier(withUnit.groups.unit);
    if (multiplier) {
      return { value: Number(withUnit.groups.value) * multiplier, length: withUnit[0].length };
    }
  }

  const plain = LEADING_PLAIN_AMOUNT.exec(text);
  if (plain) {
    return { value: Number(plain.groups.value), length: plain[0].length };
  }

  return null;
};

const extractPrices = (message, entities) => {
  const between = BETWEEN_PATTERN.exec(message);
  if (between) {
    // "between 50 and 80 lakhs" states the unit once, at either end.
    const highMultiplier = unitMultiplier(between[4]);
    const lowMultiplier = unitMultiplier(between[2]) ?? highMultiplier;
    if (lowMultiplier && highMultiplier) {
      entities.minPrice = Number(between[1]) * lowMultiplier;
      entities.maxPrice = Number(between[3]) * highMultiplier;
      return;
    }
  }

  let matchedRange = false;
  COMPARATOR_PATTERN.lastIndex = 0;
  let comparator = COMPARATOR_PATTERN.exec(message);

  while (comparator) {
    const token = comparator[0].toLowerCase().trim();
    const amount = readAmount(message.slice(comparator.index + comparator[0].length).trimStart());

    if (amount) {
      matchedRange = true;
      if (UPPER_COMPARATOR.test(` ${token} `)) {
        entities.maxPrice = amount.value;
      } else if (LOWER_COMPARATOR.test(` ${token} `)) {
        entities.minPrice = amount.value;
      }
    }

    comparator = COMPARATOR_PATTERN.exec(message);
  }

  if (!matchedRange) {
    const bare = BARE_AMOUNT.exec(message);
    if (bare) {
      const multiplier = unitMultiplier(bare.groups.unit);
      if (multiplier) {
        const value = Number(bare.groups.value) * multiplier;
        entities.minPrice = value;
        entities.maxPrice = value;
      }
    }
  }
};

const extractArea = (message, entities) => {
  AREA_PATTERN.lastIndex = 0;
  let match = AREA_PATTERN.exec(message);

  while (match) {
    const value = Number(match[1]);
    const prefix = message.slice(0, match.index);
    const comparator = [...prefix.matchAll(new RegExp(`${UPPER_COMPARATOR.source}|${LOWER_COMPARATOR.source}`, 'gi'))]
      .at(-1);

    if (!comparator) {
      if (entities.minArea === undefined) {
        entities.minArea = value;
        entities.maxArea = value;
      }
    } else if (UPPER_COMPARATOR.test(` ${comparator[0].toLowerCase().trim()} `)) {
      entities.maxArea = value;
    } else if (LOWER_COMPARATOR.test(` ${comparator[0].toLowerCase().trim()} `)) {
      entities.minArea = value;
    }

    match = AREA_PATTERN.exec(message);
  }
};

const extractCount = (message, pattern, key, entities) => {
  const match = pattern.exec(message);
  if (!match) {
    return;
  }
  const value = readCount(match[1]);
  if (value !== null) {
    entities[key] = value;
  }
};

/**
 * Reads a place reference from the message the user actually typed, so an
 * unknown name is echoed back exactly as written rather than normalised away.
 * Stop words are compared case-insensitively.
 */
const extractPlace = (source) => {
  GEO_PREPOSITION.lastIndex = 0;
  let match = GEO_PREPOSITION.exec(source);

  while (match) {
    const words = [];

    for (const rawWord of source.slice(match.index + match[0].length).split(/\s+/)) {
      const word = rawWord
        .replace(/^[^a-z]*/i, '')
        .replace(/[.,'?!:()[\]"-]+$/, '')
        .trim();

      if (!word) {
        continue;
      }
      if (STOP_WORDS.has(word.toLowerCase())) {
        break;
      }
      words.push(word);
    }

    const candidate = words.join(' ').trim();
    if (candidate.length >= 2 && candidate.length <= 60 && PLACE_ALLOWED.test(candidate)) {
      return candidate;
    }

    match = GEO_PREPOSITION.exec(source);
  }

  return null;
};

const extractAmenities = (message) => {
  const labels = [];
  const keywords = [];

  for (const amenity of AMENITY_VOCABULARY) {
    const matched = amenity.patterns.find((pattern) =>
      new RegExp(`\\b${escapeRegExp(pattern)}\\b`, 'i').test(message),
    );
    if (matched) {
      labels.push(amenity.label);
      keywords.push(matched);
    }
  }

  return { labels, keywords };
};

/**
 * Turns a message into the entities PropVal understands.
 *
 * Only keys that were actually found are returned, so an empty search is a
 * genuinely unfiltered search instead of a search for empty strings.
 */
export const parseEntities = (rawMessage) => {
  const message = normalizeMessage(rawMessage);
  const entities = {};

  for (const { pattern, value } of PROPERTY_TYPE_PATTERNS) {
    if (pattern.test(message)) {
      entities.propertyType = value;
      break;
    }
  }

  extractCount(message, BEDROOM_PATTERN, 'bedrooms', entities);
  extractCount(message, BATHROOM_PATTERN, 'bathrooms', entities);
  extractPrices(message, entities);
  extractArea(message, entities);

  const place = extractPlace(String(rawMessage));
  if (place) {
    entities.place = place;
  }

  const amenities = extractAmenities(message);
  if (amenities.labels.length > 0) {
    entities.amenities = amenities.labels;
  }

  const propertyId = PROPERTY_ID_PATTERN.exec(message);
  if (propertyId) {
    entities.propertyId = propertyId[1].toLowerCase();
  }

  return { message, entities, amenityKeywords: amenities.keywords };
};
