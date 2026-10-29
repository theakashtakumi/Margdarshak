# Margdarshak — Civic Clarity & Student Opportunity Platform (Architectural Blueprint)

A resilient, source-backed opportunity discovery platform and civic portal audit system engineered for Indian students navigating central/state scholarships and premier entrance examinations.

---

## User Review & Critical Decisions

> [!IMPORTANT]
> **Summary of Architectural Revisions based on Expert Security and Systems Review:**
> 1. **Authentication & Session Authorization**: Abandoned insecure client-controlled identity headers (`X-Margdarshak-User-ID`). Implemented server-issued, cryptographically secure session cookies/tokens (`session_token`) stored in a dedicated `user_sessions` table with expiration. Every mutating endpoint enforces session validation and strictly isolates user records. Added automated security test cases attempting cross-user data tampering.
> 2. **Durable Storage & Deployment Boundaries**: Implemented a Repository abstraction (`OpportunityRepository`, `UserRecordRepository`, `PortalAuditRepository`) backed by an embedded SQLite engine with WAL mode and foreign-key constraints. Documented storage boundaries: SQLite provides ACID transactions for local development and single-container deployments; production multi-instance Cloud Run requires managed Cloud SQL (PostgreSQL). The repository interface ensures seamless database migration without modifying UI or routing code.
> 3. **SSRF-Hardened Portal Monitoring Engine**: Prohibited open outbound network probes. All checks enforce:
>    - Strict host allowlist (`scholarships.gov.in`, `upsconline.nic.in`, `nta.ac.in`, `pmrf.in`).
>    - HTTPS-only scheme enforcement.
>    - DNS resolution pre-check prohibiting loopback (`127.0.0.1`), RFC 1918 private IPs (`10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`), and link-local addresses (`169.254.0.0/16`).
>    - Strict redirect policy (maximum 2 hops, with each redirect target re-validated against the allowlist and private IP filter).
>    - 3-second hard timeout, 50 KB maximum response payload limit, and rate limiting (max 1 probe per portal per 60s).
>    - Explicit `tested_scope` recording (`homepage_tls_head_only`), acknowledging that transaction steps (OTP, login, upload) are unverified.
> 4. **Resilient Data Model with Nullable Cycle Dates**: Officially unannounced dates are represented as `null` rather than simulated strings. Date math safely handles missing dates, expired cycles, future opening dates, and IST (`Asia/Kolkata`) timezone boundaries.
> 5. **Evidence-Grounded Initial Dataset**: Clearly separated records into `verified` (officially confirmed against active gazettes/bulletins), `provisional` (confirmed government schemes awaiting current-cycle schedule notification), and `demo` (for testing data-quality edge cases).

---

## 1. Overview & Core Concept

- **Problem Statement**: Indian students applying for government scholarships and national examinations face fragmented information, conflicting unofficial blogs, expired deadlines, and unexpected government portal downtimes during peak application hours.
- **Product Solution**: Margdarshak acts as a verified civic compass. It displays only source-backed opportunities with direct links to official `.gov.in` and `.nic.in` domains, calculates deadlines transparently, provides scheme-specific application checklists, and offers an honest, non-misleading audit of portal reachability.
- **Target Audience**: Undergraduate, postgraduate, and 10+2 students in India seeking scholarships (e.g., Central Sector Scheme, Post-Matric SC/ST, PMRF) and competitive exams (e.g., UPSC CSE, UGC-NET, GATE).
- **Core Value Metric**: Zero hallucinated deadlines or requirements. If an official closing date is unannounced, it is shown as "Pending Official Notification" rather than an invented date.

---

## 2. User Experience & Visual Design Specification

The UI faithfully implements the **Civic Clarity** design system detailed in `Image_9_bd4ef983.markdown`:

### Design Movement & Aesthetic Direction
- **Modern Civic Precision**: High typographic contrast, disciplined grid architecture, authoritative calm, and tactile hairline boundaries (`1px solid #E2E8F0`).
- **Anti-AI Slop Rules**:
  - No static pill capsules enclosing metadata. Metadata items use clean unboxed text separated by typographic middots (`·`).
  - Interactive filter controls use clean segmented button switches with clear active states (`#243B6B` fill or crisp white shadow).
  - No mechanical code prefixes (`// 01`, `>_`), fake status tickers, or floating card sandwiches.
  - Strict Top Bar Contract: Wordmark on the left, 4 single-line nav links, 1 primary action button.

### Palette & Typography
- **Primary Indigo/Navy (`#243B6B`)**: Header brand identity, primary navigation links, active states, primary CTA buttons.
- **Deep Slate Navy (`#1A2B4C`)**: High-impact titles and structural accents.
- **Accent Teal (`#0F9D8A`)**: Verified badges, completed checklist steps, progress bars.
- **Canvas Base (`#F7F9FC`)**: Crisp, glare-free background.
- **Container Surface (`#FFFFFF`)**: Crisp cards with `1px solid #E2E8F0` and subtle diffused shadow (`0 1px 3px rgba(26, 43, 76, 0.04)`).
- **Status Indicators (Icon + Text)**:
  - Reachable / Verified: Forest Green (`#16A34A`) on Mint (`#DCFCE7`)
  - Warning / Approaching: Amber (`#D97706`) on Sand (`#FEF3C7`)
  - Issue / Expired: Crimson (`#DC2626`) on Coral (`#FEE2E2`)
  - Unknown / Unmonitored: Slate (`#64748B`) on Light Gray (`#F1F5F9`)
- **Typography Pairing**:
  - Headers: `Plus Jakarta Sans` (700/600 weight, tight tracking).
  - Body & Data Grids: `Inter` with tabular figures (`font-variant-numeric: tabular-nums`) for currency amounts, countdown days, and dates.

### Primary Screens & Navigation
1. **Overview Dashboard**: High-level civic pulse showing verified active schemes, items closing within 15 days, personal checklist completion rate, and overall portal audit health.
2. **Opportunity Directory**: Live search bar with instant debounced filtering by category (Scholarship vs. Examination), target academic tier, and verification state.
3. **Opportunity Detail Drawer / Modal**: Complete scheme breakdown, official source citation, eligibility criteria, and scheme-specific document checklist with conditional tags. Includes `.ics` calendar file download.
4. **Application Checklist Manager**: Multi-step checklist for saved opportunities, allowing students to check off documents (e.g. Income Certificate, Marksheet) with instantaneous server-side persistence.
5. **Civic Portal Status Monitor**: Live audit cards for national and state portals displaying last verified timestamp, tested scope, response latency, and explicit non-misleading service disclaimers.

---

## 3. System Architecture & Data Model

### Architectural Diagram

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                                   Browser Client                                        │
│  ┌───────────────────────┐  ┌─────────────────────────┐  ┌───────────────────────────┐  │
│  │ Opportunity Discovery │  │ Scheme-Specific Tracker │  │ Portal Audit Console      │  │
│  └───────────┬───────────┘  └────────────┬────────────┘  └─────────────┬─────────────┘  │
│              │                           │                             │                │
│              ▼                           ▼                             ▼                │
│  ┌───────────────────────────────────────────────────────────────────────────────────┐  │
│  │     API Client Layer (Session Credential Management & Bearer/Cookie Handling)     │  │
│  └───────────────────────────────────────┬───────────────────────────────────────────┘  │
└──────────────────────────────────────────┼──────────────────────────────────────────────┘
                                           │ HTTPS REST API
┌──────────────────────────────────────────┼──────────────────────────────────────────────┐
│ Full-Stack Server (server.ts)            ▼                                              │
│  ┌───────────────────────────────────────────────────────────────────────────────────┐  │
│  │ Express Middleware: Helmet, CORS, RateLimiter, SessionAuthGuard                   │  │
│  └───────────────────────────────────────┬───────────────────────────────────────────┘  │
│                                          │                                              │
│  ┌───────────────────────────────────────┴───────────────────────────────────────────┐  │
│  │ Controllers & Business Services:                                                  │  │
│  │  - OpportunityService (Query, Filter, Nullable Deadline Calculation)              │  │
│  │  - UserService (Session Validation, Scoped Saved Items, Scoped Checklists)        │  │
│  │  - PortalAuditService (SSRF-Hardened DNS/HTTP Probe, Classification, Rate Limit)  │  │
│  │  - CalendarExportService (RFC 5545 .ics Generator)                                │  │
│  └───────────────────────────────────────┬───────────────────────────────────────────┘  │
│                                          │                                              │
│  ┌───────────────────────────────────────┴───────────────────────────────────────────┐  │
│  │ Repository Abstraction Layer (IRepository Interface)                              │  │
│  └──────────────────┬──────────────────────────────────────────┬─────────────────────┘  │
│                     │                                          │                        │
│                     ▼ (Default Implementation)                 ▼ (Production Migration) │
│       ┌───────────────────────────┐              ┌───────────────────────────┐          │
│       │ SQLite Engine (WAL mode)  │              │ PostgreSQL (Cloud SQL)    │          │
│       │ /data/margdarshak.sqlite  │              │ via connection pool       │          │
│       └───────────────────────────┘              └───────────────────────────┘          │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

### Relational Database Schema

```sql
-- 1. Opportunities Table (Source-Backed Catalog)
CREATE TABLE IF NOT EXISTS opportunities (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  category TEXT NOT NULL CHECK(category IN ('scholarship', 'examination')),
  issuing_authority TEXT NOT NULL,
  official_url TEXT NOT NULL,
  verified_domain TEXT NOT NULL,
  description TEXT NOT NULL,
  eligibility_summary TEXT NOT NULL,
  financial_benefit TEXT,
  opening_date TEXT, -- ISO8601 or NULL if unannounced
  deadline TEXT,     -- ISO8601 or NULL if unannounced
  official_source_url TEXT NOT NULL,
  verification_state TEXT NOT NULL CHECK(verification_state IN ('verified', 'provisional', 'demo')),
  last_verified_at TEXT NOT NULL,
  checklist_schema TEXT NOT NULL -- JSON Array of opportunity-specific document steps
);

-- 2. User Sessions Table (Cryptographic Server-Side Identity)
CREATE TABLE IF NOT EXISTS user_sessions (
  session_token TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON user_sessions(user_id);

-- 3. User Saved Opportunities (Scoped to authenticated user_id)
CREATE TABLE IF NOT EXISTS user_saved_opportunities (
  user_id TEXT NOT NULL,
  opportunity_id TEXT NOT NULL,
  saved_at TEXT NOT NULL,
  PRIMARY KEY (user_id, opportunity_id),
  FOREIGN KEY (opportunity_id) REFERENCES opportunities(id) ON DELETE CASCADE
);

-- 4. User Checklist Progress (Scoped to authenticated user_id)
CREATE TABLE IF NOT EXISTS user_checklist_progress (
  user_id TEXT NOT NULL,
  opportunity_id TEXT NOT NULL,
  step_id TEXT NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('pending', 'in_progress', 'completed')),
  updated_at TEXT NOT NULL,
  PRIMARY KEY (user_id, opportunity_id, step_id),
  FOREIGN KEY (opportunity_id) REFERENCES opportunities(id) ON DELETE CASCADE
);

-- 5. Portal Audit Records (SSRF-protected diagnostics)
CREATE TABLE IF NOT EXISTS portal_audit_records (
  portal_id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  official_url TEXT NOT NULL,
  allowlisted_host TEXT NOT NULL,
  monitoring_method TEXT NOT NULL CHECK(monitoring_method IN ('curated_audit', 'automated_probe')),
  tested_scope TEXT NOT NULL, -- e.g., 'homepage_tls_head_only'
  status TEXT NOT NULL CHECK(status IN ('reachable', 'degraded', 'issue', 'unknown', 'monitoring_unavailable')),
  http_status INTEGER,
  latency_ms INTEGER,
  last_checked_at TEXT NOT NULL,
  disclaimer_notes TEXT NOT NULL
);
```

---

## 4. Rigorous Seed Dataset Classification

To avoid false claims of external verification, the seed catalog is explicitly categorized:

1. **Central Sector Scheme for College and University Students** (`verified`)
   - Authority: Department of Higher Education, Ministry of Education, Govt. of India
   - Application Portal: `https://scholarships.gov.in` (NSP)
   - Official Source Guidelines: `https://scholarships.gov.in/public/schemeGuidelines/Guidelines_DOHE_CSSS.pdf`
   - Verified Domain: `scholarships.gov.in`
   - Eligibility: Above 80th percentile in relevant stream in Class 12 board; family income <= ₹4,50,000 per annum; enrolled in regular degree course.
   - Scheme Checklist:
     - Step 1: Class 12th Board Marksheet & Roll Number (Mandatory)
     - Step 2: Competent Authority Annual Income Certificate (Mandatory)
     - Step 3: Aadhaar-seeded Bank Passbook Copy (Mandatory)
     - Step 4: Bona Fide Student Certificate from Enrolled College/Institute (Mandatory)
2. **Prime Minister's Research Fellowship (PMRF)** (`verified`)
   - Authority: Ministry of Education & National Coordination Committee
   - Application Portal: `https://www.pmrf.in`
   - Official Source Guidelines: `https://www.pmrf.in/guidelines`
   - Verified Domain: `pmrf.in`
   - Eligibility: Completed or final year of B.Tech/M.Tech at CFTI with CGPA >= 8.0, or qualified GATE score; admitted to PhD at IISc, IITs, or IISERs.
   - Scheme Checklist:
     - Step 1: Written Research Proposal (Max 1000 words) (Mandatory)
     - Step 2: Degree Transcripts with Cumulative GPA calculation (Mandatory)
     - Step 3: Valid GATE Scorecard (Conditional: Required only for non-CFTI applicants or CGPA < 8.0)
     - Step 4: Two Letters of Recommendation (Mandatory)
3. **UPSC Civil Services Examination (CSE)** (`provisional`)
   - Authority: Union Public Service Commission
   - Application Portal: `https://upsconline.nic.in`
   - Official Source Guidelines: `https://upsc.gov.in/examinations/active-exams`
   - Verified Domain: `upsconline.nic.in`
   - Note on Verification: Baseline examination rules and OTR flow verified; dates marked *Provisional* until the official annual UPSC calendar notification is gazetted for the forthcoming cycle.
   - Scheme Checklist:
     - Step 1: Complete One-Time Registration (OTR) on UPSCOnline (Mandatory)
     - Step 2: Government Photo Identity Proof (Aadhaar / Voter ID / Passport) (Mandatory)
     - Step 3: Degree Certificate or Final Year Provisional Certificate (Mandatory)
     - Step 4: Community / Caste / EWS Certificate (Conditional: Required only for reservation/age relaxation applicants)
4. **State Post-Matric SC/ST Education Assistance (Sample Mock Scheme)** (`demo`)
   - Verification State: `demo`
   - Explicit Disclaimer: "Demonstration fixture designed for automated data-quality testing of missing deadlines and expired application states."
   - Deadline: `null` (Simulates unannounced schedule).

---

## 5. Security & SSRF Hardening Architecture

### Portal Monitoring SSRF Defense Invariants
The server-side probe in `PortalAuditService` executes checks with multi-layer defense:

```
User Request (POST /api/portals/:id/check)
   │
   ▼
1. Rate Limit Guard (Max 1 check per portal ID per 60 seconds)
   │
   ▼
2. Parse URL & Scheme Check (Must be https://, port 443 only)
   │
   ▼
3. Allowlist Verification (Target host must match strict allowlist: scholarships.gov.in, upsconline.nic.in, nta.ac.in, pmrf.in)
   │
   ▼
4. DNS Resolution & IP Range Check
   - Resolve hostname to IPv4/IPv6 address
   - Reject if IP in [0.0.0.0/8, 10.0.0.0/8, 127.0.0.0/8, 169.254.0.0/16, 172.16.0.0/12, 192.168.0.0/16, ::1, fc00::/7]
   │
   ▼
5. Outbound HEAD Request with Safe Client
   - Timeout: 3000ms
   - Max Redirects: 2 (Each redirect target hops back to Step 2 for scheme/allowlist/IP verification)
   - Max Response Body: 50 KB
   │
   ▼
6. Record Audit Diagnostics
   - Status: Reachable (200-399) | Degraded (400-499, high latency > 2500ms) | Issue (500-599, timeout)
   - Tested Scope: 'homepage_tls_head_only'
   - Disclaimer: 'Automated check verifies homepage reachability only. Transactional services (OTP, login, document upload) are not tested.'
```

### Authentication & Authorization Isolation
- Session tokens are generated using `crypto.randomBytes(32).toString('hex')`.
- Sessions are established via `POST /api/auth/session` (issuing a guest or named session).
- Session cookie is configured with `HttpOnly`, `SameSite=Strict`, `Secure` in production.
- Every API endpoint mutating or reading user state (`/api/user/*`) inspects the session token:
  - Validates session expiration in `user_sessions`.
  - Binds all queries strictly to the authenticated `user_id`.
  - If token is missing, expired, or tampered, returns `401 Unauthorized`.
  - A client attempting to access records for another `user_id` is prevented by SQL parameter binding (`WHERE user_id = ?`).

---

## 6. API Specification & Error Handling

All API responses follow a consistent, envelope structure:

- **Success**: `{ "data": T, "meta"?: Record<string, any> }`
- **Error**: `{ "error": { "code": string, "message": string, "details"?: any } }`

### Endpoints
1. `GET /api/health`: Basic service liveness and database connection ping.
2. `POST /api/auth/session`: Create or refresh an isolated student session.
3. `GET /api/opportunities`:
   - Query parameters: `search`, `category`, `status` (`open`, `closing_soon`, `expired`, `unannounced`), `page`, `limit`.
   - Returns paginated source-backed opportunities with computed countdown metrics.
4. `GET /api/opportunities/:id`: Full details, checklist schema, and official source links.
5. `GET /api/opportunities/:id/calendar.ics`: RFC 5545 calendar file download containing start and closing reminders.
6. `GET /api/user/saved`: List all saved opportunities for the authenticated user.
7. `POST /api/user/saved`: Toggle save state for an opportunity `{ "opportunityId": string }`.
8. `GET /api/user/checklist`: Retrieve all checklist progression states for the authenticated user.
9. `PUT /api/user/checklist`: Update a step status `{ "opportunityId": string, "stepId": string, "status": "pending"|"in_progress"|"completed" }`.
10. `GET /api/portals`: List curated government portals with recent audit records and tested scopes.
11. `POST /api/portals/:id/check`: Trigger an SSRF-hardened audit probe against an allowlisted portal.
12. `GET /api/dashboard/stats`: Returns calculated totals (total active schemes, urgent deadlines < 15 days, saved count, checklist progress, portal reachability index) calculated directly via SQL aggregation.

---

## 7. Phased Implementation Plan

### Phase 1: Storage, Architecture Foundation & Security Layer
- Initialize SQLite database engine in `src/server/db.ts` with schema migrations, indexes, and WAL configuration.
- Setup Express application in `server.ts` with security headers, request parsers, and Vite development middleware.
- Configure production static file serving from `dist/` with fallback to `index.html`.
- Implement Session Authentication middleware and repository interfaces.

### Phase 2: Core Opportunity Engine & Discovery UI
- Seed validated catalog records with explicit verification states (`verified`, `provisional`, `demo`).
- Implement `OpportunityService` with server-side search, filtering, and nullable date math.
- Build Opportunity Directory UI in React adhering to the Civic Clarity design system (unboxed metadata, clean typography, responsive layout).

### Phase 3: Scheme-Specific Checklists & User Tracking
- Implement User Session API, Saved Opportunities controller, and Checklist controller.
- Build Opportunity Detail drawer and Scheme-Specific Checklist Manager with conditional requirement indicators.
- Implement `.ics` calendar generator service and browser download action.

### Phase 4: SSRF-Hardened Portal Monitoring Console
- Implement `PortalAuditService` with DNS pre-check, allowlist validation, redirect revalidation, and timeout handling.
- Build Portal Status dashboard displaying honest audit records, latency metrics, and clear disclaimers regarding untested transactional steps.

### Phase 5: Civic Dashboard & Metrics Aggregation
- Implement `GET /api/dashboard/stats` with SQL queries (`COUNT`, `SUM`).
- Build Dashboard overview screen showing live calculated metrics, urgent deadlines banner, and quick-action access.

### Phase 6: Automated Verification, Security Tests & Production Build
- Write comprehensive automated tests in `tests/`:
  - Opportunity queries and nullable date calculations.
  - Cross-user authorization isolation.
  - SSRF defense tests (blocked localhost, blocked private IPs, blocked redirects).
  - Portal status classification and timeout handling.
  - Production build verification (`npm run build`).

---

## 8. Test Plan & Acceptance Criteria

### Automated Test Matrix
1. **SSRF & Network Defense Tests**:
   - Verify request to `http://127.0.0.1` is blocked with `400 Invalid Target`.
   - Verify request to internal IP `http://192.168.1.5` is blocked.
   - Verify request to unapproved domain `https://google.com` is rejected by host allowlist.
   - Verify redirect to localhost is caught and aborted.
2. **Authorization & Multi-User Isolation Tests**:
   - Verify User A cannot fetch or mutate User B's saved opportunities or checklist steps.
   - Verify invalid session tokens return `401 Unauthorized`.
3. **Data Quality & Date Calculations**:
   - Opportunities with `deadline: null` correctly return status `unannounced` with clean UI display ("Dates Pending").
   - Opportunities with past deadlines return status `expired`.
   - Opportunities with future start dates return status `opening_soon`.
4. **Portal Audit Classification**:
   - Mock HTTP 200 within 200ms classifies as `reachable`.
   - Mock HTTP 200 with 2800ms latency classifies as `degraded`.
   - Mock HTTP 503 or network timeout classifies as `issue`.
5. **Production Build & Asset Delivery**:
   - `npm run build` succeeds without TypeScript compilation or bundle errors.
   - Express server serves compiled static bundle in production mode.

---

## 9. Change Log (Revisions from Prior Plan)

| Item | Prior Draft | Revised Architectural Blueprint | Rationale |
| :--- | :--- | :--- | :--- |
| **User Identity** | Client-generated `X-Margdarshak-User-ID` header | Cryptographic server-side session tokens (`user_sessions` table) | Prevents arbitrary client impersonation and cross-user data tampering. |
| **Storage Architecture** | Generic JSON / undefined persistence | Relational SQLite with WAL mode + Repository Abstraction | Guarantees atomic writes and data integrity, with a clean interface for PostgreSQL migration. |
| **Portal Monitoring** | Ambiguous live checks | SSRF-hardened probe (DNS check, IP filter, allowlist, redirect guard) | Eliminates critical security vulnerabilities and honestly bounds tested scope. |
| **Opportunity Dates** | Assumed mandatory opening and closing dates | Nullable date fields (`ISO8601 \| null`) with graceful UI handling | Prevents hallucinating application cycles when official notifications are pending. |
| **Checklist Scope** | Generic universal checklist steps | Scheme-specific checklists with explicit conditional indicators | Accurately reflects real government guidelines where documents vary by applicant. |
| **Seed Dataset** | Described as completely verified | Explicitly triaged into `verified`, `provisional`, and `demo` | Maintains strict intellectual honesty regarding the current verification state of records. |
