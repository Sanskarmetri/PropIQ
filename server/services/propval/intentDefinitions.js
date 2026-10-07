import { AMENITY_ADJUSTMENTS } from '../../config/valuationConfig.js';

/**
 * PropVal runs entirely on these deterministic rules. No external model, prompt
 * or generated text is involved, so the same message always produces the same
 * intent and the same entities.
 *
 * `priority` decides which intent wins when several rule sets match the same
 * message: the most specific interpretation always beats the generic one.
 */
export const INTENTS = {
  GREETING: 'GREETING',
  HELP: 'HELP',
  PROPERTY_SEARCH: 'PROPERTY_SEARCH',
  PROPERTY_DETAILS: 'PROPERTY_DETAILS',
  VALUATION: 'VALUATION',
  PRICE_ANALYSIS: 'PRICE_ANALYSIS',
  FRAUD_EXPLANATION: 'FRAUD_EXPLANATION',
  SIMILAR_PROPERTIES: 'SIMILAR_PROPERTIES',
  MARKET_ANALYTICS: 'MARKET_ANALYTICS',
  UNKNOWN: 'UNKNOWN',
};

const LOCALITY_WORD = '[a-z][a-z0-9 .\'-]{1,60}?';

/**
 * A "how many" question that also carries a search constraint ("how many 3BHKs
 * under 1 crore") is a search with a count, not an analytics question, so the
 * aggregate rules below refuse to claim it. The guard is a plain regular
 * expression: nothing is ever evaluated.
 */
const NOT_A_SEARCH = '(?![^.?!]*\\b(under|below|above|over|between|with|having|budget|crores?|cr|lakhs?|lacs?|lac|bhk|beds?|bedrooms?)\\b)';

const SEARCH_STOP_WORDS = [
  'under',
  'below',
  'above',
  'over',
  'with',
  'near',
  'around',
  'between',
  'starting',
  'from',
  'at',
  'in',
  'and',
  'or',
  'of',
  'for',
  'to',
  'that',
  'which',
  'having',
  'include',
  'including',
  'plus',
  'only',
  'budget',
  'price',
  'area',
  // The product's own name is never a place, so "in PropIQ" must not be read
  // as a locality filter.
  'propiq',
];

/**
 * Ordered rule table. `patterns` are matched against the lowercased message and
 * every pattern is a plain regular expression: nothing is ever evaluated.
 */
export const INTENT_RULES = [
  {
    intent: INTENTS.GREETING,
    priority: 100,
    patterns: [
      /^(hi|hello|hey|hiya|yo|namaste|good\s+(morning|afternoon|evening|night))(\s+(there|everyone|team|all|propval))?[.!,?]*$/,
    ],
  },
  {
    intent: INTENTS.HELP,
    priority: 90,
    patterns: [
      /\bhelp\b/,
      /\b(what|how)\s+(can|could|do|does)\s+(you|propval)\b/,
      /\bhow\s+do\s+(you|this)\s+work\b/,
      /\b(what|who)\s+are\s+you\b/,
      /\bcapabilit(y|ies)\b/,
      /\bwhat\s+should\s+i\s+ask\b/,
    ],
  },
  {
    // Aggregate questions about the whole collection rather than one listing.
    // Every pattern needs aggregate language ("how many listings", "average
    // price by city", "listing volume"), so a question about the property the
    // user is viewing can never be captured here. The priority sits above
    // screening and valuation because "how many listings are flagged?" is an
    // analytics question, not a request to explain one flag.
    intent: INTENTS.MARKET_ANALYTICS,
    priority: 88,
    patterns: [
      new RegExp(`\\bhow\\s+many\\b${NOT_A_SEARCH}[^.?!]*\\b(listings?|properties)\\b`),
      /\b(listing|market|price|portfolio)\s+(analytics|statistics|breakdown|report|overview|summary)\b/,
      /\banalytics\b/,
      /\bdashboard\b/,
      /\binventory\b/,
      /\blisting\s+volume\b/,
      /\b(most|top)\s+(listed|common)\b/,
      /\baverage\s+(asking\s+)?price\s+(by|in|across|for\s+(all|the\s+market))\b/,
      /\bmedian\s+(asking\s+)?price\b/,
      /\bprice\s+(range|distribution|spread|trend|summary)\b/,
      new RegExp(`\\bhow\\s+many\\b${NOT_A_SEARCH}[^.?!]*\\b(flagged|review|elevated|unavailable)\\b`),
      /\bwhich\s+listings\b[^.?!]*\b(flagged|review|elevated)\b/,
      /\bsummar(y|ise|ize)\b[^.?!]*\b(listings?|market|portfolio|inventory)\b/,
    ],
  },
  {
    intent: INTENTS.FRAUD_EXPLANATION,
    priority: 85,
    patterns: [
      /\bflag(ged|s)?\b/,
      /\bsuspicious\b/,
      /\bscreening\b/,
      /\bduplicate\s+(listing|match|flag)\b/,
      /\bpricing\s+(anomaly|check|review)\b/,
      /\bwhy\s+(was|is|does|do)\b[^.?!]*\bflag/,
    ],
  },
  {
    intent: INTENTS.PRICE_ANALYSIS,
    priority: 80,
    patterns: [
      /\bover[\s-]?priced\b/,
      /\bunder[\s-]?priced\b/,
      /\bfair(ly)?[\s-]?priced\b/,
      /\bfair\s+price\b/,
      /\basking\s+price\b/,
      /\bprice\s+(analysis|check|comparison|review)\b/,
      /\b(why|is|are)\b[^.?!]*\bprice\b[^.?!]*\b(high|low|high\s+or\s+low|too\s+much|too\s+high|too\s+low)\b/,
      /\bprice\b[^.?!]*\b(estimated|estimate|valuation|market\s+value)\b/,
    ],
  },
  {
    intent: INTENTS.SIMILAR_PROPERTIES,
    priority: 75,
    patterns: [
      /\bsimilar\b/,
      /\balternatives?\b/,
      /\bsomething\s+like\b/,
      /\blike\s+(this|it)\b/,
      /\bcomparable\b/,
      /\bother\s+(options?|choices?|properties)\b/,
      /\bsame\s+(area|locality|price\s+range|budget)\b/,
    ],
  },
  {
    intent: INTENTS.PROPERTY_DETAILS,
    priority: 70,
    patterns: [
      /\bdetails?\b/,
      /\btell\s+me\s+about\b/,
      /\babout\s+(this|the)\s+(property|listing|home)\b/,
      /\bmore\s+about\s+(this|the)\b/,
      /\binfo(r|rmation)?\s+(about|on)\s+(this|the)\b/,
      /\bdescribe\s+(this|the)\s+(property|listing)\b/,
    ],
  },
  {
    // A bare "what is this property" is a details request, but it must not beat
    // a more specific question such as "what is this property worth".
    intent: INTENTS.PROPERTY_DETAILS,
    priority: 55,
    patterns: [/\b(what|which)\s+is\s+(this|the)\s+(property|listing|home)\b/],
  },
  {
    intent: INTENTS.VALUATION,
    priority: 60,
    patterns: [
      /\bworth\b/,
      /\bvaluation\b/,
      /\bvalue\s+of\s+(this|the)\b/,
      /\bestimate\b/,
      /\bhow\s+much\s+(is|does|would)\b[^.?!]*\b(cost|worth)\b/,
      /\b(what|how\s+much)\s+(should|would)\b[^.?!]*\b(cost|be\s+worth|price)\b/,
      /\bmarket\s+value\b/,
      /\bvaluation\s+report\b/,
    ],
  },
  {
    intent: INTENTS.PROPERTY_SEARCH,
    priority: 50,
    patterns: [
      /\b(find|search|list|show|browse|get)\b/,
      /\b(properties|property|apartments?|flats?|villas?|houses|homes?|plots?|listings?)\b/,
      /\d+\s*-?\s*bhk\b/,
      /\b(beds?|bedrooms?)\b/,
      /\b(crores?|cr|lakhs?|lacs?|lac)\b/,
      /\b(sq\.?\s?ft|sqft|square\s+(feet|foot)|built[\s-]?up\s+area)\b/,
      /\b(under|below|less\s+than|up\s+to|within|above|over|more\s+than|at\s+least|between|around|starting\s+from)\b/,
    ],
  },
];

/**
 * The action each intent performs. Actions, not intents, are handed to the
 * service layer, which keeps parsing free of business logic.
 */
export const ACTIONS = {
  NONE: 'NONE',
  PROPERTY_SEARCH: 'PROPERTY_SEARCH',
  PROPERTY_DETAILS: 'PROPERTY_DETAILS',
  VALUATION: 'VALUATION',
  FRAUD_SCREENING: 'FRAUD_SCREENING',
  SIMILAR_PROPERTIES: 'SIMILAR_PROPERTIES',
  MARKET_ANALYTICS: 'MARKET_ANALYTICS',
};

export const INTENT_ACTIONS = {
  [INTENTS.GREETING]: ACTIONS.NONE,
  [INTENTS.HELP]: ACTIONS.NONE,
  [INTENTS.UNKNOWN]: ACTIONS.NONE,
  [INTENTS.PROPERTY_SEARCH]: ACTIONS.PROPERTY_SEARCH,
  [INTENTS.PROPERTY_DETAILS]: ACTIONS.PROPERTY_DETAILS,
  [INTENTS.VALUATION]: ACTIONS.VALUATION,
  [INTENTS.PRICE_ANALYSIS]: ACTIONS.FRAUD_SCREENING,
  [INTENTS.FRAUD_EXPLANATION]: ACTIONS.FRAUD_SCREENING,
  [INTENTS.SIMILAR_PROPERTIES]: ACTIONS.SIMILAR_PROPERTIES,
  [INTENTS.MARKET_ANALYTICS]: ACTIONS.MARKET_ANALYTICS,
};

/**
 * Intents that need a property the user is currently looking at.
 */
export const CONTEXT_REQUIRED_INTENTS = [
  INTENTS.PROPERTY_DETAILS,
  INTENTS.PRICE_ANALYSIS,
  INTENTS.FRAUD_EXPLANATION,
  INTENTS.SIMILAR_PROPERTIES,
];

/**
 * Intents that summarise the whole listing collection rather than one listing.
 * They are answered with the same analytics service the admin dashboard uses, and
 * they are refused for anyone who is not an authenticated admin.
 */
export const ADMIN_ONLY_INTENTS = [INTENTS.MARKET_ANALYTICS];

/**
 * HELPs are written from the live rule table, so the list can never drift away
 * from what PropVal actually implements.
 */
export const CAPABILITIES = [
  'Find a property by city, locality, type, bedrooms, budget, area or amenities',
  'Open a property and ask for its details',
  'Open a property and ask what it is worth',
  'Open a property and ask whether the asking price is close to the PropIQ estimate',
  'Open a property and ask why a listing screening flag was raised',
  'Open a property and ask for similar listings',
];

/**
 * Aggregate questions are only offered to admins, so a signed-in user is never
 * told they can ask for something the assistant would refuse to answer.
 */
export const ADMIN_CAPABILITIES = [
  'Summarise listing volume, average price and screening coverage across PropIQ',
  'Break analytics down by city, locality or property type',
  'Report the listings that screening has flagged for review',
];

export const SUGGESTED_PROMPTS = [
  'Find me a 3BHK in Whitefield under 1 crore',
  '2 bhk under 80 lakhs',
  'What is this property worth?',
  'Is this overpriced?',
  'Show similar properties',
];

export const ADMIN_SUGGESTED_PROMPTS = [
  'How many listings are in PropIQ?',
  'Show the analytics for Bengaluru',
  'Which listings are flagged for review?',
];

export const suggestionsForRole = (role) =>
  role === 'admin' ? [...SUGGESTED_PROMPTS, ...ADMIN_SUGGESTED_PROMPTS] : SUGGESTED_PROMPTS;

export const capabilitiesForRole = (role) =>
  role === 'admin' ? [...CAPABILITIES, ...ADMIN_CAPABILITIES] : CAPABILITIES;

/**
 * Amenity vocabulary is derived from the valuation configuration so PropVal
 * can only ever ask for amenities the application already understands.
 */
export const AMENITY_VOCABULARY = AMENITY_ADJUSTMENTS.map((amenity) => ({
  label: amenity.label,
  id: amenity.id,
  patterns: amenity.aliases,
}));

export { LOCALITY_WORD, SEARCH_STOP_WORDS };
