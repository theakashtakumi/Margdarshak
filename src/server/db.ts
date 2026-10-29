import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import fs from 'node:fs';

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

  // 2. Portals Table (Independent civic portal entity)
  db.exec(`
    CREATE TABLE IF NOT EXISTS portals (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      official_url TEXT NOT NULL,
      verified_hostname TEXT NOT NULL,
      description TEXT NOT NULL,
      operating_authority TEXT NOT NULL,
      category TEXT NOT NULL,
      services_offered TEXT NOT NULL,
      verification_state TEXT NOT NULL CHECK(verification_state IN ('verified', 'provisional', 'demo')),
      last_verified_at TEXT NOT NULL
    );
  `);

  // 3. Portal Monitoring History (Separate history log)
  db.exec(`
    CREATE TABLE IF NOT EXISTS portal_monitoring_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      portal_id TEXT NOT NULL,
      check_timestamp TEXT NOT NULL,
      monitoring_method TEXT NOT NULL CHECK(monitoring_method IN ('curated_audit', 'automated_probe')),
      tested_scope TEXT NOT NULL,
      status TEXT NOT NULL CHECK(status IN ('reachable', 'degraded', 'issue', 'unknown', 'monitoring_unavailable')),
      http_status INTEGER,
      latency_ms INTEGER,
      diagnostic_notes TEXT NOT NULL,
      FOREIGN KEY (portal_id) REFERENCES portals(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_monitoring_portal_time ON portal_monitoring_records(portal_id, check_timestamp DESC);
  `);

  // 4. Opportunity-to-Portal Junction Table (Many-to-Many explicit relationship)
  db.exec(`
    CREATE TABLE IF NOT EXISTS opportunity_portals (
      opportunity_id TEXT NOT NULL,
      portal_id TEXT NOT NULL,
      relationship_type TEXT NOT NULL CHECK(relationship_type IN ('application_portal', 'information_source', 'registration_portal', 'notice_portal')),
      official_reference_url TEXT,
      relationship_notes TEXT,
      PRIMARY KEY (opportunity_id, portal_id, relationship_type),
      FOREIGN KEY (opportunity_id) REFERENCES opportunities(id) ON DELETE CASCADE,
      FOREIGN KEY (portal_id) REFERENCES portals(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_opp_portals_opp ON opportunity_portals(opportunity_id);
    CREATE INDEX IF NOT EXISTS idx_opp_portals_portal ON opportunity_portals(portal_id);
  `);

  // 5. User Sessions Table
  db.exec(`
    CREATE TABLE IF NOT EXISTS user_sessions (
      session_token TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      created_at TEXT NOT NULL,
      expires_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON user_sessions(user_id);
  `);

  // 6. User Saved Opportunities
  db.exec(`
    CREATE TABLE IF NOT EXISTS user_saved_opportunities (
      user_id TEXT NOT NULL,
      opportunity_id TEXT NOT NULL,
      saved_at TEXT NOT NULL,
      PRIMARY KEY (user_id, opportunity_id),
      FOREIGN KEY (opportunity_id) REFERENCES opportunities(id) ON DELETE CASCADE
    );
  `);

  // 7. User Checklist Progress
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

  // Seed opportunities, portals, relationships, and audit history
  seedOpportunities(db);
  seedPortals(db);
  seedOpportunityPortals(db);
  seedInitialMonitoringHistory(db);
}

function seedOpportunities(db: DatabaseSync) {
  const upsertStmt = db.prepare(`
    INSERT INTO opportunities (
      id, title, category, academic_level, issuing_authority, official_url,
      verified_domain, description, eligibility_summary, financial_benefit,
      opening_date, deadline, official_source_url, verification_state,
      last_verified_at, checklist_schema
    ) VALUES (
      ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
    )
    ON CONFLICT(id) DO UPDATE SET
      title = excluded.title,
      category = excluded.category,
      academic_level = excluded.academic_level,
      issuing_authority = excluded.issuing_authority,
      official_url = excluded.official_url,
      verified_domain = excluded.verified_domain,
      description = excluded.description,
      eligibility_summary = excluded.eligibility_summary,
      financial_benefit = excluded.financial_benefit,
      opening_date = excluded.opening_date,
      deadline = excluded.deadline,
      official_source_url = excluded.official_source_url,
      verification_state = excluded.verification_state,
      last_verified_at = excluded.last_verified_at,
      checklist_schema = excluded.checklist_schema
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
      id: 'opp-aicte-pragati-2026',
      title: 'AICTE Pragati Scholarship for Girl Students (Technical Degree/Diploma)',
      category: 'scholarship',
      academic_level: 'Undergraduate',
      issuing_authority: 'All India Council for Technical Education (AICTE), Ministry of Education',
      official_url: 'https://scholarships.gov.in',
      verified_domain: 'scholarships.gov.in',
      description: 'Empowers young women to pursue technical education by providing annual tuition and educational expense assistance for degree and diploma programs.',
      eligibility_summary: 'Girl student admitted to 1st year of degree/diploma program in AICTE approved institution; family income not exceeding ₹8,00,000 p.a.; maximum two girls per family.',
      financial_benefit: '₹50,000/year for every year of study towards college fee, books, software, and equipment',
      opening_date: '2026-08-01T00:00:00Z',
      deadline: '2026-11-15T23:59:59Z',
      official_source_url: 'https://www.aicte-india.org/schemes/students-development-schemes/Pragati',
      verification_state: 'verified',
      last_verified_at: '2026-10-27T10:00:00Z',
      checklist_schema: JSON.stringify([
        {
          id: 'step-pragati-1',
          title: 'Class 10th and 12th Marksheet',
          description: 'Verified marksheet from recognized state/central secondary education board.',
          is_mandatory: true,
          condition_note: null,
          official_reference_url: 'https://scholarships.gov.in'
        },
        {
          id: 'step-pragati-2',
          title: 'Parental Annual Income Certificate (<= ₹8 LPA)',
          description: 'Issued by competent Tehsildar/Sub-Divisional Magistrate for current financial year.',
          is_mandatory: true,
          condition_note: null,
          official_reference_url: 'https://scholarships.gov.in'
        },
        {
          id: 'step-pragati-3',
          title: 'AICTE Institution Admission Bonafide Letter & Fee Receipt',
          description: 'Signed certificate from college registrar confirming 1st-year technical degree/diploma seat.',
          is_mandatory: true,
          condition_note: null,
          official_reference_url: 'https://scholarships.gov.in'
        },
        {
          id: 'step-pragati-4',
          title: 'Two-Girl Child Family Declaration Affidavit',
          description: 'Self-declaration by parents certifying girl child quota conditions.',
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
      id: 'opp-pwd-postmatric-2026',
      title: 'Post-Matric Scholarship for Students with Disabilities',
      category: 'scholarship',
      academic_level: 'Undergraduate',
      issuing_authority: 'Department of Empowerment of Persons with Disabilities, Ministry of Social Justice',
      official_url: 'https://scholarships.gov.in',
      verified_domain: 'scholarships.gov.in',
      description: 'Supports higher education among students with benchmark disabilities through comprehensive maintenance, book, and disability allowance.',
      eligibility_summary: 'Disability >= 40% with valid UDID or disability certificate; studying in recognized post-matric course; gross family income <= ₹2,50,000 p.a.',
      financial_benefit: 'Maintenance allowance up to ₹1,600/month + book grant + disability escort allowance',
      opening_date: '2026-07-15T00:00:00Z',
      deadline: '2026-12-10T23:59:59Z',
      official_source_url: 'https://disabilityaffairs.gov.in/content/page/post-matric-scholarship.php',
      verification_state: 'verified',
      last_verified_at: '2026-10-26T12:00:00Z',
      checklist_schema: JSON.stringify([
        {
          id: 'step-pwd-1',
          title: 'UDID Card / Government Medical Disability Certificate',
          description: 'Verification of 40% or more benchmark disability issued by authorized medical board.',
          is_mandatory: true,
          condition_note: null,
          official_reference_url: 'https://scholarships.gov.in'
        },
        {
          id: 'step-pwd-2',
          title: 'Parental Annual Income Certificate (<= ₹2.5 LPA)',
          description: 'Income certificate issued by revenue authority.',
          is_mandatory: true,
          condition_note: null,
          official_reference_url: 'https://scholarships.gov.in'
        },
        {
          id: 'step-pwd-3',
          title: 'Post-Matric Course Admission Receipt',
          description: 'Admission fee receipt and verified college bonafide certificate.',
          is_mandatory: true,
          condition_note: null,
          official_reference_url: 'https://scholarships.gov.in'
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
      id: 'opp-neet-ug-2027',
      title: 'NEET (UG) National Eligibility cum Entrance Test',
      category: 'examination',
      academic_level: '10+2 / Secondary',
      issuing_authority: 'National Testing Agency (NTA)',
      official_url: 'https://exams.nta.ac.in',
      verified_domain: 'nta.ac.in',
      description: 'Single national entrance examination for admission to undergraduate medical (MBBS), dental (BDS), and AYUSH courses in all recognized medical institutions in India.',
      eligibility_summary: 'Passed or appearing in 10+2 with Physics, Chemistry, Biology/Biotechnology, and English; minimum 17 years of age.',
      financial_benefit: 'Eligibility for admission to state and central subsidized government medical colleges',
      opening_date: '2027-01-10T00:00:00Z',
      deadline: '2027-03-09T23:50:00Z',
      official_source_url: 'https://exams.nta.ac.in/NEET/',
      verification_state: 'provisional',
      last_verified_at: '2026-10-28T09:00:00Z',
      checklist_schema: JSON.stringify([
        {
          id: 'step-neet-1',
          title: 'Class 10th & 12th Board Certificates',
          description: 'Passed or admit card details for 10+2 examination.',
          is_mandatory: true,
          condition_note: null,
          official_reference_url: 'https://exams.nta.ac.in'
        },
        {
          id: 'step-neet-2',
          title: 'Scanned Passport and Postcard Photo (White Background)',
          description: 'Recent clear photograph with candidate name and date of photo imprinted.',
          is_mandatory: true,
          condition_note: null,
          official_reference_url: 'https://exams.nta.ac.in'
        },
        {
          id: 'step-neet-3',
          title: 'Left and Right Hands Fingers and Thumb Impressions',
          description: 'Clear ink impression scanned conforming to NTA specifications.',
          is_mandatory: true,
          condition_note: null,
          official_reference_url: 'https://exams.nta.ac.in'
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
      opening_date: null,
      deadline: null,
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
    upsertStmt.run(
      r.id, r.title, r.category, r.academic_level, r.issuing_authority,
      r.official_url, r.verified_domain, r.description, r.eligibility_summary,
      r.financial_benefit, r.opening_date, r.deadline, r.official_source_url,
      r.verification_state, r.last_verified_at, r.checklist_schema
    );
  }
}

function seedPortals(db: DatabaseSync) {
  const upsertStmt = db.prepare(`
    INSERT INTO portals (
      id, name, official_url, verified_hostname, description,
      operating_authority, category, services_offered, verification_state, last_verified_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      name = excluded.name,
      official_url = excluded.official_url,
      verified_hostname = excluded.verified_hostname,
      description = excluded.description,
      operating_authority = excluded.operating_authority,
      category = excluded.category,
      services_offered = excluded.services_offered,
      verification_state = excluded.verification_state,
      last_verified_at = excluded.last_verified_at
  `);

  const portals = [
    {
      id: 'portal-nsp',
      name: 'National Scholarship Portal (NSP)',
      official_url: 'https://scholarships.gov.in',
      verified_hostname: 'scholarships.gov.in',
      description: 'Apex central portal for pan-India Government scholarship applications, student verification, institute KYC, and direct DBT fund transfers.',
      operating_authority: 'National Informatics Centre (NIC) & Ministry of Electronics and Information Technology',
      category: 'scholarship_gateway',
      services_offered: JSON.stringify([
        'Student Universal Registration & Profile',
        'Multi-Ministry Scholarship Applications',
        'Institute Bonafide Verification',
        'National Automated Clearing House (NACH) DBT Tracking'
      ]),
      verification_state: 'verified',
      last_verified_at: '2026-10-29T08:15:00Z'
    },
    {
      id: 'portal-upsc-online',
      name: 'UPSC Online Examination Portal',
      official_url: 'https://upsconline.nic.in',
      verified_hostname: 'upsconline.nic.in',
      description: 'Official application engine for national civil, defense, and engineering recruitment examinations administered by UPSC.',
      operating_authority: 'Union Public Service Commission (UPSC)',
      category: 'examination_portal',
      services_offered: JSON.stringify([
        'One-Time Registration (OTR) Lifecycle',
        'Civil Services Preliminary & Mains Application',
        'Admit Card Download & Centre Allotment',
        'e-Challan & Online Fee Payment Gateway'
      ]),
      verification_state: 'verified',
      last_verified_at: '2026-10-29T08:20:00Z'
    },
    {
      id: 'portal-upsc-gov',
      name: 'Union Public Service Commission Gazette & Notices',
      official_url: 'https://upsc.gov.in',
      verified_hostname: 'upsc.gov.in',
      description: 'Authoritative departmental repository for active examination notifications, syllabi, previous question papers, and final recruitment press releases.',
      operating_authority: 'Union Public Service Commission (UPSC)',
      category: 'civic_records',
      services_offered: JSON.stringify([
        'Annual Examination Calendar Gazette',
        'Detailed Syllabus & Examination Scheme Rules',
        'Answer Keys & Cut-Off Marks Disclosure',
        'Recruitment Interview Schedule Notices'
      ]),
      verification_state: 'verified',
      last_verified_at: '2026-10-29T08:20:00Z'
    },
    {
      id: 'portal-nta',
      name: 'National Testing Agency (NTA)',
      official_url: 'https://nta.ac.in',
      verified_hostname: 'nta.ac.in',
      description: 'Specialized testing organization conducting premier entrance assessments (UGC-NET, NEET-UG, JEE Main, CMAT) across India.',
      operating_authority: 'Department of Higher Education, Ministry of Education',
      category: 'examination_portal',
      services_offered: JSON.stringify([
        'Centralized Examination Information Bulletins',
        'Public Circulars & Calendar Updates',
        'Mock Test Practice Interface',
        'Score Card Score Normalization Reports'
      ]),
      verification_state: 'verified',
      last_verified_at: '2026-10-29T08:05:00Z'
    },
    {
      id: 'portal-ugcnet',
      name: 'UGC-NET Examination Portal',
      official_url: 'https://ugcnet.nta.ac.in',
      verified_hostname: 'ugcnet.nta.ac.in',
      description: 'Dedicated applicant transaction portal for UGC National Eligibility Test registration, application form submission, and city intimation slips.',
      operating_authority: 'National Testing Agency (NTA)',
      category: 'examination_portal',
      services_offered: JSON.stringify([
        'Online Examination Registration & Fee Payment',
        'Correction Window Form Editing',
        'Advance City Intimation Slip Download',
        'Final Scorecard & JRF Award Letter Generation'
      ]),
      verification_state: 'verified',
      last_verified_at: '2026-10-29T08:05:00Z'
    },
    {
      id: 'portal-pmrf',
      name: 'PMRF National Coordination Portal',
      official_url: 'https://www.pmrf.in',
      verified_hostname: 'www.pmrf.in',
      description: 'Central administrative gateway for Prime Minister’s Research Fellowship candidate nomination review, guidelines, and nodal coordinator access.',
      operating_authority: 'National Coordination Committee (IITs & IISc)',
      category: 'education_portal',
      services_offered: JSON.stringify([
        'Doctoral Fellowship Guidelines & Rulebook',
        'Participating IISc/IIT Nodal Center Directory',
        'Research Progress Review Schedules'
      ]),
      verification_state: 'verified',
      last_verified_at: '2026-10-29T07:45:00Z'
    },
    {
      id: 'portal-digilocker',
      name: 'DigiLocker National Academic Depository',
      official_url: 'https://digilocker.gov.in',
      verified_hostname: 'digilocker.gov.in',
      description: 'Digital India flagship platform providing paperless access to verified digital marksheet certificates and academic identity documents.',
      operating_authority: 'Ministry of Electronics and Information Technology (MeitY)',
      category: 'civic_records',
      services_offered: JSON.stringify([
        'Aadhaar e-KYC Verification',
        'Class 10 & 12 Digital Marksheet Issuance',
        'Caste & Income Certificate Integration'
      ]),
      verification_state: 'verified',
      last_verified_at: '2026-10-28T12:00:00Z'
    }
  ];

  for (const p of portals) {
    upsertStmt.run(
      p.id, p.name, p.official_url, p.verified_hostname, p.description,
      p.operating_authority, p.category, p.services_offered, p.verification_state, p.last_verified_at
    );
  }
}

function seedOpportunityPortals(db: DatabaseSync) {
  const upsertStmt = db.prepare(`
    INSERT INTO opportunity_portals (
      opportunity_id, portal_id, relationship_type, official_reference_url, relationship_notes
    ) VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(opportunity_id, portal_id, relationship_type) DO UPDATE SET
      official_reference_url = excluded.official_reference_url,
      relationship_notes = excluded.relationship_notes
  `);

  // Explicit many-to-many mappings
  const relationships = [
    // CSSS linked to NSP (application) and DigiLocker (registration/verification)
    {
      opportunity_id: 'opp-csss-2026',
      portal_id: 'portal-nsp',
      relationship_type: 'application_portal',
      official_reference_url: 'https://scholarships.gov.in',
      relationship_notes: 'Primary digital application gateway for student registration and DBT verification.'
    },
    {
      opportunity_id: 'opp-csss-2026',
      portal_id: 'portal-digilocker',
      relationship_type: 'registration_portal',
      official_reference_url: 'https://digilocker.gov.in',
      relationship_notes: 'Provides verified digital Class 12 marksheet fetching directly into the NSP application.'
    },

    // Pragati linked to NSP (One portal serving multiple opportunities)
    {
      opportunity_id: 'opp-aicte-pragati-2026',
      portal_id: 'portal-nsp',
      relationship_type: 'application_portal',
      official_reference_url: 'https://scholarships.gov.in',
      relationship_notes: 'Submitted under the AICTE Schemes tab on the National Scholarship Portal.'
    },

    // PwD Post-Matric linked to NSP
    {
      opportunity_id: 'opp-pwd-postmatric-2026',
      portal_id: 'portal-nsp',
      relationship_type: 'application_portal',
      official_reference_url: 'https://scholarships.gov.in',
      relationship_notes: 'Online application submitted under Department of Empowerment of Persons with Disabilities.'
    },

    // Demo state fellowship linked to NSP
    {
      opportunity_id: 'opp-demo-state-fellowship',
      portal_id: 'portal-nsp',
      relationship_type: 'information_source',
      official_reference_url: 'https://scholarships.gov.in',
      relationship_notes: 'Demonstration reference linkage.'
    },

    // UPSC CSE linked to upsconline.nic.in (application & OTR) AND upsc.gov.in (notices & gazette)
    {
      opportunity_id: 'opp-upsc-cse-2027',
      portal_id: 'portal-upsc-online',
      relationship_type: 'application_portal',
      official_reference_url: 'https://upsconline.nic.in',
      relationship_notes: 'Portal for One Time Registration (OTR) and online application submission.'
    },
    {
      opportunity_id: 'opp-upsc-cse-2027',
      portal_id: 'portal-upsc-online',
      relationship_type: 'registration_portal',
      official_reference_url: 'https://upsconline.nic.in/upsc/OTRP/',
      relationship_notes: 'Required One-Time Registration before applying for CSE.'
    },
    {
      opportunity_id: 'opp-upsc-cse-2027',
      portal_id: 'portal-upsc-gov',
      relationship_type: 'notice_portal',
      official_reference_url: 'https://upsc.gov.in/examinations/active-exams',
      relationship_notes: 'Official gazette notification, exam rules, and syllabus bulletins published here.'
    },

    // UGC-NET linked to ugcnet.nta.ac.in (application) and nta.ac.in (notices)
    {
      opportunity_id: 'opp-ugc-net-2026',
      portal_id: 'portal-ugcnet',
      relationship_type: 'application_portal',
      official_reference_url: 'https://ugcnet.nta.ac.in',
      relationship_notes: 'Candidate portal for candidate login, application submission, and admit card download.'
    },
    {
      opportunity_id: 'opp-ugc-net-2026',
      portal_id: 'portal-nta',
      relationship_type: 'information_source',
      official_reference_url: 'https://nta.ac.in',
      relationship_notes: 'Apex examination body portal publishing examination calendar circulars.'
    },

    // NEET-UG linked to NTA
    {
      opportunity_id: 'opp-neet-ug-2027',
      portal_id: 'portal-nta',
      relationship_type: 'information_source',
      official_reference_url: 'https://nta.ac.in',
      relationship_notes: 'NTA circular announcements and eligibility clarification notices.'
    },

    // PMRF linked to pmrf.in
    {
      opportunity_id: 'opp-pmrf-2026',
      portal_id: 'portal-pmrf',
      relationship_type: 'application_portal',
      official_reference_url: 'https://www.pmrf.in',
      relationship_notes: 'Official doctoral fellowship application and nomination guidelines.'
    }
  ];

  for (const rel of relationships) {
    upsertStmt.run(
      rel.opportunity_id,
      rel.portal_id,
      rel.relationship_type,
      rel.official_reference_url,
      rel.relationship_notes
    );
  }
}

function seedInitialMonitoringHistory(db: DatabaseSync) {
  const countStmt = db.prepare('SELECT COUNT(*) as count FROM portal_monitoring_records');
  const countRow = countStmt.get() as { count: number };

  if (countRow.count === 0) {
    const insertStmt = db.prepare(`
      INSERT INTO portal_monitoring_records (
        portal_id, check_timestamp, monitoring_method, tested_scope,
        status, http_status, latency_ms, diagnostic_notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const initialHistory = [
      {
        portal_id: 'portal-nsp',
        check_timestamp: '2026-10-29T08:15:00Z',
        monitoring_method: 'curated_audit',
        tested_scope: 'homepage_tls_head_only',
        status: 'reachable',
        http_status: 200,
        latency_ms: 184,
        diagnostic_notes: 'Root TLS handshake nominal. Transactional services (Aadhaar OTP, student login, file upload) not verified in automated scope.'
      },
      {
        portal_id: 'portal-nsp',
        check_timestamp: '2026-10-29T04:00:00Z',
        monitoring_method: 'automated_probe',
        tested_scope: 'homepage_tls_head_only',
        status: 'reachable',
        http_status: 200,
        latency_ms: 195,
        diagnostic_notes: 'Scheduled probe successful.'
      },
      {
        portal_id: 'portal-upsc-online',
        check_timestamp: '2026-10-29T08:20:00Z',
        monitoring_method: 'curated_audit',
        tested_scope: 'homepage_tls_head_only',
        status: 'reachable',
        http_status: 200,
        latency_ms: 220,
        diagnostic_notes: 'Server responding nominally. One-Time Registration (OTR) server status not verified in automated scope.'
      },
      {
        portal_id: 'portal-upsc-gov',
        check_timestamp: '2026-10-29T08:20:00Z',
        monitoring_method: 'curated_audit',
        tested_scope: 'homepage_tls_head_only',
        status: 'reachable',
        http_status: 200,
        latency_ms: 178,
        diagnostic_notes: 'Gazette portal root response nominal.'
      },
      {
        portal_id: 'portal-nta',
        check_timestamp: '2026-10-29T08:05:00Z',
        monitoring_method: 'curated_audit',
        tested_scope: 'homepage_tls_head_only',
        status: 'reachable',
        http_status: 200,
        latency_ms: 310,
        diagnostic_notes: 'Gateway responsive. Third-party payment gateways and admit card distribution CDN are not audited here.'
      },
      {
        portal_id: 'portal-ugcnet',
        check_timestamp: '2026-10-29T08:05:00Z',
        monitoring_method: 'curated_audit',
        tested_scope: 'homepage_tls_head_only',
        status: 'reachable',
        http_status: 200,
        latency_ms: 245,
        diagnostic_notes: 'Application engine responding with valid TLS certificate.'
      },
      {
        portal_id: 'portal-pmrf',
        check_timestamp: '2026-10-29T07:45:00Z',
        monitoring_method: 'curated_audit',
        tested_scope: 'homepage_tls_head_only',
        status: 'reachable',
        http_status: 200,
        latency_ms: 145,
        diagnostic_notes: 'Homepage content verified. Internal nodal center review portals are restricted intranets.'
      }
      // Note: portal-digilocker intentionally has NO monitoring history records seeded yet (Unknown monitoring state)
    ];

    for (const h of initialHistory) {
      insertStmt.run(
        h.portal_id,
        h.check_timestamp,
        h.monitoring_method,
        h.tested_scope,
        h.status,
        h.http_status,
        h.latency_ms,
        h.diagnostic_notes
      );
    }
  }
}

export const db = getDatabase();
initDatabase(db);
