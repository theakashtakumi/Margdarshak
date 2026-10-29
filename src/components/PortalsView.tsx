import React, { useState, useEffect } from 'react';
import { Portal } from '../types.ts';
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
  Search,
  Server,
  Layers,
  Info
} from 'lucide-react';

interface PortalsViewProps {
  onSelectPortal?: (portalId: string) => void;
}

export const PortalsView: React.FC<PortalsViewProps> = ({ onSelectPortal }) => {
  const [portals, setPortals] = useState<Portal[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [probingId, setProbingId] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<{ id: string; text: string; isError?: boolean } | null>(null);

  const loadPortals = async () => {
    setLoading(true);
    try {
      const data = await fetchPortals({
        search: search.trim() || undefined,
        category: categoryFilter !== 'all' ? categoryFilter : undefined
      });
      setPortals(data);
    } catch (err) {
      console.error('Failed to load portals:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPortals();
  }, [categoryFilter]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loadPortals();
  };

  const handleRunProbe = async (portalId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setProbingId(portalId);
    setStatusMessage(null);
    try {
      const updated = await checkPortalHealth(portalId);
      setPortals((prev) => prev.map((p) => (p.id === portalId ? updated : p)));
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
          <span>INDEPENDENT CIVIC INFRASTRUCTURE DIRECTORY</span>
        </div>
        <h1 className="font-display text-2xl sm:text-3xl font-bold text-[#1A2B4C] tracking-tight">
          Government Portal Directory & Reachability Audits
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

      {/* Search & Category Filter Controls */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white p-3 rounded-xl border border-[#E2E8F0] shadow-xs">
        <form onSubmit={handleSearchSubmit} className="relative flex-1">
          <Search className="w-4 h-4 text-[#94A3B8] absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search portals by name, authority, or hostname..."
            className="w-full pl-9 pr-4 py-2 text-xs text-[#1F2937] placeholder-[#94A3B8] bg-[#F8FAFC] border border-[#CBD5E1] rounded-lg focus:outline-hidden focus:ring-1 focus:ring-[#243B6B] focus:border-[#243B6B]"
          />
        </form>

        <div className="flex items-center gap-2">
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="px-3 py-2 text-xs text-[#1F2937] bg-[#F8FAFC] border border-[#CBD5E1] rounded-lg focus:outline-hidden focus:ring-1 focus:ring-[#243B6B]"
          >
            <option value="all">All Portal Categories</option>
            <option value="Scholarship Gateway">Scholarship Gateways</option>
            <option value="Examination Portal">Examination Portals</option>
            <option value="Civic & Identity Infrastructure">Civic & Identity</option>
            <option value="Higher Education Gateway">Higher Education</option>
          </select>

          <button
            onClick={loadPortals}
            className="px-3 py-2 text-xs font-semibold text-[#243B6B] bg-white border border-[#CBD5E1] hover:bg-[#F1F5F9] rounded-lg transition-colors whitespace-nowrap"
          >
            Filter
          </button>
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
      ) : portals.length === 0 ? (
        <div className="py-12 bg-white rounded-2xl border border-[#E2E8F0] text-center space-y-3">
          <Server className="w-8 h-8 text-[#94A3B8] mx-auto" />
          <h3 className="text-sm font-bold text-[#1A2B4C]">No Portals Found</h3>
          <p className="text-xs text-[#64748B]">Try resetting your search query or category filter.</p>
          <button
            onClick={() => {
              setSearch('');
              setCategoryFilter('all');
            }}
            className="px-3 py-1.5 text-xs font-semibold text-[#243B6B] bg-white border border-[#CBD5E1] rounded-lg hover:bg-[#F8FAFC]"
          >
            Reset Filters
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {portals.map((portal) => {
            const latestCheck = portal.latest_check;
            const status = latestCheck?.status || 'unknown';
            const isReachable = status === 'reachable';
            const isDegraded = status === 'degraded';
            const isIssue = status === 'issue';
            const isUnknown = status === 'unknown';
            const isProbing = probingId === portal.id;

            return (
              <div
                key={portal.id}
                className="bg-white rounded-2xl border border-[#E2E8F0] shadow-[0_1px_3px_rgba(26,43,76,0.04)] p-5 flex flex-col justify-between hover:border-[#CBD5E1] transition-all"
              >
                <div>
                  {/* Top Bar: Authority, Name & Status */}
                  <div className="flex items-start justify-between gap-3 mb-2.5">
                    <div>
                      <div className="text-[11px] font-semibold text-[#64748B] uppercase tracking-wider">
                        {portal.operating_authority}
                      </div>
                      <h3 className="font-display text-base sm:text-lg font-bold text-[#1A2B4C] leading-snug mt-0.5">
                        {portal.name}
                      </h3>
                      <div className="flex items-center gap-1.5 text-xs text-[#64748B] mt-0.5">
                        <span className="font-mono text-[#0F9D8A]">{portal.verified_hostname}</span>
                        <a
                          href={portal.official_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="hover:text-[#1A2B4C] ml-1"
                          title="Open official site"
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
                      {isUnknown && (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-[#F1F5F9] text-[#475569] border border-[#CBD5E1]">
                          <HelpCircle className="w-3.5 h-3.5 text-[#64748B]" />
                          <span>Not Yet Probed</span>
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Description */}
                  <p className="text-xs text-[#475569] line-clamp-2 leading-relaxed mb-3">
                    {portal.description}
                  </p>

                  {/* Services tags */}
                  {portal.services_offered && portal.services_offered.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mb-3.5">
                      {portal.services_offered.slice(0, 3).map((srv, idx) => (
                        <span
                          key={idx}
                          className="px-2 py-0.5 text-[11px] font-medium bg-[#F8FAFC] text-[#334155] rounded border border-[#E2E8F0]"
                        >
                          {srv}
                        </span>
                      ))}
                      {portal.services_offered.length > 3 && (
                        <span className="px-2 py-0.5 text-[11px] font-medium text-[#64748B]">
                          +{portal.services_offered.length - 3} more
                        </span>
                      )}
                    </div>
                  )}

                  {/* Diagnostic Metrics Grid */}
                  <div className="grid grid-cols-3 gap-2 p-2.5 bg-[#F8F9FF] rounded-xl border border-[#E2E8F0] text-xs mb-3">
                    <div>
                      <div className="text-[11px] text-[#64748B] font-medium">HTTP Status</div>
                      <div className="font-semibold text-[#1F2937] tabular-nums mt-0.5">
                        {latestCheck?.http_status ? `HTTP ${latestCheck.http_status}` : '—'}
                      </div>
                    </div>

                    <div>
                      <div className="text-[11px] text-[#64748B] font-medium">Latency</div>
                      <div className="font-semibold text-[#1F2937] tabular-nums mt-0.5">
                        {latestCheck?.latency_ms !== null && latestCheck?.latency_ms !== undefined ? `${latestCheck.latency_ms} ms` : '—'}
                      </div>
                    </div>

                    <div>
                      <div className="text-[11px] text-[#64748B] font-medium">Tested Scope</div>
                      <div className="font-semibold text-[#1F2937] truncate mt-0.5" title={latestCheck?.tested_scope}>
                        Root TLS Head
                      </div>
                    </div>
                  </div>
                </div>

                {/* Footer: Details & Check Buttons */}
                <div>
                  <div className="pt-3 border-t border-[#F1F5F9] flex flex-wrap items-center justify-between gap-2 text-xs">
                    <button
                      onClick={() => onSelectPortal?.(portal.id)}
                      className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#243B6B] hover:text-[#0F9D8A] transition-colors"
                    >
                      <Info className="w-3.5 h-3.5" />
                      <span>View Portal Details & Logs</span>
                    </button>

                    <button
                      onClick={(e) => handleRunProbe(portal.id, e)}
                      disabled={isProbing}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-[#243B6B] hover:text-[#1A2B4C] bg-white border border-[#CBD5E1] hover:bg-[#F1F5F9] rounded-lg transition-all disabled:opacity-50"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${isProbing ? 'animate-spin text-[#0F9D8A]' : ''}`} />
                      <span>{isProbing ? 'Probing...' : 'Check Reachability'}</span>
                    </button>
                  </div>

                  {/* Probe result feedback */}
                  {statusMessage && statusMessage.id === portal.id && (
                    <div className={`mt-2 p-2 rounded text-[11px] font-medium ${
                      statusMessage.isError ? 'bg-[#FEE2E2] text-[#B91C1C]' : 'bg-[#DCFCE7] text-[#15803D]'
                    }`}>
                      {statusMessage.text}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
