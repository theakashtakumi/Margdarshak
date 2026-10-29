import React from 'react';
import { Opportunity, StepStatus } from '../types.ts';
import { CheckCircle2, Circle, Clock, AlertTriangle, ArrowRight, Bookmark, ExternalLink } from 'lucide-react';

interface ChecklistViewProps {
  savedOpportunities: Opportunity[];
  checklistProgress: Record<string, Record<string, StepStatus>>;
  onUpdateStep: (opportunityId: string, stepId: string, status: StepStatus) => void;
  onSelectOpportunity: (opportunity: Opportunity) => void;
  onBrowseOpportunities: () => void;
}

export const ChecklistView: React.FC<ChecklistViewProps> = ({
  savedOpportunities,
  checklistProgress,
  onUpdateStep,
  onSelectOpportunity,
  onBrowseOpportunities
}) => {
  if (savedOpportunities.length === 0) {
    return (
      <div className="max-w-2xl mx-auto py-12 px-4 text-center space-y-4">
        <div className="w-16 h-16 rounded-2xl bg-[#E5EEFF] text-[#243B6B] flex items-center justify-center mx-auto shadow-xs">
          <Bookmark className="w-8 h-8" />
        </div>
        <h2 className="font-display text-2xl font-bold text-[#1A2B4C]">
          No Opportunities Tracked in Checklist Yet
        </h2>
        <p className="text-sm text-[#64748B] max-w-md mx-auto leading-relaxed">
          Save scholarships or examination schemes to generate an opportunity-specific document checklist derived directly from official government guidelines.
        </p>
        <div className="pt-2">
          <button
            onClick={onBrowseOpportunities}
            className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-[#243B6B] hover:bg-[#1A2B4C] rounded-lg shadow-sm transition-all"
          >
            <span>Explore Verified Schemes</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div>
        <h1 className="font-display text-2xl sm:text-3xl font-bold text-[#1A2B4C] tracking-tight">
          Application Checklists & Roadmaps
        </h1>
        <p className="text-sm text-[#64748B] mt-1 max-w-2xl">
          Track official document requirements, portal registrations, and certifications. Every checklist is custom-tailored to that specific scheme's verified instructions.
        </p>
      </div>

      {/* Scheme Checklists Cards */}
      <div className="space-y-6">
        {savedOpportunities.map((opp) => {
          const userSteps = checklistProgress[opp.id] || {};
          const steps = opp.checklist_schema;
          const completedCount = steps.filter((s) => userSteps[s.id] === 'completed').length;
          const inProgressCount = steps.filter((s) => userSteps[s.id] === 'in_progress').length;
          const totalCount = steps.length;
          const percent = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

          return (
            <div
              key={opp.id}
              className="bg-white rounded-2xl border border-[#E2E8F0] shadow-[0_1px_3px_rgba(26,43,76,0.04)] overflow-hidden"
            >
              {/* Card Header */}
              <div className="p-5 sm:p-6 border-b border-[#F1F5F9] bg-[#F8F9FF] flex flex-wrap items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="text-xs font-semibold uppercase tracking-wider text-[#64748B]">
                    {opp.issuing_authority}
                  </div>
                  <h3
                    onClick={() => onSelectOpportunity(opp)}
                    className="font-display text-lg font-bold text-[#1A2B4C] hover:text-[#0F9D8A] cursor-pointer transition-colors"
                  >
                    {opp.title}
                  </h3>
                </div>

                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <div className="text-xs font-medium text-[#64748B]">Document Readiness</div>
                    <div className="text-sm font-bold text-[#1F2937] tabular-nums">
                      {completedCount} / {totalCount} Ready ({percent}%)
                      {inProgressCount > 0 && (
                        <span className="text-xs font-normal text-[#B45309] ml-1.5">
                          · {inProgressCount} in progress
                        </span>
                      )}
                    </div>
                  </div>

                  <a
                    href={opp.official_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2 text-[#64748B] hover:text-[#0F9D8A] hover:bg-white rounded-lg transition-colors border border-transparent hover:border-[#CBD5E1]"
                    title="Open official portal"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </a>
                </div>
              </div>

              {/* Progress Stepper Bar */}
              <div className="px-5 sm:px-6 pt-4 pb-2">
                <div className="w-full bg-[#E2E8F0] h-2 rounded-full overflow-hidden">
                  <div
                    className="bg-[#0F9D8A] h-full transition-all duration-300 rounded-full"
                    style={{ width: `${percent}%` }}
                  />
                </div>
              </div>

              {/* Checklist Items */}
              <div className="p-5 sm:p-6 space-y-3">
                {steps.map((step, idx) => {
                  const status = userSteps[step.id] || 'pending';
                  const isCompleted = status === 'completed';
                  const isInProgress = status === 'in_progress';

                  return (
                    <div
                      key={step.id}
                      className={`p-4 rounded-xl border transition-all flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 ${
                        isCompleted
                          ? 'bg-[#E6F7F5]/30 border-[#80F3DD]'
                          : isInProgress
                          ? 'bg-[#FEF3C7]/20 border-[#FDE68A]'
                          : 'bg-white border-[#E2E8F0]'
                      }`}
                    >
                      <div className="flex items-start gap-4 flex-1 min-w-0">
                        {/* Checkbox */}
                        <button
                          type="button"
                          onClick={() => onUpdateStep(opp.id, step.id, isCompleted ? 'pending' : 'completed')}
                          className="pt-0.5 shrink-0 focus:outline-none"
                          title={isCompleted ? 'Mark as pending' : 'Mark as ready'}
                        >
                          <div
                            className={`w-6 h-6 rounded-md border flex items-center justify-center transition-colors ${
                              isCompleted
                                ? 'bg-[#243B6B] border-[#243B6B] text-white shadow-xs'
                                : isInProgress
                                ? 'border-[#D97706] bg-[#FEF3C7]'
                                : 'border-[#94A3B8] bg-white hover:border-[#243B6B]'
                            }`}
                          >
                            {isCompleted ? (
                              <CheckCircle2 className="w-4 h-4 text-white" />
                            ) : isInProgress ? (
                              <Clock className="w-3.5 h-3.5 text-[#D97706]" />
                            ) : (
                              <span className="text-[10px] font-bold text-[#94A3B8]">{idx + 1}</span>
                            )}
                          </div>
                        </button>

                        {/* Step Details */}
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-2 mb-1">
                            <span
                              className={`text-sm font-semibold ${
                                isCompleted ? 'text-[#1F2937] line-through opacity-75' : 'text-[#1F2937]'
                              }`}
                            >
                              {step.title}
                            </span>

                            {step.is_mandatory ? (
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-[#FEE2E2] text-[#B91C1C]">
                                Mandatory
                              </span>
                            ) : (
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-[#FEF3C7] text-[#B45309]">
                                Conditional
                              </span>
                            )}
                          </div>

                          <p className="text-xs text-[#64748B] leading-relaxed">
                            {step.description}
                          </p>

                          {step.condition_note && (
                            <div className="mt-1.5 text-xs text-[#B45309] bg-[#FEF3C7]/60 px-2 py-0.5 rounded inline-block">
                              Condition: {step.condition_note}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Explicit Status State Selector */}
                      <div className="shrink-0 flex items-center gap-1.5 p-1 bg-[#F1F5F9] rounded-lg text-xs font-medium self-end sm:self-center">
                        <button
                          type="button"
                          onClick={() => onUpdateStep(opp.id, step.id, 'pending')}
                          className={`px-2 py-1 rounded transition-colors ${
                            status === 'pending'
                              ? 'bg-white text-[#1F2937] font-semibold shadow-xs'
                              : 'text-[#64748B] hover:text-[#1F2937]'
                          }`}
                        >
                          Pending
                        </button>
                        <button
                          type="button"
                          onClick={() => onUpdateStep(opp.id, step.id, 'in_progress')}
                          className={`px-2 py-1 rounded transition-colors ${
                            status === 'in_progress'
                              ? 'bg-white text-[#B45309] font-semibold shadow-xs'
                              : 'text-[#64748B] hover:text-[#1F2937]'
                          }`}
                        >
                          In Progress
                        </button>
                        <button
                          type="button"
                          onClick={() => onUpdateStep(opp.id, step.id, 'completed')}
                          className={`px-2 py-1 rounded transition-colors ${
                            status === 'completed'
                              ? 'bg-white text-[#15803D] font-semibold shadow-xs'
                              : 'text-[#64748B] hover:text-[#1F2937]'
                          }`}
                        >
                          Ready
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Card Footer */}
              <div className="px-6 py-3 bg-[#F8F9FF] border-t border-[#E2E8F0] flex items-center justify-between text-xs text-[#64748B]">
                <span>Status changes persist securely to your student profile across sessions.</span>
                <button
                  onClick={() => onSelectOpportunity(opp)}
                  className="font-semibold text-[#243B6B] hover:text-[#0F9D8A] transition-colors"
                >
                  View Scheme Guidelines →
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
