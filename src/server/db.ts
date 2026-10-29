import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import fs from 'node:fs';

// Ensure data directory exists
const DATA_DIR = path.resolve(process.cwd(), 'data');
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const DB_PATH = path.join(DATA_DIR, 'margdarshak.sqlite');

export function getDatabase(dbPath = DB_PATH) {
  const db = new DatabaseSync(dbPath);
  db.exec('PRAGMA foreign_keys = ON;');
  db.exec('PRAGMA journal_mode = WAL;');
  return db;
}

export function initDatabase(db: DatabaseSync) {
  // 1. Opportunities Table
  db.exec(`
    CREATE TABLE IF NOT EXISTS opportunities (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      category TEXT NOT NULL CHECK(category IN ('scholarship', 'examination')),
      academic_level TEXT NOT NULL,
      issuing_authority TEXT NOT NULL,
      official_url TEXT NOT NULL,
      verified_domain TEXT NOT NULL,
      description TEXT NOT NULL,
      eligibility_summary TEXT NOT NULL,
      financial_benefit TEXT,
      opening_date TEXT,
      deadline TEXT,
      official_source_url TEXT NOT NULL,
      verification_state TEXT NOT NULL CHECK(verification_state IN ('verified', 'provisional', 'demo')),
      last_verified_at TEXT NOT NULL,
      checklist_schema TEXT NOT NULL
    );
  `);

  // 2. User Sessions Table
  db.exec(`
    CREATE TABLE IF NOT EXISTS user_sessions (
      session_token TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      created_at TEXT NOT NULL,
      expires_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON user_sessions(user_id);
  `);

  // 3. User Saved Opportunities
  db.exec(`
    CREATE TABLE IF NOT EXISTS user_saved_opportunities (
      user_id TEXT NOT NULL,
      opportunity_id TEXT NOT NULL,
      saved_at TEXT NOT NULL,
      PRIMARY KEY (user_id, opportunity_id),
      FOREIGN KEY (opportunity_id) REFERENCES opportunities(id) ON DELETE CASCADE
    );
  `);

  // 4. User Checklist Progress
  db.exec(`
    CREATE TABLE IF NOT EXISTS user_checklist_progress (
      user_id TEXT NOT NULL,
      opportunity_id TEXT NOT NULL,
      step_id TEXT NOT NULL,
      status TEXT NOT NULL CHECK(status IN ('pending', 'in_progress', 'completed')),
      updated_at TEXT NOT NULL,
      PRIMARY KEY (user_id, opportunity_id, step_id),
      FOREIGN KEY (opportunity_id) REFERENCES opportunities(id) ON DELETE CASCADE
    );
  `);

  // 5. Portal Audit Records
  db.exec(`
    CREATE TABLE IF NOT EXISTS portal_audit_records (
      portal_id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      official_url TEXT NOT NULL,
      allowlisted_host TEXT NOT NULL,
      monitoring_method TEXT NOT NULL CHECK(monitoring_method IN ('curated_audit', 'automated_probe')),
      tested_scope TEXT NOT NULL,
      status TEXT NOT NULL CHECK(status IN ('reachable', 'degraded', 'issue', 'unknown', 'monitoring_unavailable')),
      http_status INTEGER,
      latency_ms INTEGER,
      last_checked_at TEXT NOT NULL,
      disclaimer_notes TEXT NOT NULL
    );
  `);

  // Seed opportunities if empty
  const countStmt = db.prepare('SELECT COUNT(*) as count FROM opportunities');
  const countRow = countStmt.get() as { count: number };

  if (countRow.count === 0) {
    seedInitialOpportunities(db);
  }

  // Seed portal audits if empty
  const portalCountStmt = db.prepare('SELECT COUNT(*) as count FROM portal_audit_records');
  const portalCountRow = portalCountStmt.get() as { count: number };

  if (portalCountRow.count === 0) {
    seedInitialPortals(db);
  }
}

function seedInitialOpportunities(db: DatabaseSync) {
  const insertStmt = db.prepare(`
    INSERT INTO opportunities (
      id, title, category, academic_level, issuing_authority, official_url,
      verified_domain, description, eligibility_summary, financial_benefit,
      opening_date, deadline, official_source_url, verification_state,
      last_verified_at, checklist_schema
    ) VALUES (
      ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
    )
  `);

  const records = [
    {
      id: 'opp-csss-2026',
      title: 'Central Sector Scheme of Scholarship for College and University Students',
      category: 'scholarship',
      academic_level: 'Undergraduate',
      issuing_authority: 'Department of Higher Education, Ministry of Education, Govt. of India',
      official_url: 'https://scholarships.gov.in',
      verified_domain: 'scholarships.gov.in',
      description: 'Provides financial assistance to meritorious students from low-income families to meet part of their daily expenses while pursuing higher studies in recognized institutions.',
      eligibility_summary: 'Top 20th percentile in respective Class 12 board examination; gross parental/family income <= ₹4,50,000 p.a.; admitted in regular full-time undergraduate or professional course.',
      financial_benefit: '₹12,000/year for first 3 years of UG; ₹20,000/year at PG level (direct DBT disbursal)',
      opening_date: '2026-07-01T00:00:00Z',
      deadline: '2026-11-30T23:59:59Z',
      official_source_url: 'https://scholarships.gov.in/public/schemeGuidelines/Guidelines_DOHE_CSSS.pdf',
      verification_state: 'verified',
      last_verified_at: '2026-10-25T14:30:00Z',
      checklist_schema: JSON.stringify([
        {
          id: 'step-1',
          title: 'Class 12th Board Marksheet & Percentile Certificate',
          description: 'Official marksheet showing score within top 20th percentile of relevant state/central board.',
          is_mandatory: true,
          condition_note: null,
          official_reference_url: 'https://scholarships.gov.in'
        },
        {
          id: 'step-2',
          title: 'Competent Authority Annual Income Certificate',
          description: 'Valid revenue authority income certificate verifying gross family income <= ₹4.5 Lakhs.',
          is_mandatory: true,
          condition_note: null,
          official_reference_url: 'https://scholarships.gov.in'
        },
        {
          id: 'step-3',
          title: 'Aadhaar-Seeded Bank Passbook / DBT Consent',
          description: 'Savings bank account strictly seeded with applicant Aadhaar for National Automated Clearing House (NACH) DBT.',
          is_mandatory: true,
          condition_note: null,
          official_reference_url: 'https://scholarships.gov.in'
        },
        {
          id: 'step-4',
          title: 'College Bonafide Student Certificate',
          description: 'Duly sealed certificate from principal/head of institution confirming regular full-time enrollment.',
          is_mandatory: true,
          condition_note: null,
          official_reference_url: 'https://scholarships.gov.in'
        }
      ])
    },
    {
      id: 'opp-pmrf-2026',
      title: "Prime Minister's Research Fellowship (PMRF)",
      category: 'scholarship',
      academic_level: 'Doctorate',
      issuing_authority: 'Ministry of Education & National Coordination Committee (IISc/IITs)',
      official_url: 'https://www.pmrf.in',
      verified_domain: 'pmrf.in',
      description: 'Attracts exceptional talent into doctoral research at premier Indian institutions (IISc, IITs, IISERs) with substantial research fellowships and annual contingency grants.',
      eligibility_summary: 'Completed or in final year of B.Tech/Integrated M.Tech with CGPA >= 8.0 from recognized CFTI, or qualifying GATE score >= 650 with master degree; offered PhD admission at PMRF granting institution.',
      financial_benefit: '₹70,000 to ₹80,000/month fellowship + ₹2,00,000/year research contingency grant',
      opening_date: '2026-08-15T00:00:00Z',
      deadline: '2026-11-15T18:00:00Z',
      official_source_url: 'https://www.pmrf.in/guidelines',
      verification_state: 'verified',
      last_verified_at: '2026-10-24T11:00:00Z',
      checklist_schema: JSON.stringify([
        {
          id: 'step-pmrf-1',
          title: 'Comprehensive Research Proposal Abstract',
          description: 'Focused 1000-word proposal detailing problem formulation, methodology, and national/civic relevance.',
          is_mandatory: true,
          condition_note: null,
          official_reference_url: 'https://www.pmrf.in/guidelines'
        },
        {
          id: 'step-pmrf-2',
          title: 'Official Academic Transcripts with CGPA Formula',
          description: 'Official transcripts verifying cumulative grade point average >= 8.00 on a 10-point scale.',
          is_mandatory: true,
          condition_note: null,
          official_reference_url: 'https://www.pmrf.in/guidelines'
        },
        {
          id: 'step-pmrf-3',
          title: 'Valid National GATE Scorecard',
          description: 'Required if applicant is not a graduate of a Centrally Funded Technical Institute (CFTI).',
          is_mandatory: false,
          condition_note: 'Mandatory only for non-CFTI graduates or candidates with CGPA below CFTI waiver threshold.',
          official_reference_url: 'https://www.pmrf.in/guidelines'
        },
        {
          id: 'step-pmrf-4',
          title: 'Two Confidential Letters of Academic Recommendation',
          description: 'Endorsements from research faculty familiar with applicant analytical capabilities.',
          is_mandatory: true,
          condition_note: null,
          official_reference_url: 'https://www.pmrf.in/guidelines'
        }
      ])
    },
    {
      id: 'opp-upsc-cse-2027',
      title: 'Civil Services Examination (CSE) 2027',
      category: 'examination',
      academic_level: 'Graduate',
      issuing_authority: 'Union Public Service Commission (UPSC)',
      official_url: 'https://upsconline.nic.in',
      verified_domain: 'upsconline.nic.in',
      description: 'National competitive examination conducted for recruitment to prestigious Indian administrative, police, and foreign civil services (IAS, IPS, IFS, IRS).',
      eligibility_summary: 'Citizen of India; hold a degree of any recognized university; age between 21 and 32 years as of August 1 of exam year (relaxations for SC/ST/OBC/PwD).',
      financial_benefit: 'Level 10 (Pay Matrix ₹56,100 - ₹1,77,500) entry-scale civil appointment',
      opening_date: '2026-12-15T00:00:00Z',
      deadline: '2027-01-20T18:00:00Z',
      official_source_url: 'https://upsc.gov.in/examinations/active-exams',
      verification_state: 'provisional',
      last_verified_at: '2026-10-22T09:15:00Z',
      checklist_schema: JSON.stringify([
        {
          id: 'step-upsc-1',
          title: 'One Time Registration (OTR) Profile Completion',
          description: 'Verified OTR registration on upsconline.nic.in with verified mobile and email.',
          is_mandatory: true,
          condition_note: null,
          official_reference_url: 'https://upsconline.nic.in'
        },
        {
          id: 'step-upsc-2',
          title: 'Government Photo Identity Card',
          description: 'Aadhaar Card, Passport, Voter ID, or PAN Card; exact number must be cited during application.',
          is_mandatory: true,
          condition_note: null,
          official_reference_url: 'https://upsconline.nic.in'
        },
        {
          id: 'step-upsc-3',
          title: 'Graduation Degree / Final Year Enrollment Certificate',
          description: 'Proof of qualifying graduation degree from a UGC-recognized university.',
          is_mandatory: true,
          condition_note: null,
          official_reference_url: 'https://upsconline.nic.in'
        },
        {
          id: 'step-upsc-4',
          title: 'Caste / Community / EWS / Disability Certificate',
          description: 'Official certificate in prescribed Central Govt. format issued prior to closing date.',
          is_mandatory: false,
          condition_note: 'Mandatory only for applicants claiming reservation benefits or age concessions.',
          official_reference_url: 'https://upsconline.nic.in'
        }
      ])
    },
    {
      id: 'opp-ugc-net-2026',
      title: 'UGC-NET Examination (Junior Research Fellowship & Assistant Professor)',
      category: 'examination',
      academic_level: 'Postgraduate',
      issuing_authority: 'National Testing Agency (NTA) & University Grants Commission',
      official_url: 'https://ugcnet.nta.ac.in',
      verified_domain: 'nta.ac.in',
      description: 'National eligibility determination test for Indian nationals for eligibility for Assistant Professor and award of Junior Research Fellowship (JRF) in Indian universities.',
      eligibility_summary: 'Master degree with at least 55% marks (50% for SC/ST/OBC-NCL/PwD) in Humanities, Social Sciences, Computer Applications, etc.',
      financial_benefit: 'JRF Fellowship of ₹37,000/month + HRA for initial 2 years; ₹42,000/month as SRF',
      opening_date: '2026-10-01T00:00:00Z',
      deadline: '2026-11-10T23:50:00Z',
      official_source_url: 'https://ugcnet.nta.ac.in/information-bulletin',
      verification_state: 'verified',
      last_verified_at: '2026-10-26T16:00:00Z',
      checklist_schema: JSON.stringify([
        {
          id: 'step-net-1',
          title: 'Master Degree Marksheets / Final Year Certificate',
          description: 'Official proof of postgraduate course completion or appearing status.',
          is_mandatory: true,
          condition_note: null,
          official_reference_url: 'https://ugcnet.nta.ac.in'
        },
        {
          id: 'step-net-2',
          title: 'Recent Scanned Passport Photograph & Signature',
          description: 'Clear photograph (10kb-200kb) with 80% face coverage against white background.',
          is_mandatory: true,
          condition_note: null,
          official_reference_url: 'https://ugcnet.nta.ac.in'
        },
        {
          id: 'step-net-3',
          title: 'Category / PwD Certificate (if applicable)',
          description: 'Competent authority certificate conforming to central list requirements.',
          is_mandatory: false,
          condition_note: 'Required only for fee concession or category seat allocation.',
          official_reference_url: 'https://ugcnet.nta.ac.in'
        }
      ])
    },
    {
      id: 'opp-demo-state-fellowship',
      title: 'State Public Policy Leadership Fellowship (Demonstration Fixture)',
      category: 'scholarship',
      academic_level: 'Graduate',
      issuing_authority: 'State Governance Department (Test Fixture)',
      official_url: 'https://scholarships.gov.in',
      verified_domain: 'scholarships.gov.in',
      description: 'Demonstration fixture designed for automated data-quality testing of unannounced application deadlines, optional document handling, and expired cycles.',
      eligibility_summary: 'Demonstration criteria: Graduates with public policy focus; demonstration data for UI resilience testing.',
      financial_benefit: '₹35,000/month demonstration stipend',
      opening_date: null, // Test nullable dates
      deadline: null,     // Test unannounced deadline
      official_source_url: 'https://scholarships.gov.in/public/demoGuidelines.pdf',
      verification_state: 'demo',
      last_verified_at: '2026-10-20T00:00:00Z',
      checklist_schema: JSON.stringify([
        {
          id: 'step-demo-1',
          title: 'Statement of Civic Purpose (Demo)',
          description: 'Sample essay demonstrating dynamic step checklist progression.',
          is_mandatory: true,
          condition_note: null,
          official_reference_url: 'https://scholarships.gov.in'
        },
        {
          id: 'step-demo-2',
          title: 'Optional State Residency Proof (Demo)',
          description: 'Demonstration conditional certificate requirement.',
          is_mandatory: false,
          condition_note: 'Required only if claiming state domicile incentive.',
          official_reference_url: 'https://scholarships.gov.in'
        }
      ])
    }
  ];

  for (const r of records) {
    insertStmt.run(
      r.id, r.title, r.category, r.academic_level, r.issuing_authority,
      r.official_url, r.verified_domain, r.description, r.eligibility_summary,
      r.financial_benefit, r.opening_date, r.deadline, r.official_source_url,
      r.verification_state, r.last_verified_at, r.checklist_schema
    );
  }
}

function seedInitialPortals(db: DatabaseSync) {
  const insertStmt = db.prepare(`
    INSERT INTO portal_audit_records (
      portal_id, name, official_url, allowlisted_host, monitoring_method,
      tested_scope, status, http_status, latency_ms, last_checked_at, disclaimer_notes
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const portals = [
    {
      portal_id: 'portal-nsp',
      name: 'National Scholarship Portal (NSP)',
      official_url: 'https://scholarships.gov.in',
      allowlisted_host: 'scholarships.gov.in',
      monitoring_method: 'curated_audit',
      tested_scope: 'homepage_tls_head_only',
      status: 'reachable',
      http_status: 200,
      latency_ms: 184,
      last_checked_at: '2026-10-29T08:15:00Z',
      disclaimer_notes: 'Automated check verifies root DNS and TLS handshake only. Internal transactional steps (Aadhaar OTP, student login, file upload) are not verified.'
    },
    {
      portal_id: 'portal-upsc',
      name: 'UPSC Online Application Portal',
      official_url: 'https://upsconline.nic.in',
      allowlisted_host: 'upsconline.nic.in',
      monitoring_method: 'curated_audit',
      tested_scope: 'homepage_tls_head_only',
      status: 'reachable',
      http_status: 200,
      latency_ms: 220,
      last_checked_at: '2026-10-29T08:20:00Z',
      disclaimer_notes: 'Server responding nominally. One-Time Registration (OTR) server status and photo cropping service reachability not verified in automated scope.'
    },
    {
      portal_id: 'portal-nta',
      name: 'National Testing Agency (NTA Exam Portal)',
      official_url: 'https://nta.ac.in',
      allowlisted_host: 'nta.ac.in',
      monitoring_method: 'curated_audit',
      tested_scope: 'homepage_tls_head_only',
      status: 'reachable',
      http_status: 200,
      latency_ms: 310,
      last_checked_at: '2026-10-29T08:05:00Z',
      disclaimer_notes: 'Gateway responsive. Admit card generation and payment gateway callbacks are third-party services and not audited here.'
    },
    {
      portal_id: 'portal-pmrf',
      name: 'PMRF National Coordination Portal',
      official_url: 'https://www.pmrf.in',
      allowlisted_host: 'pmrf.in',
      monitoring_method: 'curated_audit',
      tested_scope: 'homepage_tls_head_only',
      status: 'reachable',
      http_status: 200,
      latency_ms: 145,
      last_checked_at: '2026-10-29T07:45:00Z',
      disclaimer_notes: 'Homepage content verified. Nomination nodal center review portals are restricted internal intranets.'
    }
  ];

  for (const p of portals) {
    insertStmt.run(
      p.portal_id, p.name, p.official_url, p.allowlisted_host,
      p.monitoring_method, p.tested_scope, p.status, p.http_status,
      p.latency_ms, p.last_checked_at, p.disclaimer_notes
    );
  }
}

// Default singleton instance
export const db = getDatabase();
initDatabase(db);
