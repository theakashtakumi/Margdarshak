export type OpportunityCategory = 'scholarship' | 'examination';
export type VerificationState = 'verified' | 'provisional' | 'demo';
export type StepStatus = 'pending' | 'in_progress' | 'completed';
export type PortalStatus = 'reachable' | 'degraded' | 'issue' | 'unknown' | 'monitoring_unavailable';

export interface ChecklistStep {
  id: string;
  title: string;
  description: string;
  is_mandatory: boolean;
  condition_note: string | null;
  official_reference_url: string;
}

export interface Opportunity {
  id: string;
  title: string;
  category: OpportunityCategory;
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
  verification_state: VerificationState;
  last_verified_at: string;
  checklist_schema: ChecklistStep[];
  checklist_progress?: {
    total_steps: number;
    completed_steps: number;
    percentage: number;
  };
}

export interface PortalAudit {
  portal_id: string;
  name: string;
  official_url: string;
  allowlisted_host: string;
  monitoring_method: 'curated_audit' | 'automated_probe';
  tested_scope: string;
  status: PortalStatus;
  http_status: number | null;
  latency_ms: number | null;
  last_checked_at: string;
  disclaimer_notes: string;
}

export interface DashboardStats {
  totalOpportunities: number;
  scholarshipsCount: number;
  examinationsCount: number;
  urgentDeadlinesCount: number;
  savedCount: number;
  completedChecklistSteps: number;
  portalHealth: {
    totalPortals: number;
    reachablePortals: number;
    healthRatio: number;
  };
}
