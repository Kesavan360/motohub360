# MotoHub360 — Master Development Plan v2
## Post-Audit Implementation Roadmap

> **Source of truth:** Full codebase audit conducted August 2026.
> All task statuses, file paths, and findings are derived from direct
> inspection of the actual source files — not from prior documentation.
>
> **Do not modify this file to reflect "planned" state — only update it
> as tasks are actually completed and verified.**

---

## Table of Contents

1. [Project Status Summary](#1-project-status-summary)
2. [Actual Architecture](#2-actual-architecture)
3. [Feature Status Registry](#3-feature-status-registry)
4. [P0 / P1 / P2 / P3 Issue Catalogue](#4-p0--p1--p2--p3-issue-catalogue)
5. [Implementation Tasks](#5-implementation-tasks)
6. [Task Dependency Graph](#6-task-dependency-graph)
7. [Recommended Implementation Order](#7-recommended-implementation-order)
8. [Production-Launch Checklist](#8-production-launch-checklist)

---

## 1. Project Status Summary

| Dimension | Status |
|---|---|
| Framework | Next.js 16.2.10, React 19.2.4, TypeScript 5 (strict) |
| Database layer | ✅ Production-ready |
| Admin auth (login/session/middleware) | ✅ Production-ready |
| Admin content mutations (create/edit/publish/delete) | ❌ Return 501 in production |
| Bike detail page | ✅ Production-ready |
| Public listing pages (brand/category/price) | ⚠️ Render correctly; FilterBar is inert |
| Homepage | ⚠️ Functional; hero shows mock placeholder images |
| Search suggestions (autocomplete) | ✅ Production-ready |
| Search results page | ❌ Returns mock data only; no DB query |
| FilterBar (all listing pages) | ❌ UI renders; zero functionality wired |
| Global site navigation (header/footer) | ❌ Absent from all public pages |
| SEO / metadata / sitemap | ✅ Production-ready |
| ISR / cache invalidation | ✅ Architecture correct (blocked by admin mutation bug) |
| Build safety | ✅ Builds without DB available |
| Vercel deployment config | ❌ No vercel.json |
| Overall production-readiness | ~60–65% |

**The single highest-leverage fix:** Replace `isAdminAuthenticated()` with real session auth in two API route files. This unblocks all admin content mutations and makes the admin panel functional in production.

---

## 2. Actual Architecture

### 2.1 Technology Stack

```
Next.js 16.2.10 (App Router)
React 19.2.4
TypeScript 5 (strict mode)
MongoDB Atlas → Mongoose 8.24.1
iron-session 8.0.4 (cookie auth)
bcryptjs 3.0.3 (password hashing, cost 12)
Cloudinary 2.10.0 (media storage)
Tailwind CSS v4 (utility + design tokens)
SWR 2.4.2 (installed, unused)
```

### 2.2 Project Directory Structure (as-built)

```
motohub360/
├── src/
│   ├── app/
│   │   ├── layout.tsx                    # Root layout — no header/footer
│   │   ├── page.tsx                      # Home — thin server wrapper
│   │   ├── HomePageClient.tsx            # Home client component
│   │   ├── globals.css                   # Global CSS reset
│   │   ├── error.tsx                     # Error boundary (has SiteHeader+Footer)
│   │   ├── not-found.tsx                 # 404 page (has SiteHeader+Footer)
│   │   ├── sitemap.ts                    # Dynamic sitemap
│   │   ├── robots.ts                     # robots.txt
│   │   ├── brands/
│   │   │   ├── page.tsx                  # /brands — all brands hub
│   │   │   └── [brand]/page.tsx          # /brands/[brand] — brand listing
│   │   ├── bikes/
│   │   │   └── [brandSlug]/[slug]/page.tsx  # /bikes/[brandSlug]/[slug]
│   │   ├── category/
│   │   │   └── [category]/page.tsx       # /category/[category]
│   │   ├── price/
│   │   │   └── [range]/page.tsx          # /price/[range]
│   │   ├── search/
│   │   │   └── page.tsx                  # /search?q=... (mock data)
│   │   ├── admin/
│   │   │   ├── layout.tsx                # Admin shell (auth check NOT implemented)
│   │   │   ├── page.tsx                  # /admin dashboard
│   │   │   ├── login/page.tsx            # /admin/login
│   │   │   ├── bikes/page.tsx            # /admin/bikes list
│   │   │   ├── bikes/new/page.tsx        # /admin/bikes/new
│   │   │   ├── bikes/[slug]/edit/page.tsx # /admin/bikes/[slug]/edit
│   │   │   ├── upload-test/              # Dev scaffold — should not ship
│   │   │   └── gallery-test/             # Dev scaffold — should not ship
│   │   └── api/
│   │       ├── admin/
│   │       │   ├── login/route.ts        # POST — real auth
│   │       │   ├── logout/route.ts       # POST — real auth
│   │       │   ├── slug-check/route.ts   # GET — real auth
│   │       │   └── upload/route.ts       # POST — real auth + Cloudinary
│   │       ├── bikes/
│   │       │   ├── route.ts              # GET (real) / POST (501 in prod)
│   │       │   └── [id]/
│   │       │       ├── route.ts          # GET (real) / PUT+DELETE (501 in prod)
│   │       │       └── publish/route.ts  # POST+DELETE (501 in prod)
│   │       ├── search/
│   │       │   └── suggest/route.ts      # GET — Atlas Search + fallback
│   │       └── upload/
│   │           └── sign/route.ts         # POST — signed Cloudinary upload
│   ├── components/
│   │   ├── admin/
│   │   │   ├── BikeEditMediaClient.tsx
│   │   │   ├── BikeFormBasic.tsx         # Lint errors
│   │   │   ├── BikeFormGallery.tsx       # Many unused handlers
│   │   │   ├── BikeFormPricing.tsx
│   │   │   ├── BikeFormSEO.tsx
│   │   │   ├── BikeFormShell.tsx         # Lint errors; submit blocked in prod
│   │   │   ├── BikeFormSpecifications.tsx
│   │   │   ├── BikeListTable.tsx         # DEAD CODE — not imported anywhere
│   │   │   ├── BikeTable.tsx             # Live bike list table
│   │   │   ├── GalleryUploader.tsx
│   │   │   └── MediaUploader.tsx
│   │   ├── bike/
│   │   │   ├── Bike360Viewer.tsx         # Lint errors
│   │   │   ├── BikeColorSelector.tsx
│   │   │   ├── BikeFeaturesList.tsx
│   │   │   ├── BikeGallery.tsx
│   │   │   ├── BikeHero.tsx              # Lint error
│   │   │   ├── BikeMobileActionBar.tsx
│   │   │   └── BikeSpecTable.tsx
│   │   ├── layout/
│   │   │   ├── AdminSidebar.tsx
│   │   │   ├── Breadcrumb.tsx
│   │   │   ├── Footer.tsx                # Built; NOT used on public pages
│   │   │   ├── Header.tsx                # Built; NOT used on public pages
│   │   │   ├── HeaderCompact.tsx         # Built; NOT used on public pages
│   │   │   └── SiteHeader.tsx            # Built; only on error.tsx/not-found.tsx
│   │   ├── listing/
│   │   │   ├── BikeCard.tsx
│   │   │   ├── BikeGrid.tsx
│   │   │   ├── BrandLogoChip.tsx
│   │   │   ├── CategoryPills.tsx
│   │   │   ├── FilterBar.tsx             # Built; onChange not passed by any parent
│   │   │   └── PriceRangePills.tsx
│   │   ├── search/
│   │   │   ├── SearchBar.tsx
│   │   │   ├── SearchBarCompact.tsx
│   │   │   └── SearchSuggestions.tsx
│   │   └── ui/
│   │       ├── AccentPulse.tsx
│   │       ├── Button.tsx
│   │       ├── Icon.tsx
│   │       └── Skeleton.tsx
│   ├── lib/
│   │   ├── auth.ts                       # getAdminSession / requireAdminSession / withAdminAuth
│   │   ├── bike-form-validation.ts
│   │   ├── cloudinary.ts
│   │   ├── mockData.ts                   # STILL IN USE on homepage — must be replaced
│   │   ├── session.ts                    # iron-session config
│   │   ├── db/
│   │   │   ├── atlasSearch.ts
│   │   │   ├── mongodb.ts                # Connection singleton
│   │   │   └── models/
│   │   │       ├── Admin.ts
│   │   │       ├── Bike.ts
│   │   │       └── Brand.ts
│   │   └── seo/
│   │       ├── bike-json-ld.ts
│   │       ├── canonical-redirects.ts
│   │       ├── home-metadata.ts
│   │       └── site-url.ts
│   ├── types/
│   │   ├── api.ts
│   │   ├── bike-form.ts
│   │   ├── bike.ts
│   │   ├── brand.ts
│   │   └── cloudinary.ts
│   ├── constants/
│   │   ├── brands.ts                     # Static brand data + BRAND_ACCENT_MAP
│   │   ├── categories.ts                 # 5 fixed categories
│   │   └── priceRanges.ts               # 4 fixed price ranges
│   ├── hooks/
│   │   ├── useScrollReveal.ts
│   │   ├── useSearch.ts
│   │   └── useStickyHeader.ts
│   └── styles/
│       └── admin.css
├── scripts/
│   └── seed.ts                           # DB seed (brands + 1 bike + admin)
├── public/                               # Static assets (logos, icons, fonts)
├── middleware.ts                         # Edge auth guard for /admin/*
├── next.config.ts                        # Cloudinary remotePatterns + redirects
├── tailwind.config.ts
├── tsconfig.json
├── .env.example
├── lint-output.txt                       # SHOULD BE GITIGNORED — committed by accident
├── tsconfig.tsbuildinfo                  # SHOULD BE GITIGNORED — committed by accident
└── "e 9MPDroadmap ..."                   # ACCIDENTAL FILE — grep output saved as filename
```

### 2.3 Environment Variables

| Variable | Required | Used by | Status |
|---|---|---|---|
| `MONGODB_URI` | Yes | All DB operations | Throws clear error if missing |
| `CLOUDINARY_CLOUD_NAME` | Yes | Upload routes | Validated at upload time |
| `CLOUDINARY_API_KEY` | Yes | Upload routes | Validated at upload time |
| `CLOUDINARY_API_SECRET` | Yes | Upload routes, sign route | Server-only; never sent to client |
| `SESSION_SECRET` | Yes | iron-session, middleware | 32+ chars required; login throws if missing |
| `NEXT_PUBLIC_SITE_URL` | Recommended | Metadata canonical URLs, sitemap | Graceful degradation if missing; canonical URLs break |
| `SEED_ADMIN_PASSWORD` | Seed only | `scripts/seed.ts` | Read from env at seed time |
| `REVALIDATE_SECRET` | ❌ Unused | Nothing | In `.env.example` but no code reads it |

### 2.4 Rendering Strategy (as-built)

| Route | Strategy | Revalidate |
|---|---|---|
| `/` | SSG (page.tsx) + Client (HomePageClient) | Static metadata; client renders |
| `/brands` | SSR with try/catch DB fallback | — |
| `/brands/[brand]` | ISR | 3600s (1hr) + revalidatePath on publish |
| `/category/[category]` | ISR | 3600s (1hr) + revalidatePath on publish |
| `/price/[range]` | ISR | 3600s (1hr) + revalidatePath on publish |
| `/bikes/[brandSlug]/[slug]` | ISR | 300s (5min) + revalidatePath on publish |
| `/search` | SSR (force-dynamic) | Never cached |
| `/sitemap.xml` | Generated at request | — |
| `/admin/*` | SSR (force-dynamic) | Never cached |

---

## 3. Feature Status Registry

### 3.1 COMPLETE — Production-Ready

| Feature | Key Files |
|---|---|
| MongoDB connection singleton | `src/lib/db/mongodb.ts` |
| Bike Mongoose model | `src/lib/db/models/Bike.ts` |
| Admin Mongoose model | `src/lib/db/models/Admin.ts` |
| Brand Mongoose model | `src/lib/db/models/Brand.ts` |
| Admin login API | `src/app/api/admin/login/route.ts` |
| Admin logout API | `src/app/api/admin/logout/route.ts` |
| Slug uniqueness check API | `src/app/api/admin/slug-check/route.ts` |
| Cloudinary upload API | `src/app/api/admin/upload/route.ts` |
| Signed upload API | `src/app/api/upload/sign/route.ts` |
| Edge auth middleware | `middleware.ts` |
| Session utilities | `src/lib/session.ts`, `src/lib/auth.ts` |
| GET /api/bikes (public) | `src/app/api/bikes/route.ts` |
| GET /api/bikes/[id] (public) | `src/app/api/bikes/[id]/route.ts` |
| Search suggest API | `src/app/api/search/suggest/route.ts` |
| Atlas Search utilities | `src/lib/db/atlasSearch.ts` |
| Bike detail page (B-01 → B-08) | `src/app/bikes/[brandSlug]/[slug]/page.tsx` + all `src/components/bike/*.tsx` |
| Brand listing page | `src/app/brands/[brand]/page.tsx` |
| All brands hub | `src/app/brands/page.tsx` |
| Category listing page | `src/app/category/[category]/page.tsx` |
| Price range listing page | `src/app/price/[range]/page.tsx` |
| Admin dashboard | `src/app/admin/page.tsx` |
| Admin login page | `src/app/admin/login/page.tsx` |
| Admin bike list page | `src/app/admin/bikes/page.tsx`, `src/components/admin/BikeTable.tsx` |
| Dynamic sitemap | `src/app/sitemap.ts` |
| robots.txt | `src/app/robots.ts` |
| JSON-LD on bike detail | `src/lib/seo/bike-json-ld.ts` |
| generateMetadata on all pages | All `page.tsx` files |
| Canonical URL redirects | `src/lib/seo/canonical-redirects.ts`, `next.config.ts` |
| ISR + revalidatePath architecture | `src/app/api/bikes/[id]/publish/route.ts` |
| DB seed script | `scripts/seed.ts` |
| BikeCard, BikeGrid, BrandLogoChip | `src/components/listing/` |
| CategoryPills, PriceRangePills | `src/components/listing/` |
| SearchBar, SearchSuggestions | `src/components/search/` |
| Error and 404 pages | `src/app/error.tsx`, `src/app/not-found.tsx` |
| useScrollReveal, useSearch, useStickyHeader | `src/hooks/` |
| Tailwind v4 + design tokens | `tailwind.config.ts`, `src/app/globals.css` |

### 3.2 PARTIAL — Exists but Incomplete

| Feature | What's There | What's Missing | Key Files |
|---|---|---|---|
| Admin bike create form | UI (BikeFormShell + all section components) | Submit → POST /api/bikes returns 501 in prod | `src/app/admin/bikes/new/page.tsx`, `src/components/admin/BikeFormShell.tsx` |
| Admin bike edit form | UI + data loading | PUT /api/bikes/[id] returns 501 in prod | `src/app/admin/bikes/[slug]/edit/page.tsx` |
| Admin layout auth | Comment documents intent | Actual `getAdminSession()` call never written | `src/app/admin/layout.tsx` |
| FilterBar | Full UI built, onChange prop defined | No parent passes onChange; filters do nothing | `src/components/listing/FilterBar.tsx` |
| Search results page | Page renders, breadcrumb, FilterBar, BikeGrid | getMockSearchResults() instead of DB query | `src/app/search/page.tsx` |
| Homepage hero | BikeHero component wired | `MOCK_FEATURED_BIKES` with demo Cloudinary URLs | `src/app/HomePageClient.tsx`, `src/lib/mockData.ts` |
| BikeFormGallery | State management + drag handlers defined | handleAddGalleryItem and 8 other handlers unused | `src/components/admin/BikeFormGallery.tsx` |
| Global navigation | Header.tsx, HeaderCompact.tsx, SiteHeader.tsx, Footer.tsx built | Not in root layout; absent from all public pages | `src/app/layout.tsx`, `src/components/layout/` |

### 3.3 BROKEN — Present but Non-Functional

| Feature | Root Cause | Impact |
|---|---|---|
| POST /api/bikes (create) | `isAdminAuthenticated()` returns `false` in prod | Admin cannot create bikes in prod |
| PUT /api/bikes/[id] (edit) | Same | Admin cannot edit bikes in prod |
| DELETE /api/bikes/[id] | Same | Admin cannot delete bikes in prod |
| POST /api/bikes/[id]/publish | Same | Admin cannot publish bikes in prod |
| DELETE /api/bikes/[id]/publish | Same | Admin cannot unpublish bikes in prod |
| FilterBar on all listing pages | onChange not passed by any parent | Filter UI renders; changes nothing |
| Search results (/search) | getMockSearchResults() hardcoded | Returns fake data regardless of real DB content |

---

## 4. P0 / P1 / P2 / P3 Issue Catalogue

### P0 — Production Blockers

| ID | Issue | Files | Impact |
|---|---|---|---|
| P0-1 | `isAdminAuthenticated()` returns `false` in production → all bike mutation APIs return 501 | `src/app/api/bikes/route.ts`, `src/app/api/bikes/[id]/route.ts`, `src/app/api/bikes/[id]/publish/route.ts` | Admin cannot create, edit, publish, or delete any bike in production |
| P0-2 | FilterBar `onChange` not wired on any listing page → filter UI is completely non-functional | `src/app/brands/[brand]/page.tsx`, `src/app/category/[category]/page.tsx`, `src/app/price/[range]/page.tsx`, `src/app/search/page.tsx`, `src/components/listing/FilterBar.tsx` | Core product navigation feature broken for all users |
| P0-3 | Search results page uses `getMockSearchResults()` → never returns real bikes from DB | `src/app/search/page.tsx` | Search is non-functional end-to-end |

### P1 — Critical Quality Issues

| ID | Issue | Files | Impact |
|---|---|---|---|
| P1-1 | Homepage hero uses `MOCK_FEATURED_BIKES` with Cloudinary demo placeholder URLs | `src/app/HomePageClient.tsx`, `src/lib/mockData.ts` | Homepage looks unfinished; references images from Cloudinary demo account |
| P1-2 | No global site header or footer on any public page (home, brands, category, price, bike detail, search) | `src/app/layout.tsx` | Users have no consistent site-wide navigation |
| P1-3 | Admin layout auth guard described in comment but never implemented — function body does not call `getAdminSession()` | `src/app/admin/layout.tsx` | Tertiary auth protection layer missing; middleware is the only enforced guard |
| P1-4 | 3 unconditional `console.log` calls in search suggest API run in production on every request | `src/app/api/search/suggest/route.ts` lines 132, 183, 184 | Pollutes production logs; marginal performance cost per request |

### P2 — Significant but Non-Blocking

| ID | Issue | Files | Impact |
|---|---|---|---|
| P2-1 | No `vercel.json` — Vercel's 4.5MB request body limit will silently block `bike_360` video uploads (up to 50MB) | Root — `vercel.json` does not exist | 360° video feature broken on Vercel without config |
| P2-2 | React Compiler lint errors: refs accessed during render in `HomePageClient.tsx` (3 errors at lines 201, 211, 215) | `src/app/HomePageClient.tsx` | Will cause unexpected behaviour with React Compiler plugin; scroll reveal animations may break |
| P2-3 | React Compiler lint errors: setState called synchronously inside effects in multiple components | `src/components/admin/BikeFormShell.tsx`, `src/components/admin/BikeFormBasic.tsx`, `src/components/bike/Bike360Viewer.tsx`, `src/components/bike/BikeHero.tsx`, `src/components/admin/BikeFormGallery.tsx`, `src/components/admin/BikeFormPricing.tsx` | Cascading renders; potential infinite loops in prod |
| P2-4 | `<img>` used instead of `<Image />` in `BikeEditMediaClient.tsx` line 253 | `src/components/admin/BikeEditMediaClient.tsx` | Degrades LCP; missing automatic image optimisation |
| P2-5 | `BikeListTable.tsx` is dead code — 352 lines, not imported anywhere | `src/components/admin/BikeListTable.tsx` | Dead weight; maintenance confusion |
| P2-6 | `swr` package installed but never used anywhere in the codebase | `package.json` | Unnecessary bundle overhead |
| P2-7 | `dotenv` is a runtime dependency (`dependencies`) but only needed for the seed script | `package.json` | Minor: should be `devDependencies` |
| P2-8 | `REVALIDATE_SECRET` in `.env.example` but no code reads it | `.env.example` | Documentation misleads; unused env var |

### P3 — Technical Debt and Polish

| ID | Issue | Files | Impact |
|---|---|---|---|
| P3-1 | Accidental file with grep command as filename in repo root (17KB) | `e 9MPDroadmap --include=...` (root) | Confusing; should be deleted and path added to `.gitignore` |
| P3-2 | `lint-output.txt` (36KB, Windows paths) committed to repo | `lint-output.txt` (root) | Committed artefact; should be gitignored |
| P3-3 | `tsconfig.tsbuildinfo` (174KB) committed to repo | `tsconfig.tsbuildinfo` (root) | Committed build cache; should be gitignored |
| P3-4 | `OBJECT_ID_REGEX`, `buildBikeQuery()`, `isAdminAuthenticated()` duplicated identically in two API route files | `src/app/api/bikes/[id]/route.ts`, `src/app/api/bikes/[id]/publish/route.ts` | DRY violation; two places to update if logic changes |
| P3-5 | Many unused handler functions in `BikeFormGallery.tsx` (handleAddGalleryItem, handleRemoveGalleryItem, handleGalleryItemChange, handleGalleryItemBlur, handleItemDragStart, handleItemDragEnter, handleItemDragOver, handleItemDragLeave, handleItemDrop, handleItemDragEnd, canAddImage) | `src/components/admin/BikeFormGallery.tsx` | Scaffold code not connected to UI; lint warnings |
| P3-6 | `SESSION_SECRET ?? ''` fallback in sessionOptions — empty string passed to iron-session if env var missing | `src/lib/session.ts` | Misleading fallback; iron-session will throw at runtime, but `''` suggests it might work |
| P3-7 | Canonical URL built with `${process.env.NEXT_PUBLIC_SITE_URL}` directly in some `generateMetadata()` calls instead of `absoluteUrl()` helper | `src/app/brands/page.tsx`, `src/app/brands/[brand]/page.tsx`, `src/app/category/[category]/page.tsx`, `src/app/price/[range]/page.tsx` | If env var missing, canonical becomes `undefined/brands` — malformed URL sent to Google |
| P3-8 | Atlas Search `bikes_search` index must be manually created in MongoDB Atlas UI — no automation or migration script | `src/lib/db/atlasSearch.ts`, `scripts/seed.ts` | Setup gap; search degrades to regex until index exists |
| P3-9 | `admin/upload-test` and `admin/gallery-test` dev pages exist in the production route tree | `src/app/admin/upload-test/`, `src/app/admin/gallery-test/` | Dev scaffolding routes accessible in production |
| P3-10 | `SectionStub` component defined but unused in BikeFormShell | `src/components/admin/BikeFormShell.tsx` | Dead code; lint warning |
| P3-11 | `brandAccentMap` variable defined but unused in BikeFormShell | `src/components/admin/BikeFormShell.tsx` | Lint warning |
| P3-12 | `aria-pressed` on `role="region"` in BikeFormGallery (line 445) — invalid ARIA | `src/components/admin/BikeFormGallery.tsx` | Accessibility violation |

---

## 5. Implementation Tasks

Each task is self-contained with exact files, changes, dependencies, acceptance criteria, and test steps.

---

### PHASE 7 — Database & API (Fixing Production Blockers)

---

#### Task DB-FIX-01
**Fix admin bike mutation APIs — replace auth placeholder with real session check**

| Field | Value |
|---|---|
| **Task ID** | DB-FIX-01 |
| **Phase** | 7 — Database & API |
| **Priority** | P0-1 |
| **Current Status** | BROKEN in production |
| **Risk Level** | LOW — localised change, no architectural impact |

**Objective**
Replace `isAdminAuthenticated()` (which returns `false` in production) with real `getAdminSession()` calls in the three bike mutation API files. This single change unblocks all admin content management in production.

**Exact Files Involved**
- `src/app/api/bikes/route.ts`
- `src/app/api/bikes/[id]/route.ts`
- `src/app/api/bikes/[id]/publish/route.ts`

**What Needs to Change**

In `src/app/api/bikes/route.ts` — `POST` handler:
- Remove the `NODE_ENV !== 'development'` guard that returns 501.
- Import `getAdminSession` from `@/lib/auth` and `cookies` from `next/headers`.
- Add `getAdminSession()` check at the top of the POST handler; return 401 if no session.
- Remove the `isAdminAuthenticated` placeholder function.

In `src/app/api/bikes/[id]/route.ts` — `PUT` and `DELETE` handlers:
- Remove `isAdminAuthenticated()` function definition.
- Import `getAdminSession` from `@/lib/auth` and `cookies` from `next/headers`.
- Replace `if (!isAdminAuthenticated())` with a real session check returning 401.
- In `GET` handler: add session check to allow admins to fetch draft bikes (currently locked to `status: 'published'`).

In `src/app/api/bikes/[id]/publish/route.ts` — `POST` and `DELETE` handlers:
- Remove `isAdminAuthenticated()` function definition.
- Import `getAdminSession` from `@/lib/auth` and `cookies` from `next/headers`.
- Replace auth placeholder with real session check returning 401.

Also extract shared utilities to a new file to eliminate duplication (see Task P3-UTIL-01 — can be done simultaneously or separately):
- `OBJECT_ID_REGEX`
- `buildBikeQuery()`

**Dependencies**
- None. `getAdminSession` and `requireAdminSession` already exist in `src/lib/auth.ts`.

**Acceptance Criteria**
1. `POST /api/bikes` returns 201 when called with a valid admin session and valid bike payload.
2. `POST /api/bikes` returns 401 (not 501) when called without a session.
3. `PUT /api/bikes/[id]` returns 200 when called with a valid admin session.
4. `PUT /api/bikes/[id]` returns 401 when called without a session.
5. `DELETE /api/bikes/[id]` returns 200 when called with a valid admin session.
6. `POST /api/bikes/[id]/publish` returns 200 when called with a valid admin session on a draft bike.
7. `DELETE /api/bikes/[id]/publish` returns 200 when called with a valid admin session on a published bike.
8. `GET /api/bikes/[id]` with admin session can retrieve draft bikes.
9. `GET /api/bikes/[id]` without session only retrieves published bikes.
10. Admin bike create form (`/admin/bikes/new`) successfully creates a bike and redirects.
11. Admin bike edit form (`/admin/bikes/[slug]/edit`) successfully saves changes.
12. Publish/unpublish buttons in BikeTable work correctly.

**Testing / Verification**
```bash
# 1. Seed DB and create admin
npx tsx scripts/seed.ts

# 2. Start dev server
npm run dev

# 3. Test mutation without session (should be 401)
curl -X POST http://localhost:3000/api/bikes \
  -H "Content-Type: application/json" \
  -d '{"name":"test"}' | jq '.error'

# 4. Log in via browser: http://localhost:3000/admin/login
# 5. Use browser DevTools Application → Cookies to copy session cookie value

# 6. Test mutation with session (should be 201 or validation error, not 501)
curl -X POST http://localhost:3000/api/bikes \
  -H "Content-Type: application/json" \
  -H "Cookie: motohub360-admin-session=<cookie>" \
  -d '{"name":"test"}' | jq '.'

# 7. In browser: navigate to /admin/bikes/new and submit a complete bike form
# 8. Verify new bike appears in /admin/bikes
# 9. Click publish — verify bike appears on /brands/[brandSlug]
```

---

#### Task DB-FIX-02
**Wire FilterBar on all listing pages**

| Field | Value |
|---|---|
| **Task ID** | DB-FIX-02 |
| **Phase** | 7 — Database & API |
| **Priority** | P0-2 |
| **Current Status** | BROKEN — FilterBar renders, does nothing |
| **Risk Level** | MEDIUM — changes are in Server Components; requires router integration |

**Objective**
Connect `FilterBar`'s `onChange` prop on every listing page so that filter selections update the URL and re-fetch data. Use URL search params as the filter state source of truth (SSR-friendly, shareable, back-button safe).

**Exact Files Involved**
- `src/app/brands/[brand]/page.tsx`
- `src/app/category/[category]/page.tsx`
- `src/app/price/[range]/page.tsx`
- `src/app/search/page.tsx`
- `src/components/listing/FilterBar.tsx` (read-only: already has onChange prop; no changes needed to component itself)

**What Needs to Change**

The listing pages are Server Components. FilterBar is `'use client'`. The integration pattern:

1. `FilterBar` accepts `onChange: (values: FilterValues) => void` — already implemented.
2. Create a thin `'use client'` wrapper component (e.g. `FilterBarConnector`) that reads `searchParams` from the URL and calls `router.replace()` with updated params when `onChange` fires. **Or** convert the onChange to push URL params.
3. Each listing page Server Component reads `searchParams` and applies them as additional filters to the MongoDB query.

For `brands/[brand]/page.tsx`:
- Accept `searchParams: Promise<{ category?: string; priceMin?: string; priceMax?: string; sort?: string }>`.
- Pass active filter values from searchParams to `FilterBar` as `initialValues`.
- Apply filter values to the `Bike.find()` query (category, price range, sort order).
- Pass `onChange` that calls `router.replace` with updated params.

For `category/[category]/page.tsx`:
- Same pattern; `category` filter pre-applied and hidden.
- Sort and price range filters active.

For `price/[range]/page.tsx`:
- Same pattern; price range pre-applied and hidden.
- Category and sort filters active.

For `search/page.tsx`:
- Same pattern (see also Task DB-FIX-03 which replaces mock data).

**Dependencies**
- None from other tasks (can be done before or after DB-FIX-01).

**Acceptance Criteria**
1. On `/brands/royal-enfield`, selecting "Adventure" in the category filter shows only adventure bikes from Royal Enfield.
2. On `/category/cruiser`, selecting a price range filter shows only cruisers in that price range.
3. Selecting a sort order (price ascending) re-renders the grid sorted correctly.
4. Filter selections persist on page refresh (stored in URL params).
5. The browser back button restores the previous filter state.
6. Selecting "Reset" clears all filters and restores the full listing.
7. Filters that are already "hidden" on a page (`hiddenFilters` prop) are not changeable via URL params either.

**Testing / Verification**
```bash
# Start dev server with seeded DB
npm run dev

# Navigate to /brands/royal-enfield
# Select "Adventure" in category filter
# Verify URL becomes /brands/royal-enfield?category=adventure
# Verify BikeGrid shows only adventure bikes
# Reload page — verify filter state preserved
# Click back — verify filter state reverts

# Navigate to /category/cruiser
# Select sort "Price: Low to High"
# Verify bikes re-order by price ascending
```

---

#### Task DB-FIX-03
**Replace mock search results with real MongoDB query**

| Field | Value |
|---|---|
| **Task ID** | DB-FIX-03 |
| **Phase** | 7 — Database & API |
| **Priority** | P0-3 |
| **Current Status** | BROKEN — mock data only |
| **Risk Level** | LOW — isolated to search/page.tsx; Atlas Search fallback already exists |

**Objective**
Replace `getMockSearchResults()` and the hardcoded `SEARCHABLE_BIKES` array in `src/app/search/page.tsx` with a real MongoDB query. The search suggest API (`/api/search/suggest`) already implements Atlas Search with regex fallback — reuse the same approach.

**Exact Files Involved**
- `src/app/search/page.tsx`

**What Needs to Change**
- Remove `SEARCHABLE_BIKES` constant (35-item hardcoded array).
- Remove `getMockSearchResults()` function.
- Add `connectDB()` call and `Bike.find()` or `Bike.aggregate()` with Atlas Search.
- Reuse or import `buildSuggestPipeline` / `buildFallbackRegexFilter` from `src/lib/db/atlasSearch.ts`.
- Apply filter values from `searchParams` (connects with DB-FIX-02).
- Add pagination (limit: 24, or implement cursor/page param).

The page is already `export const dynamic = 'force-dynamic'` — no caching changes needed.

**Dependencies**
- None blocking. Can be implemented before DB-FIX-01 and DB-FIX-02.
- Integrating with DB-FIX-02 FilterBar wiring enhances the feature but is not required.

**Acceptance Criteria**
1. Searching for "GT 650" returns the Royal Enfield GT 650 from the database (if seeded).
2. Searching for "royal enfield" returns all Royal Enfield bikes in the DB.
3. Searching for a term with no matches shows the empty state message.
4. Results are real `BikeSummary` objects from MongoDB, not mock objects.
5. Each result card links to the correct `/bikes/[brandSlug]/[slug]` page.
6. `getMockSearchResults` function is removed from the codebase.
7. `SEARCHABLE_BIKES` constant is removed from the codebase.

**Testing / Verification**
```bash
# Seed DB (requires at least 1 published bike)
npx tsx scripts/seed.ts

# Start dev server
npm run dev

# Navigate to http://localhost:3000/search?q=gt+650
# Verify Royal Enfield GT 650 appears in results
# Click result — verify bike detail page loads

# Search for a term with no real matches (e.g. "zzz")
# Verify empty state is shown

# Verify mock data constants are gone:
grep -n "SEARCHABLE_BIKES\|getMockSearchResults" src/app/search/page.tsx
# Expected: no output
```

---

### PHASE 4 — Home Page

---

#### Task HP-FIX-01
**Replace homepage hero mock data with real featured bikes from DB**

| Field | Value |
|---|---|
| **Task ID** | HP-FIX-01 |
| **Phase** | 4 — Home Page |
| **Priority** | P1-1 |
| **Current Status** | PARTIAL — hero shows Cloudinary demo images |
| **Risk Level** | LOW — component accepts any `FeaturedBike[]`; only data source changes |

**Objective**
Replace `MOCK_FEATURED_BIKES` in `HomePageClient.tsx` with real published bikes fetched from MongoDB. Move the data fetch to the server component (`page.tsx`) and pass bikes as props.

**Exact Files Involved**
- `src/app/page.tsx`
- `src/app/HomePageClient.tsx`
- `src/lib/mockData.ts`

**What Needs to Change**
- `src/app/page.tsx`: Add `connectDB()` + `Bike.find({ status: 'published' }).limit(5).sort({ publishedAt: -1 })`. Pass results as `featuredBikes` prop to `HomePageClient`.
- `src/app/HomePageClient.tsx`: Accept `featuredBikes: FeaturedBike[]` prop. Replace `MOCK_FEATURED_BIKES` usage with prop. Remove `MOCK_FEATURED_BIKES` import.
- `src/lib/mockData.ts`: Remove `MOCK_FEATURED_BIKES` export once no longer imported. (If file becomes empty, can be deleted.)

Graceful fallback: if DB returns 0 bikes, render hero without rotating images (show site name / static placeholder) rather than crashing.

**Dependencies**
- Requires at least one published bike in the database (seed script covers this).

**Acceptance Criteria**
1. Homepage hero displays real bike hero images from MongoDB.
2. No import of `MOCK_FEATURED_BIKES` or `mockData.ts` remains in page files.
3. If DB has 0 published bikes, homepage renders without crashing (graceful fallback).
4. Metadata (from `buildHomeMetadata`) is unchanged and still exported from `page.tsx`.

**Testing / Verification**
```bash
npx tsx scripts/seed.ts  # Ensure at least 1 published bike exists
npm run dev
# Navigate to http://localhost:3000
# Verify hero shows real bike image (Royal Enfield GT 650 hero image)
# Verify hero rotates if multiple bikes are available

# Test empty state:
# Comment out seed data temporarily or use a fresh DB
# Verify homepage renders without error
```

---

### PHASE 3 — Core Layout

---

#### Task LAYOUT-01
**Add global SiteHeader and Footer to the root layout**

| Field | Value |
|---|---|
| **Task ID** | LAYOUT-01 |
| **Phase** | 3 — Core Layout |
| **Priority** | P1-2 |
| **Current Status** | MISSING — header/footer absent from all public pages |
| **Risk Level** | MEDIUM — touches root layout; affects all public pages; admin pages must be excluded |

**Objective**
Add `SiteHeader` and `Footer` to the root layout so all public pages have consistent navigation. Admin pages must not receive the public header/footer (they use `AdminSidebar` in their own layout).

**Exact Files Involved**
- `src/app/layout.tsx`
- `src/components/layout/SiteHeader.tsx` (already built)
- `src/components/layout/Footer.tsx` (already built)

**What Needs to Change**
- `src/app/layout.tsx`: Import `SiteHeader` and `Footer`. Wrap `{children}` with header above and footer below.
- Admin pages are under `src/app/admin/` which have their own `layout.tsx` inheriting from root. Two options:
  - **Option A (recommended):** Move `SiteHeader` and `Footer` out of the root layout and into individual page layouts (`brands/layout.tsx`, `bikes/layout.tsx`, etc.) — more work but cleaner.
  - **Option B (simpler):** Keep in root layout but conditionally hide via CSS on `/admin/*` routes. However, the admin layout's own sidebar replaces navigation — collision risk.
  - **Option C:** Use a route group — create `(public)/layout.tsx` wrapping all public routes with header/footer, and `admin/layout.tsx` remains unchanged.

The cleanest approach is **Option C** (route groups). Move public page directories into `src/app/(public)/`. This avoids CSS hacks and is the idiomatic Next.js App Router pattern.

Alternatively if route group restructuring is too risky, **Option A** (per-section layouts) works without moving files.

**Dependencies**
- None.

**Acceptance Criteria**
1. `SiteHeader` appears on `/`, `/brands`, `/brands/[brand]`, `/category/[category]`, `/price/[range]`, `/bikes/[brandSlug]/[slug]`, `/search`.
2. `Footer` appears on the same pages.
3. Admin pages (`/admin`, `/admin/login`, `/admin/bikes/*`) do NOT show `SiteHeader` or `Footer`.
4. `error.tsx` and `not-found.tsx` continue to work (they import SiteHeader/Footer directly — no duplicate render if root layout is restructured).
5. Header scroll behaviour (SiteHeader swaps Header → HeaderCompact on scroll) works correctly.

**Testing / Verification**
```bash
npm run dev

# Verify header on public pages:
# http://localhost:3000/ — SiteHeader present
# http://localhost:3000/brands — SiteHeader present
# http://localhost:3000/bikes/royal-enfield/gt-650 — SiteHeader present

# Verify admin pages are clean:
# http://localhost:3000/admin — No SiteHeader, AdminSidebar present
# http://localhost:3000/admin/login — No SiteHeader, no AdminSidebar

# Verify no layout duplication:
# error.tsx and not-found.tsx should not render double headers
```

---

### PHASE 9 — Admin Panel

---

#### Task ADMIN-FIX-01
**Implement admin layout authentication guard**

| Field | Value |
|---|---|
| **Task ID** | ADMIN-FIX-01 |
| **Phase** | 9 — Admin Panel |
| **Priority** | P1-3 |
| **Current Status** | PARTIAL — auth check described in comment but not implemented |
| **Risk Level** | LOW — middleware already guards routes; this adds a second layer |

**Objective**
Implement the auth check in `src/app/admin/layout.tsx` that the file documents but never actually executes. The layout must call `getAdminSession()` and redirect to `/admin/login` if no session — except when the current path IS `/admin/login` (to prevent infinite redirect loop).

**Exact Files Involved**
- `src/app/admin/layout.tsx`

**What Needs to Change**
- Import `getAdminSession` from `@/lib/auth`.
- Import `headers` from `next/headers`.
- Read the current pathname from the `next-url` or `x-invoke-path` header.
- If pathname does not start with `/admin/login` AND `getAdminSession()` returns null → `redirect('/admin/login')`.
- If session exists, optionally pass `adminSession.name` to `AdminSidebar` (currently `AdminSidebar` renders without user data).

**Dependencies**
- Middleware (A-04) already guards routes. This is belt-and-suspenders.
- No dependency on DB-FIX-01.

**Acceptance Criteria**
1. Direct navigation to `/admin` (without session cookie) results in redirect to `/admin/login`.
2. The check does not redirect when on `/admin/login` itself.
3. A valid session allows the admin layout to render normally.
4. `AdminSidebar` can optionally display the logged-in admin's name if session data is passed down.

**Testing / Verification**
```bash
npm run dev
# Clear cookies in browser
# Navigate directly to http://localhost:3000/admin/bikes
# Verify redirect to /admin/login
# Log in — verify redirect back to admin area
# Navigate to /admin/login while logged in — should redirect to /admin (middleware handles this)
```

---

#### Task ADMIN-FIX-02
**Remove console.log leaks from search suggest API**

| Field | Value |
|---|---|
| **Task ID** | ADMIN-FIX-02 |
| **Phase** | 9 — Admin Panel / SEO & Performance |
| **Priority** | P1-4 |
| **Current Status** | IMPLEMENTED BUT RISKY |
| **Risk Level** | VERY LOW — delete 3 lines |

**Objective**
Remove three unconditional `console.log` calls in `/api/search/suggest/route.ts` that run on every request in production. These are debug statements left from development and were never gated behind `NODE_ENV === 'development'`.

**Exact Files Involved**
- `src/app/api/search/suggest/route.ts`

**What Needs to Change**
- Line 132: `console.log("Atlas Results:", results)` — remove.
- Lines 183–184: `console.log("FILTER:", filter)` and `console.log("Fallback Results:", fallbackResults)` — remove.

The existing `NODE_ENV === 'development'` guarded logs (lines 134–140, 191–196) are correct and should remain.

**Dependencies**
- None. Can be done independently at any time.

**Acceptance Criteria**
1. The three unconditional `console.log` lines no longer exist in the file.
2. The `NODE_ENV === 'development'`-guarded log lines are untouched.
3. Search suggest API continues to function correctly (Atlas Search + regex fallback).

**Testing / Verification**
```bash
# Verify lines are gone
grep -n 'console.log("Atlas Results' src/app/api/search/suggest/route.ts  # should return nothing
grep -n 'console.log("FILTER' src/app/api/search/suggest/route.ts          # should return nothing
grep -n 'console.log("Fallback' src/app/api/search/suggest/route.ts        # should return nothing

# Verify API still works
npm run dev
curl "http://localhost:3000/api/search/suggest?q=gt" | jq '.suggestions | length'
# Should return a number >= 0
```

---

### PHASE 10 — SEO & Performance

---

#### Task PERF-01
**Create vercel.json for upload route configuration**

| Field | Value |
|---|---|
| **Task ID** | PERF-01 |
| **Phase** | 10 — SEO & Performance |
| **Priority** | P2-1 |
| **Current Status** | MISSING |
| **Risk Level** | LOW — new file, no existing code changes |

**Objective**
Create `vercel.json` at the project root to configure the Cloudinary upload route with an appropriate `maxDuration` and to signal that the route accepts large request bodies (needed for `bike_360` video uploads up to 50MB).

**Exact Files Involved**
- `vercel.json` — create new

**What Needs to Change**
Create `/home/claude/motohub360/vercel.json`:
```json
{
  "functions": {
    "src/app/api/admin/upload/route.ts": {
      "maxDuration": 60,
      "memory": 1024
    }
  }
}
```

Additionally, Vercel project settings must have "Body Size Limit" increased in the dashboard (cannot be done via vercel.json alone for very large files).

**Dependencies**
- None.

**Acceptance Criteria**
1. `vercel.json` exists at the project root.
2. Upload route configured with `maxDuration: 60` and `memory: 1024`.
3. `next build` completes without error with `vercel.json` present.
4. On Vercel deployment, the upload route does not timeout on a 10MB+ image upload.

**Testing / Verification**
```bash
# Verify file exists
cat vercel.json

# Verify build
npm run build

# After Vercel deployment:
# Upload a bike hero image > 5MB via the admin upload UI
# Verify no 413 or timeout error
```

---

#### Task PERF-02
**Fix React Compiler errors in HomePageClient — refs during render**

| Field | Value |
|---|---|
| **Task ID** | PERF-02 |
| **Phase** | 10 — SEO & Performance |
| **Priority** | P2-2 |
| **Current Status** | LINT ERRORS — 3 errors at lines 201, 211, 215 |
| **Risk Level** | LOW — scroll reveal hook fix; visual change only if hook was broken |

**Objective**
Fix the React Compiler violation where `useScrollReveal()` returns a `ref` object that is accessed directly in JSX. The `.ref` property should not be read during render — refs must only be accessed in event handlers and effects.

**Exact Files Involved**
- `src/app/HomePageClient.tsx`
- `src/hooks/useScrollReveal.ts`

**What Needs to Change**
The `useScrollReveal` hook returns `{ ref, isVisible }`. The JSX uses `ref={brandSection.ref as React.RefObject<HTMLElement>}`. The React Compiler errors at lines 201, 211, 215 are from `brandSection.isVisible` — reading `.isVisible` (which depends on the ref) during render.

Fix options:
- **Option A:** Restructure `useScrollReveal` to return a stable callback ref (`(el) => { ... }`) instead of a `RefObject`, eliminating the need to access `.current` during render.
- **Option B:** Use `useRef` to store `isVisible` separately so React Compiler can see it's not a ref read during render.

The hook implementation in `useScrollReveal.ts` must be inspected and updated accordingly.

**Dependencies**
- None.

**Acceptance Criteria**
1. No React Compiler `react-hooks/refs` errors in `HomePageClient.tsx`.
2. Scroll reveal animations on brand chips, category pills, and price pills still function (sections animate in when scrolled into view).
3. `npm run lint` shows 0 errors for `HomePageClient.tsx`.

**Testing / Verification**
```bash
npm run lint 2>&1 | grep "HomePageClient"
# Expected: no errors (possibly warnings)

npm run dev
# Navigate to http://localhost:3000
# Scroll down — verify brand chips animate in
# Verify category and price sections also animate in on scroll
```

---

#### Task PERF-03
**Fix setState-in-effect lint errors across admin and bike components**

| Field | Value |
|---|---|
| **Task ID** | PERF-03 |
| **Phase** | 10 — SEO & Performance |
| **Priority** | P2-3 |
| **Current Status** | LINT ERRORS — multiple files |
| **Risk Level** | MEDIUM — touching multiple complex client components |

**Objective**
Fix React Compiler violations where `setState` is called synchronously inside `useEffect` bodies, causing cascading render loops. Each affected component must be audited and the anti-pattern corrected.

**Exact Files Involved**
- `src/components/admin/BikeFormShell.tsx` (lines 131, 140, 141, 168, 176, 190, 235, 301, 347)
- `src/components/admin/BikeFormBasic.tsx` (lines 409, 484)
- `src/components/bike/Bike360Viewer.tsx` (lines 235, 252)
- `src/components/bike/BikeHero.tsx` (line 252)
- `src/components/admin/BikeFormGallery.tsx` (line 484)
- `src/components/admin/BikeFormPricing.tsx`

**What Needs to Change**
For each `setState` call inside `useEffect`:
- If the effect is initialising state from props → move to `useState(initialValue)` using the prop directly.
- If the effect is responding to a prop change → use `useMemo` or `useReducer` instead.
- If the effect is triggering a derived state update → eliminate the intermediate state and compute the value inline.

Each file requires careful individual analysis. Do not blindly remove effects — understand what each is doing before changing it.

**Dependencies**
- Should be done after admin API routes are fixed (DB-FIX-01) to test the form flows.
- PERF-02 (useScrollReveal ref fix) is independent.

**Acceptance Criteria**
1. `npm run lint` returns 0 errors for all files listed above.
2. Bike create/edit forms continue to function (values persist, validation fires).
3. `Bike360Viewer` loads and plays the 360° video.
4. `BikeHero` rotates through featured bikes.
5. No infinite render loops observable in React DevTools.

**Testing / Verification**
```bash
npm run lint 2>&1 | grep "setState synchronously"
# Expected: 0 results

npm run dev
# Navigate to /admin/bikes/new — fill form, verify no flicker/loop
# Navigate to /bikes/royal-enfield/gt-650 — verify 360 viewer loads if video present
# Verify BikeHero rotates on homepage
```

---

#### Task PERF-04
**Replace `<img>` with `<Image />` in BikeEditMediaClient**

| Field | Value |
|---|---|
| **Task ID** | PERF-04 |
| **Phase** | 10 — SEO & Performance |
| **Priority** | P2-4 |
| **Current Status** | LINT ERROR — line 253 |
| **Risk Level** | VERY LOW — one-line change |

**Objective**
Replace the plain `<img>` element at line 253 of `BikeEditMediaClient.tsx` with Next.js `<Image />` to enable automatic optimisation.

**Exact Files Involved**
- `src/components/admin/BikeEditMediaClient.tsx`

**What Needs to Change**
- Import `Image` from `next/image` if not already imported.
- Replace `<img src={...} />` with `<Image src={...} alt={...} width={...} height={...} />`.
- Ensure the Cloudinary URL is within the configured `remotePatterns` in `next.config.ts` (it is — `res.cloudinary.com` is already whitelisted).

**Dependencies**
- None.

**Acceptance Criteria**
1. `npm run lint` returns 0 `no-img-element` errors.
2. Admin media panel shows uploaded images correctly.
3. No visual regression in the admin media section.

**Testing / Verification**
```bash
npm run lint 2>&1 | grep "no-img-element"
# Expected: 0 results

npm run dev
# Navigate to /admin/bikes/[slug]/edit
# Upload an image — verify it displays in the media panel
```

---

### PHASE 11 — QA & Testing

---

#### Task QA-01
**Remove dead BikeListTable component**

| Field | Value |
|---|---|
| **Task ID** | QA-01 |
| **Phase** | 11 — QA & Testing |
| **Priority** | P2-5 |
| **Current Status** | DEAD CODE — not imported anywhere |
| **Risk Level** | VERY LOW — confirm no imports, then delete |

**Objective**
Delete `src/components/admin/BikeListTable.tsx` which is a 352-line legacy component not imported by any file. `BikeTable.tsx` is the live implementation.

**Exact Files Involved**
- `src/components/admin/BikeListTable.tsx` — delete

**What Needs to Change**
1. Confirm zero imports: `grep -rn "BikeListTable" src/` should return 0 results.
2. Delete the file.

**Dependencies**
- None.

**Acceptance Criteria**
1. `src/components/admin/BikeListTable.tsx` does not exist.
2. `grep -rn "BikeListTable" src/` returns 0 results.
3. `npm run build` succeeds.
4. `/admin/bikes` page still renders correctly with `BikeTable.tsx`.

**Testing / Verification**
```bash
grep -rn "BikeListTable" src/
# Expected: 0 results

npm run build
# Expected: no errors
```

---

#### Task QA-02
**Remove unused `swr` dependency and move `dotenv` to devDependencies**

| Field | Value |
|---|---|
| **Task ID** | QA-02 |
| **Phase** | 11 — QA & Testing |
| **Priority** | P2-6 / P2-7 |
| **Current Status** | INSTALLED — never used |
| **Risk Level** | VERY LOW — no code references either package |

**Objective**
Remove `swr` from `package.json` dependencies (installed but never imported). Move `dotenv` from `dependencies` to `devDependencies` (only used in `scripts/seed.ts`).

**Exact Files Involved**
- `package.json`
- `package-lock.json` (auto-updated by npm)

**What Needs to Change**
```bash
npm uninstall swr
npm uninstall dotenv && npm install --save-dev dotenv
```

**Dependencies**
- None.

**Acceptance Criteria**
1. `swr` not present in `package.json` `dependencies` or `devDependencies`.
2. `dotenv` present in `devDependencies`, not `dependencies`.
3. `npm run build` succeeds.
4. `npx tsx scripts/seed.ts` still works (dotenv loaded correctly as devDep).
5. No import of `swr` anywhere in the codebase: `grep -rn "from 'swr'" src/` returns 0.

**Testing / Verification**
```bash
grep -rn "from 'swr'" src/
# Expected: 0 results

npm run build
npx tsx scripts/seed.ts
```

---

### PHASE 12 — Deployment

---

#### Task DEP-01
**Clean up accidental and committed build artefacts**

| Field | Value |
|---|---|
| **Task ID** | DEP-01 |
| **Phase** | 12 — Deployment |
| **Priority** | P3-1 / P3-2 / P3-3 |
| **Current Status** | PRESENT — three files should not be in the repo |
| **Risk Level** | VERY LOW — deleting non-code files |

**Objective**
Delete the three accidental/build artefact files from the repository root and add their patterns to `.gitignore`.

**Exact Files Involved**
- `e 9MPDroadmap --include=.ts ...` (root) — accidental grep output saved as filename
- `lint-output.txt` (root) — committed ESLint output
- `tsconfig.tsbuildinfo` (root) — committed TypeScript build cache

**What Needs to Change**
1. Delete all three files.
2. Add to `.gitignore`:
   ```
   lint-output.txt
   tsconfig.tsbuildinfo
   ```
   (The accidental grep file has a unique enough name that a gitignore pattern may not be worth adding — deletion is sufficient.)

**Dependencies**
- None.

**Acceptance Criteria**
1. None of the three files exist in the working directory.
2. `lint-output.txt` and `tsconfig.tsbuildinfo` are in `.gitignore`.
3. `npm run build` generates a fresh `tsconfig.tsbuildinfo` that is immediately ignored.
4. `npm run lint` output is not saved to a file automatically.

**Testing / Verification**
```bash
ls lint-output.txt tsconfig.tsbuildinfo 2>&1
# Expected: "No such file or directory"

cat .gitignore | grep "tsbuildinfo\|lint-output"
# Expected: both patterns present

npm run build && ls tsconfig.tsbuildinfo
# File regenerated; verify git status shows it as untracked (ignored)
```

---

#### Task DEP-02
**Remove REVALIDATE_SECRET from .env.example or implement its usage**

| Field | Value |
|---|---|
| **Task ID** | DEP-02 |
| **Phase** | 12 — Deployment |
| **Priority** | P2-8 |
| **Current Status** | MISLEADING — documented but unused |
| **Risk Level** | VERY LOW — documentation-only change |

**Objective**
`REVALIDATE_SECRET` appears in `.env.example` but no code in the project reads it. Either remove it from `.env.example` to eliminate confusion, or implement a revalidation endpoint that uses it for external cache purge triggers (webhook-style). For now, remove it unless there is a concrete plan to implement the endpoint.

**Exact Files Involved**
- `.env.example`

**What Needs to Change**
- Remove the `REVALIDATE_SECRET=replace_with_32_plus_character_random_string` line from `.env.example`.
- **Or** implement `src/app/api/revalidate/route.ts` that accepts a `secret` header and calls `revalidatePath` on specified paths.

**Dependencies**
- None.

**Acceptance Criteria**
1. `REVALIDATE_SECRET` is either removed from `.env.example` or has a real implementation that uses it.
2. No dangling undocumented env var references.

---

#### Task DEP-03
**Remove admin dev scaffold routes from production**

| Field | Value |
|---|---|
| **Task ID** | DEP-03 |
| **Phase** | 12 — Deployment |
| **Priority** | P3-9 |
| **Current Status** | PRESENT — dev scaffolding in production route tree |
| **Risk Level** | LOW — auth-protected; not a security risk but adds noise |

**Objective**
Remove `/admin/upload-test` and `/admin/gallery-test` from the production route tree. These are development scaffolding pages that were never intended to ship.

**Exact Files Involved**
- `src/app/admin/upload-test/` — delete directory
- `src/app/admin/gallery-test/` — delete directory

**Dependencies**
- None. Ensure no links to these pages exist in `AdminSidebar.tsx` or anywhere else.

**Acceptance Criteria**
1. `src/app/admin/upload-test/` does not exist.
2. `src/app/admin/gallery-test/` does not exist.
3. No links to these routes exist in the admin sidebar or any navigation component.
4. `npm run build` succeeds.

---

### PHASE 7 — Database & API (Utilities)

---

#### Task P3-UTIL-01
**Extract shared utilities from duplicate API route files**

| Field | Value |
|---|---|
| **Task ID** | P3-UTIL-01 |
| **Phase** | 7 — Database & API |
| **Priority** | P3-4 |
| **Current Status** | DUPLICATED — same code in two files |
| **Risk Level** | LOW — refactor only; no behaviour change |

**Objective**
Extract `OBJECT_ID_REGEX`, `buildBikeQuery()`, and the now-removed `isAdminAuthenticated()` from both API route files into a shared utility module to eliminate duplication.

**Exact Files Involved**
- `src/lib/db/utils.ts` — create new
- `src/app/api/bikes/[id]/route.ts` — update imports
- `src/app/api/bikes/[id]/publish/route.ts` — update imports

**What Needs to Change**
Create `src/lib/db/utils.ts` with:
```typescript
// OBJECT_ID_REGEX
// buildBikeQuery(id: string) function
```
Both route files import from `@/lib/db/utils` instead of defining locally.

**Dependencies**
- Should be done alongside or after DB-FIX-01 (since that task also touches these files).

**Acceptance Criteria**
1. `OBJECT_ID_REGEX` defined only once (in `src/lib/db/utils.ts`).
2. `buildBikeQuery` defined only once (in `src/lib/db/utils.ts`).
3. Both route files import from `@/lib/db/utils`.
4. `npm run build` succeeds.
5. All API routes continue to function correctly.

---

#### Task P3-SEO-01
**Standardise canonical URL generation using absoluteUrl() helper**

| Field | Value |
|---|---|
| **Task ID** | P3-SEO-01 |
| **Phase** | 10 — SEO & Performance |
| **Priority** | P3-7 |
| **Current Status** | INCONSISTENT — some pages use `process.env` directly |
| **Risk Level** | LOW — SEO metadata change; no user-visible UI change |

**Objective**
Replace direct `${process.env.NEXT_PUBLIC_SITE_URL}/...` string construction in `generateMetadata()` functions with the `absoluteUrl()` helper from `src/lib/seo/site-url.ts`. This ensures consistent canonical URL generation and graceful handling when the env var is missing.

**Exact Files Involved**
- `src/app/brands/page.tsx`
- `src/app/brands/[brand]/page.tsx`
- `src/app/category/[category]/page.tsx`
- `src/app/price/[range]/page.tsx`

**What Needs to Change**
In each file:
- Import `absoluteUrl` from `@/lib/seo/site-url`.
- Replace `${process.env.NEXT_PUBLIC_SITE_URL}/brands` with `absoluteUrl('/brands')`.
- Same pattern for OpenGraph `url` and `alternates.canonical`.

**Dependencies**
- None.

**Acceptance Criteria**
1. No `process.env.NEXT_PUBLIC_SITE_URL` string concatenation in any `generateMetadata()` function.
2. All four files use `absoluteUrl()` for canonical and OG URLs.
3. Canonical URLs are correct in page source (verify with browser DevTools).

---

#### Task P3-A11Y-01
**Fix invalid ARIA role in BikeFormGallery**

| Field | Value |
|---|---|
| **Task ID** | P3-A11Y-01 |
| **Phase** | 11 — QA & Testing |
| **Priority** | P3-12 |
| **Current Status** | LINT WARNING — invalid ARIA |
| **Risk Level** | VERY LOW — admin-only component |

**Objective**
Remove `aria-pressed` attribute from the element with `role="region"` at line 445 of `BikeFormGallery.tsx`. The `aria-pressed` attribute is not supported on the `region` role.

**Exact Files Involved**
- `src/components/admin/BikeFormGallery.tsx`

**What Needs to Change**
- Line 445: Remove `aria-pressed` attribute, or change the element's role to one that supports it (e.g. `role="button"` if it's actually interactive).

**Dependencies**
- None.

**Acceptance Criteria**
1. `npm run lint` returns 0 `jsx-a11y/role-supports-aria-props` errors.
2. Gallery section in the admin form is visually unchanged.

---

#### Task P3-SESS-01
**Fix SESSION_SECRET empty string fallback**

| Field | Value |
|---|---|
| **Task ID** | P3-SESS-01 |
| **Phase** | 9 — Admin Panel |
| **Priority** | P3-6 |
| **Current Status** | RISKY PATTERN |
| **Risk Level** | LOW — runtime behaviour change only when env var missing |

**Objective**
Replace `process.env.SESSION_SECRET ?? ''` in `sessionOptions` with a pattern that makes the missing env var immediately obvious, rather than passing an empty string to iron-session.

**Exact Files Involved**
- `src/lib/session.ts`

**What Needs to Change**
Change:
```typescript
password: process.env.SESSION_SECRET ?? '',
```
To:
```typescript
password: process.env.SESSION_SECRET ?? (() => {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('[MotoHub360] SESSION_SECRET is required in production.')
  }
  return 'dev-session-secret-not-for-production-use-only'
})(),
```
Or simply remove the `?? ''` so iron-session receives `undefined` and throws its own descriptive error. The `validateSessionSecret()` function already does a proper check — ensure it's called early enough.

**Dependencies**
- None.

**Acceptance Criteria**
1. `sessionOptions.password` does not have `?? ''` fallback.
2. Starting the server without `SESSION_SECRET` in development gives a clear error message.
3. Admin login continues to work with `SESSION_SECRET` set.

---

## 6. Task Dependency Graph

```
DB-FIX-01 (Fix mutation APIs)
  └── Enables: Admin create/edit/publish bike forms to work in prod
  └── Can be done alongside: P3-UTIL-01 (extract shared utils from same files)

DB-FIX-02 (Wire FilterBar)
  └── Enables: Useful filtering on brand/category/price pages
  └── Enhanced by: DB-FIX-03 (FilterBar on search page also benefits)

DB-FIX-03 (Real search results)
  └── Independent — no blockers
  └── Enhanced by: DB-FIX-02 (filter integration on search results)

HP-FIX-01 (Homepage real data)
  └── Requires: At least 1 published bike in DB (seed script handles this)
  └── Independent of: DB-FIX-01, DB-FIX-02, DB-FIX-03

LAYOUT-01 (Global header/footer)
  └── Independent of all other tasks
  └── Should be done early — affects all public pages

ADMIN-FIX-01 (Admin layout auth)
  └── Independent — middleware already guards routes
  └── Low urgency but complete the security story

ADMIN-FIX-02 (Remove console.log)
  └── Fully independent — can be done any time

PERF-01 (vercel.json)
  └── Fully independent — new file only

PERF-02 (Fix HomePageClient refs)
  └── Fully independent

PERF-03 (Fix setState-in-effects)
  └── Easier to test after DB-FIX-01 (admin forms need working APIs)

PERF-04 (Replace <img>)
  └── Fully independent

QA-01 (Delete BikeListTable)
  └── Fully independent — verify no imports first

QA-02 (Remove swr, move dotenv)
  └── Fully independent

DEP-01 (Clean artefact files)
  └── Fully independent — do early to keep repo clean

DEP-02 (REVALIDATE_SECRET)
  └── Fully independent — docs only

DEP-03 (Remove dev scaffold routes)
  └── Fully independent — verify no sidebar links first

P3-UTIL-01 (Extract shared utils)
  └── Best done alongside DB-FIX-01 (same files)

P3-SEO-01 (Standardise absoluteUrl)
  └── Fully independent

P3-A11Y-01 (Fix ARIA role)
  └── Fully independent

P3-SESS-01 (Fix session secret fallback)
  └── Fully independent
```

**Critical path for production launch:**
```
DB-FIX-01 → ADMIN-FIX-01 → HP-FIX-01 → LAYOUT-01 → DB-FIX-02 → DB-FIX-03 → ADMIN-FIX-02 → PERF-01
```

---

## 7. Recommended Implementation Order

### Wave 1 — Unblock Production (P0 + immediate P1)
These must be done before any real content can be managed or the site can launch.

| Order | Task ID | Priority | Time Estimate | Safe Independently? |
|---|---|---|---|---|
| 1 | DB-FIX-01 | P0 | 1–2 hrs | ✅ Yes |
| 2 | ADMIN-FIX-02 | P1 | 15 min | ✅ Yes |
| 3 | DB-FIX-03 | P0 | 2–3 hrs | ✅ Yes |
| 4 | ADMIN-FIX-01 | P1 | 1 hr | ✅ Yes |
| 5 | P3-UTIL-01 | P3 | 30 min | ✅ With DB-FIX-01 |

**Start with DB-FIX-01.** It is the highest-leverage change in the codebase (fixes all admin mutations with changes to 3 files) and has zero dependencies. After this, the admin panel becomes fully functional in production.

### Wave 2 — Complete Public Site (P0 FilterBar + P1 Homepage/Nav)
These make the site usable for end users.

| Order | Task ID | Priority | Time Estimate | Safe Independently? |
|---|---|---|---|---|
| 6 | LAYOUT-01 | P1 | 2–4 hrs | ✅ Yes |
| 7 | HP-FIX-01 | P1 | 1–2 hrs | ✅ Yes |
| 8 | DB-FIX-02 | P0 | 3–5 hrs | ✅ Yes |

**LAYOUT-01 before HP-FIX-01** — with the header in place, the homepage will look more complete when testing the real bike data.

### Wave 3 — Polish and Deployment Prep (P2)

| Order | Task ID | Priority | Time Estimate |
|---|---|---|---|
| 9 | PERF-01 | P2 | 15 min |
| 10 | PERF-04 | P2 | 15 min |
| 11 | QA-01 | P2 | 5 min |
| 12 | QA-02 | P2 | 15 min |
| 13 | DEP-01 | P3 | 5 min |
| 14 | DEP-02 | P2 | 5 min |
| 15 | DEP-03 | P3 | 5 min |

### Wave 4 — Technical Debt (P3)

| Order | Task ID | Priority | Time Estimate |
|---|---|---|---|
| 16 | PERF-02 | P2 | 1–2 hrs |
| 17 | PERF-03 | P2 | 2–4 hrs |
| 18 | P3-SEO-01 | P3 | 30 min |
| 19 | P3-A11Y-01 | P3 | 10 min |
| 20 | P3-SESS-01 | P3 | 15 min |

---

## 8. Production-Launch Checklist

### 8.1 Blocker Checklist (ALL must be ✅ before launch)

- [ ] **DB-FIX-01** — Admin bike mutations work in production (POST/PUT/DELETE/publish routes return correct status, not 501)
- [ ] **DB-FIX-02** — FilterBar functional on all listing pages
- [ ] **DB-FIX-03** — Search results page shows real DB results
- [ ] **HP-FIX-01** — Homepage hero shows real bike images from DB
- [ ] **LAYOUT-01** — SiteHeader and Footer visible on all public pages
- [ ] **ADMIN-FIX-01** — Admin layout auth guard implemented
- [ ] **ADMIN-FIX-02** — No unconditional console.log in production
- [ ] **PERF-01** — vercel.json created for upload route

### 8.2 Quality Checklist (SHOULD be ✅ before launch)

- [ ] **QA-01** — Dead BikeListTable component removed
- [ ] **QA-02** — swr removed; dotenv moved to devDependencies
- [ ] **DEP-01** — Accidental files deleted; .gitignore updated
- [ ] **DEP-02** — REVALIDATE_SECRET removed from .env.example or implemented
- [ ] **DEP-03** — Dev scaffold routes (upload-test, gallery-test) removed
- [ ] **PERF-04** — `<img>` replaced with `<Image />` in BikeEditMediaClient
- [ ] `npm run lint` returns 0 errors (warnings acceptable)
- [ ] `npm run build` succeeds cleanly

### 8.3 Environment Variables Checklist

- [ ] `MONGODB_URI` set and pointing to Atlas M10+ (not M0 free tier for production)
- [ ] `CLOUDINARY_CLOUD_NAME` set
- [ ] `CLOUDINARY_API_KEY` set
- [ ] `CLOUDINARY_API_SECRET` set
- [ ] `SESSION_SECRET` set, minimum 32 characters, cryptographically random
- [ ] `NEXT_PUBLIC_SITE_URL` set to production domain (e.g. `https://motohub360.in`)
- [ ] `SEED_ADMIN_PASSWORD` set (used only during seed; can be rotated after)
- [ ] `REVALIDATE_SECRET` removed from required vars (not used in code)

### 8.4 Database Checklist

- [ ] Seed script run against production MongoDB Atlas: `npx tsx scripts/seed.ts`
- [ ] Admin account created and password documented securely
- [ ] At least 1 published bike exists in the database
- [ ] All 6 brands seeded (Royal Enfield, KTM, Yamaha, Honda, TVS, Bajaj)
- [ ] MongoDB Atlas `bikes_search` index created manually in Atlas UI (for full-text search)
- [ ] Atlas connection tested: admin login works, bike listing page loads

### 8.5 Vercel Deployment Checklist

- [ ] `vercel.json` committed with upload route configuration
- [ ] Vercel project environment variables set (all from 8.3)
- [ ] Vercel Body Size Limit increased in project settings (for video uploads)
- [ ] Production deployment tested end-to-end:
  - [ ] Homepage loads with real bike images
  - [ ] Brand listing page shows bikes
  - [ ] Bike detail page renders correctly
  - [ ] Admin login works
  - [ ] Admin can create and publish a bike
  - [ ] Published bike appears on public listing pages
  - [ ] Search suggests real results

### 8.6 SEO Checklist

- [ ] `NEXT_PUBLIC_SITE_URL` set — canonical URLs are valid
- [ ] `/sitemap.xml` returns valid XML with all published bike URLs
- [ ] `/robots.txt` blocks `/admin/` and `/api/`
- [ ] Bike detail pages have correct `<title>` and `<meta description>`
- [ ] JSON-LD present on bike detail pages (inspect in browser source)
- [ ] Google Search Console property verified (post-launch)
- [ ] No `noindex` on public pages (verify brand/category/price pages)

### 8.7 Post-Launch Monitoring

- [ ] Monitor Vercel function logs for any unexpected errors
- [ ] Monitor MongoDB Atlas metrics (connection count, query time)
- [ ] Verify search suggest API response times are acceptable (<300ms)
- [ ] Confirm ISR revalidation works: publish a bike → verify page updates within 5 minutes
- [ ] Test mobile layout on real device (iPhone/Android)

---

## Appendix A — Phase Status Summary

| Phase | Phase Name | Status |
|---|---|---|
| 1 | Project Setup | ✅ Complete |
| 2 | Design Tokens | ✅ Complete |
| 3 | Core Layout | ⚠️ Header/Footer not in root layout — Task LAYOUT-01 |
| 4 | Home Page | ⚠️ Hero uses mock data — Task HP-FIX-01 |
| 5 | Listing Pages | ⚠️ Pages render; FilterBar inert — Task DB-FIX-02 |
| 6 | Search | ⚠️ Suggest API complete; Results page mock — Task DB-FIX-03 |
| 7 | Database & API | ⚠️ Models + read APIs complete; mutations broken in prod — Task DB-FIX-01 |
| 8 | Bike Detail | ✅ Complete (B-01 → B-08) |
| 9 | Admin Panel | ⚠️ Auth + list complete; mutations blocked; layout auth gap — Tasks DB-FIX-01, ADMIN-FIX-01 |
| 10 | SEO & Performance | ⚠️ SEO complete; lint errors; no vercel.json — Tasks PERF-01–04 |
| 11 | QA & Testing | ⚠️ Dead code, ARIA issues — Tasks QA-01, QA-02 |
| 12 | Deployment | ❌ Not started — Tasks PERF-01, DEP-01–03 |

---

## Appendix B — Files That Must NOT Be Modified During Documentation Phase

This MDP is documentation only. The following files are untouched pending task implementation:

- All `src/**/*.ts`, `src/**/*.tsx`, `src/**/*.css` files
- `package.json`, `package-lock.json`
- `next.config.ts`, `tsconfig.json`, `tailwind.config.ts`
- `middleware.ts`
- `.env.example`
- `scripts/seed.ts`

---

*MDP-v2 last updated: August 2026*
*Based on: Full codebase audit of /home/claude/motohub360*
*Next review: After Wave 1 implementation complete*
