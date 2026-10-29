import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { OpportunityRepository, UserRepository, PortalRepository } from '../src/server/repositories.ts';
import { isPrivateOrReservedIP, validateAndProbePortalUrl, isHostAllowed } from '../src/server/ssrfGuard.ts';
import { calculateDeadlineInfo } from '../src/lib/dateUtils.ts';
import { generateOpportunityIcs } from '../src/server/calendar.ts';
import { getDatabase, initDatabase } from '../src/server/db.ts';

// Dedicated in-memory database for clean test isolation
const testDb = getDatabase(':memory:');
initDatabase(testDb);

const oppRepo = new OpportunityRepository(testDb);
const userRepo = new UserRepository(testDb);
const portalRepo = new PortalRepository(testDb);

describe('Opportunity Repository & Search Engine', () => {
  test('retrieves seeded opportunities with structured checklist schema', () => {
    const all = oppRepo.list();
    assert.ok(all.length >= 7, 'Should contain at least 7 seeded opportunities');

    const csss = all.find((o) => o.id === 'opp-csss-2026');
    assert.ok(csss, 'Central Sector Scholarship must be present');
    assert.equal(csss.verified_domain, 'scholarships.gov.in');
    assert.equal(csss.verification_state, 'verified');

    const steps = JSON.parse(csss.checklist_schema);
    assert.ok(Array.isArray(steps), 'Checklist schema must be a valid JSON array');
    assert.ok(steps.length >= 3, 'Must have at least 3 scheme-specific steps');
    assert.equal(steps[0].is_mandatory, true);
  });

  test('contains opportunity with unannounced / null deadline', () => {
    const fellowship = oppRepo.findById('opp-demo-state-fellowship');
    assert.ok(fellowship, 'State fellowship opportunity should be present');
    assert.equal(fellowship.deadline, null, 'Opportunity deadline should be null for unannounced schedules');
  });

  test('filters opportunities by category accurately', () => {
    const scholarships = oppRepo.list({ category: 'scholarship' });
    assert.ok(scholarships.every((s) => s.category === 'scholarship'));
    assert.ok(scholarships.length >= 4);

    const exams = oppRepo.list({ category: 'examination' });
    assert.ok(exams.every((e) => e.category === 'examination'));
    assert.ok(exams.length >= 3);
  });

  test('filters opportunities by academic level including 10+2 and Graduate', () => {
    const schoolLevel = oppRepo.list({ academic_level: '10+2 / Secondary' });
    assert.ok(schoolLevel.length >= 1);
    assert.equal(schoolLevel[0].id, 'opp-neet-ug-2027');

    const graduateLevel = oppRepo.list({ academic_level: 'Graduate' });
    assert.ok(graduateLevel.length >= 1);
    assert.ok(graduateLevel.some((g) => g.id === 'opp-upsc-cse-2027'));
  });

  test('supports server-side sorting by deadline_soonest, recently_updated, and alphabetical', () => {
    const alpha = oppRepo.list({ sort: 'alphabetical' });
    const alphaLabel = oppRepo.list({ sort: 'Alphabetical' });
    assert.equal(alpha[0].id, alphaLabel[0].id, 'Slug and display label must produce identical alphabetical order');
    for (let i = 0; i < alpha.length - 1; i++) {
      assert.ok(alpha[i].title.localeCompare(alpha[i + 1].title, undefined, { sensitivity: 'base' }) <= 0);
    }

    const recentlyUpdated = oppRepo.list({ sort: 'recently_updated' });
    const recentlyUpdatedLabel = oppRepo.list({ sort: 'Recently Updated' });
    assert.equal(recentlyUpdated[0].id, recentlyUpdatedLabel[0].id);
    for (let i = 0; i < recentlyUpdated.length - 1; i++) {
      assert.ok(new Date(recentlyUpdated[i].last_verified_at).getTime() >= new Date(recentlyUpdated[i + 1].last_verified_at).getTime());
    }

    const soonest = oppRepo.list({ sort: 'deadline_soonest' });
    const soonestLabel = oppRepo.list({ sort: 'Soonest Deadline' });
    assert.equal(soonest[0].id, soonestLabel[0].id);
    const datedOpps = soonest.filter((o) => o.deadline !== null);
    for (let i = 0; i < datedOpps.length - 1; i++) {
      assert.ok(new Date(datedOpps[i].deadline!).getTime() <= new Date(datedOpps[i + 1].deadline!).getTime());
    }
  });

  test('executes deep search across title, authority, eligibility, and domain', () => {
    const byEligibility = oppRepo.list({ search: 'UDID' });
    assert.ok(byEligibility.length >= 1);
    assert.equal(byEligibility[0].id, 'opp-pwd-postmatric-2026');

    const byDomain = oppRepo.list({ search: 'nta.ac.in' });
    assert.ok(byDomain.length >= 2);
  });

  test('computes accurate aggregated repository metrics', () => {
    const metrics = oppRepo.getMetrics();
    assert.ok(metrics.total >= 7);
    assert.ok(metrics.scholarships >= 4);
    assert.ok(metrics.examinations >= 3);
  });
});

describe('Independent Portals & Opportunity-Portal Relationships', () => {
  test('lists independent portals with verified hostnames and latest checks', () => {
    const portals = portalRepo.list();
    assert.ok(portals.length >= 6, 'Should have at least 6 seeded portals');

    const nsp = portals.find((p) => p.id === 'portal-nsp');
    assert.ok(nsp);
    assert.equal(nsp.verified_hostname, 'scholarships.gov.in');
    assert.ok(nsp.latest_check, 'NSP should have an audit check record');
    assert.equal(nsp.latest_check?.status, 'reachable');
  });

  test('handles portals with unknown / unprobed status gracefully', () => {
    const digilocker = portalRepo.findById('portal-digilocker');
    assert.ok(digilocker);
    assert.equal(digilocker.latest_check, null, 'DigiLocker should intentionally have null check to represent unknown status');
  });

  test('filters portals by category and search keyword', () => {
    const examPortals = portalRepo.list({ category: 'Examination Portal' });
    assert.ok(examPortals.length >= 2);
    assert.ok(examPortals.every((p) => p.category === 'examination_portal' || p.category === 'Examination Portal'));

    const searchResults = portalRepo.list({ search: 'UPSC' });
    assert.ok(searchResults.length >= 2);
    assert.ok(searchResults.every((p) => p.name.includes('UPSC') || p.operating_authority.includes('UPSC')));
  });

  test('retrieves multiple linked portals for a single opportunity', () => {
    const portals = oppRepo.getPortalsForOpportunity('opp-upsc-cse-2027');
    assert.ok(portals.length >= 2, 'UPSC CSE must link to at least 2 portals (application + information/records)');

    const relationTypes = portals.map((p) => p.relationship_type);
    assert.ok(relationTypes.includes('application_portal'));
    assert.ok(relationTypes.includes('notice_portal') || relationTypes.includes('information_source'));
  });

  test('retrieves multiple opportunities served by a single portal', () => {
    const opps = portalRepo.getOpportunitiesForPortal('portal-nsp');
    assert.ok(opps.length >= 2, 'NSP portal must service multiple scholarship opportunities');

    const ids = opps.map((o) => o.opportunity_id);
    assert.ok(ids.includes('opp-csss-2026'));
    assert.ok(ids.includes('opp-aicte-pragati-2026'));
  });

  test('records and retrieves monitoring history for a portal from PortalMonitoringHistory', () => {
    // Explicit query on the new PortalMonitoringHistory table
    const dbCheckStmt = testDb.prepare('SELECT COUNT(*) as count FROM PortalMonitoringHistory WHERE portal_id = ?');
    const row = dbCheckStmt.get('portal-nsp') as { count: number };
    assert.ok(row.count >= 1, 'PortalMonitoringHistory table must exist and contain seeded records for portal-nsp');

    const historyBefore = portalRepo.getMonitoringHistory('portal-nsp');
    assert.ok(historyBefore.length >= 1);

    const insertedId = portalRepo.addMonitoringRecord({
      portal_id: 'portal-nsp',
      check_timestamp: new Date().toISOString(),
      monitoring_method: 'automated_probe',
      tested_scope: 'homepage_tls_head_only',
      status: 'reachable',
      http_status: 200,
      latency_ms: 125,
      diagnostic_notes: 'Automated test diagnostic probe'
    });
    assert.ok(insertedId > 0);

    const historyAfter = portalRepo.getMonitoringHistory('portal-nsp', 50, 'DESC');
    assert.equal(historyAfter.length, historyBefore.length + 1);
    assert.equal(historyAfter[0].latency_ms, 125);
  });

  test('computes portal health ratio correctly', () => {
    const summary = portalRepo.getHealthSummary();
    assert.ok(summary.total >= 6);
    assert.ok(summary.reachable >= 4);
    assert.ok(summary.ratio > 50 && summary.ratio <= 100);
  });
});

describe('Date & Deadline Calculation Utilities', () => {
  test('correctly handles null / unannounced application dates', () => {
    const info = calculateDeadlineInfo(null);
    assert.equal(info.state, 'unannounced');
    assert.equal(info.daysRemaining, null);
    assert.equal(info.label, 'Dates Pending Notification');
  });

  test('correctly flags expired past deadlines', () => {
    const pastDate = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString();
    const info = calculateDeadlineInfo(pastDate);
    assert.equal(info.state, 'expired');
    assert.equal(info.label, 'Application Closed');
    assert.ok(info.daysRemaining! < 0);
  });

  test('correctly flags urgent closing soon deadlines (<= 15 days)', () => {
    const urgentDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    const info = calculateDeadlineInfo(urgentDate);
    assert.equal(info.state, 'closing_soon');
    assert.ok(info.label.includes('Remaining'));
    assert.ok(info.daysRemaining! <= 15);
  });

  test('handles malformed date strings gracefully without throwing', () => {
    const info = calculateDeadlineInfo('invalid-date-string');
    assert.equal(info.state, 'unannounced');
  });
});

describe('Security, Multi-User Isolation & Checklist Persistence', () => {
  test('creates cryptographically unique user sessions', () => {
    const s1 = userRepo.createSession();
    const s2 = userRepo.createSession();

    assert.notEqual(s1.session_token, s2.session_token);
    assert.notEqual(s1.user_id, s2.user_id);
    assert.equal(s1.session_token.length, 64);
  });

  test('validates active session and rejects tampered tokens', () => {
    const session = userRepo.createSession();
    const valid = userRepo.validateSession(session.session_token);
    assert.ok(valid);
    assert.equal(valid.user_id, session.user_id);

    const invalid = userRepo.validateSession('forged_token_12345');
    assert.equal(invalid, null);
  });

  test('supports reusing a stable client userId across sessions to persist checklist across reloads', () => {
    const stableUserId = 'usr_persistent_student_42';
    const session1 = userRepo.createSession(stableUserId);
    assert.equal(session1.user_id, stableUserId);

    // Save an opportunity and update a checklist step
    userRepo.updateChecklistStep(stableUserId, 'opp-csss-2026', 'step-csss-1', 'completed');

    // Simulate page refresh / new session creation with the same client userId
    const session2 = userRepo.createSession(stableUserId);
    assert.notEqual(session1.session_token, session2.session_token);
    assert.equal(session2.user_id, stableUserId);

    // Verify checklist progress is fully retained
    const progress = userRepo.getChecklistProgress(session2.user_id);
    assert.equal(progress['opp-csss-2026']?.['step-csss-1'], 'completed');

    // Verify saved opportunities includes it
    const saved = userRepo.getSavedOpportunities(session2.user_id);
    assert.ok(saved.includes('opp-csss-2026'));
  });

  test('enforces strict cross-user saved items isolation', () => {
    const userA = userRepo.createSession();
    const userB = userRepo.createSession();

    userRepo.saveOpportunity(userA.user_id, 'opp-csss-2026');

    const savedA = userRepo.getSavedOpportunities(userA.user_id);
    const savedB = userRepo.getSavedOpportunities(userB.user_id);

    assert.deepEqual(savedA, ['opp-csss-2026']);
    assert.deepEqual(savedB, [], 'User B must not see User A saved opportunities');
  });

  test('enforces strict cross-user checklist progression isolation and auto-tracking', () => {
    const userA = userRepo.createSession();
    const userB = userRepo.createSession();

    // User A completes step-1
    userRepo.updateChecklistStep(userA.user_id, 'opp-aicte-pragati-2026', 'step-pragati-1', 'completed');

    const progressA = userRepo.getChecklistProgress(userA.user_id);
    const progressB = userRepo.getChecklistProgress(userB.user_id);

    assert.equal(progressA['opp-aicte-pragati-2026']?.['step-pragati-1'], 'completed');
    assert.equal(progressB['opp-aicte-pragati-2026'], undefined, 'User B must have isolated checklist state');

    // Verify auto-tracking
    const savedA = userRepo.getSavedOpportunities(userA.user_id);
    assert.ok(savedA.includes('opp-aicte-pragati-2026'), 'Updating a step must auto-track the scheme for User A');
  });
});

describe('SSRF Hardening & Portal Probe Safety', () => {
  test('identifies loopback and private IPv4/IPv6 addresses', () => {
    assert.equal(isPrivateOrReservedIP('127.0.0.1'), true);
    assert.equal(isPrivateOrReservedIP('127.0.0.53'), true);
    assert.equal(isPrivateOrReservedIP('10.0.1.20'), true);
    assert.equal(isPrivateOrReservedIP('172.16.5.1'), true);
    assert.equal(isPrivateOrReservedIP('192.168.0.1'), true);
    assert.equal(isPrivateOrReservedIP('169.254.169.254'), true);
    assert.equal(isPrivateOrReservedIP('::1'), true);

    // Public IPs
    assert.equal(isPrivateOrReservedIP('8.8.8.8'), false);
    assert.equal(isPrivateOrReservedIP('164.100.158.135'), false);
  });

  test('validates allowed government hosts including subdomains', () => {
    assert.equal(isHostAllowed('scholarships.gov.in'), true);
    assert.equal(isHostAllowed('www.scholarships.gov.in'), true);
    assert.equal(isHostAllowed('upsconline.nic.in'), true);
    assert.equal(isHostAllowed('www.pmrf.in'), true);
    assert.equal(isHostAllowed('pmrf.in'), true);
    assert.equal(isHostAllowed('malicious-site.com'), false);
    assert.equal(isHostAllowed('attacker.gov.in.evil.com'), false);
  });

  test('blocks non-allowlisted portal target URLs', async () => {
    const result = await validateAndProbePortalUrl('https://evil-unauthorized-site.com');
    assert.equal(result.status, 'issue');
    assert.equal(result.testedScope, 'host_allowlist_validation');
    assert.ok(result.notes.includes('allowlist'));
  });

  test('blocks non-HTTPS schemes', async () => {
    const result = await validateAndProbePortalUrl('http://scholarships.gov.in');
    assert.equal(result.status, 'issue');
    assert.equal(result.testedScope, 'protocol_validation');
    assert.ok(result.notes.includes('HTTPS'));
  });
});

describe('Calendar (.ics) RFC 5545 Export', () => {
  test('generates valid RFC 5545 iCalendar content', () => {
    const opp = oppRepo.findById('opp-csss-2026');
    assert.ok(opp);

    const ics = generateOpportunityIcs(opp);
    assert.ok(ics.startsWith('BEGIN:VCALENDAR'));
    assert.ok(ics.includes('PRODID:-//Margdarshak Civic Clarity//'));
    assert.ok(ics.includes('BEGIN:VEVENT'));
    assert.ok(ics.includes('SUMMARY:Central Sector Scheme'));
    assert.ok(ics.includes('URL:https://scholarships.gov.in'));
    assert.ok(ics.includes('END:VEVENT'));
    assert.ok(ics.endsWith('END:VCALENDAR'));
  });
});
