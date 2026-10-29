import { DatabaseSync } from 'node:sqlite';
import crypto from 'node:crypto';
import { db } from './db.ts';

export interface OpportunityRecord {
  id: string;
  title: string;
  category: 'scholarship' | 'examination';
  academic_level: string;
  issuing_authority: string;
  official_url: string;
  verified_domain: string;
  description: string;
  eligibility_summary: string;
  financial_benefit: string | null;
  opening_date: string | null;
  deadline: string | null;
  official_source_url: string;
  verification_state: 'verified' | 'provisional' | 'demo';
  last_verified_at: string;
  checklist_schema: string; // JSON parsed on response
}

export interface ChecklistStep {
  id: string;
  title: string;
  description: string;
  is_mandatory: boolean;
  condition_note: string | null;
  official_reference_url: string;
}

export interface UserSession {
  session_token: string;
  user_id: string;
  created_at: string;
  expires_at: string;
}

export interface PortalAuditRecord {
  portal_id: string;
  name: string;
  official_url: string;
  allowlisted_host: string;
  monitoring_method: 'curated_audit' | 'automated_probe';
  tested_scope: string;
  status: 'reachable' | 'degraded' | 'issue' | 'unknown' | 'monitoring_unavailable';
  http_status: number | null;
  latency_ms: number | null;
  last_checked_at: string;
  disclaimer_notes: string;
}

export class OpportunityRepository {
  constructor(private database: DatabaseSync = db) {}

  list(filters?: {
    search?: string;
    category?: string;
    academic_level?: string;
    status?: string;
  }): OpportunityRecord[] {
    let query = 'SELECT * FROM opportunities WHERE 1=1';
    const params: (string | number)[] = [];

    if (filters?.category && filters.category !== 'all') {
      query += ' AND category = ?';
      params.push(filters.category);
    }

    if (filters?.academic_level && filters.academic_level !== 'all') {
      query += ' AND academic_level = ?';
      params.push(filters.academic_level);
    }

    if (filters?.search && filters.search.trim() !== '') {
      const term = `%${filters.search.trim().toLowerCase()}%`;
      query += ' AND (LOWER(title) LIKE ? OR LOWER(issuing_authority) LIKE ? OR LOWER(description) LIKE ?)';
      params.push(term, term, term);
    }

    query += ' ORDER BY CASE WHEN deadline IS NULL THEN 1 ELSE 0 END, deadline ASC';

    const stmt = this.database.prepare(query);
    const rows = stmt.all(...params) as unknown as OpportunityRecord[];

    // If status filter is passed (open, closing_soon, expired, unannounced)
    if (filters?.status && filters.status !== 'all') {
      const now = new Date().toISOString();
      return rows.filter((r) => {
        if (!r.deadline) return filters.status === 'unannounced';
        if (r.deadline < now) return filters.status === 'expired';
        const diffDays = (new Date(r.deadline).getTime() - new Date(now).getTime()) / (1000 * 60 * 60 * 24);
        if (filters.status === 'closing_soon') return diffDays >= 0 && diffDays <= 15;
        if (filters.status === 'open') return diffDays > 0;
        return true;
      });
    }

    return rows;
  }

  findById(id: string): OpportunityRecord | null {
    const stmt = this.database.prepare('SELECT * FROM opportunities WHERE id = ?');
    const row = stmt.get(id) as unknown as OpportunityRecord | undefined;
    return row || null;
  }

  getMetrics() {
    const totalStmt = this.database.prepare('SELECT COUNT(*) as total FROM opportunities');
    const total = (totalStmt.get() as { total: number }).total;

    const scholarshipsStmt = this.database.prepare("SELECT COUNT(*) as count FROM opportunities WHERE category = 'scholarship'");
    const scholarships = (scholarshipsStmt.get() as { count: number }).count;

    const examsStmt = this.database.prepare("SELECT COUNT(*) as count FROM opportunities WHERE category = 'examination'");
    const examinations = (examsStmt.get() as { count: number }).count;

    const now = new Date().toISOString();
    const urgentStmt = this.database.prepare(`
      SELECT COUNT(*) as count FROM opportunities 
      WHERE deadline IS NOT NULL 
        AND deadline >= ? 
        AND julianday(deadline) - julianday(?) <= 15
    `);
    const urgent = (urgentStmt.get(now, now) as { count: number }).count;

    return {
      total,
      scholarships,
      examinations,
      urgent
    };
  }
}

export class UserRepository {
  constructor(private database: DatabaseSync = db) {}

  createSession(customUserId?: string): UserSession {
    const session_token = crypto.randomBytes(32).toString('hex');
    const user_id = customUserId || `usr_${crypto.randomBytes(8).toString('hex')}`;
    const created_at = new Date().toISOString();
    // 30 days expiry
    const expires_at = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

    const stmt = this.database.prepare(`
      INSERT INTO user_sessions (session_token, user_id, created_at, expires_at)
      VALUES (?, ?, ?, ?)
    `);
    stmt.run(session_token, user_id, created_at, expires_at);

    return { session_token, user_id, created_at, expires_at };
  }

  validateSession(token: string): UserSession | null {
    if (!token) return null;
    const stmt = this.database.prepare('SELECT * FROM user_sessions WHERE session_token = ?');
    const session = stmt.get(token) as unknown as UserSession | undefined;

    if (!session) return null;

    if (new Date(session.expires_at).getTime() < Date.now()) {
      return null;
    }

    return session;
  }

  getSavedOpportunities(userId: string): string[] {
    const stmt = this.database.prepare(`
      SELECT opportunity_id FROM user_saved_opportunities 
      WHERE user_id = ? ORDER BY saved_at DESC
    `);
    const rows = stmt.all(userId) as unknown as { opportunity_id: string }[];
    return rows.map((r) => r.opportunity_id);
  }

  saveOpportunity(userId: string, opportunityId: string): boolean {
    const stmt = this.database.prepare(`
      INSERT OR IGNORE INTO user_saved_opportunities (user_id, opportunity_id, saved_at)
      VALUES (?, ?, ?)
    `);
    stmt.run(userId, opportunityId, new Date().toISOString());
    return true;
  }

  unsaveOpportunity(userId: string, opportunityId: string): boolean {
    const stmt = this.database.prepare(`
      DELETE FROM user_saved_opportunities WHERE user_id = ? AND opportunity_id = ?
    `);
    stmt.run(userId, opportunityId);
    return true;
  }

  getChecklistProgress(userId: string): Record<string, Record<string, string>> {
    const stmt = this.database.prepare(`
      SELECT opportunity_id, step_id, status FROM user_checklist_progress
      WHERE user_id = ?
    `);
    const rows = stmt.all(userId) as unknown as { opportunity_id: string; step_id: string; status: string }[];
    const result: Record<string, Record<string, string>> = {};

    for (const row of rows) {
      if (!result[row.opportunity_id]) {
        result[row.opportunity_id] = {};
      }
      result[row.opportunity_id][row.step_id] = row.status;
    }

    return result;
  }

  updateChecklistStep(userId: string, opportunityId: string, stepId: string, status: 'pending' | 'in_progress' | 'completed'): boolean {
    const stmt = this.database.prepare(`
      INSERT INTO user_checklist_progress (user_id, opportunity_id, step_id, status, updated_at)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(user_id, opportunity_id, step_id) 
      DO UPDATE SET status = excluded.status, updated_at = excluded.updated_at
    `);
    stmt.run(userId, opportunityId, stepId, status, new Date().toISOString());
    return true;
  }
}

export class PortalAuditRepository {
  constructor(private database: DatabaseSync = db) {}

  list(): PortalAuditRecord[] {
    const stmt = this.database.prepare('SELECT * FROM portal_audit_records ORDER BY name ASC');
    return stmt.all() as unknown as PortalAuditRecord[];
  }

  findById(portalId: string): PortalAuditRecord | null {
    const stmt = this.database.prepare('SELECT * FROM portal_audit_records WHERE portal_id = ?');
    const row = stmt.get(portalId) as unknown as PortalAuditRecord | undefined;
    return row || null;
  }

  updateAudit(portalId: string, data: {
    status: 'reachable' | 'degraded' | 'issue' | 'unknown' | 'monitoring_unavailable';
    http_status: number | null;
    latency_ms: number | null;
    last_checked_at: string;
    disclaimer_notes: string;
    monitoring_method?: 'curated_audit' | 'automated_probe';
  }): boolean {
    const stmt = this.database.prepare(`
      UPDATE portal_audit_records SET
        status = ?,
        http_status = ?,
        latency_ms = ?,
        last_checked_at = ?,
        disclaimer_notes = ?,
        monitoring_method = COALESCE(?, monitoring_method)
      WHERE portal_id = ?
    `);
    stmt.run(
      data.status,
      data.http_status,
      data.latency_ms,
      data.last_checked_at,
      data.disclaimer_notes,
      data.monitoring_method || 'automated_probe',
      portalId
    );
    return true;
  }
}

export const opportunityRepo = new OpportunityRepository();
export const userRepo = new UserRepository();
export const portalRepo = new PortalAuditRepository();
