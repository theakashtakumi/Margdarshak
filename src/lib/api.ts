import { Opportunity, Portal, MonitoringRecord, OpportunityPortalRelation, DashboardStats, StepStatus } from '../types.ts';

const SESSION_KEY = 'margdarshak_session_token';
const USER_ID_KEY = 'margdarshak_client_user_id';

let sessionToken: string | null = typeof window !== 'undefined' ? localStorage.getItem(SESSION_KEY) : null;
let sessionPromise: Promise<string> | null = null;

function getOrCreateUserId(): string {
  if (typeof window === 'undefined') return 'usr_student_demo';
  let userId = localStorage.getItem(USER_ID_KEY);
  if (!userId) {
    userId = `usr_${Math.random().toString(36).substring(2, 10)}`;
    localStorage.setItem(USER_ID_KEY, userId);
  }
  return userId;
}

export async function ensureSession(): Promise<string> {
  if (sessionToken) {
    return sessionToken;
  }

  if (sessionPromise) {
    return sessionPromise;
  }

  sessionPromise = (async () => {
    try {
      const stableUserId = getOrCreateUserId();
      const res = await fetch('/api/auth/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: stableUserId })
      });
      const data = await res.json();
      if (data?.data?.session_token) {
        sessionToken = data.data.session_token;
        if (typeof window !== 'undefined') {
          localStorage.setItem(SESSION_KEY, sessionToken!);
        }
        return sessionToken!;
      }
    } catch (err) {
      console.error('Failed to initialize session:', err);
    } finally {
      sessionPromise = null;
    }

    return '';
  })();

  return sessionPromise;
}

async function apiFetch<T>(endpoint: string, options: RequestInit & { _retry?: boolean } = {}): Promise<T> {
  const token = await ensureSession();
  const headers = new Headers(options.headers || {});
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  if (!headers.has('Content-Type') && options.body && typeof options.body === 'string') {
    headers.set('Content-Type', 'application/json');
  }

  const response = await fetch(endpoint, {
    ...options,
    headers
  });

  if (response.status === 401 && !options._retry) {
    // Session token expired or invalid; clear and recreate
    sessionToken = null;
    if (typeof window !== 'undefined') {
      localStorage.removeItem(SESSION_KEY);
    }
    await ensureSession();
    return apiFetch<T>(endpoint, { ...options, _retry: true });
  }

  if (!response.ok) {
    let errorJson;
    try {
      errorJson = await response.json();
    } catch {
      // ignore
    }
    const message = errorJson?.error?.message || `Request failed with status ${response.status}`;
    const error = new Error(message);
    (error as any).status = response.status;
    (error as any).details = errorJson?.error;
    throw error;
  }

  return response.json();
}

export async function fetchOpportunities(
  filters?: {
    search?: string;
    category?: string;
    academic_level?: string;
    status?: string;
    sort?: string;
  },
  sort?: string
): Promise<Opportunity[]> {
  const params = new URLSearchParams();
  if (filters?.search) params.set('search', filters.search);
  if (filters?.category && filters.category !== 'all') params.set('category', filters.category);
  if (filters?.academic_level && filters.academic_level !== 'all') params.set('academic_level', filters.academic_level);
  if (filters?.status && filters.status !== 'all') params.set('status', filters.status);

  // Accept sort parameter either via filters.sort or second sort argument
  const effectiveSort = sort || filters?.sort;
  if (effectiveSort && effectiveSort !== 'default') {
    params.set('sort', effectiveSort);
  }

  const query = params.toString() ? `?${params.toString()}` : '';
  const result = await apiFetch<{ data: Opportunity[] }>(`/api/opportunities${query}`);
  return result.data;
}

export async function fetchOpportunityById(id: string): Promise<Opportunity> {
  const result = await apiFetch<{ data: Opportunity }>(`/api/opportunities/${id}`);
  return result.data;
}

export async function fetchOpportunityPortals(id: string): Promise<OpportunityPortalRelation[]> {
  const result = await apiFetch<{ data: OpportunityPortalRelation[] }>(`/api/opportunities/${id}/portals`);
  return result.data;
}

export async function fetchSavedOpportunities(): Promise<{ saved_ids: string[]; items: Opportunity[] }> {
  const result = await apiFetch<{ data: { saved_ids: string[]; items: Opportunity[] } }>('/api/user/saved');
  return result.data;
}

export async function toggleSaveOpportunity(opportunityId: string): Promise<{ saved: boolean; saved_ids: string[] }> {
  const result = await apiFetch<{ data: { saved: boolean; saved_ids: string[] } }>('/api/user/saved', {
    method: 'POST',
    body: JSON.stringify({ opportunityId })
  });
  return result.data;
}

export async function fetchChecklistProgress(): Promise<Record<string, Record<string, StepStatus>>> {
  const result = await apiFetch<{ data: Record<string, Record<string, StepStatus>> }>('/api/user/checklist');
  return result.data;
}

export async function updateChecklistStep(
  opportunityId: string,
  stepId: string,
  status: StepStatus
): Promise<{ opportunityId: string; stepId: string; status: StepStatus; allProgress: Record<string, Record<string, StepStatus>>; saved_ids: string[] }> {
  const res = await apiFetch<{ data: any }>('/api/user/checklist', {
    method: 'PUT',
    body: JSON.stringify({ opportunityId, stepId, status })
  });
  return res.data;
}

export async function fetchPortals(filters?: { search?: string; category?: string }): Promise<Portal[]> {
  const params = new URLSearchParams();
  if (filters?.search) params.set('search', filters.search);
  if (filters?.category && filters.category !== 'all') params.set('category', filters.category);

  const query = params.toString() ? `?${params.toString()}` : '';
  const result = await apiFetch<{ data: Portal[] }>(`/api/portals${query}`);
  return result.data;
}

export async function fetchPortalById(id: string): Promise<Portal & { related_opportunities: (OpportunityPortalRelation & { opportunity: any })[] }> {
  const result = await apiFetch<{ data: Portal & { related_opportunities: (OpportunityPortalRelation & { opportunity: any })[] } }>(`/api/portals/${id}`);
  return result.data;
}

export async function fetchPortalHistory(id: string): Promise<MonitoringRecord[]> {
  const result = await apiFetch<{ data: MonitoringRecord[] }>(`/api/portals/${id}/history`);
  return result.data;
}

export async function checkPortalHealth(portalId: string): Promise<Portal> {
  const result = await apiFetch<{ data: Portal }>(`/api/portals/${portalId}/check`, {
    method: 'POST'
  });
  return result.data;
}

export async function fetchDashboardStats(): Promise<DashboardStats> {
  const result = await apiFetch<{ data: DashboardStats }>('/api/dashboard/stats');
  return result.data;
}

export function getCalendarDownloadUrl(opportunityId: string): string {
  return `/api/opportunities/${opportunityId}/calendar.ics`;
}
