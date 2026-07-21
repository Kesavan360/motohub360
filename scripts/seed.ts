/*
 * seed.ts — MotoHub360 database seed script.
 *
 * MPD Task DB-10:
 *   "Seed script: insert initial Brand documents (6 brands), seed first
 *   real bike (GT 650, Royal Enfield), create admin account.
 *   Run via `npx tsx scripts/seed.ts`."
 *
 * WHAT THIS SCRIPT DOES:
 *   1. Connects to MongoDB Atlas using MONGODB_URI from .env.local
 *   2. Seeds 6 Brand documents (Royal Enfield, KTM, Yamaha, Honda, TVS, Bajaj)
 *   3. Seeds 1 complete Bike document (Royal Enfield GT 650)
 *   4. Seeds 1 Admin document (founder account)
 *   5. Disconnects from MongoDB
 *   6. Exits with code 0 (success) or 1 (failure)
 *
 * IDEMPOTENCY:
 *   The script is safe to run multiple times.
 *   For Brands: upsert by slug (update if exists, insert if not).
 *   For Bikes: upsert by slug (update if exists, insert if not).
 *   For Admin: upsert by email (update if exists, insert if not).
 *   No data is deleted — running twice does not create duplicates.
 *
 * HOW TO RUN:
 *   Ensure MONGODB_URI is set in .env.local, then:
 *
 *   npx tsx scripts/seed.ts
 *
 *   tsx is a TypeScript executor that runs .ts files without a build step.
 *   It respects the paths alias (@/*) via tsconfig.json.
 *
 * ENVIRONMENT:
 *   Reads MONGODB_URI and SEED_ADMIN_PASSWORD from process.env.
 *   MONGODB_URI:         required — MongoDB Atlas connection string
 *   SEED_ADMIN_PASSWORD: required — plaintext password for the admin account
 *                        Minimum 8 characters. Hashed with bcryptjs before storage.
 *                        Example: set in .env.local as SEED_ADMIN_PASSWORD=mypassword123
 *
 * SAFETY:
 *   Admin passwords are never hardcoded — always read from env vars.
 *   Running in production: the same script works — upserts are safe.
 *   The script exits immediately if MONGODB_URI is not set.
 *
 * CLOUDINARY IMAGES:
 *   The GT 650 bike document uses Cloudinary demo images as placeholders.
 *   Replace heroImageUrl and gallery[].url with real Cloudinary URLs
 *   after uploading official Royal Enfield GT 650 photography via the
 *   admin media upload (A-07).
 *
 * AFTER RUNNING:
 *   1. Visit http://localhost:3000/brands/royal-enfield — GT 650 appears
 *   2. Visit http://localhost:3000/category/cruiser — GT 650 appears
 *   3. Visit http://localhost:3000/price/2-5-lakh — GT 650 appears
 *   4. Visit http://localhost:3000/api/search/suggest?q=gt — GT 650 in suggestions
 *   5. Admin login: use the email + SEED_ADMIN_PASSWORD from .env.local
 */

import path from 'path'
import { config } from 'dotenv'
import mongoose from 'mongoose'

/*
 * Load .env.local before importing any module that reads process.env.
 * dotenv.config() must be called before the first import that accesses env vars.
 * path.resolve(__dirname, '../.env.local') points to the project root .env.local.
 */
config({ path: path.resolve(__dirname, '../.env.local') })

/*
 * Import models AFTER dotenv.config() so MONGODB_URI is available.
 * These imports trigger Mongoose model registration.
 */
import Brand from '../src/lib/db/models/Brand'
import Bike from '../src/lib/db/models/Bike'
import Admin, { hashPassword } from '../src/lib/db/models/Admin'

// ---------------------------------------------------------------------------
// Environment validation
// ---------------------------------------------------------------------------

const MONGODB_URI = process.env['MONGODB_URI']
const SEED_ADMIN_PASSWORD = process.env['SEED_ADMIN_PASSWORD']
const SEED_ADMIN_EMAIL =
  process.env['SEED_ADMIN_EMAIL'] ?? 'admin@motohub360.in'
const SEED_ADMIN_NAME =
  process.env['SEED_ADMIN_NAME'] ?? 'MotoHub360 Admin'

if (!MONGODB_URI) {
  console.error(
    '\n[seed] ❌ MONGODB_URI is not set.\n' +
      'Add MONGODB_URI to your .env.local file:\n' +
      'MONGODB_URI=mongodb+srv://[user]:[password]@[cluster].mongodb.net/motohub360\n',
  )
  process.exit(1)
}

if (!SEED_ADMIN_PASSWORD) {
  console.error(
    '\n[seed] ❌ SEED_ADMIN_PASSWORD is not set.\n' +
      'Add SEED_ADMIN_PASSWORD to your .env.local file:\n' +
      'SEED_ADMIN_PASSWORD=your-secure-password-here\n' +
      'Minimum 8 characters.\n',
  )
  process.exit(1)
}

if (SEED_ADMIN_PASSWORD.length < 8) {
  console.error(
    '\n[seed] ❌ SEED_ADMIN_PASSWORD must be at least 8 characters.\n',
  )
  process.exit(1)
}

// ---------------------------------------------------------------------------
// Brand seed data
// ---------------------------------------------------------------------------

/*
 * BRAND_SEED_DATA — the 6 initial curated brands for MotoHub360.
 * Values match constants/brands.ts (S-08) exactly:
 *   - slug and accentColor match BRANDS constant
 *   - defaultMetaDescription is the production SEO description
 *   - displayOrder controls the order in the brand grid
 */
const BRAND_SEED_DATA = [
  {
    slug: 'royal-enfield',
    name: 'Royal Enfield',
    accentColor: '#7A2E2E',
    defaultMetaDescription:
      'Explore all Royal Enfield motorcycles available in India. ' +
      'Find prices, specs, colours and on-road costs for Classic 350, ' +
      'Himalayan, GT 650, Meteor 350 and more on MotoHub360.',
    displayOrder: 1,
    isActive: true,
  },
  {
    slug: 'ktm',
    name: 'KTM',
    accentColor: '#FF6A00',
    defaultMetaDescription:
      'Explore all KTM motorcycles available in India. ' +
      'Find prices, specs, colours and on-road costs for Duke 125, ' +
      'Duke 250, Duke 390, RC 390 and Adventure 390 on MotoHub360.',
    displayOrder: 2,
    isActive: true,
  },
  {
    slug: 'yamaha',
    name: 'Yamaha',
    accentColor: '#1B3A8A',
    defaultMetaDescription:
      'Explore all Yamaha motorcycles available in India. ' +
      'Find prices, specs, colours and on-road costs for MT-15, ' +
      'R15M, FZ-S V3, MT-03 and R3 on MotoHub360.',
    displayOrder: 3,
    isActive: true,
  },
  {
    slug: 'honda',
    name: 'Honda',
    accentColor: '#C8102E',
    defaultMetaDescription:
      'Explore all Honda motorcycles available in India. ' +
      'Find prices, specs, colours and on-road costs for CB350RS, ' +
      'Hornet 2.0, CB200X, CBR 650R and CB500X on MotoHub360.',
    displayOrder: 4,
    isActive: true,
  },
  {
    slug: 'tvs',
    name: 'TVS',
    accentColor: '#0E7C7B',
    defaultMetaDescription:
      'Explore all TVS motorcycles available in India. ' +
      'Find prices, specs, colours and on-road costs for Apache RTR 310, ' +
      'Apache RR 310, Ronin, Raider 125 and Ntorq 125 on MotoHub360.',
    displayOrder: 5,
    isActive: true,
  },
  {
    slug: 'bajaj',
    name: 'Bajaj',
    accentColor: '#1F2937',
    defaultMetaDescription:
      'Explore all Bajaj motorcycles available in India. ' +
      'Find prices, specs, colours and on-road costs for Pulsar NS400Z, ' +
      'Dominar 400, Avenger Street 160 and Pulsar 150 on MotoHub360.',
    displayOrder: 6,
    isActive: true,
  },
]

// ---------------------------------------------------------------------------
// Bike seed data — Royal Enfield GT 650
// ---------------------------------------------------------------------------

/*
 * GT650_SEED_DATA — the first real bike listing on MotoHub360.
 *
 * All spec values are from the official Royal Enfield GT 650 datasheet.
 * Prices are ex-showroom Delhi as of mid-2024 (update via admin panel).
 *
 * Images: Cloudinary demo URLs as placeholders.
 * Replace with real Cloudinary URLs after admin media upload (A-07).
 *
 * The bike is seeded as 'published' so it appears immediately on listing
 * pages without requiring a manual publish step.
 */
const GT650_SEED_DATA = {
  slug: 'gt-650',
  brandSlug: 'royal-enfield',
  brandName: 'Royal Enfield',
  name: 'GT 650',
  tagline: 'Modern Classic Roadster',
  category: 'cruiser' as const,
  status: 'published' as const,
  publishedAt: new Date(),

  heroImageUrl:
    'https://res.cloudinary.com/demo/image/upload/v1/samples/landscapes/architecture-signs.jpg',
  blurDataUrl: undefined,

  gallery: [
    {
      url: 'https://res.cloudinary.com/demo/image/upload/v1/samples/landscapes/architecture-signs.jpg',
      alt: 'Royal Enfield GT 650 — front three-quarter view',
    },
    {
      url: 'https://res.cloudinary.com/demo/image/upload/v1/samples/landscapes/beach-boat.jpg',
      alt: 'Royal Enfield GT 650 — side profile',
    },
    {
      url: 'https://res.cloudinary.com/demo/image/upload/v1/samples/landscapes/girl-urban-view.jpg',
      alt: 'Royal Enfield GT 650 — rear three-quarter view',
    },
  ],

  colors: [
    {
      name: 'Ventura Blue',
      hex: '#2B4B8A',
    },
    {
      name: 'Mr Clean',
      hex: '#C0C0C0',
    },
    {
      name: 'British Racing Green',
      hex: '#1A3A2A',
    },
  ],

  pricing: {
    exShowroom: 348000,
    onRoad: 385000,
  },

  specs: {
    engine: {
      displacement: '648 cc',
      engineType: 'Parallel-twin, 4-stroke, SOHC, Air + Oil Cooled',
      maxPower: '47 bhp @ 7,150 rpm',
      maxTorque: '52 Nm @ 5,250 rpm',
      fuelSystem: 'Fuel Injection (EFI)',
      coolingType: 'Air + Oil Cooled',
      transmission: '6-speed constant mesh',
      clutch: 'Slipper / Assist Clutch',
      emission: 'BS6 Phase 2 OBD2',
      startingSystem: 'Electric',
    },
    dimensions: {
      kerbWeight: '202 kg',
      fuelCapacity: '13.7 litres',
      seatHeight: '790 mm',
      groundClearance: '174 mm',
      wheelbase: '1,400 mm',
      overallLength: '2,122 mm',
      overallWidth: '785 mm',
      overallHeight: '1,024 mm',
    },
    features: {
      abs: true,
      dualChannelAbs: true,
      tractionControl: false,
      ridingModes: [],
      bluetooth: false,
      usbCharging: true,
      quickshifter: false,
      autoblipper: false,
      cruiseControl: false,
      slipAssistClutch: true,
      ledLights: true,
      tft: false,
      navigation: false,
    },
  },

  seo: {
    metaTitle:
      'Royal Enfield GT 650 Price in India, Specs, Colours 2024 | MotoHub360',
    metaDescription:
      'Royal Enfield GT 650 price in India starts at ₹3.48 Lakh ex-showroom. ' +
      'Check GT 650 specs, mileage, colours, on-road price and images on MotoHub360.',
  },
}

// ---------------------------------------------------------------------------
// Seed functions
// ---------------------------------------------------------------------------

/*
 * seedBrands — upserts all 6 Brand documents.
 * Uses updateOne with upsert:true so running twice is safe.
 */
async function seedBrands(): Promise<void> {
  console.log('\n[seed] Seeding brands...')

  const results = await Promise.all(
    BRAND_SEED_DATA.map(async (brandData) => {
      const result = await Brand.updateOne(
        { slug: brandData.slug },
        { $set: brandData },
        { upsert: true },
      )

      const action =
        result.upsertedCount > 0
          ? 'inserted'
          : result.modifiedCount > 0
          ? 'updated'
          : 'unchanged'

      console.log(
        `  [brand] ${brandData.name} (${brandData.slug}) — ${action}`,
      )

      return { slug: brandData.slug, action }
    }),
  )

  const inserted = results.filter((r) => r.action === 'inserted').length
  const updated = results.filter((r) => r.action === 'updated').length
  const unchanged = results.filter((r) => r.action === 'unchanged').length

  console.log(
    `[seed] Brands complete: ${inserted} inserted, ${updated} updated, ${unchanged} unchanged`,
  )
}

/*
 * seedBikes — upserts the GT 650 bike document.
 * Sets publishedAt if inserting for the first time.
 * Does not overwrite publishedAt on subsequent runs.
 */
async function seedBikes(): Promise<void> {
  console.log('\n[seed] Seeding bikes...')

  /*
   * Check if the bike already exists to preserve publishedAt.
   * If it exists: $set all fields EXCEPT publishedAt (don't reset timestamp).
   * If it doesn't exist: $setOnInsert publishedAt + $set everything else.
   */
  const existing = await Bike.findOne({ slug: GT650_SEED_DATA.slug })

  if (existing) {
    /*
     * Bike exists — update all fields except publishedAt.
     * Preserve the original publishedAt timestamp.
     */
    const { publishedAt: _publishedAt, ...updateFields } = GT650_SEED_DATA

    await Bike.updateOne(
      { slug: GT650_SEED_DATA.slug },
      { $set: updateFields },
    )

    console.log(
      `  [bike] ${GT650_SEED_DATA.name} (${GT650_SEED_DATA.slug}) — updated (publishedAt preserved)`,
    )
  } else {
    /*
     * Bike does not exist — insert with publishedAt.
     * Bike.create() triggers the pre-save hook which sets publishedAt
     * correctly when status is 'published'.
     */
    await Bike.create(GT650_SEED_DATA)

    console.log(
      `  [bike] ${GT650_SEED_DATA.name} (${GT650_SEED_DATA.slug}) — inserted (status: published)`,
    )
  }

  console.log('[seed] Bikes complete.')
}

/*
 * seedAdmin — upserts the founder admin account.
 *
 * Password is hashed with bcryptjs (cost 12) before storage.
 * Uses the standalone hashPassword() export from Admin model (DB-04).
 *
 * SECURITY: SEED_ADMIN_PASSWORD is read from .env.local — never hardcoded.
 */
async function seedAdmin(plainPassword: string): Promise<void> {
  console.log('\n[seed] Seeding admin...')

  /*
   * Hash the password before upsert.
   * bcryptjs cost 12 takes ~250ms — normal for a seed script.
   */
  const passwordHash = await hashPassword(plainPassword)

  /*
   * Check if admin already exists.
   * We don't use updateOne with $set for the admin because:
   *   1. passwordHash changes every run (bcryptjs salt is random)
   *   2. We should not reset the password on every seed run
   *
   * Strategy:
   *   - If admin exists: do NOT update passwordHash (preserve existing)
   *   - If admin doesn't exist: create with hashed password
   */
  const existing = await Admin.findOne({ email: SEED_ADMIN_EMAIL })

  if (existing) {
    /*
     * Admin exists — update name and role only.
     * Do NOT update passwordHash — preserve the existing password
     * (admin may have changed it via the admin panel in Phase 9).
     */
    await Admin.updateOne(
      { email: SEED_ADMIN_EMAIL },
      {
        $set: {
          name: SEED_ADMIN_NAME,
          role: 'superadmin',
          isActive: true,
        },
      },
    )

    console.log(
      `  [admin] ${SEED_ADMIN_EMAIL} — updated (password preserved)`,
    )
  } else {
    /*
     * Admin does not exist — create with hashed password.
     * Admin model's pre-save hook normalises email to lowercase.
     */
    await Admin.create({
      email: SEED_ADMIN_EMAIL,
      passwordHash,
      name: SEED_ADMIN_NAME,
      role: 'superadmin',
      isActive: true,
      lastLoginAt: null,
    })

    console.log(
      `  [admin] ${SEED_ADMIN_EMAIL} — created (role: superadmin)`,
    )
  }

  console.log('[seed] Admin complete.')
}

// ---------------------------------------------------------------------------
// Main seed function
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  console.log('\n╔══════════════════════════════════════╗')
  console.log('║     MotoHub360 Database Seed         ║')
  console.log('╚══════════════════════════════════════╝')
  console.log(`\n[seed] Connecting to MongoDB...`)
  console.log(
    `[seed] URI: ${MONGODB_URI!.replace(/:([^@]+)@/, ':****@')}`,
  )

  try {
    /*
     * Connect directly (not via the singleton connectDB) because
     * this script runs outside of Next.js — the global cache is not
     * needed for a one-shot seed script.
     */
    await mongoose.connect(MONGODB_URI!, {
      bufferCommands: false,
      serverSelectionTimeoutMS: 15_000,
      socketTimeoutMS: 45_000,
      family: 4,
    })

    console.log('[seed] ✓ Connected to MongoDB')
    console.log(
      `[seed] Database: ${mongoose.connection.db?.databaseName ?? 'unknown'}`,
    )

    /*
     * Run seed functions in sequence.
     * Order matters: brands must exist before bikes (brandSlug reference).
     * Admin is independent and can run in any order.
     */
    await seedBrands()
    await seedBikes()
    await seedAdmin(SEED_ADMIN_PASSWORD!)

    /*
     * Summary
     */
    console.log('\n╔══════════════════════════════════════╗')
    console.log('║     Seed completed successfully ✓    ║')
    console.log('╚══════════════════════════════════════╝')
    console.log('\nNext steps:')
    console.log(
      '  1. Visit http://localhost:3000/brands/royal-enfield',
    )
    console.log('  2. Visit http://localhost:3000/category/cruiser')
    console.log('  3. Visit http://localhost:3000/price/2-5-lakh')
    console.log(
      '  4. Visit http://localhost:3000/api/search/suggest?q=gt',
    )
    console.log(
      `  5. Admin login: ${SEED_ADMIN_EMAIL} / [your SEED_ADMIN_PASSWORD]`,
    )
    console.log('')
  } catch (error) {
    console.error('\n[seed] ❌ Seed failed:')
    console.error(
      error instanceof Error ? error.message : String(error),
    )

    if (
      error instanceof Error &&
      error.message.includes('ECONNREFUSED')
    ) {
      console.error('\n  → MongoDB is not reachable.')
      console.error('    Check your MONGODB_URI in .env.local')
      console.error('    Ensure your IP is whitelisted in Atlas Network Access')
    }

    if (
      error instanceof Error &&
      error.message.includes('Authentication failed')
    ) {
      console.error('\n  → Authentication failed.')
      console.error(
        '    Check the username and password in your MONGODB_URI',
      )
    }

    process.exit(1)
  } finally {
    await mongoose.disconnect()
    console.log('[seed] Disconnected from MongoDB')
  }
}

/*
 * Run the seed script.
 * main() is async — wrap in .catch() to ensure unhandled rejections
 * exit with code 1 rather than being silently swallowed.
 */
main().catch((error: unknown) => {
  console.error('[seed] Unhandled error:', error)
  process.exit(1)
})