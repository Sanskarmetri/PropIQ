import { isDatabaseReady } from '../../config/db.js';
import { routeIntent } from './actionRouter.js';
import { normalizeContext, resolveContext } from './contextResolver.js';
import { ADMIN_ONLY_INTENTS, INTENT_ACTIONS, ACTIONS } from './intentDefinitions.js';
import { parseMessage } from './intentParser.js';
import { buildResponse } from './responseBuilder.js';

const isAdmin = (user) => user?.role === 'admin';

/**
 * Admin-only questions are refused before any query runs, so an analytics answer
 * can never be produced — or started — for a visitor.
 */
const refusalOutcome = (intent) => ({
  action: INTENT_ACTIONS[intent] ?? ACTIONS.NONE,
  forbidden: true,
});

/**
 * Stage five of the pipeline: parse, resolve context, route to a service, build
 * the response.
 *
 * Every stage is deterministic, so the same message with the same context always
 * produces the same answer, and nothing here invents a property, price or
 * location that the database did not return.
 *
 * `user` is the signed-in account when one was attached to the request. It is
 * used only to decide whether an admin-only question may run.
 */
export const handlePropValMessage = async ({ message, context = {}, user = null }) => {
  const parsed = parseMessage(message);
  const adminOnly = ADMIN_ONLY_INTENTS.includes(parsed.intent);
  const permitted = !adminOnly || isAdmin(user);

  let entities = parsed.entities;
  let resolvedContext;
  let outcome;

  if (permitted) {
    const resolved = await resolveContext({ entities: parsed.entities, context });
    entities = resolved.entities;
    resolvedContext = resolved.context;
    outcome = await routeIntent({
      intent: parsed.intent,
      entities: resolved.entities,
      amenityKeywords: parsed.amenityKeywords,
      propertyId: resolved.propertyId,
      property: resolved.property,
    });
  } else {
    resolvedContext = normalizeContext(context);
    outcome = refusalOutcome(parsed.intent);
  }

  return buildResponse({
    intent: parsed.intent,
    entities,
    outcome,
    context: resolvedContext,
    viewer: { role: user?.role ?? null, authenticated: Boolean(user) },
  });
};

/**
 * The database is only touched when a request actually needs data, so greetings
 * and help still work while MongoDB is disconnected.
 */
export const isPropValDatabaseReady = () => isDatabaseReady();
