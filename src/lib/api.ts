import { Opportunity, PortalAudit, DashboardStats, StepStatus } from '../types.ts';

const SESSION_KEY = 'margdarshak_session_token';

let sessionToken: string | null = typeof window !== 'undefined' ? localStorage.getItem(SESSION_KEY) : null;

export async function ensureSession(): Promise<string> {
  if (sessionToken) {
    return sessionToken;
  }

  try {
    const res = await fetch('/api/auth/session', { method: 'POST' });
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
  }

  return '';
}

async function apiFetch<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
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

export async function fetchOpportunities(filters?: {
  search?: string;
  category?: string;
  academic_level?: string;
  status?: string;
}): Promise<Opportunity[]> {
  const params = new URLSearchParams();
  if (filters?.search) params.set('search', filters.search);
  if (filters?.category && filters.category !== 'all') params.set('category', filters.category);
  if (filters?.academic_level && filters.academic_level !== 'all') params.set('academic_level', filters.academic_level);
  if (filters?.status && filters.status !== 'all') params.set('status', filters.status);

  const query = params.toString() ? `?${params.toString()}` : '';
  const result = await apiFetch<{ data: Opportunity[] }>(`/api/opportunities${query}`);
  return result.data;
}

export async function fetchOpportunityById(id: string): Promise<Opportunity> {
  const result = await apiFetch<{ data: Opportunity }>(`/api/opportunities/${id}`);
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
): Promise<void> {
  await apiFetch('/api/user/checklist', {
    method: 'PUT',
    body: JSON.stringify({ opportunityId, stepId, status })
  });
}

export async function fetchPortals(): Promise<PortalAudit[]> {
  const result = await apiFetch<{ data: PortalAudit[] }>('/api/portals');
  return result.data;
}

export async function checkPortalHealth(portalId: string): Promise<PortalAudit> {
  const result = await apiFetch<{ data: PortalAudit }>(`/api/portals/${portalId}/check`, {
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
