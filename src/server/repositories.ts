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
  checklist_schema: string; // JSON string
}

export interface PortalRecord {
  id: string;
  name: string;
  official_url: string;
  verified_hostname: string;
  description: string;
  operating_authority: string;
  category: string;
  services_offered: string; // JSON string
  verification_state: 'verified' | 'provisional' | 'demo';
  last_verified_at: string;
  latest_check?: MonitoringRecord | null;
}

export interface MonitoringRecord {
  id?: number;
  portal_id: string;
  check_timestamp: string;
  monitoring_method: 'curated_audit' | 'automated_probe';
  tested_scope: string;
  status: 'reachable' | 'degraded' | 'issue' | 'unknown' | 'monitoring_unavailable';
  http_status: number | null;
  latency_ms: number | null;
  diagnostic_notes: string;
}

export interface OpportunityPortalRelation {
  opportunity_id: string;
  portal_id: string;
  relationship_type: 'application_portal' | 'information_source' | 'registration_portal' | 'notice_portal';
  official_reference_url: string | null;
  relationship_notes: string | null;
  portal?: PortalRecord;
  opportunity?: OpportunityRecord;
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

export class OpportunityRepository {
  constructor(private database: DatabaseSync = db) {}

  list(filters?: {
    search?: string;
    category?: string;
    academic_level?: string;
    status?: string;
    sort?: string;
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
      query += ' AND (LOWER(title) LIKE ? OR LOWER(issuing_authority) LIKE ? OR LOWER(description) LIKE ? OR LOWER(eligibility_summary) LIKE ? OR LOWER(verified_domain) LIKE ?)';
      params.push(term, term, term, term, term);
    }

    // Dynamic sorting
    const sortVal = (filters?.sort || '').toLowerCase().trim();
    if (sortVal === 'alphabetical' || sortVal === 'title_asc') {
      query += ' ORDER BY title COLLATE NOCASE ASC';
    } else if (sortVal === 'recently_updated' || sortVal === 'recently updated' || sortVal === 'verified_desc') {
      query += ' ORDER BY last_verified_at DESC';
    } else if (sortVal === 'deadline_desc') {
      query += ' ORDER BY CASE WHEN deadline IS NULL THEN 1 ELSE 0 END, deadline DESC';
    } else {
      query += ' ORDER BY CASE WHEN deadline IS NULL THEN 1 ELSE 0 END, deadline ASC';
    }

    const stmt = this.database.prepare(query);
    const rows = stmt.all(...params) as unknown as OpportunityRecord[];

    // Status filtering
    if (filters?.status && filters.status !== 'all') {
      const now = new Date().toISOString();
      return rows.filter((r) => {
        if (!r.deadline) return filters.status === 'unannounced';
        if (r.deadline < now) return filters.status === 'expired';
        
        if (r.opening_date && r.opening_date > now) {
          if (filters.status === 'upcoming') return true;
        }

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

  getPortalsForOpportunity(opportunityId: string): (OpportunityPortalRelation & { portal: PortalRecord & { latest_check: MonitoringRecord | null } })[] {
    const stmt = this.database.prepare(`
      SELECT 
        op.opportunity_id,
        op.portal_id,
        op.relationship_type,
        op.official_reference_url,
        op.relationship_notes,
        p.name as portal_name,
        p.official_url as portal_url,
        p.verified_hostname,
        p.description as portal_description,
        p.operating_authority,
        p.category as portal_category,
        p.services_offered,
        p.verification_state as portal_verification_state,
        p.last_verified_at as portal_last_verified_at
      FROM opportunity_portals op
      JOIN portals p ON op.portal_id = p.id
      WHERE op.opportunity_id = ?
      ORDER BY 
        CASE op.relationship_type 
          WHEN 'application_portal' THEN 1 
          WHEN 'registration_portal' THEN 2 
          WHEN 'notice_portal' THEN 3 
          ELSE 4 
        END ASC
    `);

    const rows = stmt.all(opportunityId) as unknown as any[];

    // Fetch latest monitoring record for each portal
    return rows.map((r) => {
      const latestStmt = this.database.prepare(`
        SELECT * FROM portal_monitoring_records
        WHERE portal_id = ?
        ORDER BY check_timestamp DESC, id DESC
        LIMIT 1
      `);
      const latestCheck = (latestStmt.get(r.portal_id) as unknown as MonitoringRecord) || null;

      return {
        opportunity_id: r.opportunity_id,
        portal_id: r.portal_id,
        relationship_type: r.relationship_type,
        official_reference_url: r.official_reference_url,
        relationship_notes: r.relationship_notes,
        portal: {
          id: r.portal_id,
          name: r.portal_name,
          official_url: r.portal_url,
          verified_hostname: r.verified_hostname,
          description: r.portal_description,
          operating_authority: r.operating_authority,
          category: r.portal_category,
          services_offered: r.services_offered,
          verification_state: r.portal_verification_state,
          last_verified_at: r.portal_last_verified_at,
          latest_check: latestCheck
        }
      };
    });
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

export class PortalRepository {
  constructor(private database: DatabaseSync = db) {}

  list(filters?: { search?: string; category?: string }): (PortalRecord & { latest_check: MonitoringRecord | null })[] {
    let query = 'SELECT * FROM portals WHERE 1=1';
    const params: string[] = [];

    if (filters?.category && filters.category !== 'all') {
      const catLower = filters.category.toLowerCase().trim();
      const catSlug = catLower.replace(/\s+/g, '_');
      query += ' AND (LOWER(category) = ? OR LOWER(category) = ? OR LOWER(category) LIKE ?)';
      params.push(catLower, catSlug, `%${catLower}%`);
    }

    if (filters?.search && filters.search.trim() !== '') {
      const term = `%${filters.search.trim().toLowerCase()}%`;
      query += ' AND (LOWER(name) LIKE ? OR LOWER(verified_hostname) LIKE ? OR LOWER(description) LIKE ? OR LOWER(operating_authority) LIKE ?)';
      params.push(term, term, term, term);
    }

    query += ' ORDER BY name ASC';

    const stmt = this.database.prepare(query);
    const portals = stmt.all(...params) as unknown as PortalRecord[];

    // Attach latest monitoring record
    return portals.map((p) => {
      const latestStmt = this.database.prepare(`
        SELECT * FROM portal_monitoring_records
        WHERE portal_id = ?
        ORDER BY check_timestamp DESC, id DESC
        LIMIT 1
      `);
      const latest = (latestStmt.get(p.id) as unknown as MonitoringRecord) || null;
      return {
        ...p,
        latest_check: latest
      };
    });
  }

  findById(portalId: string): (PortalRecord & { latest_check: MonitoringRecord | null }) | null {
    const stmt = this.database.prepare('SELECT * FROM portals WHERE id = ?');
    const portal = stmt.get(portalId) as unknown as PortalRecord | undefined;
    if (!portal) return null;

    const latestStmt = this.database.prepare(`
      SELECT * FROM portal_monitoring_records
      WHERE portal_id = ?
      ORDER BY check_timestamp DESC, id DESC
      LIMIT 1
    `);
    const latest = (latestStmt.get(portal.id) as unknown as MonitoringRecord) || null;

    return {
      ...portal,
      latest_check: latest
    };
  }

  getMonitoringHistory(portalId: string, limit = 20): MonitoringRecord[] {
    const stmt = this.database.prepare(`
      SELECT * FROM portal_monitoring_records
      WHERE portal_id = ?
      ORDER BY check_timestamp DESC, id DESC
      LIMIT ?
    `);
    return stmt.all(portalId, limit) as unknown as MonitoringRecord[];
  }

  addMonitoringRecord(record: MonitoringRecord): number {
    const stmt = this.database.prepare(`
      INSERT INTO portal_monitoring_records (
        portal_id, check_timestamp, monitoring_method, tested_scope,
        status, http_status, latency_ms, diagnostic_notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const result = stmt.run(
      record.portal_id,
      record.check_timestamp,
      record.monitoring_method,
      record.tested_scope,
      record.status,
      record.http_status,
      record.latency_ms,
      record.diagnostic_notes
    );
    return Number(result.lastInsertRowid);
  }

  getOpportunitiesForPortal(portalId: string): (OpportunityPortalRelation & { opportunity: OpportunityRecord })[] {
    const stmt = this.database.prepare(`
      SELECT 
        op.opportunity_id,
        op.portal_id,
        op.relationship_type,
        op.official_reference_url,
        op.relationship_notes,
        o.title,
        o.category,
        o.academic_level,
        o.issuing_authority,
        o.deadline,
        o.financial_benefit,
        o.verification_state
      FROM opportunity_portals op
      JOIN opportunities o ON op.opportunity_id = o.id
      WHERE op.portal_id = ?
      ORDER BY o.title ASC
    `);
    const rows = stmt.all(portalId) as unknown as any[];
    return rows.map((r) => ({
      opportunity_id: r.opportunity_id,
      portal_id: r.portal_id,
      relationship_type: r.relationship_type,
      official_reference_url: r.official_reference_url,
      relationship_notes: r.relationship_notes,
      opportunity: {
        id: r.opportunity_id,
        title: r.title,
        category: r.category,
        academic_level: r.academic_level,
        issuing_authority: r.issuing_authority,
        deadline: r.deadline,
        financial_benefit: r.financial_benefit,
        verification_state: r.verification_state
      } as any
    }));
  }

  getHealthSummary() {
    const totalStmt = this.database.prepare('SELECT COUNT(*) as total FROM portals');
    const total = (totalStmt.get() as { total: number }).total;

    // Count portals whose LATEST check was 'reachable'
    const reachableStmt = this.database.prepare(`
      SELECT COUNT(*) as reachable FROM portals p
      WHERE (
        SELECT status FROM portal_monitoring_records
        WHERE portal_id = p.id
        ORDER BY check_timestamp DESC, id DESC
        LIMIT 1
      ) = 'reachable'
    `);
    const reachable = (reachableStmt.get() as { reachable: number }).reachable;

    return {
      total,
      reachable,
      ratio: total > 0 ? Math.round((reachable / total) * 100) : 0
    };
  }
}

export class UserRepository {
  constructor(private database: DatabaseSync = db) {}

  createSession(customUserId?: string): UserSession {
    const session_token = crypto.randomBytes(32).toString('hex');
    const user_id = customUserId || `usr_${crypto.randomBytes(8).toString('hex')}`;
    const created_at = new Date().toISOString();
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
    // Return all opportunities explicitly saved OR that have user checklist progress
    const stmt = this.database.prepare(`
      SELECT DISTINCT opportunity_id FROM (
        SELECT opportunity_id, saved_at FROM user_saved_opportunities WHERE user_id = ?
        UNION
        SELECT opportunity_id, updated_at as saved_at FROM user_checklist_progress WHERE user_id = ?
      ) ORDER BY saved_at DESC
    `);
    const rows = stmt.all(userId, userId) as unknown as { opportunity_id: string }[];
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
    // Automatically record in saved opportunities so progress is tracked in dashboard
    this.saveOpportunity(userId, opportunityId);

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

export const opportunityRepo = new OpportunityRepository();
export const portalRepo = new PortalRepository();
export const userRepo = new UserRepository();
