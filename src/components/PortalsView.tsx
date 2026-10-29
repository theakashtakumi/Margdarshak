import React, { useState, useEffect } from 'react';
import { PortalAudit } from '../types.ts';
import { fetchPortals, checkPortalHealth } from '../lib/api.ts';
import {
  Activity,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  HelpCircle,
  RefreshCw,
  ExternalLink,
  ShieldAlert,
  Clock,
  ShieldCheck,
  Server
} from 'lucide-react';

export const PortalsView: React.FC = () => {
  const [portals, setPortals] = useState<PortalAudit[]>([]);
  const [loading, setLoading] = useState(true);
  const [probingId, setProbingId] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<{ id: string; text: string; isError?: boolean } | null>(null);

  const loadPortals = async () => {
    setLoading(true);
    try {
      const data = await fetchPortals();
      setPortals(data);
    } catch (err) {
      console.error('Failed to load portals:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPortals();
  }, []);

  const handleRunProbe = async (portalId: string) => {
    setProbingId(portalId);
    setStatusMessage(null);
    try {
      const updated = await checkPortalHealth(portalId);
      setPortals((prev) => prev.map((p) => (p.portal_id === portalId ? updated : p)));
      setStatusMessage({ id: portalId, text: 'Verification probe completed successfully.' });
    } catch (err: any) {
      const msg = err.details?.message || err.message || 'Probe failed or rate limited.';
      setStatusMessage({ id: portalId, text: msg, isError: true });
    } finally {
      setProbingId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Title & Scope */}
      <div>
        <div className="flex items-center gap-2 text-xs font-semibold text-[#0F9D8A] mb-1">
          <Activity className="w-3.5 h-3.5" />
          <span>CIVIC INFRASTRUCTURE AUDIT</span>
        </div>
        <h1 className="font-display text-2xl sm:text-3xl font-bold text-[#1A2B4C] tracking-tight">
          Government Portal Reachability Audits
        </h1>
        <p className="text-sm text-[#64748B] mt-1 max-w-2xl">
          Monitors root DNS reachability and TLS response times for premier public application portals. We explicitly bound our inspection scope to prevent false guarantees.
        </p>
      </div>

      {/* Honest Civic Notice Banner */}
      <div className="p-4 rounded-xl border border-[#CBD5E1] bg-white shadow-xs flex items-start gap-3.5">
        <ShieldAlert className="w-5 h-5 text-[#243B6B] shrink-0 mt-0.5" />
        <div className="text-xs text-[#475569] leading-relaxed">
          <span className="font-semibold text-[#1A2B4C] block mb-0.5">
            Honest Civic Inspection Boundary:
          </span>
          A successful root HTTPS check verifies that the government web server is reachable over the public internet. It does <strong>not</strong> guarantee that internal microservices (Aadhaar OTP delivery, candidate login, photo compression, or final payment callbacks) are fully functional. Never wait until the final deadline hour to submit applications.
        </div>
      </div>

      {/* Portals Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-56 bg-white rounded-xl border border-[#E2E8F0] animate-pulse p-5">
              <div className="h-5 bg-slate-200 rounded w-1/2 mb-3"></div>
              <div className="h-4 bg-slate-200 rounded w-1/3 mb-4"></div>
              <div className="h-16 bg-slate-100 rounded w-full"></div>
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {portals.map((portal) => {
            const isReachable = portal.status === 'reachable';
            const isDegraded = portal.status === 'degraded';
            const isIssue = portal.status === 'issue';
            const isProbing = probingId === portal.portal_id;

            return (
              <div
                key={portal.portal_id}
                className="bg-white rounded-2xl border border-[#E2E8F0] shadow-[0_1px_3px_rgba(26,43,76,0.04)] p-5 flex flex-col justify-between"
              >
                <div>
                  {/* Top Bar: Name & Status */}
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div>
                      <h3 className="font-display text-base sm:text-lg font-bold text-[#1A2B4C] leading-snug">
                        {portal.name}
                      </h3>
                      <div className="flex items-center gap-1.5 text-xs text-[#64748B] mt-0.5">
                        <span className="font-mono text-[#0F9D8A]">{portal.allowlisted_host}</span>
                        <a
                          href={portal.official_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="hover:text-[#1A2B4C]"
                        >
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      </div>
                    </div>

                    {/* Status Badge */}
                    <div className="shrink-0">
                      {isReachable && (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-[#DCFCE7] text-[#15803D] border border-[#BBF7D0]">
                          <CheckCircle2 className="w-3.5 h-3.5 text-[#15803D]" />
                          <span>Reachable</span>
                        </span>
                      )}
                      {isDegraded && (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-[#FEF3C7] text-[#B45309] border border-[#FDE68A]">
                          <AlertTriangle className="w-3.5 h-3.5 text-[#B45309]" />
                          <span>Degraded</span>
                        </span>
                      )}
                      {isIssue && (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-[#FEE2E2] text-[#B91C1C] border border-[#FECACA]">
                          <XCircle className="w-3.5 h-3.5 text-[#B91C1C]" />
                          <span>Issue Detected</span>
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Diagnostic Metrics Grid */}
                  <div className="grid grid-cols-3 gap-2 p-3 bg-[#F8F9FF] rounded-xl border border-[#E2E8F0] text-xs mb-3">
                    <div>
                      <div className="text-[11px] text-[#64748B] font-medium">HTTP Status</div>
                      <div className="font-semibold text-[#1F2937] tabular-nums mt-0.5">
                        {portal.http_status ? `HTTP ${portal.http_status}` : 'No Response'}
                      </div>
                    </div>

                    <div>
                      <div className="text-[11px] text-[#64748B] font-medium">Latency</div>
                      <div className="font-semibold text-[#1F2937] tabular-nums mt-0.5">
                        {portal.latency_ms !== null ? `${portal.latency_ms} ms` : '—'}
                      </div>
                    </div>

                    <div>
                      <div className="text-[11px] text-[#64748B] font-medium">Tested Scope</div>
                      <div className="font-semibold text-[#1F2937] truncate mt-0.5" title={portal.tested_scope}>
                        Root TLS Head
                      </div>
                    </div>
                  </div>

                  {/* Disclaimer / Inspection Notes */}
                  <p className="text-xs text-[#64748B] leading-relaxed mb-4">
                    {portal.disclaimer_notes}
                  </p>
                </div>

                {/* Footer: Last Check Time & Probe Button */}
                <div className="pt-3 border-t border-[#F1F5F9] flex flex-wrap items-center justify-between gap-3 text-xs">
                  <div className="flex items-center gap-1.5 text-[#64748B]">
                    <Clock className="w-3.5 h-3.5" />
                    <span>
                      Audited: {new Date(portal.last_checked_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>

                  <button
                    onClick={() => handleRunProbe(portal.portal_id)}
                    disabled={isProbing}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-[#243B6B] hover:text-[#1A2B4C] bg-white border border-[#CBD5E1] hover:bg-[#F1F5F9] rounded-lg transition-all disabled:opacity-50"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isProbing ? 'animate-spin text-[#0F9D8A]' : ''}`} />
                    <span>{isProbing ? 'Probing...' : 'Check Reachability'}</span>
                  </button>
                </div>

                {/* Probe result feedback */}
                {statusMessage && statusMessage.id === portal.portal_id && (
                  <div className={`mt-2 p-2 rounded text-[11px] font-medium ${
                    statusMessage.isError ? 'bg-[#FEE2E2] text-[#B91C1C]' : 'bg-[#DCFCE7] text-[#15803D]'
                  }`}>
                    {statusMessage.text}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
