import React, { useState, useEffect } from 'react';
import { Portal, MonitoringRecord, Opportunity } from '../types.ts';
import { fetchPortalById, fetchPortalHistory, checkPortalHealth } from '../lib/api.ts';
import { PortalTimeSeriesChart } from './PortalTimeSeriesChart.tsx';
import {
  X,
  ExternalLink,
  ShieldAlert,
  ShieldCheck,
  Activity,
  Clock,
  RefreshCw,
  Server,
  Layers,
  ArrowRight,
  AlertCircle,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  HelpCircle
} from 'lucide-react';

interface PortalDetailModalProps {
  portalId: string;
  onClose: () => void;
  onSelectOpportunity?: (opportunityId: string) => void;
  onPortalUpdated?: (updated: Portal) => void;
}

export const PortalDetailModal: React.FC<PortalDetailModalProps> = ({
  portalId,
  onClose,
  onSelectOpportunity,
  onPortalUpdated
}) => {
  const [portal, setPortal] = useState<(Portal & { related_opportunities?: any[] }) | null>(null);
  const [history, setHistory] = useState<MonitoringRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [probing, setProbing] = useState(false);
  const [probeMessage, setProbeMessage] = useState<{ text: string; isError?: boolean } | null>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const [portalData, historyData] = await Promise.all([
        fetchPortalById(portalId),
        fetchPortalHistory(portalId)
      ]);
      setPortal(portalData);
      setHistory(historyData);
    } catch (err) {
      console.error('Failed to load portal details:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [portalId]);

  const handleProbe = async () => {
    if (!portal) return;
    setProbing(true);
    setProbeMessage(null);
    try {
      const updated = await checkPortalHealth(portal.id);
      setPortal((prev) => (prev ? { ...prev, latest_check: updated.latest_check } : null));
      onPortalUpdated?.(updated);

      // Refresh history list
      const updatedHistory = await fetchPortalHistory(portal.id);
      setHistory(updatedHistory);
      setProbeMessage({ text: 'Diagnostic probe completed successfully.' });
    } catch (err: any) {
      const msg = err.details?.message || err.message || 'Probe failed or rate limited.';
      setProbeMessage({ text: msg, isError: true });
    } finally {
      setProbing(false);
    }
  };

  const latestCheck = portal?.latest_check;
  const status = latestCheck?.status || 'unknown';

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5">
      <div
        className="portal-detail-modal relative w-full max-w-3xl bg-white rounded-2xl shadow-2xl border border-[#CBD5E1] overflow-hidden my-6 max-h-[92vh] flex flex-col animate-in fade-in zoom-in-95 duration-200"
        role="dialog"
        aria-modal="true"
      >
        {/* Top Header */}
        <div className="px-6 py-4 bg-gradient-to-r from-[#1A2B4C] to-[#243B6B] text-white flex items-start justify-between gap-4 shrink-0">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold text-[#6EE7B7] mb-1">
              <Server className="w-4 h-4 text-[#6EE7B7]" />
              <span className="uppercase tracking-wider">Independent Civic Portal Record</span>
            </div>
            <h2 className="font-display text-xl sm:text-2xl font-bold tracking-tight text-white">
              {portal?.name || 'Loading Portal...'}
            </h2>
            <div className="text-xs text-slate-300 mt-0.5">
              Authority: {portal?.operating_authority || 'Government of India'}
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-white/10 transition-colors"
            aria-label="Close portal modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Scrollable Body */}
        <div className="p-6 overflow-y-auto space-y-6 text-[#1A2B4C]">
          {loading && !portal ? (
            <div className="py-12 flex flex-col items-center justify-center text-slate-400 gap-3">
              <RefreshCw className="w-6 h-6 animate-spin text-[#0F9D8A]" />
              <span className="text-sm">Loading portal diagnostics...</span>
            </div>
          ) : portal ? (
            <>
              {/* Portal Metadata & Verified Hostname */}
              <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 bg-[#F8FAFC] rounded-xl border border-[#E2E8F0]">
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-[#64748B] font-medium">Verified Domain:</span>
                  <span className="font-mono font-semibold text-[#0F9D8A] bg-white px-2 py-0.5 rounded border border-[#CBD5E1]">
                    {portal.verified_hostname}
                  </span>
                  <span className="text-slate-300">|</span>
                  <span className="text-[#64748B]">Category:</span>
                  <span className="font-semibold text-[#1A2B4C]">{portal.category}</span>
                </div>

                <a
                  href={portal.official_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#243B6B] hover:text-[#0F9D8A] transition-colors"
                >
                  <span>Open Official Website</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>

              {/* Description */}
              <div>
                <h4 className="text-xs font-bold text-[#64748B] uppercase tracking-wider mb-1.5">
                  Scope & Responsibilities
                </h4>
                <p className="text-sm text-[#334155] leading-relaxed">
                  {portal.description}
                </p>
              </div>

              {/* Services Offered */}
              {portal.services_offered && portal.services_offered.length > 0 && (
                <div>
                  <h4 className="text-xs font-bold text-[#64748B] uppercase tracking-wider mb-2">
                    Key Digital Services Facilitated
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {portal.services_offered.map((service, idx) => (
                      <span
                        key={idx}
                        className="px-2.5 py-1 text-xs font-medium bg-[#F1F5F9] text-[#1E293B] rounded-lg border border-[#CBD5E1]"
                      >
                        {service}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Latest Diagnostic Status & Live Probe */}
              <div className="border border-[#CBD5E1] rounded-xl p-4 bg-white shadow-xs">
                <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
                  <div className="flex items-center gap-2">
                    <Activity className="w-4 h-4 text-[#0F9D8A]" />
                    <h4 className="text-sm font-bold text-[#1A2B4C]">Latest Reachability Diagnostic</h4>
                  </div>

                  <div className="flex items-center gap-2">
                    {status === 'reachable' && (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-[#DCFCE7] text-[#15803D] border border-[#BBF7D0]">
                        <CheckCircle2 className="w-3.5 h-3.5 text-[#15803D]" />
                        <span>Reachable</span>
                      </span>
                    )}
                    {status === 'degraded' && (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-[#FEF3C7] text-[#B45309] border border-[#FDE68A]">
                        <AlertTriangle className="w-3.5 h-3.5 text-[#B45309]" />
                        <span>Degraded Response</span>
                      </span>
                    )}
                    {status === 'issue' && (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-[#FEE2E2] text-[#B91C1C] border border-[#FECACA]">
                        <XCircle className="w-3.5 h-3.5 text-[#B91C1C]" />
                        <span>Issue Detected</span>
                      </span>
                    )}
                    {status === 'unknown' && (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-[#F1F5F9] text-[#475569] border border-[#CBD5E1]">
                        <HelpCircle className="w-3.5 h-3.5 text-[#64748B]" />
                        <span>Not Yet Probed</span>
                      </span>
                    )}

                    <button
                      onClick={handleProbe}
                      disabled={probing}
                      className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-semibold text-[#243B6B] hover:text-[#1A2B4C] bg-white border border-[#CBD5E1] hover:bg-[#F8FAFC] rounded-lg transition-all disabled:opacity-50"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${probing ? 'animate-spin text-[#0F9D8A]' : ''}`} />
                      <span>{probing ? 'Probing...' : 'Run Probe'}</span>
                    </button>
                  </div>
                </div>

                {probeMessage && (
                  <div
                    className={`mb-3 p-2.5 rounded-lg text-xs font-medium ${
                      probeMessage.isError ? 'bg-[#FEE2E2] text-[#B91C1C]' : 'bg-[#DCFCE7] text-[#15803D]'
                    }`}
                  >
                    {probeMessage.text}
                  </div>
                )}

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 p-3 bg-[#F8FAFC] rounded-lg border border-[#E2E8F0] text-xs">
                  <div>
                    <div className="text-[11px] text-[#64748B]">HTTP Response</div>
                    <div className="font-semibold text-[#1F2937] mt-0.5">
                      {latestCheck?.http_status ? `HTTP ${latestCheck.http_status}` : '—'}
                    </div>
                  </div>
                  <div>
                    <div className="text-[11px] text-[#64748B]">Latency</div>
                    <div className="font-semibold text-[#1F2937] mt-0.5">
                      {latestCheck?.latency_ms !== null && latestCheck?.latency_ms !== undefined ? `${latestCheck.latency_ms} ms` : '—'}
                    </div>
                  </div>
                  <div>
                    <div className="text-[11px] text-[#64748B]">Tested Scope</div>
                    <div className="font-semibold text-[#1F2937] mt-0.5 truncate" title={latestCheck?.tested_scope}>
                      {latestCheck?.tested_scope || 'homepage_tls_head_only'}
                    </div>
                  </div>
                  <div>
                    <div className="text-[11px] text-[#64748B]">Audit Timestamp</div>
                    <div className="font-semibold text-[#1F2937] mt-0.5">
                      {latestCheck?.check_timestamp
                        ? new Date(latestCheck.check_timestamp).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
                        : 'Pending'}
                    </div>
                  </div>
                </div>

                {latestCheck?.diagnostic_notes && (
                  <p className="text-xs text-[#64748B] mt-2.5 leading-relaxed">
                    <strong>Diagnostic Note:</strong> {latestCheck.diagnostic_notes}
                  </p>
                )}
              </div>

              {/* Time-Series Trajectory Chart */}
              <PortalTimeSeriesChart history={history} />

              {/* Honest Civic Notice */}
              <div className="p-3.5 rounded-xl border border-[#CBD5E1] bg-[#F8FAFC] flex items-start gap-3 text-xs text-[#475569]">
                <ShieldAlert className="w-4 h-4 text-[#243B6B] shrink-0 mt-0.5" />
                <div className="leading-relaxed">
                  <span className="font-semibold text-[#1A2B4C] block mb-0.5">
                    Monitoring Scope Limitation:
                  </span>
                  Margdarshak checks root domain connectivity and TLS handshake. It does not initiate transactional actions (submitting applicant forms, SMS OTP delivery, or processing debit card/UPI payments). Reachability of this homepage does not guarantee application submission success.
                </div>
              </div>

              {/* Related Opportunities served by this portal */}
              {portal.related_opportunities && portal.related_opportunities.length > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-xs font-bold text-[#64748B] uppercase tracking-wider">
                      Opportunities Serviced by this Portal ({portal.related_opportunities.length})
                    </h4>
                  </div>
                  <div className="space-y-2">
                    {portal.related_opportunities.map((rel: any, idx: number) => {
                      const opp = rel.opportunity;
                      return (
                        <div
                          key={idx}
                          className="p-3 rounded-xl border border-[#E2E8F0] hover:border-[#243B6B] transition-colors flex items-center justify-between gap-3 bg-white"
                        >
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-[11px] font-semibold text-[#243B6B] bg-[#EEF2FF] px-2 py-0.5 rounded border border-[#C7D2FE]">
                                {rel.relationship_type.replace('_', ' ').toUpperCase()}
                              </span>
                              <span className="text-xs text-[#64748B] truncate">
                                {opp.issuing_authority}
                              </span>
                            </div>
                            <div className="font-semibold text-sm text-[#1A2B4C] truncate">
                              {opp.title}
                            </div>
                          </div>

                          {onSelectOpportunity && (
                            <button
                              onClick={() => {
                                onClose();
                                onSelectOpportunity(rel.opportunity_id);
                              }}
                              className="inline-flex items-center gap-1 text-xs font-semibold text-[#243B6B] hover:text-[#0F9D8A] whitespace-nowrap px-2.5 py-1.5 rounded-lg border border-[#CBD5E1] hover:bg-[#F8FAFC]"
                            >
                              <span>View Opportunity</span>
                              <ArrowRight className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Historical Monitoring Logs */}
              <div>
                <h4 className="text-xs font-bold text-[#64748B] uppercase tracking-wider mb-2">
                  Historical Audit Log ({history.length} Probes)
                </h4>
                {history.length === 0 ? (
                  <p className="text-xs text-[#64748B] italic">No historical audit records logged yet.</p>
                ) : (
                  <div className="border border-[#E2E8F0] rounded-xl overflow-hidden text-xs">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left">
                        <thead className="bg-[#F8FAFC] border-b border-[#E2E8F0] text-[#64748B] font-semibold">
                          <tr>
                            <th className="py-2 px-3">Timestamp</th>
                            <th className="py-2 px-3">Method</th>
                            <th className="py-2 px-3">Status</th>
                            <th className="py-2 px-3">HTTP</th>
                            <th className="py-2 px-3">Latency</th>
                            <th className="py-2 px-3">Diagnostic Scope</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#F1F5F9]">
                          {[...history]
                            .sort((a, b) => new Date(b.check_timestamp).getTime() - new Date(a.check_timestamp).getTime())
                            .map((record, idx) => (
                            <tr key={record.id || idx} className="hover:bg-[#F8FAFC]">
                              <td className="py-2 px-3 text-[#334155] whitespace-nowrap">
                                {new Date(record.check_timestamp).toLocaleString('en-IN', {
                                  month: 'short',
                                  day: 'numeric',
                                  hour: '2-digit',
                                  minute: '2-digit'
                                })}
                              </td>
                              <td className="py-2 px-3 text-[#64748B]">
                                {record.monitoring_method === 'automated_probe' ? 'Automated' : 'Curated'}
                              </td>
                              <td className="py-2 px-3">
                                <span
                                  className={`inline-flex px-1.5 py-0.5 rounded text-[11px] font-semibold ${
                                    record.status === 'reachable'
                                      ? 'bg-[#DCFCE7] text-[#15803D]'
                                      : record.status === 'degraded'
                                      ? 'bg-[#FEF3C7] text-[#B45309]'
                                      : 'bg-[#FEE2E2] text-[#B91C1C]'
                                  }`}
                                >
                                  {record.status}
                                </span>
                              </td>
                              <td className="py-2 px-3 font-mono text-[#334155]">
                                {record.http_status || '—'}
                              </td>
                              <td className="py-2 px-3 tabular-nums text-[#334155]">
                                {record.latency_ms !== null ? `${record.latency_ms} ms` : '—'}
                              </td>
                              <td className="py-2 px-3 text-[#64748B] max-w-[180px] truncate" title={record.diagnostic_notes}>
                                {record.tested_scope}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            </>
          ) : null}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3 bg-[#F8FAFC] border-t border-[#E2E8F0] flex items-center justify-between text-xs text-[#64748B] shrink-0">
          <span>Official Government Directory Reference</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-semibold text-[#1A2B4C] bg-white border border-[#CBD5E1] rounded-lg hover:bg-[#F1F5F9] transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
