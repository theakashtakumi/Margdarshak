import { Router, Request, Response, NextFunction } from 'express';
import { opportunityRepo, userRepo, portalRepo } from './repositories.ts';
import { validateAndProbePortalUrl } from './ssrfGuard.ts';
import { generateOpportunityIcs } from './calendar.ts';

export const apiRouter = Router();

export interface AuthenticatedRequest extends Request {
  userSession?: {
    session_token: string;
    user_id: string;
  };
}

export function authMiddleware(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  const tokenFromHeader = authHeader && authHeader.startsWith('Bearer ') ? authHeader.substring(7) : null;
  const tokenFromCookie = req.cookies?.margdarshak_session;
  const token = tokenFromHeader || tokenFromCookie;

  if (token) {
    const session = userRepo.validateSession(token);
    if (session) {
      req.userSession = {
        session_token: session.session_token,
        user_id: session.user_id
      };
      return next();
    }
  }

  return next();
}

export function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  if (!req.userSession) {
    return res.status(401).json({
      error: {
        code: 'UNAUTHORIZED',
        message: 'A valid active session token is required to access personal tracking records.'
      }
    });
  }
  next();
}

// --- Auth Endpoints ---

apiRouter.post('/auth/session', (req: Request, res: Response) => {
  const { userId } = req.body || {};
  const session = userRepo.createSession(typeof userId === 'string' && userId.trim() ? userId.trim() : undefined);
  res.cookie('margdarshak_session', session.session_token, {
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 30 * 24 * 60 * 60 * 1000
  });

  res.json({
    data: {
      session_token: session.session_token,
      user_id: session.user_id,
      expires_at: session.expires_at
    }
  });
});

apiRouter.get('/auth/me', (req: AuthenticatedRequest, res: Response) => {
  if (!req.userSession) {
    return res.json({
      data: {
        authenticated: false,
        user_id: null
      }
    });
  }

  res.json({
    data: {
      authenticated: true,
      user_id: req.userSession.user_id
    }
  });
});

// --- Opportunity Endpoints ---

apiRouter.get('/opportunities', (req: Request, res: Response) => {
  const { search, category, academic_level, status, sort } = req.query as Record<string, string>;

  const rows = opportunityRepo.list({
    search,
    category,
    academic_level,
    status,
    sort
  });

  const parsed = rows.map((r) => ({
    ...r,
    checklist_schema: JSON.parse(r.checklist_schema)
  }));

  res.json({
    data: parsed,
    meta: {
      total: parsed.length
    }
  });
});

apiRouter.get('/opportunities/:id', (req: Request, res: Response) => {
  const opp = opportunityRepo.findById(req.params.id);
  if (!opp) {
    return res.status(404).json({
      error: {
        code: 'NOT_FOUND',
        message: `Opportunity with identifier "${req.params.id}" was not found.`
      }
    });
  }

  const linkedPortals = opportunityRepo.getPortalsForOpportunity(opp.id).map((r) => ({
    ...r,
    portal: {
      ...r.portal,
      services_offered: JSON.parse(r.portal.services_offered)
    }
  }));

  res.json({
    data: {
      ...opp,
      checklist_schema: JSON.parse(opp.checklist_schema),
      linked_portals: linkedPortals
    }
  });
});

apiRouter.get('/opportunities/:id/portals', (req: Request, res: Response) => {
  const opp = opportunityRepo.findById(req.params.id);
  if (!opp) {
    return res.status(404).json({
      error: {
        code: 'NOT_FOUND',
        message: `Opportunity with identifier "${req.params.id}" was not found.`
      }
    });
  }

  const linkedPortals = opportunityRepo.getPortalsForOpportunity(opp.id).map((r) => ({
    ...r,
    portal: {
      ...r.portal,
      services_offered: JSON.parse(r.portal.services_offered)
    }
  }));

  res.json({
    data: linkedPortals
  });
});

apiRouter.get('/opportunities/:id/calendar.ics', (req: Request, res: Response) => {
  const opp = opportunityRepo.findById(req.params.id);
  if (!opp) {
    return res.status(404).json({
      error: {
        code: 'NOT_FOUND',
        message: 'Opportunity not found.'
      }
    });
  }

  const icsText = generateOpportunityIcs(opp);
  res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="margdarshak-${opp.id}.ics"`);
  res.send(icsText);
});

// --- User Endpoints (Session Required) ---

apiRouter.get('/user/saved', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const userId = req.userSession!.user_id;
  const savedIds = userRepo.getSavedOpportunities(userId);
  const checklist = userRepo.getChecklistProgress(userId);

  const fullRecords = savedIds
    .map((id) => opportunityRepo.findById(id))
    .filter((opp): opp is NonNullable<typeof opp> => opp !== null)
    .map((opp) => {
      const steps = JSON.parse(opp.checklist_schema);
      const userSteps = checklist[opp.id] || {};
      const completedCount = steps.filter((s: any) => userSteps[s.id] === 'completed').length;
      return {
        ...opp,
        checklist_schema: steps,
        checklist_progress: {
          total_steps: steps.length,
          completed_steps: completedCount,
          percentage: steps.length > 0 ? Math.round((completedCount / steps.length) * 100) : 0
        }
      };
    });

  res.json({
    data: {
      saved_ids: savedIds,
      items: fullRecords
    }
  });
});

apiRouter.post('/user/saved', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const userId = req.userSession!.user_id;
  const { opportunityId } = req.body;

  if (!opportunityId || typeof opportunityId !== 'string') {
    return res.status(400).json({
      error: {
        code: 'INVALID_INPUT',
        message: 'Field "opportunityId" is required.'
      }
    });
  }

  const opp = opportunityRepo.findById(opportunityId);
  if (!opp) {
    return res.status(404).json({
      error: {
        code: 'NOT_FOUND',
        message: 'Specified opportunity does not exist.'
      }
    });
  }

  const existing = userRepo.getSavedOpportunities(userId);
  const isSaved = existing.includes(opportunityId);

  if (isSaved) {
    userRepo.unsaveOpportunity(userId, opportunityId);
  } else {
    userRepo.saveOpportunity(userId, opportunityId);
  }

  const updatedSaved = userRepo.getSavedOpportunities(userId);
  res.json({
    data: {
      saved: !isSaved,
      saved_ids: updatedSaved
    }
  });
});

apiRouter.get('/user/checklist', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const userId = req.userSession!.user_id;
  const progress = userRepo.getChecklistProgress(userId);
  res.json({
    data: progress
  });
});

apiRouter.put('/user/checklist', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const userId = req.userSession!.user_id;
  const { opportunityId, stepId, status } = req.body;

  if (!opportunityId || !stepId || !['pending', 'in_progress', 'completed'].includes(status)) {
    return res.status(400).json({
      error: {
        code: 'INVALID_INPUT',
        message: 'Fields "opportunityId", "stepId", and valid "status" (pending|in_progress|completed) are required.'
      }
    });
  }

  const opp = opportunityRepo.findById(opportunityId);
  if (!opp) {
    return res.status(404).json({
      error: {
        code: 'NOT_FOUND',
        message: 'Opportunity not found.'
      }
    });
  }

  userRepo.updateChecklistStep(userId, opportunityId, stepId, status);
  const updatedProgress = userRepo.getChecklistProgress(userId);
  const updatedSaved = userRepo.getSavedOpportunities(userId);

  res.json({
    data: {
      opportunityId,
      stepId,
      status,
      allProgress: updatedProgress,
      saved_ids: updatedSaved
    }
  });
});

// --- Portal Directory & Monitoring Endpoints ---

apiRouter.get('/portals', (req: Request, res: Response) => {
  const { search, category } = req.query as { search?: string; category?: string };
  const portals = portalRepo.list({ search, category });
  const parsed = portals.map((p) => ({
    ...p,
    services_offered: JSON.parse(p.services_offered)
  }));

  res.json({
    data: parsed,
    meta: {
      total: parsed.length
    }
  });
});

apiRouter.get('/portals/:id', (req: Request, res: Response) => {
  const portal = portalRepo.findById(req.params.id);
  if (!portal) {
    return res.status(404).json({
      error: {
        code: 'NOT_FOUND',
        message: `Portal record "${req.params.id}" does not exist.`
      }
    });
  }

  const relatedOpportunities = portalRepo.getOpportunitiesForPortal(req.params.id);

  res.json({
    data: {
      ...portal,
      services_offered: JSON.parse(portal.services_offered),
      related_opportunities: relatedOpportunities
    }
  });
});

apiRouter.get('/portals/:id/history', (req: Request, res: Response) => {
  const portal = portalRepo.findById(req.params.id);
  if (!portal) {
    return res.status(404).json({
      error: {
        code: 'NOT_FOUND',
        message: `Portal record "${req.params.id}" does not exist.`
      }
    });
  }

  const order = req.query.order === 'DESC' || req.query.order === 'desc' ? 'DESC' : 'ASC';
  const limit = req.query.limit ? Math.min(300, Math.max(1, parseInt(req.query.limit as string, 10))) : 100;
  const history = portalRepo.getMonitoringHistory(req.params.id, limit, order);
  res.json({
    data: history,
    meta: {
      portal_id: portal.id,
      total: history.length,
      order
    }
  });
});

apiRouter.get('/portals/:id/opportunities', (req: Request, res: Response) => {
  const portal = portalRepo.findById(req.params.id);
  if (!portal) {
    return res.status(404).json({
      error: {
        code: 'NOT_FOUND',
        message: `Portal record "${req.params.id}" does not exist.`
      }
    });
  }

  const opportunities = portalRepo.getOpportunitiesForPortal(req.params.id);
  res.json({
    data: opportunities
  });
});

// In-memory rate limiting map for portal checks (portalId -> timestamp)
const portalCheckRateLimits = new Map<string, number>();
const RATE_LIMIT_MS = 15000; // 15 seconds rate limit per portal

apiRouter.post('/portals/:id/check', async (req: Request, res: Response) => {
  const portalId = req.params.id;
  const portal = portalRepo.findById(portalId);

  if (!portal) {
    return res.status(404).json({
      error: {
        code: 'NOT_FOUND',
        message: `Portal record "${portalId}" does not exist.`
      }
    });
  }

  const lastCheck = portalCheckRateLimits.get(portalId) || 0;
  const now = Date.now();
  if (now - lastCheck < RATE_LIMIT_MS) {
    const remainingSec = Math.ceil((RATE_LIMIT_MS - (now - lastCheck)) / 1000);
    return res.status(429).json({
      error: {
        code: 'RATE_LIMITED',
        message: `Rate limit active: Next verification probe permitted in ${remainingSec} seconds.`
      }
    });
  }

  portalCheckRateLimits.set(portalId, now);

  // Execute SSRF-hardened audit
  const probeResult = await validateAndProbePortalUrl(portal.official_url);
  const checkTimestamp = new Date().toISOString();

  // Append new monitoring record
  portalRepo.addMonitoringRecord({
    portal_id: portalId,
    check_timestamp: checkTimestamp,
    monitoring_method: 'automated_probe',
    tested_scope: probeResult.testedScope,
    status: probeResult.status,
    http_status: probeResult.httpStatus,
    latency_ms: probeResult.latencyMs,
    diagnostic_notes: probeResult.notes
  });

  const updated = portalRepo.findById(portalId)!;

  res.json({
    data: {
      ...updated,
      services_offered: JSON.parse(updated.services_offered)
    },
    meta: {
      tested_scope: probeResult.testedScope,
      latency_ms: probeResult.latencyMs
    }
  });
});

// --- Dashboard Aggregated Metrics Endpoint ---

apiRouter.get('/dashboard/stats', (req: AuthenticatedRequest, res: Response) => {
  const oppMetrics = opportunityRepo.getMetrics();
  const portalHealth = portalRepo.getHealthSummary();

  let savedCount = 0;
  let completedChecklistSteps = 0;

  if (req.userSession) {
    const saved = userRepo.getSavedOpportunities(req.userSession.user_id);
    savedCount = saved.length;

    const checklist = userRepo.getChecklistProgress(req.userSession.user_id);
    for (const oppId in checklist) {
      for (const stepId in checklist[oppId]) {
        if (checklist[oppId][stepId] === 'completed') {
          completedChecklistSteps++;
        }
      }
    }
  }

  res.json({
    data: {
      totalOpportunities: oppMetrics.total,
      scholarshipsCount: oppMetrics.scholarships,
      examinationsCount: oppMetrics.examinations,
      urgentDeadlinesCount: oppMetrics.urgent,
      savedCount,
      completedChecklistSteps,
      portalHealth: {
        totalPortals: portalHealth.total,
        reachablePortals: portalHealth.reachable,
        healthRatio: portalHealth.ratio
      }
    }
  });
});
