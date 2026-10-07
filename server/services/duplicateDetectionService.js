import mongoose from 'mongoose';
import { DUPLICATE_MATCHING } from '../config/fraudConfig.js';
import { Property, PROPERTY_STATUSES } from '../models/Property.js';

const normalizeText = (value) => (typeof value === 'string' ? value.trim().toLowerCase() : '');

const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Builds the query clause for one gate field.
 *
 * `scoreCandidate` compares gate fields with `normalizeText`, so an exact
 * case-sensitive equality match in Mongo would drop candidates that the scorer
 * considers identical. Matching the normalised value with an anchored,
 * case-insensitive pattern keeps the query and the scoring in agreement:
 * `Whitefield`, `whitefield`, and `WHITEFOLD` all resolve to the same candidate
 * set, while a longer name such as `Whitefield Extension` still does not match.
 * Surrounding whitespace is tolerated because `normalizeText` trims it.
 *
 * A value that cannot be normalised is passed through unchanged, so a missing
 * field keeps its current behaviour instead of widening the candidate set.
 */
const textGateClause = (value) => {
  const normalized = normalizeText(value);
  return normalized ? new RegExp(`^\\s*${escapeRegExp(normalized)}\\s*$`, 'i') : value;
};

const isUsableNumber = (value) => typeof value === 'number' && Number.isFinite(value) && value >= 0;

/**
 * Relative difference between two non-negative numbers, using the larger value
 * as the denominator so the result stays inside 0..1.
 */
const relativeDifference = (a, b) => {
  const larger = Math.max(a, b);
  if (larger === 0) return 0;
  return Math.abs(a - b) / larger;
};

/**
 * Scores one candidate against the subject property.
 *
 * Text fields score their full weight on a normalised match. Number fields
 * score full weight within `tolerance`, half weight within `nearTolerance`, and
 * nothing beyond that. Fields that are not usable on both sides are skipped
 * entirely, and `comparableWeight` records the weight that was actually
 * available so the caller can normalise honestly.
 */
export const scoreCandidate = (subject, candidate) => {
  const fields = DUPLICATE_MATCHING.fields;
  const gateFields = fields.filter((rule) => rule.kind === 'text');

  const gateMissed = gateFields.filter(
    (rule) => normalizeText(subject[rule.field]) !== normalizeText(candidate[rule.field]),
  );

  if (gateMissed.length > 0) {
    return {
      eligible: false,
      matchScore: 0,
      matchedWeight: 0,
      comparableWeight: 0,
      matchingFields: [],
      mismatchedFields: gateMissed.map((rule) => rule.field),
    };
  }

  const matchingFields = [];
  const mismatchedFields = [];
  const missingFields = [];
  let matchedWeight = 0;
  let comparableWeight = 0;

  for (const rule of fields) {
    const subjectValue = subject[rule.field];
    const candidateValue = candidate[rule.field];

    if (rule.kind === 'text') {
      comparableWeight += rule.weight;
      if (normalizeText(subjectValue) === normalizeText(candidateValue)) {
        matchedWeight += rule.weight;
        matchingFields.push(rule.field);
      } else {
        mismatchedFields.push(rule.field);
      }
      continue;
    }

    if (!isUsableNumber(subjectValue) || !isUsableNumber(candidateValue)) {
      missingFields.push(rule.field);
      continue;
    }

    comparableWeight += rule.weight;
    const difference = relativeDifference(subjectValue, candidateValue);

    if (difference <= rule.tolerance) {
      matchedWeight += rule.weight;
      matchingFields.push(rule.field);
    } else if (difference <= rule.nearTolerance) {
      matchedWeight += rule.weight / 2;
      mismatchedFields.push(rule.field);
    } else {
      mismatchedFields.push(rule.field);
    }
  }

  if (comparableWeight === 0) {
    return {
      eligible: false,
      matchScore: 0,
      matchedWeight: 0,
      comparableWeight: 0,
      matchingFields,
      mismatchedFields,
    };
  }

  return {
    eligible: true,
    matchScore: Math.round((100 * matchedWeight) / comparableWeight),
    matchedWeight,
    comparableWeight,
    matchingFields,
    mismatchedFields,
    missingFields,
  };
};

/**
 * Only fields already visible on the public listing response are ever returned,
 * so a duplicate report can never leak seller information.
 */
const publicMatchSummary = (candidate, score) => ({
  propertyId: candidate._id.toString(),
  title: candidate.title,
  locality: candidate.locality,
  city: candidate.city,
  propertyType: candidate.propertyType,
  builtUpArea: candidate.builtUpArea,
  bedrooms: candidate.bedrooms,
  bathrooms: candidate.bathrooms,
  propertyAge: candidate.propertyAge,
  askingPrice: candidate.askingPrice,
  status: candidate.status,
  matchScore: score.matchScore,
  matchingFields: score.matchingFields,
});

/**
 * Finds stored listings that look like the same property as `property`.
 *
 * The subject property is always excluded from its own candidate set, and the
 * candidate query is additionally scoped to the same locality, city, and
 * property type so the scan stays small and deterministic. Those three gate
 * fields are compared through `textGateClause`, so the query applies the same
 * normalisation as the scorer and casing cannot hide a candidate. Results are
 * ordered by match score and then by id, so repeated calls return an identical
 * list.
 */
export const findSimilarListings = async (property, { limit = 5 } = {}) => {
  const subjectId = property._id ? property._id.toString() : null;
  const statuses = DUPLICATE_MATCHING.comparableStatuses.filter((status) =>
    PROPERTY_STATUSES.includes(status),
  );

  const filter = {
    locality: textGateClause(property.locality),
    city: textGateClause(property.city),
    propertyType: textGateClause(property.propertyType),
    ...(statuses.length > 0 ? { status: { $in: statuses } } : {}),
  };

  // Never compare a property against itself.
  if (subjectId && mongoose.isValidObjectId(subjectId)) {
    filter._id = { $ne: new mongoose.Types.ObjectId(subjectId) };
  }

  const candidates = await Property.find(filter)
    .sort({ createdAt: -1, _id: 1 })
    .limit(DUPLICATE_MATCHING.maxCandidates)
    .lean();

  const scored = candidates
    .map((candidate) => ({ candidate, score: scoreCandidate(property, candidate) }))
    .filter((entry) => entry.score.eligible && entry.score.matchScore >= DUPLICATE_MATCHING.duplicateThreshold)
    .sort((a, b) => {
      if (b.score.matchScore !== a.score.matchScore) return b.score.matchScore - a.score.matchScore;
      return a.candidate._id.toString().localeCompare(b.candidate._id.toString());
    });

  const matches = scored.slice(0, limit);
  const matchingFields = [...new Set(matches.flatMap((entry) => entry.score.matchingFields))];

  return {
    candidatesCompared: candidates.length,
    threshold: DUPLICATE_MATCHING.duplicateThreshold,
    matches: matches.map((entry) => publicMatchSummary(entry.candidate, entry.score)),
    matchingPropertyIds: matches.map((entry) => entry.candidate._id.toString()),
    matchingFields,
    highestMatchScore: matches.length > 0 ? matches[0].score.matchScore : null,
  };
};
