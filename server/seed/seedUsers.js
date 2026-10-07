import { connectDatabase, disconnectDatabase, isDatabaseReady } from '../config/db.js';
import { env } from '../config/env.js';
import { Property } from '../models/Property.js';
import { User } from '../models/User.js';

const SEED_USERS = [
  { name: 'Aarav Sharma', email: 'buyer@propiq.dev', password: 'PropIQ-Buyer-2024', role: 'buyer' },
  { name: 'Diya Menon', email: 'seller@propiq.dev', password: 'PropIQ-Seller-2024', role: 'seller' },
  { name: 'PropIQ Admin', email: 'admin@propiq.dev', password: 'PropIQ-Admin-2024', role: 'admin' },
];

const SAMPLE_IMAGE = 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=1400&q=85';
const SAMPLE_LIVING_IMAGE = 'https://images.unsplash.com/photo-1600566753086-00f18fb6b3ea?auto=format&fit=crop&w=1400&q=85';
const SAMPLE_INTERIOR_IMAGE = 'https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=1400&q=85';
const SAMPLE_EXTERIOR_IMAGE = 'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?auto=format&fit=crop&w=1400&q=85';
const SAMPLE_VILLA_IMAGE = 'https://images.unsplash.com/photo-1613490493576-7fde63acd811?auto=format&fit=crop&w=1400&q=85';
const SAMPLE_PLOT_IMAGE = 'https://images.unsplash.com/photo-1500382017468-9049fed747ef?auto=format&fit=crop&w=1400&q=85';

const SEED_PROPERTIES = [
  {
    title: 'Sunlit Courtyard Residence',
    description:
      'A calm, light-filled apartment with generous living spaces, a private balcony, and a quiet position close to the neighbourhood’s best cafés and parks.',
    locality: 'Indiranagar',
    city: 'Bengaluru',
    propertyType: 'apartment',
    builtUpArea: 1840,
    bedrooms: 3,
    bathrooms: 3,
    propertyAge: 4,
    amenities: ['Private balcony', 'Covered parking', 'Clubhouse', 'Power backup'],
    askingPrice: 24500000,
    status: 'active',
    images: [SAMPLE_IMAGE],
    createdAt: '2026-05-06T09:15:00.000Z',
    ownerEmail: 'seller@propiq.dev',
  },
  {
    title: 'The Juniper House',
    description:
      'A contemporary family home designed around natural light, a landscaped garden, and effortless indoor-outdoor living across every floor.',
    locality: 'Whitefield',
    city: 'Bengaluru',
    propertyType: 'villa',
    builtUpArea: 2680,
    bedrooms: 4,
    bathrooms: 4,
    propertyAge: 7,
    amenities: ['Private garden', 'Home office', 'Rainwater harvesting', 'Two-car garage'],
    askingPrice: 38200000,
    status: 'active',
    images: [SAMPLE_IMAGE],
    createdAt: '2026-05-12T11:40:00.000Z',
    ownerEmail: 'seller@propiq.dev',
  },
  {
    title: 'Orchard View Apartment',
    description:
      'A refined three-bedroom apartment with wide views, considered finishes, and a connected lifestyle minutes from the Pune airport corridor.',
    locality: 'Koregaon Park',
    city: 'Pune',
    propertyType: 'apartment',
    builtUpArea: 1520,
    bedrooms: 3,
    bathrooms: 2,
    propertyAge: 2,
    amenities: ['Lake view', 'Gym', 'Play area', 'Concierge'],
    askingPrice: 19800000,
    status: 'active',
    images: [SAMPLE_IMAGE],
    createdAt: '2026-05-19T14:05:00.000Z',
    ownerEmail: 'seller@propiq.dev',
  },
  {
    title: 'Marine Terrace',
    description:
      'A composed sea-facing residence with an airy floor plan, warm materials, and a rare sense of privacy in the heart of Bandra West.',
    locality: 'Bandra West',
    city: 'Mumbai',
    propertyType: 'apartment',
    builtUpArea: 2140,
    bedrooms: 3,
    bathrooms: 3,
    propertyAge: 5,
    amenities: ['Sea-facing deck', 'Concierge', 'Pool', 'Reserved parking'],
    askingPrice: 61500000,
    status: 'sold',
    images: [SAMPLE_IMAGE],
    createdAt: '2026-05-27T16:30:00.000Z',
    ownerEmail: 'seller@propiq.dev',
  },
  {
    title: 'The Cedar Studio',
    description:
      'A smart, beautifully proportioned home for a more focused city rhythm, with flexible work space and easy access to the Koramangala lane.',
    locality: 'Koramangala',
    city: 'Bengaluru',
    propertyType: 'apartment',
    builtUpArea: 980,
    bedrooms: 2,
    bathrooms: 2,
    propertyAge: 3,
    amenities: ['Work-from-home nook', 'Cycling room', 'Lift', 'Pet friendly'],
    askingPrice: 12400000,
    status: 'active',
    images: [SAMPLE_IMAGE],
    createdAt: '2026-06-03T09:15:00.000Z',
    ownerEmail: 'seller@propiq.dev',
  },
  {
    title: 'Gardenline Retreat',
    description:
      'A new-build home with a strong connection to its landscape, balancing private green space with thoughtful technology and easy access to the city.',
    locality: 'Gurugram',
    city: 'Gurugram',
    propertyType: 'house',
    builtUpArea: 2450,
    bedrooms: 4,
    bathrooms: 3,
    propertyAge: 1,
    amenities: ['Open courtyard', 'Solar panels', 'Servant quarters', 'Smart home'],
    askingPrice: 28750000,
    status: 'inactive',
    images: [SAMPLE_IMAGE],
    createdAt: '2026-06-09T11:40:00.000Z',
    ownerEmail: 'admin@propiq.dev',
  },
  {
    title: 'Sarjapur Survey Plot',
    description:
      'A clear-title residential plot in a fast-developing corridor, five minutes from the main road and ready for immediate development.',
    locality: 'Sarjapur Road',
    city: 'Bengaluru',
    propertyType: 'plot',
    builtUpArea: 3600,
    bedrooms: 0,
    bathrooms: 0,
    propertyAge: 0,
    amenities: ['Clear title', 'East facing', 'Corner plot'],
    askingPrice: 9500000,
    status: 'active',
    images: [SAMPLE_IMAGE],
    createdAt: '2026-06-15T14:05:00.000Z',
    ownerEmail: 'seller@propiq.dev',
  },

  // Bengaluru — Indiranagar
  {
    title: 'Chandrika Heights Apartment',
    description:
      'A bright two-bedroom apartment on a quiet inner lane, with a covered car park, a residents’ clubhouse, and power backup that keeps the lights on through outages.',
    locality: 'Indiranagar',
    city: 'Bengaluru',
    propertyType: 'apartment',
    builtUpArea: 1180,
    bedrooms: 2,
    bathrooms: 2,
    propertyAge: 8,
    amenities: ['Covered parking', 'Clubhouse', 'Lift', 'Power backup'],
    askingPrice: 17800000,
    status: 'active',
    images: [SAMPLE_LIVING_IMAGE, SAMPLE_INTERIOR_IMAGE],
    createdAt: '2026-06-21T16:30:00.000Z',
    ownerEmail: 'seller@propiq.dev',
  },
  {
    title: 'Halcyon Nest Apartment',
    description:
      'A comfortable three-bedroom home with wide balconies, a gym in the building, and round-the-clock security, set far enough back from the main road to stay quiet.',
    locality: 'Indiranagar',
    city: 'Bengaluru',
    propertyType: 'apartment',
    builtUpArea: 1650,
    bedrooms: 3,
    bathrooms: 3,
    propertyAge: 13,
    amenities: ['Private balcony', 'Covered parking', 'Gym', '24x7 security'],
    askingPrice: 27000000,
    status: 'active',
    images: [SAMPLE_INTERIOR_IMAGE, SAMPLE_LIVING_IMAGE],
    createdAt: '2026-06-26T10:50:00.000Z',
    ownerEmail: 'admin@propiq.dev',
  },

  // Bengaluru — Koramangala
  {
    title: 'Sonora Lane Apartment',
    description:
      'A compact two-bedroom apartment a short walk from the 5th Block park, with a proper work-from-home corner and a building that welcomes pets.',
    locality: 'Koramangala',
    city: 'Bengaluru',
    propertyType: 'apartment',
    builtUpArea: 1120,
    bedrooms: 2,
    bathrooms: 2,
    propertyAge: 6,
    amenities: ['Covered parking', 'Private balcony', 'Work-from-home nook', 'Pet friendly'],
    askingPrice: 16000000,
    status: 'active',
    images: [SAMPLE_INTERIOR_IMAGE],
    createdAt: '2026-07-04T09:15:00.000Z',
    ownerEmail: 'seller@propiq.dev',
  },
  {
    title: 'Terrace Nine Residences',
    description:
      'A brand-new three-bedroom apartment on a high floor, with the full amenity floor — clubhouse, gym and a rooftop pool — and an asking price the original owner has not revised yet.',
    locality: 'Koramangala',
    city: 'Bengaluru',
    propertyType: 'apartment',
    builtUpArea: 1980,
    bedrooms: 3,
    bathrooms: 3,
    propertyAge: 1,
    amenities: ['Private balcony', 'Covered parking', 'Clubhouse', 'Gym', 'Pool'],
    askingPrice: 38500000,
    status: 'active',
    images: [SAMPLE_LIVING_IMAGE, SAMPLE_EXTERIOR_IMAGE],
    createdAt: '2026-07-08T11:40:00.000Z',
    ownerEmail: 'seller@propiq.dev',
  },

  // Bengaluru — Whitefield
  {
    title: 'Maple Grove Apartments',
    description:
      'A three-bedroom apartment in a completed Whitefield project, walking distance to the main market, with a clubhouse, a gym, and covered parking for one car.',
    locality: 'Whitefield',
    city: 'Bengaluru',
    propertyType: 'apartment',
    builtUpArea: 1650,
    bedrooms: 3,
    bathrooms: 2,
    propertyAge: 3,
    amenities: ['Covered parking', 'Clubhouse', 'Gym', 'Lift'],
    askingPrice: 14200000,
    status: 'active',
    images: [SAMPLE_INTERIOR_IMAGE, SAMPLE_LIVING_IMAGE],
    createdAt: '2026-07-13T14:05:00.000Z',
    ownerEmail: 'seller@propiq.dev',
  },
  {
    title: 'Maple Grove Premium Apartments',
    description:
      'A second and larger unit in the same Maple Grove project, on a higher floor with the same clubhouse, gym, lift, and covered parking.',
    locality: 'Whitefield',
    city: 'Bengaluru',
    propertyType: 'apartment',
    builtUpArea: 1750,
    bedrooms: 3,
    bathrooms: 2,
    propertyAge: 3,
    amenities: ['Covered parking', 'Clubhouse', 'Gym', 'Lift'],
    askingPrice: 14800000,
    status: 'active',
    images: [SAMPLE_INTERIOR_IMAGE],
    createdAt: '2026-07-18T16:30:00.000Z',
    ownerEmail: 'seller@propiq.dev',
  },
  {
    title: 'Banyan Row Villa',
    description:
      'A four-bedroom villa on a tree-lined private road, with a mature garden, a two-car garage, rainwater harvesting, and a cycling track inside the enclave.',
    locality: 'Whitefield',
    city: 'Bengaluru',
    propertyType: 'villa',
    builtUpArea: 3250,
    bedrooms: 4,
    bathrooms: 4,
    propertyAge: 15,
    amenities: ['Private garden', 'Two-car garage', 'Rainwater harvesting', 'Cycling track'],
    askingPrice: 44000000,
    status: 'sold',
    images: [SAMPLE_VILLA_IMAGE, SAMPLE_EXTERIOR_IMAGE],
    createdAt: '2026-07-23T10:50:00.000Z',
    ownerEmail: 'admin@propiq.dev',
  },
  {
    title: 'Gurugere Hills Villa',
    description:
      'A newer villa above Whitefield with a private garden and a shared pool and gym, sold by the builder after the family relocated overseas.',
    locality: 'Whitefield',
    city: 'Bengaluru',
    propertyType: 'villa',
    builtUpArea: 2400,
    bedrooms: 4,
    bathrooms: 3,
    propertyAge: 2,
    amenities: ['Private garden', 'Clubhouse', 'Pool', 'Gym', 'Covered parking'],
    askingPrice: 33500000,
    status: 'sold',
    images: [SAMPLE_VILLA_IMAGE],
    createdAt: '2026-07-29T15:20:00.000Z',
    ownerEmail: 'seller@propiq.dev',
  },
  {
    title: 'Hope Farm Garden Apartment',
    description:
      'A well-planned three-bedroom apartment in an older building near Hope Farm, with a shared open courtyard, a lift, and covered parking.',
    locality: 'Whitefield',
    city: 'Bengaluru',
    propertyType: 'apartment',
    builtUpArea: 1050,
    bedrooms: 3,
    bathrooms: 2,
    propertyAge: 12,
    amenities: ['Covered parking', 'Lift', 'Open courtyard'],
    askingPrice: 9500000,
    status: 'active',
    images: [SAMPLE_INTERIOR_IMAGE, SAMPLE_LIVING_IMAGE],
    createdAt: '2026-08-02T09:15:00.000Z',
    ownerEmail: 'seller@propiq.dev',
  },

  // Bengaluru — Sarjapur Road
  {
    title: 'Bellandur Lake View Plot',
    description:
      'A compact east-facing residential plot with clean paperwork, a short walk from the main road, and a lake view from the eventual first-floor deck.',
    locality: 'Sarjapur Road',
    city: 'Bengaluru',
    propertyType: 'plot',
    builtUpArea: 1800,
    bedrooms: 0,
    bathrooms: 0,
    propertyAge: 0,
    amenities: ['Clear title', 'East facing'],
    askingPrice: 4900000,
    status: 'active',
    images: [SAMPLE_PLOT_IMAGE],
    createdAt: '2026-08-07T11:40:00.000Z',
    ownerEmail: 'seller@propiq.dev',
  },
  {
    title: 'Sarjapur Corner Estate Plot',
    description:
      'A corner plot inside a gated residential layout, with a park along one boundary and unobstructed frontage on two sides for an independent house.',
    locality: 'Sarjapur Road',
    city: 'Bengaluru',
    propertyType: 'plot',
    builtUpArea: 2400,
    bedrooms: 0,
    bathrooms: 0,
    propertyAge: 0,
    amenities: ['Clear title', 'Park view', 'Gated community'],
    askingPrice: 7200000,
    status: 'inactive',
    images: [SAMPLE_PLOT_IMAGE],
    createdAt: '2026-08-11T14:05:00.000Z',
    ownerEmail: 'seller@propiq.dev',
  },

  // Mumbai — Bandra West
  {
    title: 'Sea Breeze Residences',
    description:
      'A sea-facing three-bedroom apartment a short walk from Pali Hill, with a wraparound deck, concierge service, a heated pool, and reserved parking.',
    locality: 'Bandra West',
    city: 'Mumbai',
    propertyType: 'apartment',
    builtUpArea: 2100,
    bedrooms: 3,
    bathrooms: 3,
    propertyAge: 6,
    amenities: ['Sea-facing deck', 'Concierge', 'Pool', 'Reserved parking'],
    askingPrice: 72000000,
    status: 'active',
    images: [SAMPLE_LIVING_IMAGE, SAMPLE_EXTERIOR_IMAGE],
    createdAt: '2026-08-16T16:30:00.000Z',
    ownerEmail: 'seller@propiq.dev',
  },
  {
    title: 'Sea Breeze Sea View Homes',
    description:
      'A near-identical sea-view unit in the same Bandra West building, listed by a second owner with an extra bathroom and a slightly higher ask.',
    locality: 'Bandra West',
    city: 'Mumbai',
    propertyType: 'apartment',
    builtUpArea: 2110,
    bedrooms: 3,
    bathrooms: 4,
    propertyAge: 6,
    amenities: ['Sea view', 'Concierge', 'Pool', 'Reserved parking'],
    askingPrice: 74000000,
    status: 'active',
    images: [SAMPLE_LIVING_IMAGE],
    createdAt: '2026-08-20T10:50:00.000Z',
    ownerEmail: 'seller@propiq.dev',
  },
  {
    title: 'Carter Road Heritage Apartment',
    description:
      'A restored four-bedroom apartment in one of the older Carter Road buildings, with high ceilings, a private balcony, and a residents’ club on the terrace level.',
    locality: 'Bandra West',
    city: 'Mumbai',
    propertyType: 'apartment',
    builtUpArea: 2450,
    bedrooms: 4,
    bathrooms: 4,
    propertyAge: 22,
    amenities: ['Private balcony', 'Covered parking', 'Clubhouse', 'Concierge'],
    askingPrice: 56000000,
    status: 'active',
    images: [SAMPLE_INTERIOR_IMAGE, SAMPLE_LIVING_IMAGE],
    createdAt: '2026-08-25T15:20:00.000Z',
    ownerEmail: 'admin@propiq.dev',
  },

  // Mumbai — Powai
  {
    title: 'Hiranandani Lakeside Apartment',
    description:
      'A two-bedroom apartment facing the Powai lake, with a clubhouse, a gym, and covered parking, five minutes from the Hiranandani main gate.',
    locality: 'Powai',
    city: 'Mumbai',
    propertyType: 'apartment',
    builtUpArea: 1180,
    bedrooms: 2,
    bathrooms: 2,
    propertyAge: 4,
    amenities: ['Covered parking', 'Clubhouse', 'Gym', 'Security'],
    askingPrice: 35500000,
    status: 'sold',
    images: [SAMPLE_LIVING_IMAGE],
    createdAt: '2026-08-30T13:10:00.000Z',
    ownerEmail: 'seller@propiq.dev',
  },
  {
    title: 'IIT Campus Compact Home',
    description:
      'A well-kept one-bedroom apartment in a low-rise building near the IIT campus, with covered parking, a lift, and power backup for the quieter hours.',
    locality: 'Powai',
    city: 'Mumbai',
    propertyType: 'apartment',
    builtUpArea: 560,
    bedrooms: 1,
    bathrooms: 1,
    propertyAge: 17,
    amenities: ['Covered parking', 'Lift', 'Power backup'],
    askingPrice: 15200000,
    status: 'active',
    images: [SAMPLE_INTERIOR_IMAGE],
    createdAt: '2026-09-01T09:15:00.000Z',
    ownerEmail: 'seller@propiq.dev',
  },

  // Pune — Koregaon Park
  {
    title: 'Koregaon Park Bungalow Row',
    description:
      'An independent four-bedroom house in the bungalow rows behind the Race Course, with a mature garden, staff quarters, and a cycling loop outside the gate.',
    locality: 'Koregaon Park',
    city: 'Pune',
    propertyType: 'house',
    builtUpArea: 2900,
    bedrooms: 4,
    bathrooms: 4,
    propertyAge: 18,
    amenities: ['Private garden', 'Covered parking', 'Servant quarters', 'Cycling track'],
    askingPrice: 49500000,
    status: 'active',
    images: [SAMPLE_VILLA_IMAGE, SAMPLE_EXTERIOR_IMAGE],
    createdAt: '2026-09-05T11:40:00.000Z',
    ownerEmail: 'admin@propiq.dev',
  },
  {
    title: 'Koregaon Park Lakeview Apartment',
    description:
      'A two-bedroom apartment with a clear lake view, covered parking, a gym, and a clubhouse, in a building two minutes from the boaters’ club gate.',
    locality: 'Koregaon Park',
    city: 'Pune',
    propertyType: 'apartment',
    builtUpArea: 1250,
    bedrooms: 2,
    bathrooms: 2,
    propertyAge: 3,
    amenities: ['Lake view', 'Covered parking', 'Gym', 'Clubhouse'],
    askingPrice: 22000000,
    status: 'active',
    images: [SAMPLE_LIVING_IMAGE],
    createdAt: '2026-09-09T14:05:00.000Z',
    ownerEmail: 'seller@propiq.dev',
  },

  // Pune — Baner
  {
    title: 'Baner Hillcrest Apartment',
    description:
      'A compact one-bedroom apartment in a low-rise block, five minutes from Baner Road, with covered parking and a lift in an eight-unit building.',
    locality: 'Baner',
    city: 'Pune',
    propertyType: 'apartment',
    builtUpArea: 620,
    bedrooms: 1,
    bathrooms: 1,
    propertyAge: 7,
    amenities: ['Covered parking', 'Lift'],
    askingPrice: 8800000,
    status: 'active',
    images: [SAMPLE_INTERIOR_IMAGE],
    createdAt: '2026-09-13T16:30:00.000Z',
    ownerEmail: 'seller@propiq.dev',
  },
  {
    title: 'Baner Riverside Apartment',
    description:
      'A three-bedroom apartment on the riverside stretch of Baner, with a wide balcony, a clubhouse, a gym, and rainwater harvesting already in place.',
    locality: 'Baner',
    city: 'Pune',
    propertyType: 'apartment',
    builtUpArea: 1850,
    bedrooms: 3,
    bathrooms: 3,
    propertyAge: 4,
    amenities: ['Private balcony', 'Covered parking', 'Clubhouse', 'Gym', 'Rainwater harvesting'],
    askingPrice: 24500000,
    status: 'inactive',
    images: [SAMPLE_LIVING_IMAGE, SAMPLE_EXTERIOR_IMAGE],
    createdAt: '2026-09-17T10:50:00.000Z',
    ownerEmail: 'seller@propiq.dev',
  },

  // Gurugram
  {
    title: 'Golf Course Road Sky Apartment',
    description:
      'A three-bedroom apartment high up on Golf Course Road, with a private balcony, a heated pool, a fully equipped gym, and staff on the gate at all hours.',
    locality: 'Gurugram',
    city: 'Gurugram',
    propertyType: 'apartment',
    builtUpArea: 2100,
    bedrooms: 3,
    bathrooms: 3,
    propertyAge: 2,
    amenities: ['Private balcony', 'Covered parking', 'Clubhouse', 'Pool', 'Gym', '24x7 security'],
    askingPrice: 38500000,
    status: 'active',
    images: [SAMPLE_LIVING_IMAGE, SAMPLE_EXTERIOR_IMAGE],
    createdAt: '2026-09-21T15:20:00.000Z',
    ownerEmail: 'seller@propiq.dev',
  },
  {
    title: 'Sohna Road Independent House',
    description:
      'A four-bedroom independent house off the Sohna Road, with a private lawn, a two-car garage, home automation, and separate staff quarters.',
    locality: 'Gurugram',
    city: 'Gurugram',
    propertyType: 'house',
    builtUpArea: 2600,
    bedrooms: 4,
    bathrooms: 4,
    propertyAge: 5,
    amenities: ['Private garden', 'Two-car garage', 'Smart home', 'Servant quarters', 'Power backup'],
    askingPrice: 43500000,
    status: 'sold',
    images: [SAMPLE_VILLA_IMAGE, SAMPLE_EXTERIOR_IMAGE],
    createdAt: '2026-09-25T13:10:00.000Z',
    ownerEmail: 'admin@propiq.dev',
  },
  {
    title: 'Gurugram Golf City Apartment',
    description:
      'A two-bedroom apartment in a quieter Golf City address, with a park view, a gym, a clubhouse, and covered parking for one car.',
    locality: 'Gurugram',
    city: 'Gurugram',
    propertyType: 'apartment',
    builtUpArea: 1150,
    bedrooms: 2,
    bathrooms: 2,
    propertyAge: 11,
    amenities: ['Covered parking', 'Gym', 'Clubhouse', 'Park view'],
    askingPrice: 19500000,
    status: 'active',
    images: [SAMPLE_INTERIOR_IMAGE],
    createdAt: '2026-09-30T17:45:00.000Z',
    ownerEmail: 'seller@propiq.dev',
  },
];

const upsertUser = async (seed) => {
  const existingUser = await User.findOne({ email: seed.email });

  if (existingUser) {
    existingUser.name = seed.name;
    existingUser.role = seed.role;
    existingUser.password = seed.password;
    await existingUser.save();
    return { user: existingUser, created: false };
  }

  const user = await User.create(seed);
  return { user, created: true };
};

const upsertProperty = async (seed, ownerId) => {
  const { ownerEmail, ...property } = seed;
  const existingProperty = await Property.findOne({ title: property.title });

  if (existingProperty) {
    existingProperty.set({ ...property, owner: ownerId });
    await existingProperty.save();

    // Re-assert the sample date after save: this development dataset must keep
    // the same history on every run, so the listing volume trend is stable.
    // Written straight through the driver because Mongoose would stamp `createdAt`
    // on insert only, and `{ timestamps: false }` is not honoured on an update in
    // Mongoose 8. The driver leaves `updatedAt` alone and stores a real Date.
    await Property.collection.updateOne(
      { _id: existingProperty._id },
      { $set: { createdAt: new Date(property.createdAt) } },
    );
    existingProperty.createdAt = new Date(property.createdAt);
    return { property: existingProperty, created: false };
  }

  const created = await Property.create({ ...property, owner: ownerId });
  return { property: created, created: true };
};

const run = async () => {
  if (env.nodeEnv === 'production') {
    console.error('Refusing to seed development data while NODE_ENV is "production".');
    process.exitCode = 1;
    return;
  }

  const connected = await connectDatabase();
  if (!connected || !isDatabaseReady()) {
    console.error('Cannot seed data: MongoDB is not connected. Check MONGODB_URI in server/.env.');
    process.exitCode = 1;
    return;
  }

  console.log('Seeding PropIQ development users (development credentials only):');
  const usersByEmail = new Map();
  for (const seed of SEED_USERS) {
    const { user, created } = await upsertUser(seed);
    usersByEmail.set(user.email, user);
    console.log(
      `  ${created ? 'created' : 'updated'}  ${user.role.padEnd(6)} ${user.email}  password: ${seed.password}`,
    );
  }

  console.log('\nSeeding PropIQ sample properties:');
  for (const seed of SEED_PROPERTIES) {
    const owner = usersByEmail.get(seed.ownerEmail);
    const { property, created } = await upsertProperty(seed, owner._id);
    console.log(
      `  ${created ? 'created' : 'updated'}  ${property.status.padEnd(8)} ${property.propertyType.padEnd(9)} ${property.title}`,
    );
  }

  console.log('\nSeed complete. These accounts and listings are for local development only.');
  await disconnectDatabase();
};

run().catch(async (error) => {
  console.error(`Seeding failed: ${error.message}`);
  await disconnectDatabase();
  process.exit(1);
});
