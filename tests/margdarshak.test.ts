import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { OpportunityRepository, UserRepository, PortalAuditRepository } from '../src/server/repositories.ts';
import { isPrivateOrReservedIP, validateAndProbePortalUrl } from '../src/server/ssrfGuard.ts';
import { calculateDeadlineInfo } from '../src/lib/dateUtils.ts';
import { generateOpportunityIcs } from '../src/server/calendar.ts';
import { getDatabase, initDatabase } from '../src/server/db.ts';

// Use dedicated in-memory database for clean test isolation
const testDb = getDatabase(':memory:');
initDatabase(testDb);

const oppRepo = new OpportunityRepository(testDb);
const userRepo = new UserRepository(testDb);
const portalRepo = new PortalAuditRepository(testDb);

describe('Opportunity Repository & Search Engine', () => {
  test('retrieves seeded opportunities with structured checklist schema', () => {
    const all = oppRepo.list();
    assert.ok(all.length >= 4, 'Should contain at least 4 seeded opportunities');

    const csss = all.find((o) => o.id === 'opp-csss-2026');
    assert.ok(csss, 'Central Sector Scholarship must be present');
    assert.equal(csss.verified_domain, 'scholarships.gov.in');
    assert.equal(csss.verification_state, 'verified');

    const steps = JSON.parse(csss.checklist_schema);
    assert.ok(Array.isArray(steps), 'Checklist schema must be a valid JSON array');
    assert.ok(steps.length >= 3, 'Must have at least 3 scheme-specific steps');
    assert.equal(steps[0].is_mandatory, true);
  });

  test('filters opportunities by category accurately', () => {
    const scholarships = oppRepo.list({ category: 'scholarship' });
    assert.ok(scholarships.every((s) => s.category === 'scholarship'));

    const exams = oppRepo.list({ category: 'examination' });
    assert.ok(exams.every((e) => e.category === 'examination'));
  });

  test('filters opportunities by academic level', () => {
    const doctoral = oppRepo.list({ academic_level: 'Doctorate' });
    assert.ok(doctoral.length >= 1);
    assert.equal(doctoral[0].id, 'opp-pmrf-2026');
  });

  test('executes case-insensitive text search across title and authority', () => {
    const results = oppRepo.list({ search: 'UPSC' });
    assert.ok(results.length >= 1);
    assert.ok(results.some((r) => r.id === 'opp-upsc-cse-2027'));
  });

  test('computes accurate aggregated repository metrics', () => {
    const metrics = oppRepo.getMetrics();
    assert.ok(metrics.total >= 4);
    assert.ok(metrics.scholarships >= 2);
    assert.ok(metrics.examinations >= 2);
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

describe('Security & Multi-User Isolation', () => {
  test('creates cryptographically unique user sessions', () => {
    const s1 = userRepo.createSession();
    const s2 = userRepo.createSession();

    assert.notEqual(s1.session_token, s2.session_token);
    assert.notEqual(s1.user_id, s2.user_id);
    assert.equal(s1.session_token.length, 64); // 32 bytes hex
  });

  test('validates active session and rejects tampered tokens', () => {
    const session = userRepo.createSession();
    const valid = userRepo.validateSession(session.session_token);
    assert.ok(valid);
    assert.equal(valid.user_id, session.user_id);

    const invalid = userRepo.validateSession('forged_token_12345');
    assert.equal(invalid, null);
  });

  test('enforces strict cross-user saved items isolation', () => {
    const userA = userRepo.createSession();
    const userB = userRepo.createSession();

    // User A saves opp-csss-2026
    userRepo.saveOpportunity(userA.user_id, 'opp-csss-2026');

    const savedA = userRepo.getSavedOpportunities(userA.user_id);
    const savedB = userRepo.getSavedOpportunities(userB.user_id);

    assert.deepEqual(savedA, ['opp-csss-2026']);
    assert.deepEqual(savedB, [], 'User B must not see User A saved opportunities');
  });

  test('enforces strict cross-user checklist progression isolation', () => {
    const userA = userRepo.createSession();
    const userB = userRepo.createSession();

    // User A completes step-1
    userRepo.updateChecklistStep(userA.user_id, 'opp-csss-2026', 'step-1', 'completed');

    const progressA = userRepo.getChecklistProgress(userA.user_id);
    const progressB = userRepo.getChecklistProgress(userB.user_id);

    assert.equal(progressA['opp-csss-2026']?.['step-1'], 'completed');
    assert.equal(progressB['opp-csss-2026'], undefined, 'User B must have isolated checklist state');
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

  test('blocks non-allowlisted portal target URLs', async () => {
    const result = await validateAndProbePortalUrl('https://evil-unauthorized-site.com');
    assert.equal(result.status, 'issue');
    assert.equal(result.testedScope, 'host_allowlist_validation');
    assert.ok(result.notes.includes('not on the government allowlist'));
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
