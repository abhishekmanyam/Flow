#!/usr/bin/env node

/**
 * Seed Wizzle Multi-Tenant tickets into FlowTask.
 *
 * Usage (with ADC — run `gcloud auth application-default login` first):
 *   WORKSPACE_ID=your-workspace-id \
 *   USER_ID=your-firebase-uid \
 *   node web/scripts/seed-tickets.mjs
 *
 * Or with a service account key:
 *   GOOGLE_APPLICATION_CREDENTIALS=/path/to/key.json \
 *   WORKSPACE_ID=your-workspace-id \
 *   USER_ID=your-firebase-uid \
 *   node web/scripts/seed-tickets.mjs
 */

import { initializeApp, applicationDefault, cert } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { readFileSync } from "node:fs";

// ─── Config ──────────────────────────────────────────────────────────────────

const WORKSPACE_ID = process.env.WORKSPACE_ID;
const USER_ID = process.env.USER_ID;

if (!WORKSPACE_ID || !USER_ID) {
  console.error(
    "Missing required env vars. Usage:\n" +
      "  WORKSPACE_ID=xxx USER_ID=xxx node web/scripts/seed-tickets.mjs\n" +
      "\nEnsure ADC is set up: gcloud auth application-default login"
  );
  process.exit(1);
}

// Use service account key if provided, otherwise fall back to ADC
const CREDENTIALS_PATH = process.env.GOOGLE_APPLICATION_CREDENTIALS;
if (CREDENTIALS_PATH) {
  const serviceAccount = JSON.parse(readFileSync(CREDENTIALS_PATH, "utf-8"));
  initializeApp({ credential: cert(serviceAccount) });
} else {
  initializeApp({ credential: applicationDefault(), projectId: "flow-fd851" });
}
const db = getFirestore();

const PROJECT_NAME = "Astro";
const PROJECT_DESCRIPTION =
  "Wizzle multi-tenant redesign: 3-tier hierarchy (CoreDefender > Franchisee > School > Users), dashboards, domain mapping, tenant tracking.";
const PROJECT_COLOR = "#6366f1"; // indigo

// ─── Ticket data ─────────────────────────────────────────────────────────────

const TICKETS = [
  {
    title: "T-01: Define tenant TypeScript interfaces",
    tier: 1,
    description: `Create \`frontend/src/types/tenant.ts\` with interfaces for \`Franchisee\`, \`School\`, \`SchoolDomain\`, \`SchoolArchiveHistory\`, \`AnalyticsDaily\`, and the expanded \`AccountType\` union type (\`"student" | "teacher" | "parent" | "school_admin" | "franchisee_admin" | "coredefender_admin"\`). Include \`TenantStatus\`, \`RetentionPolicy\`, and \`Address\` types. These interfaces are the shared contract used by frontend, Cloud Functions, and security rules.

**Files**: \`frontend/src/types/tenant.ts\` (new)
**Depends on**: Nothing`,
  },
  {
    title: "T-02: Update existing database interfaces with tenant fields",
    tier: 1,
    description: `Add \`franchiseeId?: string\` and \`schoolId?: string\` fields to every content interface in \`database.ts\`: \`Doodles\`, \`Story_generator\`, \`Wisdom\`, \`Puzzle_challenge\`, \`Space_explorer\`, \`Quizzes\`, \`Quiz_submissions\`, \`Ai_academy\`, \`MusicCompositions\`, \`MusicTracks\`, \`MusicNotes\`, \`SpellingLevelProgress\`, \`MathMasterLevelResults\`, \`ScienceLabResults\`, \`Credit_transactions\`, \`Audit_logs\`. Also update the \`Users\` interface to add \`franchiseeId\`, \`schoolId\`, \`status\`, \`enrolledAt\`, \`enrollmentMethod\` fields.

**Files**: \`frontend/src/types/database.ts\` (modify)
**Depends on**: T-01 (imports AccountType from tenant.ts)`,
  },
  {
    title: "T-03: Add new collection name constants",
    tier: 1,
    description: `Add constants to \`COLLECTIONS\` object: \`FRANCHISEES: 'franchisees'\`, \`SCHOOLS: 'schools'\`, \`SCHOOL_DOMAINS: 'school_domains'\`, \`SCHOOL_ARCHIVE_HISTORY: 'school_archive_history'\`, \`ANALYTICS_DAILY: 'analytics_daily'\`.

**Files**: \`frontend/src/types/collections.ts\` (modify)
**Depends on**: Nothing`,
  },
  {
    title: "T-04: Create Firestore composite indexes",
    tier: 1,
    description: `Create \`firestore.indexes.json\` with composite indexes required for tenant-scoped queries. Indexes needed: \`users\` → \`[schoolId, accountType, status]\` and \`[franchiseeId, accountType, createdAt DESC]\`. \`analytics_daily\` → \`[franchiseeId, date DESC]\` and \`[schoolId, date DESC]\`. \`school_invitations\` → \`[schoolId, status, createdAt DESC]\`. Content collections (\`doodles\`, \`story_generator\`, \`musicCompositions\`, etc.) → \`[schoolId, createdAt DESC]\`. Deploy indexes early since they build asynchronously and can take hours.

**Files**: \`firestore.indexes.json\` (new)
**Depends on**: Nothing`,
  },
  {
    title: "T-05: Create tenant CRUD Cloud Functions",
    tier: 2,
    description: `Create \`functions/src/tenantOperations.ts\` with the following callable Cloud Functions:
- \`createFranchisee(name, slug, contactEmail, ...)\` — validates caller is \`coredefender_admin\` via custom claims, creates doc in \`franchisees\` collection, returns \`franchiseeId\`. Audit logs the action.
- \`updateFranchisee(franchiseeId, updates)\` — validates caller is \`coredefender_admin\`, updates franchisee doc.
- \`createSchool(franchiseeId, name, slug, domains[], contactEmail, ...)\` — validates caller is \`coredefender_admin\` or \`franchisee_admin\` for that franchisee. Creates doc in \`schools\` collection. For each domain in \`domains[]\`, creates a doc in \`school_domains/{domain}\` with \`{domain, schoolId, franchiseeId, schoolName, status}\`. Increments \`_schoolCount\` on the parent franchisee. Returns \`schoolId\`.
- \`updateSchool(schoolId, updates)\` — validates caller is \`coredefender_admin\`, \`franchisee_admin\` (same franchisee), or \`school_admin\` (same school). If \`domains[]\` changed, updates \`school_domains\` collection accordingly.
- \`archiveSchool(schoolId, reason)\` — validates caller is \`coredefender_admin\` or \`franchisee_admin\`. Sets school \`status\` to \`"archived"\`. Batch-updates all users in that school to \`status: "suspended"\`. Creates a snapshot doc in \`school_archive_history\` with user count and full school data. Decrements \`_schoolCount\` on parent franchisee. Does NOT delete user data (retention policy).
- Internal helper \`syncCustomClaims(uid)\` — reads user doc, calls \`admin.auth().setCustomClaims(uid, { role, fid, sid, st })\`.

**Files**: \`functions/src/tenantOperations.ts\` (new)
**Depends on**: T-01 (shared types)`,
  },
  {
    title: "T-06: Create role management Cloud Function",
    tier: 2,
    description: `Create \`updateUserRole\` callable function in \`functions/src/tenantOperations.ts\`. Replaces existing \`updateUserAccountType\` in \`index.ts\`. Key differences from current implementation:
- Validates role hierarchy: a caller cannot assign a role equal to or above their own level (coredefender_admin=5, franchisee_admin=4, school_admin=3, teacher=2, student/parent=1).
- Validates tenant scope: franchisee_admin can only modify users within their franchisee. school_admin can only modify users within their school.
- Accepts \`{targetUserId, newAccountType, franchiseeId?, schoolId?}\`. For promoting to \`franchisee_admin\`, \`franchiseeId\` is required. For promoting to \`school_admin\`, both are required.
- After updating the user doc, calls \`syncCustomClaims(targetUserId)\` to update Firebase Auth custom claims.
- Audit logs every role change.

**Files**: \`functions/src/tenantOperations.ts\` (modify — append to T-05)
**Depends on**: T-05 (syncCustomClaims helper)`,
  },
  {
    title: "T-07: Rewrite validateUserCreation Cloud Function",
    tier: 2,
    description: `Modify the existing \`validateUserCreation\` in \`functions/src/index.ts\` (lines 76-170). Changes:
- Remove \`EDUCATIONAL_CONFIG.allowedSchoolDomains\` hardcoded array and \`determineAccountType()\` function.
- Remove \`enableDomainRestriction\` config flag.
- After extracting the email domain, look up \`school_domains/{domain}\` in Firestore. If found and \`status == "active"\`, get the \`schoolId\` and \`franchiseeId\`.
- If domain found: create user profile with \`franchiseeId\`, \`schoolId\`, \`accountType: "student"\`, \`status: "active"\`, \`enrollmentMethod: "domain_auto"\`. Call \`syncCustomClaims(uid)\`.
- If domain NOT found: block sign-up with error "Your school domain is not registered. Contact your school administrator."
- Keep COPPA compliance logic (age check, parent consent) unchanged.
- Keep audit logging unchanged.
- Update the user profile schema to include new fields: \`franchiseeId\`, \`schoolId\`, \`status\`, \`enrollmentMethod\`.
- Also export the new functions from \`tenantOperations.ts\` in this file.

**Files**: \`functions/src/index.ts\` (modify lines 17-170)
**Depends on**: T-05 (syncCustomClaims, tenantOperations exports)`,
  },
  {
    title: "T-08: Update credit operations with tenant fields",
    tier: 2,
    description: `Modify \`functions/src/creditOperations.ts\`. When \`handleCreditOperation\` creates a \`credit_transactions\` document, also write \`franchiseeId\` and \`schoolId\` from the caller's user doc (or custom claims). This ensures credit transactions are queryable by tenant for dashboard analytics. Same for \`getCreditHistory\` — allow filtering by \`schoolId\` if the caller is \`school_admin\` or higher.

**Files**: \`functions/src/creditOperations.ts\` (modify)
**Depends on**: T-05 (for role validation pattern)`,
  },
  {
    title: "T-09: Create scheduled analytics aggregation Cloud Function",
    tier: 2,
    description: `Create \`functions/src/analytics.ts\` with a scheduled Cloud Function \`computeDailyAnalytics\` that runs once daily (via Cloud Scheduler). For each active school:
- Count active users (users who logged in that day, from \`users\` collection where \`lastLoginAt\` is today and \`schoolId\` matches).
- Count new users (created today).
- Sum credits consumed/earned from \`credit_transactions\` for that day.
- Count feature usage by querying each content collection for docs created today with matching \`schoolId\`.
- Count student progress: math levels passed, spelling levels completed, science experiments done.
- Write results to \`analytics_daily/{franchiseeId}_{schoolId}_{date}\`.
- Also aggregate franchisee-level totals: \`analytics_daily/{franchiseeId}_ALL_{date}\`.
- Also aggregate global totals: \`analytics_daily/GLOBAL_ALL_{date}\`.

**Files**: \`functions/src/analytics.ts\` (new)
**Depends on**: T-03 (collection names), T-04 (indexes must exist for efficient queries)`,
  },
  {
    title: "T-10: Rewrite Firestore security rules",
    tier: 3,
    description: `Full rewrite of \`firestore.rules\` (currently 539 lines). Key changes:
- Replace ALL helper functions that use \`get()\` with custom claims-based helpers: \`isCoreDefenderAdmin()\` → \`request.auth.token.role == 'coredefender_admin'\`, \`isSameSchool(sid)\` → \`request.auth.token.sid == sid\`, \`isSameFranchisee(fid)\` → \`request.auth.token.fid == fid\`, \`isActiveUser()\` → \`request.auth.token.st == 'active'\`.
- Add rules for new collections: \`franchisees\` (read: coredefender_admin or own franchisee_admin; write: coredefender_admin only), \`schools\` (read: coredefender_admin, own franchisee_admin, or own school_admin/teacher; create/update: coredefender_admin or own franchisee_admin), \`school_domains\` (read: any admin; write: server-only/false), \`school_archive_history\` (read: coredefender_admin or own franchisee_admin; write: false), \`analytics_daily\` (read: coredefender_admin gets all, franchisee_admin gets own franchisee's, school_admin gets own school's; write: false).
- Update ALL existing content collection rules to: keep existing owner-based access, replace \`isSameSchoolDomain()\` with \`isSameSchool(resource.data.schoolId)\`, add franchisee_admin read access for \`isSameFranchisee(resource.data.franchiseeId)\`, add coredefender_admin read access for all.
- Update \`users\` collection rules: owner can read own, school staff can read users in same school, franchisee_admin reads their franchisee's users, coredefender_admin reads all. Owner update restrictions remain.
- Keep \`credit_transactions\` as read-only (server-only writes).
- Keep COPPA-related rules (\`parentChildLinks\`).
- Backward compatibility: during migration, fall back to \`get()\` if \`request.auth.token.role == null\`.

**Files**: \`firestore.rules\` (full rewrite)
**Depends on**: T-05 (custom claims must be set by Cloud Functions)`,
  },
  {
    title: "T-11: Update Cloud Storage security rules",
    tier: 3,
    description: `Update \`storage.rules\` to add tenant-aware access. Currently rules allow owner-only access for \`/doodles/{userId}/*\`, \`/profile-pictures/{userId}/*\`, \`/generated/{userId}/*\`, \`/music/{userId}/*\`, \`/story/{userId}/*\`. Add: school staff and franchisee_admin can read (not write) files from users in their school/franchisee using custom claims. CoreDefender admin can read all. Keep write restricted to owners.

**Files**: \`storage.rules\` (modify)
**Depends on**: T-05 (custom claims)`,
  },
  {
    title: "T-12: Update AuthProvider with tenant fields and custom claims",
    tier: 4,
    description: `Modify \`frontend/src/features/auth/hooks/useAuth.tsx\`:
- Expand \`UserProfile\` interface to include: \`franchiseeId: string | null\`, \`schoolId: string | null\`, \`status: 'active' | 'suspended' | 'archived'\`, \`enrolledAt?: Timestamp\`, \`enrollmentMethod?: string\`. Change \`accountType\` to use the expanded union type from \`tenant.ts\`.
- Expand \`AuthContextType\` to expose: \`customClaims: { role, fid, sid, st } | null\`, \`isCoreDefenderAdmin: boolean\`, \`isFranchiseeAdmin: boolean\`, \`isSchoolAdmin: boolean\`, \`isTeacher: boolean\`, \`isAdminRole: boolean\` (any admin level).
- In the \`onAuthStateChanged\` callback (line 61), after loading the user profile, also call \`user.getIdTokenResult()\` to read custom claims. Store claims in state. Derive the boolean helpers from claims.
- After operations that change roles/school assignment, call \`user.getIdToken(true)\` to force token refresh.
- Update redirect logic (lines 86-90): if user is admin, redirect to \`/dashboard\` instead of \`/\`.
- Update \`signInWithGoogle\`: remove the domain-restriction error handling (line 145-148) since server now handles this differently.

**Files**: \`frontend/src/features/auth/hooks/useAuth.tsx\` (modify)
**Depends on**: T-01 (tenant types), T-02 (updated UserProfile), T-07 (backend sets custom claims)`,
  },
  {
    title: "T-13: Update AuthPage for new enrollment flow",
    tier: 4,
    description: `Modify \`frontend/src/features/auth/components/AuthPage.tsx\`:
- Update error messages for domain-not-found scenario: "Your school domain is not registered on Wizzle. Please contact your school administrator."
- Keep COPPA compliance UI (age check, parent email) unchanged.
- Remove any references to \`VITE_SCHOOL_DOMAINS\` environment variable if present.
- Ensure Google Sign-In popup doesn't set \`hd\` (hosted domain) hint, allowing any Google Workspace domain.

**Files**: \`frontend/src/features/auth/components/AuthPage.tsx\` (modify)
**Depends on**: T-12 (updated auth hook)`,
  },
  {
    title: "T-14: Inject tenant fields into all content creation calls",
    tier: 5,
    description: `When users create content (doodles, stories, music, etc.), the \`franchiseeId\` and \`schoolId\` from their profile must be written to the document. Create a utility function \`getTenantFields()\` in \`frontend/src/services/firebase.ts\` that returns \`{ franchiseeId, schoolId }\` from the current user's profile. Update every feature's Firestore write call to include these fields. Features to update:
- \`features/doodle/\` — when saving a doodle to Firestore
- \`features/story/\` — when saving a story
- \`features/music-maker/\` — when creating compositions, tracks, notes
- \`features/spellingbee/\` — when writing spelling progress
- \`features/mathmaster/\` — when writing level results
- \`features/science-lab/\` — when writing lab results
- \`features/Ai_academy/\` — when saving AI academy data
- \`features/puzzle/\` — when saving puzzle challenges
- \`features/space-explorer/\` — when saving space explorer data
- \`features/wisdom/\` — when saving wisdom quotes
- \`features/battle-of-books/\` — when saving quiz results
- Search each feature for Firestore \`setDoc\`, \`addDoc\`, \`updateDoc\` calls and add tenant fields.

**Files**: \`frontend/src/services/firebase.ts\` (add utility), all 12+ feature directories (modify write calls)
**Depends on**: T-12 (auth hook exposes franchiseeId/schoolId)`,
  },
  {
    title: "T-15: Create dashboard layout and routing",
    tier: 6,
    description: `Create \`frontend/src/features/dashboard/components/DashboardLayout.tsx\` — a layout component with a left sidebar and main content area. Sidebar shows navigation items based on role: CoreDefender admin sees (Overview, Franchisees, Schools, Users, Analytics, Audit Logs). Franchisee admin sees (Overview, Schools, Users, Analytics). School admin sees (Overview, Users, Analytics). Uses \`useAuth()\` to determine which dashboard to render. Create \`frontend/src/features/dashboard/types/dashboard.ts\` with dashboard-specific types. Add lazy-loaded routes to \`frontend/src/core/router.tsx\`: \`/dashboard\` → \`DashboardLayout\`, \`/dashboard/franchisees\`, \`/dashboard/schools\`, \`/dashboard/users\`, \`/dashboard/analytics\`.

**Files**: \`frontend/src/features/dashboard/components/DashboardLayout.tsx\` (new), \`frontend/src/features/dashboard/types/dashboard.ts\` (new), \`frontend/src/core/router.tsx\` (modify)
**Depends on**: T-12 (auth context for role checks)`,
  },
  {
    title: "T-16: Add Dashboard link to navigation header",
    tier: 6,
    description: `Modify \`frontend/src/components/Header.tsx\` (445 lines). Add a "Dashboard" navigation link that appears only for admin roles (\`school_admin\`, \`franchisee_admin\`, \`coredefender_admin\`). Use \`useAuth()\` hook's \`isAdminRole\` boolean. Place it prominently — either as a top-level nav item or in the user dropdown menu. Link points to \`/dashboard\`.

**Files**: \`frontend/src/components/Header.tsx\` (modify)
**Depends on**: T-12 (auth hook isAdminRole), T-15 (dashboard route must exist)`,
  },
  {
    title: "T-17: Create tenant management hooks",
    tier: 6,
    description: `Create \`frontend/src/features/dashboard/hooks/useTenantManagement.tsx\` with React Query hooks for:
- \`useFranchisees()\` — list all franchisees (CoreDefender admin) or own franchisee (franchisee admin). Uses \`query(collection(db, 'franchisees'), ...)\`.
- \`useSchools(franchiseeId?)\` — list schools, filtered by franchisee. School admins see only their school.
- \`useSchoolUsers(schoolId)\` — list users in a school with pagination. Filter by accountType.
- \`useCreateFranchisee()\`, \`useUpdateFranchisee()\` — mutations calling Cloud Functions via \`httpsCallable\`.
- \`useCreateSchool()\`, \`useUpdateSchool()\`, \`useArchiveSchool()\` — mutations calling Cloud Functions.
- \`useUpdateUserRole()\` — mutation calling the \`updateUserRole\` Cloud Function.
- All hooks handle loading, error, and refetch states via TanStack React Query.

**Files**: \`frontend/src/features/dashboard/hooks/useTenantManagement.tsx\` (new)
**Depends on**: T-05 (Cloud Functions exist), T-10 (security rules allow access)`,
  },
  {
    title: "T-18: Create analytics hook",
    tier: 6,
    description: `Create \`frontend/src/features/dashboard/hooks/useAnalytics.tsx\` with React Query hooks:
- \`useDailyAnalytics(franchiseeId?, schoolId?, dateRange)\` — queries \`analytics_daily\` collection with appropriate filters based on caller's role. CoreDefender admin can query global or any franchisee/school. Franchisee admin queries their own. School admin queries their own.
- \`useOverviewStats()\` — fetches denormalized count fields from the caller's franchisee/school document (\`_schoolCount\`, \`_activeUserCount\`, etc.) for the overview cards.
- Returns formatted data ready for recharts components.

**Files**: \`frontend/src/features/dashboard/hooks/useAnalytics.tsx\` (new)
**Depends on**: T-09 (analytics collection populated), T-10 (security rules allow reads)`,
  },
  {
    title: "T-19: Build dashboard widget components",
    tier: 6,
    description: `Create reusable widget components in \`frontend/src/features/dashboard/components/widgets/\`:
- \`StatsCard.tsx\` — displays a metric with label, value, and optional trend arrow. Uses Shadcn Card component.
- \`UserTable.tsx\` — paginated table of users with columns: name, email, role, school, status, joined date, credits. Supports search/filter. Uses Shadcn Table. Includes action dropdown: change role, suspend, archive.
- \`SchoolTable.tsx\` — table of schools with: name, domains, status, teacher count, student count, credits consumed. Action: edit, archive.
- \`FranchiseeTable.tsx\` — table of franchisees with: name, status, school count, user count. Action: edit, archive.
- \`FeatureUsageChart.tsx\` — bar chart (recharts) showing daily usage per feature (doodle, story, math, etc.).
- \`CreditConsumptionChart.tsx\` — line chart (recharts) showing credits consumed over time.
- \`StudentProgressTable.tsx\` — table showing per-student progress: math levels, spelling levels, science experiments, quiz scores.

**Files**: \`frontend/src/features/dashboard/components/widgets/\` (new directory, 7 files)
**Depends on**: T-17 (data hooks), T-18 (analytics hooks)`,
  },
  {
    title: "T-20: Build CoreDefender Admin Dashboard",
    tier: 6,
    description: `Create \`frontend/src/features/dashboard/components/CoreDefenderDashboard.tsx\`. Shows:
- Overview cards: total franchisees, total schools, total users, total credits consumed (from \`useOverviewStats\`).
- Franchisee table (\`FranchiseeTable\`) with create/edit/archive actions.
- Global feature usage chart (\`FeatureUsageChart\`) and credit consumption chart (\`CreditConsumptionChart\`).
- "Create Franchisee" button opening a form dialog (name, contact email, slug).
- "Assign Franchisee Admin" action on user table.
- Quick links to drill down into any franchisee's or school's dashboard.

**Files**: \`frontend/src/features/dashboard/components/CoreDefenderDashboard.tsx\` (new)
**Depends on**: T-19 (widget components), T-17 (management hooks)`,
  },
  {
    title: "T-21: Build Franchisee Admin Dashboard",
    tier: 6,
    description: `Create \`frontend/src/features/dashboard/components/FranchiseeDashboard.tsx\`. Shows:
- Overview cards: total schools in their franchisee, total users, total credits.
- School table (\`SchoolTable\`) scoped to their franchisee. Create/edit/archive schools.
- "Create School" form: name, slug, domains[] (comma-separated Google Workspace domains), contact email.
- "Register Domain" form for adding domains to existing schools.
- Cross-school feature usage chart and credit consumption chart.
- Ability to view (not modify) student data across their schools.
- "Assign School Admin" action.

**Files**: \`frontend/src/features/dashboard/components/FranchiseeDashboard.tsx\` (new)
**Depends on**: T-19 (widget components), T-17 (management hooks)`,
  },
  {
    title: "T-22: Build School Admin Dashboard",
    tier: 6,
    description: `Create \`frontend/src/features/dashboard/components/SchoolDashboard.tsx\`. Shows:
- Overview cards: teachers, students, parents count, credits consumed.
- User table (\`UserTable\`) for their school. Filter by role. Actions: change role (teacher/student), suspend, archive.
- Student progress table (\`StudentProgressTable\`) — per-student breakdown of math levels, spelling levels, science experiments, quiz scores. Data from \`mathmaster_level_results\`, \`spellingLevelProgress\`, \`science_lab_results\` where \`schoolId\` matches.
- Feature usage chart for their school.
- Credit consumption chart for their school.

**Files**: \`frontend/src/features/dashboard/components/SchoolDashboard.tsx\` (new)
**Depends on**: T-19 (widget components), T-17 (management hooks)`,
  },
  {
    title: "T-23: Write data migration script",
    tier: 7,
    description: `Create \`scripts/migrate-to-multitenant.ts\` (runnable with \`ts-node\` or as a one-off Cloud Function). Steps:
1. Create "Legacy CoreDefender" franchisee doc in \`franchisees\` collection.
2. Create "Legacy School" doc in \`schools\` collection under that franchisee.
3. Create \`school_domains/coredefender.ai\` and \`school_domains/gmail.com\` pointing to the legacy school.
4. Batch-update ALL user docs: add \`franchiseeId\` (legacy), \`schoolId\` (legacy), \`status: "active"\`, \`enrollmentMethod: "migration"\`. Map existing \`accountType: "admin"\` → \`"coredefender_admin"\`.
5. For each of the 20+ content collections, batch-update all docs: look up each doc's \`userId\` in the user tenant map, write \`franchiseeId\` and \`schoolId\`.
6. For each migrated user, call \`admin.auth().setCustomClaims(uid, { role, fid, sid, st })\`.
7. Use Firestore batch writes (max 499 per batch) for efficiency.
8. Log progress and handle errors gracefully (idempotent — safe to re-run).

**Files**: \`scripts/migrate-to-multitenant.ts\` (new)
**Depends on**: T-05 (franchisee/school collections exist), T-07 (custom claims function)`,
  },
  {
    title: "T-24: Write Cloud Function unit tests",
    tier: 8,
    description: `Write tests for all new Cloud Functions using Firebase emulators + Jest (already configured in \`functions/package.json\`). Test cases:
- \`createFranchisee\`: success as coredefender_admin, rejection for non-admins.
- \`createSchool\`: success, domain registration in \`school_domains\`, rejection for wrong franchisee.
- \`archiveSchool\`: user suspension, history creation, count decrements.
- \`updateUserRole\`: hierarchy enforcement, claims sync, scope validation.
- \`validateUserCreation\`: domain lookup, auto-enrollment, unknown domain rejection.
- \`computeDailyAnalytics\`: metric aggregation accuracy.

**Files**: \`functions/src/__tests__/tenantOperations.test.ts\` (new), \`functions/src/__tests__/analytics.test.ts\` (new)
**Depends on**: T-05, T-06, T-07, T-09`,
  },
  {
    title: "T-25: Write Firestore security rules tests",
    tier: 8,
    description: `Write security rules unit tests using \`@firebase/rules-unit-testing\`. Test matrix:
- CoreDefender admin: can read all franchisees, all schools, all users, all content, all analytics.
- Franchisee admin: can read their franchisee's schools/users, CANNOT read other franchisees.
- School admin: can read their school's users/content, CANNOT read other schools.
- Teacher: can read students in same school, CANNOT read other schools.
- Student: can read/write only own data, CANNOT read other students.
- Suspended user (\`st: "suspended"\`): CANNOT access anything.
- Cross-tenant reads: all denied.

**Files**: \`functions/src/__tests__/firestore.rules.test.ts\` (new)
**Depends on**: T-10 (security rules written)`,
  },
  {
    title: "T-26: Staging deployment and end-to-end testing",
    tier: 8,
    description: `Deploy everything to the staging environment (\`wizzle-stagging-476121\`):
1. Deploy Firestore indexes first (\`firebase deploy --only firestore:indexes\`). Wait for builds to complete.
2. Deploy Cloud Functions (\`firebase deploy --only functions\`).
3. Deploy Firestore rules (\`firebase deploy --only firestore:rules\`).
4. Deploy Storage rules (\`firebase deploy --only storage\`).
5. Run migration script against staging Firestore.
6. Deploy frontend (\`firebase deploy --only hosting\`).
7. Manual E2E testing: create test franchisee, create test school with a domain, sign in with that domain's Google Workspace account, verify auto-enrollment, verify dashboard access per role, verify existing features still work (doodle, story, math, etc.), verify cross-tenant isolation.

**Files**: No new files. Uses GitLab CI/CD pipeline or manual \`firebase deploy\`.
**Depends on**: All previous tickets`,
  },
];

// ─── Priority mapping ────────────────────────────────────────────────────────

function getPriority(tier) {
  if (tier <= 3) return "high";
  if (tier <= 6) return "medium";
  return "low";
}

// ─── Delete helpers ──────────────────────────────────────────────────────────

async function deleteCollection(collectionRef, batchSize = 400) {
  let total = 0;
  while (true) {
    const snapshot = await collectionRef.limit(batchSize).get();
    if (snapshot.empty) break;

    const batch = db.batch();
    for (const doc of snapshot.docs) {
      batch.delete(doc.ref);
    }
    await batch.commit();
    total += snapshot.size;
  }
  return total;
}

async function deleteExistingTasks(projectRef) {
  const tasksRef = projectRef.collection("tasks");
  const tasksSnapshot = await tasksRef.get();

  if (tasksSnapshot.empty) {
    console.log("  No existing tasks to delete.");
    return;
  }

  console.log(`  Deleting ${tasksSnapshot.size} existing tasks and their subcollections...`);

  for (const taskDoc of tasksSnapshot.docs) {
    // Delete subcollections: events, subtasks, comments
    for (const sub of ["events", "subtasks", "comments"]) {
      const deleted = await deleteCollection(taskDoc.ref.collection(sub));
      if (deleted > 0) {
        console.log(`    Deleted ${deleted} ${sub} from task ${taskDoc.id}`);
      }
    }
  }

  // Now delete all task docs
  const deleted = await deleteCollection(tasksRef);
  console.log(`  Deleted ${deleted} task documents.`);
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  console.log("Seeding Wizzle Multi-Tenant tickets into FlowTask...\n");

  const workspaceRef = db.doc(`workspaces/${WORKSPACE_ID}`);
  const workspaceSnap = await workspaceRef.get();
  if (!workspaceSnap.exists) {
    console.error(`Workspace ${WORKSPACE_ID} not found.`);
    process.exit(1);
  }
  console.log(`Workspace: ${workspaceSnap.data().name} (${WORKSPACE_ID})`);

  // Find or create the project
  const projectsRef = workspaceRef.collection("projects");
  const existingProject = await projectsRef
    .where("name", "==", PROJECT_NAME)
    .limit(1)
    .get();

  let projectId;
  let projectRef;

  if (!existingProject.empty) {
    projectId = existingProject.docs[0].id;
    projectRef = existingProject.docs[0].ref;
    console.log(`Found existing project "${PROJECT_NAME}" (${projectId})`);

    // Delete existing tasks
    await deleteExistingTasks(projectRef);
  } else {
    const newProjectRef = projectsRef.doc();
    projectId = newProjectRef.id;
    projectRef = newProjectRef;

    await newProjectRef.set({
      id: projectId,
      workspaceId: WORKSPACE_ID,
      name: PROJECT_NAME,
      description: PROJECT_DESCRIPTION,
      color: PROJECT_COLOR,
      status: "active",
      memberIds: [USER_ID],
      createdBy: USER_ID,
      createdAt: FieldValue.serverTimestamp(),
    });
    console.log(`Created project "${PROJECT_NAME}" (${projectId})`);
  }

  // Create all 26 tasks
  const tasksRef = projectRef.collection("tasks");
  let created = 0;

  for (let i = 0; i < TICKETS.length; i++) {
    const ticket = TICKETS[i];
    const taskRef = tasksRef.doc();
    const taskId = taskRef.id;

    const batch = db.batch();

    // Task document
    batch.set(taskRef, {
      id: taskId,
      projectId,
      workspaceId: WORKSPACE_ID,
      title: ticket.title,
      description: ticket.description,
      status: "backlog",
      priority: getPriority(ticket.tier),
      assigneeId: null,
      dueDate: null,
      position: i,
      labelIds: [],
      storyPoints: null,
      epicId: null,
      sprintId: null,
      attachments: [],
      createdBy: USER_ID,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
      deletedAt: null,
    });

    // Event document (created event)
    const eventRef = taskRef.collection("events").doc();
    batch.set(eventRef, {
      id: eventRef.id,
      taskId,
      userId: USER_ID,
      eventType: "created",
      field: null,
      oldValue: null,
      newValue: null,
      createdAt: FieldValue.serverTimestamp(),
    });

    await batch.commit();
    created++;
    console.log(`  [${i + 1}/26] ${ticket.title}`);
  }

  console.log(`\nDone! Created ${created} tasks in project "${PROJECT_NAME}".`);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
