import React from 'react';
import { Opportunity, StepStatus } from '../types.ts';
import { calculateDeadlineInfo } from '../lib/dateUtils.ts';
import { getCalendarDownloadUrl } from '../lib/api.ts';
import {
  X,
  ShieldCheck,
  Calendar,
  ExternalLink,
  Download,
  Bookmark,
  CheckCircle2,
  Clock,
  AlertCircle,
  HelpCircle,
  FileText,
  Lock,
  Server
} from 'lucide-react';

interface OpportunityDetailModalProps {
  opportunity: Opportunity | null;
  isOpen: boolean;
  onClose: () => void;
  isSaved: boolean;
  onToggleSave: (id: string) => void;
  checklistProgress: Record<string, StepStatus>;
  onUpdateStep: (opportunityId: string, stepId: string, status: StepStatus) => void;
  onSelectPortal?: (portalId: string) => void;
}

export const OpportunityDetailModal: React.FC<OpportunityDetailModalProps> = ({
  opportunity,
  isOpen,
  onClose,
  isSaved,
  onToggleSave,
  checklistProgress,
  onUpdateStep,
  onSelectPortal
}) => {
  if (!isOpen || !opportunity) return null;

  const deadlineInfo = calculateDeadlineInfo(opportunity.deadline);

  // Compute completed steps
  const completedCount = opportunity.checklist_schema.filter(
    (step) => checklistProgress[step.id] === 'completed'
  ).length;
  const totalCount = opportunity.checklist_schema.length;
  const progressPercent = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 animate-in fade-in duration-200">
      <div 
        className="bg-white rounded-2xl border border-[#E2E8F0] shadow-[0_12px_28px_rgba(26,43,76,0.12)] max-w-3xl w-full max-h-[92vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Top Header */}
        <div className="px-6 py-4 border-b border-[#E2E8F0] flex items-center justify-between gap-4 bg-[#F8F9FF]">
          <div className="flex items-center gap-2 text-xs font-semibold text-[#64748B]">
            <span className="uppercase">{opportunity.issuing_authority}</span>
            <span aria-hidden="true">·</span>
            <span className="font-mono text-[#0F9D8A]">{opportunity.verified_domain}</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => onToggleSave(opportunity.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                isSaved
                  ? 'bg-[#243B6B] text-white shadow-sm'
                  : 'bg-white border border-[#CBD5E1] text-[#1F2937] hover:bg-[#F1F5F9]'
              }`}
            >
              <Bookmark className={`w-3.5 h-3.5 ${isSaved ? 'fill-white' : ''}`} />
              <span>{isSaved ? 'Saved' : 'Save'}</span>
            </button>

            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-[#64748B] hover:text-[#1F2937] hover:bg-slate-200/50 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Scrollable Content */}
        <div className="p-6 overflow-y-auto space-y-6">
          {/* Title & Verification Tag */}
          <div>
            <div className="flex flex-wrap items-center gap-2 mb-2">
              {opportunity.verification_state === 'verified' && (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-xs font-semibold bg-[#DCFCE7] text-[#15803D] border border-[#BBF7D0]">
                  <ShieldCheck className="w-3.5 h-3.5 text-[#15803D]" />
                  <span>Officially Verified Scheme</span>
                </span>
              )}
              {opportunity.verification_state === 'provisional' && (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-xs font-semibold bg-[#FEF3C7] text-[#B45309] border border-[#FDE68A]">
                  <Clock className="w-3.5 h-3.5 text-[#B45309]" />
                  <span>Provisional Schedule (Pending Notification)</span>
                </span>
              )}
              {opportunity.verification_state === 'demo' && (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-xs font-semibold bg-[#F1F5F9] text-[#64748B] border border-[#E2E8F0]">
                  <HelpCircle className="w-3.5 h-3.5 text-[#64748B]" />
                  <span>Test Fixture (Demonstration Data)</span>
                </span>
              )}
              <span className="text-xs text-[#64748B]">
                Last checked: {new Date(opportunity.last_verified_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
              </span>
            </div>

            <h2 className="font-display text-xl sm:text-2xl font-bold text-[#1A2B4C] leading-snug">
              {opportunity.title}
            </h2>
          </div>

          {/* Quick Metrics Strip */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-4 bg-[#F8F9FF] rounded-xl border border-[#E2E8F0]">
            <div>
              <div className="text-xs text-[#64748B] font-medium mb-1">Financial Benefit / Scale</div>
              <div className="text-sm font-semibold text-[#1F2937]">
                {opportunity.financial_benefit || 'Non-monetary civic appointment'}
              </div>
            </div>

            <div>
              <div className="text-xs text-[#64748B] font-medium mb-1">Application Deadline</div>
              <div className="text-sm font-semibold text-[#1F2937] flex items-center gap-1.5">
                <Calendar className="w-4 h-4 text-[#0F9D8A]" />
                <span>{deadlineInfo.formattedDate}</span>
              </div>
            </div>

            <div>
              <div className="text-xs text-[#64748B] font-medium mb-1">Academic Level</div>
              <div className="text-sm font-semibold text-[#1F2937] capitalize">
                {opportunity.academic_level} · {opportunity.category}
              </div>
            </div>
          </div>

          {/* Description & Eligibility */}
          <div className="space-y-4">
            <div>
              <h3 className="text-sm font-semibold text-[#1A2B4C] uppercase tracking-wider mb-2">
                Overview & Purpose
              </h3>
              <p className="text-sm text-[#475569] leading-relaxed">
                {opportunity.description}
              </p>
            </div>

            <div>
              <h3 className="text-sm font-semibold text-[#1A2B4C] uppercase tracking-wider mb-2">
                Eligibility Criteria
              </h3>
              <div className="p-4 bg-white rounded-xl border border-[#E2E8F0] text-sm text-[#1F2937] leading-relaxed shadow-xs">
                {opportunity.eligibility_summary}
              </div>
            </div>
          </div>

          {/* Official Portals & Where to Apply */}
          {opportunity.linked_portals && opportunity.linked_portals.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-1">
                <h3 className="text-sm font-semibold text-[#1A2B4C] uppercase tracking-wider flex items-center gap-1.5">
                  <Server className="w-4 h-4 text-[#0F9D8A]" />
                  <span>Official Portals & Where to Apply ({opportunity.linked_portals.length})</span>
                </h3>
              </div>
              <p className="text-xs text-[#64748B] mb-3">
                Designated government web portals handling candidate registration, application submission, and official circulars for this opportunity.
              </p>

              <div className="space-y-2.5">
                {opportunity.linked_portals.map((rel, idx) => {
                  const portal = rel.portal;
                  if (!portal) return null;
                  const latest = portal.latest_check;
                  const status = latest?.status || 'unknown';

                  return (
                    <div
                      key={idx}
                      className="p-3.5 rounded-xl border border-[#CBD5E1] bg-[#F8FAFC] flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                    >
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2 mb-1">
                          <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-[#243B6B] text-white">
                            {rel.relationship_type.replace('_', ' ')}
                          </span>
                          <span className="text-xs font-semibold text-[#1A2B4C]">
                            {portal.name}
                          </span>
                          <span className="font-mono text-xs text-[#0F9D8A]">
                            ({portal.verified_hostname})
                          </span>
                        </div>

                        {rel.relationship_notes && (
                          <div className="text-xs text-[#475569] mb-1">
                            {rel.relationship_notes}
                          </div>
                        )}

                        <div className="flex items-center gap-2 text-[11px] text-[#64748B]">
                          <span>Portal Reachability:</span>
                          {status === 'reachable' && (
                            <span className="font-semibold text-[#15803D]">Reachable</span>
                          )}
                          {status === 'degraded' && (
                            <span className="font-semibold text-[#B45309]">Degraded</span>
                          )}
                          {status === 'issue' && (
                            <span className="font-semibold text-[#B91C1C]">Issue Detected</span>
                          )}
                          {status === 'unknown' && (
                            <span className="font-semibold text-[#64748B]">Not Yet Probed</span>
                          )}
                          {latest?.latency_ms !== null && latest?.latency_ms !== undefined && (
                            <span>· {latest.latency_ms} ms</span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {onSelectPortal && (
                          <button
                            type="button"
                            onClick={() => onSelectPortal(portal.id)}
                            className="px-2.5 py-1 text-xs font-semibold text-[#243B6B] hover:text-[#1A2B4C] bg-white border border-[#CBD5E1] hover:bg-[#F1F5F9] rounded-lg transition-colors"
                          >
                            Portal Diagnostic
                          </button>
                        )}
                        <a
                          href={rel.official_reference_url || portal.official_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-semibold text-white bg-[#0F9D8A] hover:bg-[#0B8272] rounded-lg transition-colors shadow-xs"
                        >
                          <span>Visit Portal</span>
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="mt-2 text-[11px] text-[#64748B] italic">
                Note: Portal status reflects web server availability and does not determine eligibility or guarantee internal transaction completion.
              </div>
            </div>
          )}

          {/* Scheme-Specific Document Checklist */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="text-sm font-semibold text-[#1A2B4C] uppercase tracking-wider">
                  Scheme-Specific Application Checklist
                </h3>
                <p className="text-xs text-[#64748B]">
                  Derived directly from official ministry guidelines. Progress saves automatically.
                </p>
              </div>

              <div className="text-right">
                <span className="text-xs font-semibold tabular-nums text-[#0F9D8A]">
                  {completedCount} of {totalCount} completed ({progressPercent}%)
                </span>
              </div>
            </div>

            {/* Progress Bar */}
            <div className="w-full bg-[#E2E8F0] h-2 rounded-full overflow-hidden mb-4">
              <div
                className="bg-[#0F9D8A] h-full transition-all duration-300 rounded-full"
                style={{ width: `${progressPercent}%` }}
              />
            </div>

            {/* Steps List */}
            <div className="space-y-2.5">
              {opportunity.checklist_schema.map((step) => {
                const isCompleted = checklistProgress[step.id] === 'completed';
                return (
                  <div
                    key={step.id}
                    onClick={() => onUpdateStep(opportunity.id, step.id, isCompleted ? 'pending' : 'completed')}
                    className={`cursor-pointer p-3.5 rounded-xl border transition-all flex items-start gap-3.5 ${
                      isCompleted
                        ? 'bg-[#E6F7F5]/40 border-[#80F3DD]'
                        : 'bg-white border-[#E2E8F0] hover:border-[#CBD5E1]'
                    }`}
                  >
                    {/* Checkbox */}
                    <div className="pt-0.5 shrink-0">
                      <div
                        className={`w-5 h-5 rounded-md border flex items-center justify-center transition-colors ${
                          isCompleted
                            ? 'bg-[#243B6B] border-[#243B6B] text-white'
                            : 'border-[#94A3B8] bg-white'
                        }`}
                      >
                        {isCompleted && <CheckCircle2 className="w-3.5 h-3.5 text-white" />}
                      </div>
                    </div>

                    {/* Step Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <span className={`text-sm font-semibold ${isCompleted ? 'text-[#1F2937] line-through opacity-75' : 'text-[#1F2937]'}`}>
                          {step.title}
                        </span>

                        {step.is_mandatory ? (
                          <span className="px-1.5 py-0.2 rounded text-[10px] font-semibold bg-[#FEE2E2] text-[#B91C1C]">
                            Mandatory
                          </span>
                        ) : (
                          <span className="px-1.5 py-0.2 rounded text-[10px] font-semibold bg-[#FEF3C7] text-[#B45309]">
                            Conditional
                          </span>
                        )}
                      </div>

                      <p className="text-xs text-[#64748B] leading-relaxed mb-1">
                        {step.description}
                      </p>

                      {step.condition_note && (
                        <div className="text-[11px] font-medium text-[#B45309] bg-[#FEF3C7]/40 px-2 py-1 rounded inline-block">
                          Note: {step.condition_note}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Authoritative Source Citation */}
          <div className="p-4 rounded-xl border border-[#E2E8F0] bg-[#F8F9FF] flex items-start justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-[#1A2B4C]">
                <Lock className="w-3.5 h-3.5 text-[#0F9D8A]" />
                <span>Verified Government Source</span>
              </div>
              <p className="text-xs text-[#64748B]">
                Information verified against public departmental gazette / guidelines documentation.
              </p>
            </div>

            <a
              href={opportunity.official_source_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[#243B6B] hover:text-[#1A2B4C] bg-white border border-[#CBD5E1] rounded-lg hover:bg-[#F1F5F9] transition-colors whitespace-nowrap shrink-0"
            >
              <span>View Source</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>
        </div>

        {/* Modal Bottom Actions */}
        <div className="px-6 py-4 border-t border-[#E2E8F0] bg-white flex flex-wrap items-center justify-between gap-3">
          <div>
            <a
              href={getCalendarDownloadUrl(opportunity.id)}
              download={`margdarshak-${opportunity.id}.ics`}
              className="inline-flex items-center gap-2 px-3 py-2 text-xs font-medium text-[#1F2937] bg-white border border-[#CBD5E1] hover:bg-[#F1F5F9] rounded-lg transition-colors shadow-xs"
            >
              <Download className="w-3.5 h-3.5 text-[#64748B]" />
              <span>Export to Calendar (.ics)</span>
            </a>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-[#64748B] hover:text-[#1F2937] transition-colors"
            >
              Close
            </button>

            <a
              href={opportunity.official_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2 text-xs sm:text-sm font-semibold text-white bg-[#0F9D8A] hover:bg-[#0B8272] rounded-lg shadow-sm transition-all"
            >
              <span>Apply on Official Portal</span>
              <ExternalLink className="w-4 h-4" />
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};
