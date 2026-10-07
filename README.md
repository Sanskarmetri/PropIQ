PropIQ

Property intelligence platform for valuation, risk screening, property discovery, and listing analytics.

PropIQ is a full-stack property intelligence platform built with React, Node.js, Express, and MongoDB. It combines property discovery and listing management with transparent valuation, explainable screening, a deterministic property intelligence assistant, and role-based market analytics.

The project is designed around one principle:

Every number and recommendation should be traceable to data and an explicit rule.

No external LLM is used. PropVal, valuation, fraud-risk screening, and analytics are deterministic, testable application services built on the project’s own property data.

⸻

✨ What PropIQ Does

Capability	What it provides
🏠 Property Discovery	Search, filtering, property details, and responsive property browsing
💰 Property Valuation	Transparent benchmark-based valuation with amenity and age adjustments
🔎 Risk Screening	Explainable price-deviation and duplicate-listing checks
💬 PropVal	Deterministic natural-language property intelligence assistant
📊 Listing Analytics	Admin-only KPIs, trends, market breakdowns, and screening coverage
🔐 Authentication & RBAC	JWT authentication with buyer, seller, and admin roles
🏗️ Listing Management	Seller-owned property CRUD with admin controls
🎨 Modern UI	Responsive Liquid Glass / Bento-inspired interface with motion

⸻

🧠 Engineering Highlights

PropIQ is more than a CRUD application. The backend is structured around reusable services so that different product surfaces consume the same underlying business logic.

Explainable valuation

Market benchmark
      ↓
Built-up area
      ↓
Amenity adjustment
      ↓
Property-age adjustment
      ↓
Estimated property value
      ↓
Data-quality confidence + explanation

The valuation engine uses a documented fallback hierarchy and reports exactly which benchmark was used. Estimates are calculated on demand and are never persisted on the property.

Deterministic risk screening

Property
   │
   ├── Current PropIQ valuation
   │          ↓
   │    Price deviation
   │
   └── Comparable active listings
              ↓
       Duplicate detection
              ↓
       Explainable screening result

A screening flag means “review recommended”, not “fraud”. Thresholds and weights are explicitly configured and documented.

PropVal intelligence assistant

User message
     ↓
Entity parsing
     ↓
Intent detection
     ↓
Context resolution
     ↓
Existing PropIQ services
     ↓
Structured response

PropVal understands property searches, valuations, pricing questions, screening explanations, similar-property requests, and admin analytics without calling an external LLM.

⸻

🏗️ Architecture

┌─────────────────────────────────────────────────────────────┐
│                         React Client                        │
│                                                             │
│  Home │ Explore │ Property │ Valuation │ Dashboard │       │
│  Analytics │ PropVal │ Authentication                       │
└────────────────────────────┬────────────────────────────────┘
                             │ REST API
                             ▼
┌─────────────────────────────────────────────────────────────┐
│                     Express API Layer                       │
│                                                             │
│ Auth │ Properties │ Valuation │ Fraud │ PropVal │ Analytics │
└────────────────────────────┬────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────┐
│                     Service Layer                           │
│                                                             │
│ propertyService       valuationService                     │
│ fraudService          duplicateDetectionService            │
│ analyticsService      PropVal pipeline                      │
└────────────────────────────┬────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────┐
│                         MongoDB                             │
│                                                             │
│ Users │ Properties │ HistoricalPrice                        │
└─────────────────────────────────────────────────────────────┘

The architecture keeps API routes, controllers, business services, models, validation, and configuration separated so individual features can be tested and evolved independently.

⸻

🛠️ Tech Stack

Frontend

* React
* Vite
* Framer Motion
* CSS
* Responsive Liquid Glass / Bento UI

Backend

* Node.js
* Express
* Mongoose
* MongoDB
* JWT
* bcrypt

Engineering

* REST API architecture
* Role-based access control
* Input validation
* Service-oriented business logic
* Automated backend testing
* In-memory MongoDB testing
* Environment-based configuration

⸻

📸 Product Preview

Home

<!-- Add screenshot: docs/screenshots/home.png -->

Explore

<!-- Add screenshot: docs/screenshots/explore.png -->

Property Details

<!-- Add screenshot: docs/screenshots/property-details.png -->

Valuation

<!-- Add screenshot: docs/screenshots/valuation.png -->

Admin Analytics

<!-- Add screenshot: docs/screenshots/analytics.png -->

PropVal

<!-- Add screenshot: docs/screenshots/propval.png -->

Screenshots can be added under docs/screenshots/ when available.

⸻

⚡ Quick Start

Requirements

* Node.js 18+
* npm 9+
* MongoDB 6+ or MongoDB Atlas

1. Clone the repository

git clone https://github.com/Sanskarmetri/PropIQ.git
cd PropIQ

2. Install dependencies

npm run install:all

3. Configure the backend

cp server/.env.example server/.env

Set the required values:

MONGODB_URI=mongodb://127.0.0.1:27017/propiq
JWT_SECRET=your-development-secret

4. Seed development data

npm run seed:users
npm run seed:market

5. Start the application

Frontend:

npm run dev:client

Backend:

npm run dev:server

Then open:

http://localhost:5173

The frontend communicates with the Express API running on the configured backend port.

⸻

👤 Development Roles

The development seed creates three roles:

Role	Purpose
Buyer	Browse properties and use public intelligence features
Seller	Manage owned property listings
Admin	Access listing analytics and administrative functionality

The seed credentials are intended only for local development and are not production credentials.

⸻

🧪 Verification

PropIQ includes automated backend tests covering authentication, authorization, property CRUD, valuation, screening, PropVal, analytics, validation, determinism, and edge cases.

Run:

npm run lint:client
npm run build:client
npm run test:server

The project also supports an in-memory MongoDB test environment, so backend tests do not require a running local database.

⸻

🔐 Security & Data Principles

PropIQ deliberately avoids presenting development assumptions as real-world certainty.

* Secrets are stored through environment variables and excluded from Git.
* JWT authentication protects private operations.
* Seller listings are ownership-scoped server-side.
* Admin-only analytics are protected by role-based middleware.
* Request inputs are validated before reaching business logic.
* PropVal does not execute or evaluate user input as code.
* Database filters are validated and constrained.
* Valuation and screening results are calculated from current stored data.
* Screening flags are presented as review signals, not accusations.
* Development market benchmarks are explicitly labelled as sample data.
* No external LLM or chatbot API is used by PropVal.

⸻

⚠️ Important Limitation

PropIQ is a software prototype and decision-support system, not a replacement for professional property valuation, legal due diligence, title verification, inspection, or fraud investigation.

The included market benchmarks are development sample data, not live market data.

Screening thresholds are documented development assumptions rather than statistically validated fraud indicators.

Analytics describe the listings stored inside PropIQ; they should not be interpreted as a representation of the entire real-estate market.

⸻

📚 Project Documentation

The remainder of this README documents the implementation in detail:

* Phase 1 — React/Vite frontend and initial property API
* Phase 2 — Authentication, RBAC, MongoDB property CRUD, and seller workspace
* Phase 3 — Explainable property valuation engine
* Phase 4 — Deterministic fraud-risk screening
* Phase 5 — PropVal property intelligence assistant
* Phase 6 — Admin listing analytics

⸻

Built as a full-stack engineering project with an emphasis on explainability, deterministic business logic, security, testing, and polished user experience.

⸻

Phase 1 scope

## Phase 1 scope

- Responsive React/Vite frontend with Home, Explore, Property details, Valuation, Login, Register, Dashboard preview, and 404 routes.
- Reusable navigation, buttons, section headings, property cards, metrics, status indicators, footer, reveal animations, and form components.
- Subtle Framer Motion transitions for reveal, card hover, valuation bars, and assistant preview states.
- Express API with `GET /api/health`, `GET /api/properties`, and `GET /api/properties/:id`.
- Mongoose `Property` model with validation, indexes, and timestamp fields.
- Environment-based configuration with no committed secrets.

## Phase 2 scope

- Validated backend configuration: `MONGODB_URI` and `JWT_SECRET` are required and the server refuses to start without them.
- Reusable Mongoose connection module that reports live connection state.
- `User` model with bcrypt password hashing, unique lowercase email, `buyer`/`seller`/`admin` roles, and safe user serialization that never exposes passwords.
- JWT authentication with `POST /api/auth/register`, `POST /api/auth/login`, and the protected `GET /api/auth/me` route.
- `requireAuth` and `requireRole` middleware for protected and role-restricted routes.
- Health endpoint that reports `ok` or `degraded` plus the current MongoDB connection state.
- Development seed script for one buyer, one seller, and one admin account.
- Frontend auth state (`AuthProvider`/`useAuth`), token storage, and connected Login/Register forms that keep the existing design system.
- Backend test suite covering registration, duplicate email, weak input, login, invalid login, protected access, and role restriction.
- Database-backed `Property` model and full CRUD API with seller ownership, admin override, validation, and pagination.
- Scoped `GET /api/properties/mine` route for the seller workspace, so a seller sees every own listing including inactive ones.
- Explore, property details, and the dashboard seller workspace now read and write live API data.
- Backend test suite covering the property CRUD, role, ownership, filter, and error paths.

## Phase 3 scope

- `HistoricalPrice` model holding locality benchmarks as `averagePricePerSqFt`, with a nullable `propertyType` for all-type rows, a `sampleSize`, a `source`, and a `period`.
- Documented fallback hierarchy: exact locality and type → locality across all types → city and type → city across all types → `422 INSUFFICIENT_MARKET_DATA`.
- Transparent, rule-based valuation: benchmark rate × built-up area, then a weighted amenity credit and a property-age adjustment, with a published cap on each.
- Equivalent amenities are grouped so the same benefit is never counted twice, unrecognised amenities are reported instead of failing the request, and every adjustment can be traced back to a rule in `server/config/valuationConfig.js`.
- Generated plain-language explanation plus a bounded data-quality confidence indicator, both returned with the estimate.
- Public `POST /api/valuation` that values either a stored `propertyId` or inline characteristics. Valuations are calculated on demand and never stored on the property.
- Idempotent development market-data seed covering the sample localities, labelled `development-sample`.
- Valuation page wired to the live engine, and property details showing the current estimate with a graceful message when no benchmark exists.
- Backend test suite covering the lookup hierarchy, the formula, amenity grouping and caps, age bands, confidence, the API contract, and the "never persisted" guarantee.

## Phase 4 scope

- Deterministic, explainable listing screening built on top of the Phase 3 valuation engine. Screening reuses `valueStoredProperty()`, so the estimate and the price check can never disagree, and nothing is persisted.
- Rule 1, price deviation: the asking price is compared with the current PropIQ estimate, and the deviation is reported with its direction, severity, and the threshold it crossed.
- Rule 2, duplicate listing: other active listings in the same locality, city, and property type are scored on area, bedrooms, bathrooms, age, and price to find near-identical duplicates.
- `server/config/fraudConfig.js` holds every threshold, field weight, tolerance, and severity mapping, so each result can be traced back to a rule.
- Public `POST /api/fraud/check` that screens a stored `propertyId` and returns the triggered flags, the evidence behind them, a summary, and the limitations.
- A missing benchmark produces a `200` result with `status: "unavailable"` and `riskLevel: null` rather than an invented score, while duplicate screening still runs.
- Property details gained a restrained "PropIQ screening" panel that shows each rule's outcome, the evidence, and why it matters.
- Backend test suite covering every rule path, boundary values, self-exclusion, determinism, privacy, and the API contract.

Every threshold and weight is a documented development assumption, not a statistically validated figure. Screening is a review aid, not a verdict.

## Phase 5 scope

PropVal is an application-native deterministic property intelligence engine. It does not use an external LLM or chatbot API.

There is no model call, no prompt, and no generated text anywhere in the pipeline. A message is matched against an ordered rule table, its entities are read with fixed patterns, and the answer is assembled from numbers that existing PropIQ services already returned. The same message with the same context always produces the same answer.

- Fixed pipeline: `parseMessage` → `detectIntent` → `parseEntities` → `resolveContext` → `routeIntent` → `buildResponse`, orchestrated by `handlePropValMessage` in `server/services/propval/propvalService.js`.
- Eight intents, each with a published priority so the most specific reading wins: greeting, help, property search, property details, valuation, pricing comparison, screening explanation, and similar properties. Anything unmatched becomes `UNKNOWN` and is answered with the capability list rather than a guess.
- Entities: `city`, `locality`, `propertyType`, `bedrooms`, `bathrooms`, `minPrice`, `maxPrice`, `minArea`, `maxArea`, `amenities`, and `propertyId`.
- Indian phrasing is understood directly: `flat`/`flats` becomes `apartment`, `1BHK`, `2 bhk`, and `two bhk` become bedrooms, `crore`/`cr` multiplies by 10,000,000, and `lakh`/`lakhs`/`lac`/`lacs` multiplies by 100,000. `between 50 and 80 lakhs` becomes `minPrice: 5000000` and `maxPrice: 8000000`.
- City and locality are resolved against the listings themselves, so PropVal stays correct as the data changes and no city list is hardcoded. A place name PropIQ has never seen is passed through untouched, which returns an honest empty result set.
- The action router is the only place that calls a service, and it only calls the existing ones: `searchProperties` and `findPropertyById` for listings, `valueProperty` and `valueStoredProperty` for valuations, and `screenStoredProperty` for screening. No valuation arithmetic, screening threshold, or search rule is duplicated.
- Valuation and screening answers can only describe the property in context, or inline characteristics the user actually supplied. When neither is available PropVal says so instead of inventing a property.
- Screening wording stays neutral: pricing anomaly, duplicate listing match, review recommended, screening flag. PropVal never states or implies that a seller is fraudulent or that a listing is a scam.
- Request context is deliberately small — `currentRoute`, `currentPropertyId`, `lastSearch`, and `lastSearchResultCount` — with no long-term memory and no per-user conversation store.
- The message is length bounded, stripped of control characters, and only ever read as text. Every filter value is coerced to a number, checked against a model enum, or escaped into a regular expression, so no request field can introduce a MongoDB operator.
- Public `POST /api/propval`, available to every visitor like the other discovery endpoints.
- A compact floating PropVal panel in the shared Liquid Glass material, with conversation history, quick actions, loading and error states, a valuation card, a compact screening summary, and real `PropertyCard` results. The property under view is picked up from the route, and Explore hands its applied filters to PropVal so a follow-up question is answered against the same search.
- Backend test suite covering every intent, entity parsing, missing context, empty results, unknown localities, missing benchmarks, determinism, request validation, and the response envelope.

## Phase 6 scope

Phase 6 adds listing analytics, and it follows the same rule as every other phase: a number only appears if it was computed from the stored listings. There is no sampled metric, no estimated month, no hard-coded figure, and no model-generated text.

- `server/services/analyticsService.js` is the only place analytics is computed. It validates its own filters, then aggregates the `Property` collection for the same filter set in a single pass, so the dashboard, the report, and a PropVal question can never describe different data.
- Filters are shared with PropVal, so both surfaces read the same question the same way: case-insensitive **exact** city or locality, a valid `propertyType`, a valid `status`, and an inclusive UTC `createdAt` range. An unknown filter value is rejected with `INVALID_ANALYTICS_FILTER` and a field detail; nothing is silently dropped or coerced.
- Overview returns real KPIs (volume, status split, average/median/min/max asking price, price per sq.ft., average area and bedrooms, total and active asking value), breakdowns by status, property type, city, and locality, a listing volume trend, screening coverage, the flagged listings, the data coverage window, and the limitations.
- The trend only contains months that actually contain a listing. A month with no listing is a gap in the data, not a zero, so an empty month is never invented and the most recent month shown is always a real one.
- Screening reuses `screenStoredProperty()` from Phase 4, so the dashboard can never disagree with a screening answer. Flagged rows are reduced to a status, risk level, and triggered rule names: the owner reference is never included.
- Analytics reads up to 50 listings for screening, reports at most 10 flagged listings, at most 24 trend months, 10 cities, and 8 localities, and says so in `dataCoverage`, `screening.coverage`, and `limitations` rather than truncating silently.
- `GET /api/analytics/overview`, `GET /api/analytics/report`, and `GET /api/analytics/filters` are all behind `requireAuth` and `requireRole('admin')`. The filter options endpoint reads the cities, localities, and the real `createdAt` range out of the database, so the dashboard cannot offer a filter that would return nothing by construction.
- The report is generated by the server from the same aggregations: a written finding per significant result, a table per section, and the combined analytics and screening limitations.
- PropVal gained a `MARKET_ANALYTICS` intent that calls the same service with the same filters. It is admin-only: a visitor is told analytics is restricted rather than being served a partial answer. `POST /api/propval` stays public through a new `optionalAuth` middleware, so every other intent is unchanged for anonymous callers.
- The client added a Liquid Glass admin analytics page at `/analytics`: a filter bar, four real KPI tiles, a status donut, a listing volume trend, city/type/locality bars, screening coverage, the flagged listings, a printable generated report, and the coverage and limitations panels.
- The charts are hand-drawn SVG using the existing palette rather than a charting dependency, and each chart publishes its own numbers as a visually hidden table so the same figures are available to a screen reader.
- The analytics page never renders a zero for a figure that does not exist. A missing average is shown as a dash, and a filter that matches nothing says so and offers a way back.
- Backend test suite covering the filter contract, every breakdown, the trend gap rule, screening coverage, the report, admin authorization, PropVal parity with the REST endpoints, determinism, and the empty-result contract.

The limitation that matters most: this is a catalogue of what PropIQ holds, not a view of the market. The numbers describe the listings that exist in the database, at the prices that were asked, on the dates they were created.

## Project structure

```text
PropIQ/
├── client/
│   ├── src/
│   │   ├── components/
│   │   ├── context/
│   │   ├── data/
│   │   ├── layouts/
│   │   ├── pages/
│   │   ├── services/
│   │   ├── utils/
│   │   ├── App.jsx
│   │   └── main.jsx
│   └── ...
└── server/
    ├── config/
    │   ├── db.js
    │   ├── env.js
    │   ├── fraudConfig.js
    │   └── valuationConfig.js
    ├── controllers/
    ├── middleware/
    ├── models/
    │   ├── HistoricalPrice.js
    │   ├── Property.js
    │   └── User.js
    ├── routes/
    │   ├── analyticsRoutes.js
    │   ├── authRoutes.js
    │   ├── fraudRoutes.js
    │   ├── healthRoutes.js
    │   ├── propertyRoutes.js
    │   ├── propvalRoutes.js
    │   └── valuationRoutes.js
    ├── seed/
    │   ├── marketData.js
    │   └── seedUsers.js
    ├── services/
    │   ├── analyticsService.js
    │   ├── propval/
    │   │   ├── actionRouter.js
    │   │   ├── contextResolver.js
    │   │   ├── entityParser.js
    │   │   ├── intentDefinitions.js
    │   │   ├── intentParser.js
    │   │   ├── propvalService.js
    │   │   └── responseBuilder.js
    │   ├── duplicateDetectionService.js
    │   ├── fraudService.js
    │   ├── propertyService.js
    │   └── valuationService.js
    ├── tests/
    │   ├── analytics.test.js
    │   ├── propval.test.js
    │   └── ...
    ├── utils/
    │   ├── formatCurrency.js
    │   ├── propvalValidation.js
    │   ├── propertyValidation.js
    │   └── valuationValidation.js
    ├── server.js
    └── ...
```

## Requirements

- Node.js 18 or newer
- npm 9 or newer
- MongoDB 6 or newer, running locally or available through MongoDB Atlas

## Setup

Install both workspaces:

```bash
npm run install:all
```

Create the backend environment file:

```bash
cp server/.env.example server/.env
```

Set `MONGODB_URI` and generate a `JWT_SECRET`. For a local MongoDB instance, the example URI is usually sufficient:

```env
MONGODB_URI=mongodb://127.0.0.1:27017/propiq
```

Generate a signing secret (any random string of 16 characters or more works):

```bash
node -e "console.log(require('node:crypto').randomBytes(48).toString('hex'))"
```

The frontend can use its example API URL. To customize it, copy `client/.env.example` to `client/.env` and update `VITE_API_URL` if needed.

The backend validates its environment on startup and exits with an actionable message when `MONGODB_URI` or `JWT_SECRET` is missing, malformed, or too short.

## Seed development users

With MongoDB running, create one account per role and a set of sample listings:

```bash
npm run seed:users
```

| Role | Email | Password |
| --- | --- | --- |
| buyer | buyer@propiq.dev | PropIQ-Buyer-2024 |
| seller | seller@propiq.dev | PropIQ-Seller-2024 |
| admin | admin@propiq.dev | PropIQ-Admin-2024 |

The script also creates 30 sample properties across Bengaluru, Mumbai, Pune, and Gurugram — 22 `active`, 5 `sold`, and 3 `inactive` — so the public explore filters have something to show. The dataset spans all four property types (21 `apartment`, 3 `villa`, 3 `house`, 3 `plot`), 1 to 4 BHK homes plus plots, built-up areas from 560 to 3,600 sq.ft., and asking prices from about ₹49 lakh to ₹7.4 crore. Prices are consistent with the development market benchmarks, so a handful of listings intentionally sit outside the normal price-deviation band, and two pairs of near-identical active listings are included to demonstrate duplicate detection. Sign in as the seller to manage them from the dashboard.

These credentials are for local development only. The seed script refuses to run when `NODE_ENV=production`. The script is idempotent: running it again resets those accounts and listings.

## Seed market benchmarks

The valuation engine needs `HistoricalPrice` rows. Load the development sample dataset with:

```bash
npm run seed:market
```

The script is idempotent (re-running updates the same 29 rows instead of duplicating them) and refuses to run when `NODE_ENV=production`.

**These figures are hand-written development sample data, not live market data.** They approximate Indian metro ₹/sq.ft. ranges so the engine has something to read locally. They are not sourced from a registry, a broker feed, a survey, or a paid provider, and every row is stored with `source: "development-sample"` and `period: "2025-sample"` so it can never be mistaken for a real market feed. Replacing them with licensed data is a data problem, not a code change: the engine only reads the `HistoricalPrice` collection.

## Run locally

Start the frontend:

```bash
npm run dev:client
```

Open `http://localhost:5173`.

Start the backend in a second terminal:

```bash
npm run dev:server
```

The default API URL is `http://localhost:5000`. If port `5000` is already occupied, set a different `PORT` in `server/.env`.

The backend starts even when MongoDB is unreachable so the health endpoint can still be checked. In that state `/api/health` reports `degraded`, and database-backed routes return `503` with `DATABASE_UNAVAILABLE` until the connection returns.

## Verify

```bash
npm run lint:client
npm run build:client
npm run test:server
npm run seed:market
curl http://localhost:5000/api/health
```

Backend tests use an in-memory MongoDB instance, so no local database is required for `npm run test:server`.

## API routes

| Method | Route | Purpose |
| --- | --- | --- |
| GET | `/api/health` | Service status plus MongoDB connection state |
| POST | `/api/auth/register` | Create an account and receive a signed JWT |
| POST | `/api/auth/login` | Exchange email and password for a signed JWT |
| GET | `/api/auth/me` | Return the current user for a valid bearer token |
| GET | `/api/properties` | List properties with search, locality, type, price, status, area, and pagination query options |
| GET | `/api/properties/:id` | Retrieve one property by MongoDB ObjectId |
| GET | `/api/properties/mine` | List the signed-in seller's own listings, including inactive ones |
| POST | `/api/properties` | Create a listing (seller or admin only) |
| PUT | `/api/properties/:id` | Update a listing you own (admin can update any) |
| DELETE | `/api/properties/:id` | Delete a listing you own (admin can delete any) |
| POST | `/api/valuation` | Value a stored property or inline characteristics (public) |
| POST | `/api/fraud/check` | Screen a stored listing for price deviation and duplicate active listings (public) |
| POST | `/api/propval` | Ask PropVal a property question and get a structured, deterministic answer (public) |
| GET | `/api/analytics/overview` | Aggregated listing analytics for an optional filter set (admin only) |
| GET | `/api/analytics/report` | The same figures written as a generated report with sections and limitations (admin only) |
| GET | `/api/analytics/filters` | The city, locality, type, status, and date-range values that exist in the database (admin only) |

All responses use the same envelope: `{ "success": true, "message": "...", "data": {} }` on success and `{ "success": false, "message": "..." }` on failure, with an optional `code` and `details` for programmatic handling.

### Properties

Every listing stores `title`, `description`, `locality`, `city`, `propertyType` (`apartment`, `villa`, `house`, `plot`), `builtUpArea`, `askingPrice`, `bedrooms`, `bathrooms`, `propertyAge`, `amenities`, `status` (`active`, `inactive`, `sold`), and `images`. The owner is always taken from the signed-in account, so a spoofed `owner` in the request body is ignored.

`GET /api/properties` returns:

```json
{
  "success": true,
  "data": {
    "properties": [{ "id": "…", "title": "…", "askingPrice": 24500000 }],
    "pagination": { "page": 1, "limit": 20, "total": 6, "pages": 1 }
  }
}
```

Supported query options: `search` (title, locality, city), `locality`, `city`, `propertyType`, `status`, `minPrice`, `maxPrice`, `minArea`, `maxArea`, `bedrooms`, `page`, `limit` (capped at 50). Listings are scoped to the public view, so `inactive` records stay hidden unless `status` is passed explicitly.

Ownership rules:

- `buyer` gets `403` on every write.
- `seller` can create, update, and delete only their own listings.
- `admin` can update and delete any listing.
- A seller editing someone else's listing gets `404`, so listings are not confirmed to exist by probing.

Create a listing as a seller:

```bash
curl -X POST http://localhost:5000/api/properties \
  -H "Authorization: Bearer $PROPIQ_TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"title":"Sunlit Courtyard Residence","locality":"Indiranagar","city":"Bengaluru","propertyType":"apartment","builtUpArea":1840,"askingPrice":24500000,"bedrooms":3,"bathrooms":3,"propertyAge":4,"amenities":["Covered parking","Power backup"],"description":"A calm, light-filled apartment."}'
```

`amenities` accepts an array or a comma separated string. Validation failures return `400` with a per-field `details` object so forms can highlight individual inputs.

### Seller workspace

The dashboard (`/dashboard`) is the listing management entry point. Signed-in sellers and admins get a publish/edit form, a list of their own listings, and edit and delete actions. Buyers and signed-out visitors see a sign-in prompt instead. The panel reads `/api/properties/mine`, so it is scoped to the caller server-side and includes `inactive` and `sold` listings.

Registration offers a buyer or seller choice, and only those two roles can be self-assigned. `admin` accounts are never created through the API.

### Authentication

Register:

```bash
curl -X POST http://localhost:5000/api/auth/register \
  -H 'Content-Type: application/json' \
  -d '{"name":"Aarav Sharma","email":"aarav@example.com","password":"Str0ng-PropIQ-Password"}'
```

The response contains a `data.token` JWT. Use it as a bearer token:

```bash
curl http://localhost:5000/api/auth/me \
  -H "Authorization: Bearer $PROPIQ_TOKEN"
```

Tokens carry the user id and role. `requireAuth` re-reads the user from MongoDB on every protected request, so role changes and deleted accounts take effect immediately, and `requireRole('admin')` guards role-restricted routes with `403` responses. Public registration only ever assigns `buyer` or `seller`.

### Valuation

`POST /api/valuation` is public. Send either a stored `propertyId` or inline characteristics; when both are present the stored property wins, because a saved listing already holds the authoritative details.

```bash
curl -X POST http://localhost:5000/api/valuation \
  -H 'Content-Type: application/json' \
  -d '{"locality":"Indiranagar","city":"Bengaluru","propertyType":"apartment","builtUpArea":2000,"propertyAge":8,"amenities":["Covered parking","Private balcony","Gym"]}'
```

```json
{
  "success": true,
  "data": {
    "valuation": {
      "estimatedValue": 29476360,
      "estimatedPricePerSqFt": 14738,
      "benchmarkPricePerSqFt": 14200,
      "baseValue": 28400000,
      "amenityAdjustment": {
        "total": 0.07,
        "rawTotal": 0.07,
        "capped": false,
        "limit": 0.25,
        "recognized": [{ "id": "parking", "label": "Covered parking", "percentage": 0.03, "matched": ["Covered parking"] }],
        "unrecognized": []
      },
      "ageAdjustment": { "age": 8, "band": "6 to 10 years old", "percentage": -0.03 },
      "confidence": { "label": "Data-quality confidence", "level": "medium", "score": 74, "factors": {} },
      "marketData": {
        "locality": "Indiranagar",
        "city": "Bengaluru",
        "propertyType": "apartment",
        "averagePricePerSqFt": 14200,
        "sampleSize": 34,
        "source": "development-sample",
        "period": "2025-sample",
        "matchedLevel": "locality-type",
        "matchedLevelLabel": "exact locality and property type benchmark"
      },
      "explanation": "Based on 34 sample comparable records from the exact locality and property type benchmark …",
      "disclaimer": "Benchmarks come from a small development sample …"
    }
  }
}
```

The formula is intentionally simple and fully auditable:

```text
baseValue      = benchmark ₹/sq.ft. × builtUpArea
estimatedValue = baseValue × (1 + amenityAdjustment) × (1 + ageAdjustment)
```

Benchmark lookup walks a documented hierarchy and stops at the first match:

| Order | Match | Confidence contribution |
| --- | --- | --- |
| 1 | locality + city + property type | 40 |
| 2 | locality + city, all types | 32 |
| 3 | city + property type | 24 |
| 4 | city, all types | 16 |
| 5 | nothing usable | `422 INSUFFICIENT_MARKET_DATA` |

The response always reports which level matched, so a broad city-wide fallback is never presented as a precise locality match. Uncovered locations return `422` with the combinations that were searched rather than a fabricated estimate.

Adjustments live in `server/config/valuationConfig.js`:

- **Amenities** are matched by alias and grouped, so `Covered parking`, `Reserved parking`, and `Two-car garage` all credit the `parking` group once. The longest matching alias wins. The combined credit is capped at `+25%`.
- **Property age** uses published bands: 0–1 years `0%`, 2–5 `-1%`, 6–10 `-3%`, 11–15 `-6%`, 16–25 `-10%`, over 25 `-15%`.
- **Unrecognised amenities** are returned in `amenityAdjustment.unrecognized` and never block a valuation.

`confidence` is a bounded 0–100 **data-quality** score: the matched level (40/32/24/16) plus 10 for a type-specific benchmark plus a sample-size tier (30/24/18/12/6/3). The bands are `high` at 75+, `medium` at 50+, and `low` below that. It describes the quality of the input data. It is not a statistical confidence interval and carries no probability of accuracy.

Valuations are always recalculated from the current benchmark and property data and are never written to the `Property` document, so a benchmark update immediately changes every estimate without a migration.

### Frontend valuation surfaces

`/valuation` posts inline characteristics and shows the benchmark, every adjustment, the confidence indicator, the generated explanation, and the disclaimer. Opening it as `/valuation?property=<id>` values a stored listing instead, and offers an "Adjust details" escape hatch back to the inline form. Property details load their own estimate and degrade to a plain message when the location has no benchmark, so a valuation failure never hides the listing.

### Screening

`POST /api/fraud/check` is public, like the other listing intelligence reads, and it only ever returns data that is already visible on the public listing and valuation endpoints. It screens a stored listing, so pass a `propertyId`:

```bash
curl -X POST http://localhost:5000/api/fraud/check \
  -H 'Content-Type: application/json' \
  -d '{"propertyId":"65f000000000000000000001"}'
```

Screening is deterministic and rule based. Every threshold and weight lives in `server/config/fraudConfig.js`, the same way the valuation rules live in `server/config/valuationConfig.js`. **This is a deterministic rule-based screening system. A flag indicates that a listing requires review and does not establish fraud.**

#### Rule 1: price deviation

```
deviationPercentage = ((askingPrice - estimatedValue) / estimatedValue) × 100
```

The estimate is the live Phase 3 valuation of the same listing, so the two features can never disagree. The deviation is rounded to two decimals and mapped to a band:

| Direction | Band | Deviation | Severity |
| --- | --- | --- | --- |
| Above estimate | `high` | 30% or more | `high` |
| Above estimate | `review` | 12% to 29.99% | `medium` |
| Above estimate | `normal` | under 12% | none |
| Below estimate | `high` | 40% or more | `high` |
| Below estimate | `review` | 20% to 39.99% | `medium` |
| Below estimate | `normal` | under 20% | none |

The below-estimate bands are deliberately wider: a low asking price is far more often a stale price, a negotiation artefact, or an urgent seller than a listing problem.

#### Rule 2: duplicate active listing

Other **active** listings in the same locality, city, and property type are scored against the subject. Text fields must match to be comparable at all; numeric fields earn full weight inside their tolerance and half weight inside the near tolerance:

| Field | Weight | Tolerance | Near tolerance |
| --- | --- | --- | --- |
| `locality` | 12 | exact, case insensitive | gate |
| `city` | 10 | exact, case insensitive | gate |
| `propertyType` | 10 | exact, case insensitive | gate |
| `builtUpArea` | 28 | 5% | 15% |
| `bedrooms` | 8 | 0 | 25% |
| `bathrooms` | 6 | 0 | 34% |
| `propertyAge` | 12 | 15% | 50% |
| `askingPrice` | 14 | 5% | 20% |

A field missing on either side is skipped rather than treated as a mismatch, and the score is normalised over the fields that were actually comparable: `round(100 × matchedWeight / comparableWeight)`. A score of 70 or more is a duplicate and 88 or more is a strong match. The subject listing is always excluded from its own candidate set, at most 200 candidates are compared, and ties are broken by property id so repeated calls return identical results.

#### Response

```json
{
  "success": true,
  "data": {
    "screening": {
      "status": "review",
      "riskLevel": "medium",
      "partial": false,
      "summary": "Pricing screening flagged this listing: …",
      "flags": [
        {
          "type": "PRICE_DEVIATION",
          "title": "Pricing",
          "evaluated": true,
          "triggered": true,
          "severity": "medium",
          "message": "The asking price is 14.29% above the current PropIQ estimate. …",
          "details": {
            "askingPrice": 32000000,
            "estimatedValue": 28000000,
            "deviationPercentage": 14.29,
            "direction": "above",
            "band": "review",
            "threshold": 12
          }
        },
        { "type": "DUPLICATE_LISTING", "title": "Duplicate listing", "…": "…" }
      ],
      "property": { "id": "…", "title": "…", "askingPrice": 32000000 },
      "valuation": { "estimatedValue": 28000000 },
      "disclaimer": "This is a deterministic rule-based screening system. …",
      "limitations": ["…"]
    }
  }
}
```

`status` is `clear`, `review`, `elevated`, or `unavailable`, and `riskLevel` is `low`, `medium`, `high`, or `null`. Every flag reports `evaluated` separately from `triggered`, so a skipped check is never shown as a pass.

Nothing is written to the `Property` document, so a benchmark or listing change immediately changes the next result. Seller identity, email, and account data are never included in the response.

#### When a benchmark is missing

A listing outside the seeded market areas still gets a `200`. The price rule is reported as not evaluated, the result is marked `partial`, and `riskLevel` is `null` rather than a fabricated score:

```json
{
  "status": "unavailable",
  "riskLevel": null,
  "partial": true,
  "valuation": null,
  "valuationUnavailable": { "code": "INSUFFICIENT_MARKET_DATA", "reason": "…", "searched": [] }
}
```

Duplicate screening still runs, and a real duplicate finding is still reported with its risk level. Only the missing pricing check is withheld.

#### Limitations

Screening compares asking prices and listing characteristics. It does not verify ownership, inspect documents, detect image reuse, contact the seller, or use any third-party data source. Duplicate matching is scoped to `active` listings in PropIQ, so duplicates against withdrawn, sold, or unlisted properties are invisible. The thresholds are development assumptions, not validated figures, and are expected to be tuned with real data.

### Frontend screening surface

Property details load their own screening result alongside the estimate and render one card per rule with its outcome, the evidence behind it, and a short note on why it matters. The panel degrades to a plain message when screening itself fails, and exposes the limitations in a collapsed disclosure so the page stays calm and readable. Flagged rules use a restrained amber accent rather than an alarm treatment, because a flag is a prompt to look closer, not a conclusion.

### PropVal

PropVal is an application-native deterministic property intelligence engine. It does not use an external LLM or chatbot API.

#### Architecture

```text
message + page context
        │
        ▼
entityParser      reads city, locality, type, bedrooms, bathrooms,
        │         price, area, amenities, property id with fixed patterns
        ▼
intentParser      matches an ordered rule table and applies its priority
        │
        ▼
contextResolver   resolves the place against real listings, loads the
        │         property in context, normalises the request context
        ▼
actionRouter      calls the existing services only
        │         PROPERTY_SEARCH  → searchProperties
        │         PROPERTY_DETAILS → findPropertyById
        │         VALUATION        → valueStoredProperty / valueProperty
        │         FRAUD_SCREENING  → screenStoredProperty
        │         SIMILAR_PROPERTIES → findSimilarListings + searchProperties
        │         MARKET_ANALYTICS  → getAnalyticsOverview (admin only)
        ▼
responseBuilder   assembles the message from the numbers already returned
        │
        ▼
{ intent, action, message, entities, results, … }
```

Everything is a plain regular expression or a plain function call. Nothing evaluates input, calls a model, or composes prose from a template that could describe something the data does not support.

#### Supported intents

| Intent | Example message | Action | Needs context |
| --- | --- | --- | --- |
| `GREETING` | `Hi` | `NONE` | No |
| `HELP` | `what can you do` | `NONE` | No |
| `PROPERTY_SEARCH` | `Find me a 3BHK in Whitefield under 1 crore` | `PROPERTY_SEARCH` | No |
| `PROPERTY_DETAILS` | `tell me about this property` | `PROPERTY_DETAILS` | Yes |
| `VALUATION` | `what is this property worth?` | `VALUATION` | Property or enough characteristics |
| `PRICE_ANALYSIS` | `is this overpriced?` | `FRAUD_SCREENING` | Yes |
| `FRAUD_EXPLANATION` | `why was this property flagged?` | `FRAUD_SCREENING` | Yes |
| `SIMILAR_PROPERTIES` | `show similar properties` | `SIMILAR_PROPERTIES` | Yes |
| `MARKET_ANALYTICS` | `how many listings are in PropIQ?` | `MARKET_ANALYTICS` | No (admin session only) |
| `UNKNOWN` | `what is the weather tomorrow` | `NONE` | No |

#### Supported entities

| Entity | Example input | Result |
| --- | --- | --- |
| `propertyType` | `flats`, `villa`, `house`, `plot` | `apartment`, `villa`, `house`, `plot` |
| `bedrooms` | `3BHK`, `2 bhk`, `two bhk`, `3 bed` | `3`, `2`, `2`, `3` |
| `bathrooms` | `2 bathrooms` | `2` |
| `minPrice` / `maxPrice` | `under 1 crore` | `maxPrice: 10000000` |
| `minPrice` / `maxPrice` | `above 80 lakhs` | `minPrice: 8000000` |
| `minPrice` / `maxPrice` | `between 50 and 80 lakhs` | `minPrice: 5000000`, `maxPrice: 8000000` |
| `minArea` / `maxArea` | `1200 sqft apartment` | `minArea: 1200`, `maxArea: 1200` |
| `minArea` / `maxArea` | `under 1500 sqft` | `maxArea: 1500` |
| `locality` / `city` | `in Whitefield`, `in Bengaluru` | Resolved against stored listings |
| `amenities` | `with parking` | `["Covered parking"]`, matched against stored amenity text |
| `propertyId` | a 24-character id in the message | Used instead of the context property |

Amounts accept `crore`, `crores`, `cr`, `lakh`, `lakhs`, `lac`, `lacs`, and plain rupee figures. An amount with no comparator, such as `1.2 crore`, is read as both ends of a range.

#### Request

```http
POST /api/propval
Content-Type: application/json
```

```json
{
  "message": "Find me a 3BHK in Whitefield under 1 crore",
  "context": {
    "currentRoute": "/explore",
    "currentPropertyId": "65f0c1a2b3c4d5e6f7a8b9c0",
    "lastSearch": { "locality": "Whitefield", "bedrooms": 3 },
    "lastSearchResultCount": 6
  }
}
```

`message` is required, must be text, and must be 500 characters or fewer. Every `context` field is optional, and only these four keys are accepted; anything else is rejected with `400 PROPVAL_VALIDATION_FAILED` rather than forwarded.

#### Response

```json
{
  "success": true,
  "data": {
    "intent": "PROPERTY_SEARCH",
    "action": "PROPERTY_SEARCH",
    "message": "Found 2 properties in Whitefield · 3 bed under ₹1 crore.",
    "entities": { "bedrooms": 3, "locality": "Whitefield", "city": "Bengaluru", "maxPrice": 10000000 },
    "results": [ { "id": "…", "title": "…", "askingPrice": 7500000 } ],
    "total": 2,
    "context": { "currentRoute": "/explore", "currentPropertyId": "…", "lastSearch": { }, "lastSearchResultCount": 6 }
  }
}
```

`valuation` and `screening` are added when the answer came from those engines, and `suggestions` is added for greetings, help, and unsupported requests. `results` always holds real serialized listings, so the client can render the same `PropertyCard` it uses everywhere else.

#### Examples

| Message | Context | Answer |
| --- | --- | --- |
| `Hi` | — | `Hi 👋 Welcome to PropVal. We're ready to help you find your dream property.` |
| `what can you do` | — | The implemented capability list |
| `Find me a 3BHK in Whitefield under 1 crore` | — | Matching listings, or `I couldn't find properties matching those filters.` |
| `what is this property worth?` | property in view | The PropIQ estimate, or a note that no benchmark exists |
| `is this overpriced?` | property in view | The asking price against the estimate, in neutral language |
| `why was this property flagged?` | property in view | The screening summary and each triggered check |
| `show similar properties` | property in view | Ranked nearby listings, never including the property itself |
| `2 bhk in Necronopolis` | — | `[]` and `I couldn't find properties matching those filters.` |
| `tell me about this property` | none | `I can show property details once you open a property.` |
| `how many listings are in PropIQ?` | admin session | Listing volume, average and median asking price, leading city and type, and screening coverage for the whole catalogue |
| `how many listings are in PropIQ?` | no admin session | `Listing analytics cover every listing in PropIQ, so they are limited to admin accounts. Sign in as an admin to ask.` |
| `what is the weather tomorrow` | — | `I can help you find properties, estimate value, compare asking prices, or review listing screening.` |

#### No hallucination

Every property, price, estimate, locality, screening flag, and property id in a PropVal answer comes from a PropIQ service or the database. When the data cannot answer the question, PropVal says exactly that: a search with no matches returns an empty array, a location with no benchmark returns a "no current market benchmark" note instead of a number, and a property-related question with no property in context asks the user to open one.

#### Limitations

PropVal only understands the intents and entities listed above, and only in English. It does not handle typos, follow-up pronouns beyond the published phrases, multi-turn references to earlier answers other than the current property and last search, voice, images, or languages other than English. Similar listings come from the duplicate-matching scorer plus other listings in the same locality, so "similar" means comparable on the fields PropIQ stores, not visually similar. No conversation is persisted, and no request is logged with its message text.

### Frontend PropVal surface

The assistant is a compact floating launcher that opens a small panel, so it never takes over the page. It keeps the conversation in place, offers the four quick actions, shows a loading and an error state, and renders each answer with the same visual language as the rest of the app: a valuation card with the estimate, benchmark, and data-quality confidence, a compact screening summary reusing the existing screening wording, and real `PropertyCard` results for searches. The property being viewed is taken from the route, so questions like "what is this property worth?" work without any wiring on the property page, and Explore publishes its applied filters so a follow-up question continues the same search.

### Analytics

`GET /api/analytics/overview`, `GET /api/analytics/report`, and `GET /api/analytics/filters` all require a bearer token for an account with `role: "admin"`. A missing or non-admin token is rejected by the same `requireAuth` and `requireRole('admin')` middleware used by the seller workspace, so a non-admin receives `403` rather than an empty result.

#### Filters

| Query parameter | Accepted value | Notes |
| --- | --- | --- |
| `city` | Any stored city name | Case-insensitive exact match, not a prefix or fuzzy search |
| `locality` | Any stored locality name | Case-insensitive exact match |
| `propertyType` | `apartment`, `villa`, `house`, `plot` | Checked against the model enum |
| `status` | `active`, `sold`, `inactive` | Checked against the model enum |
| `from` | `YYYY-MM` or `YYYY-MM-DD` | Inclusive, UTC, matched on `Property.createdAt` |
| `to` | `YYYY-MM` or `YYYY-MM-DD` | Inclusive to the end of the day |

All parameters are optional and combine with AND. An unrecognised value returns `400` with `code: "INVALID_ANALYTICS_FILTER"` and a `details` array naming the offending field, rather than being ignored:

```json
{
  "success": false,
  "message": "Some analytics filters are not valid.",
  "code": "INVALID_ANALYTICS_FILTER",
  "details": [{ "field": "propertyType", "message": "Use one of: apartment, villa, house, plot." }]
}
```

When MongoDB is not connected the endpoints return `503` with `code: "DATABASE_UNAVAILABLE"`. They never fall back to sample data.

#### Overview

`GET /api/analytics/overview` returns:

- `generatedAt` — the ISO timestamp of the aggregation, not a stored value
- `filters` — the filters that were actually applied, with `hasAnyFilter`
- `kpis` — `totalListings`, `activeListings`, `soldListings`, `inactiveListings`, `activeSharePercentage`, `averageAskingPrice`, `medianAskingPrice`, `minimumAskingPrice`, `maximumAskingPrice`, `averagePricePerSqFt`, `averageBuiltUpArea`, `averageBedrooms`, `totalAskingValue`, `activeAskingValue`, and `empty`
- `breakdowns.status` — `byStatus` counts plus a row per status with its share, average, minimum, and maximum asking price
- `breakdowns.propertyTypes`, `breakdowns.cities`, `breakdowns.localities` — volume, share, average asking price, and average price per sq.ft. per group
- `trend` — `months` (each with `month`, `listings`, `totalAskingValue`, `averageAskingPrice`), `limit`, `capped`, and `basis`
- `screening` — `screenedListings`, `coverage`, `byStatus`, `byRiskLevel`, `ruleTriggers`, `withoutBenchmark`, `errors`, `flaggedListings`, and a `note`
- `dataCoverage` — `totalListingsInDatabase`, `matchedListings`, `firstListingAt`, `lastListingAt`
- `limitations` — the limits that apply to this response

An average or median is `null`, not `0`, when no listing matches. `kpis.empty` is `true` in that case, and the payload still describes the coverage so the client can say what is actually in the database.

#### Report

`GET /api/analytics/report` returns the same figures plus a `findings` array of sentences generated from them, a `sections` array (`status`, `propertyType`, `city`, `locality`, `trend`, `screening`) with a table of rows each, a `scope` block, and the analytics and screening `limitations` combined. A finding is only written when the aggregation supports it, so the report cannot describe something the data does not contain.

#### Filter options

`GET /api/analytics/filters` returns the `cities`, `localities`, `propertyTypes`, `statuses`, `dateRange`, and `limits` that the dashboard offers, all read from the database. A city or locality with no listings is never offered, because selecting it could only ever return nothing.

### Frontend analytics surface

The admin page lives at `/analytics` and is linked from the primary navigation only for an admin session, with the same role check the server applies. It follows the existing Liquid Glass material: warm paper, forest and near-black ink, lime accents, and the same reveal motion that respects `prefers-reduced-motion`.

The page has a filter bar over the real stored values, four KPI tiles, a status donut, a listing volume trend, city, property type, and locality bars, screening coverage with the rule triggers, the flagged listings with their risk level and deviation, the coverage window, the limitations, and a generated report that can be printed. Every chart is hand-drawn SVG using the existing palette instead of a charting library, and each one publishes its own numbers as a visually hidden table so the figures are readable with a screen reader. Missing values render as a dash rather than a zero, an empty filter set says so and offers a way back, and the loading and error states name what failed.

## Environment variables

Backend variables are documented in `server/.env.example`:

- `PORT`
- `NODE_ENV`
- `CLIENT_URL`
- `MONGODB_URI` (required)
- `JWT_SECRET` (required, 16 characters or more)
- `JWT_EXPIRES_IN`

Frontend variables are documented in `client/.env.example`:

- `VITE_API_URL`

Never commit `.env` files or database credentials. The frontend stores the JWT in `localStorage` under `propiq.auth.token` and sends it as a bearer token; move to `httpOnly` cookies if the deployment needs stronger protection against script-based token theft.
