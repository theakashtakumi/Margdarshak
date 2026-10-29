import React from 'react';
import { Opportunity } from '../types.ts';
import { calculateDeadlineInfo } from '../lib/dateUtils.ts';
import { CheckCircle2, Clock, AlertTriangle, Bookmark, ExternalLink, ChevronRight, ShieldCheck, HelpCircle } from 'lucide-react';

interface OpportunityCardProps {
  opportunity: Opportunity;
  isSaved: boolean;
  onToggleSave: (id: string, e: React.MouseEvent) => void;
  onSelect: (opportunity: Opportunity) => void;
}

export const OpportunityCard: React.FC<OpportunityCardProps> = ({
  opportunity,
  isSaved,
  onToggleSave,
  onSelect
}) => {
  const deadlineInfo = calculateDeadlineInfo(opportunity.deadline);

  return (
    <div
      onClick={() => onSelect(opportunity)}
      className="group cursor-pointer bg-white rounded-[14px] border border-[#E2E8F0] hover:border-[#0F9D8A] p-5 shadow-[0_1px_3px_rgba(26,43,76,0.04)] hover:shadow-[0_4px_12px_rgba(26,43,76,0.06)] transition-all duration-200 flex flex-col justify-between"
    >
      <div>
        {/* Top Row: Authority & Verification Tag */}
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="text-xs font-semibold text-[#64748B] uppercase tracking-wider line-clamp-1">
            {opportunity.issuing_authority}
          </div>

          <div className="shrink-0 flex items-center gap-1.5">
            {opportunity.verification_state === 'verified' && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-[#DCFCE7] text-[#15803D] border border-[#BBF7D0]">
                <ShieldCheck className="w-3 h-3 text-[#15803D]" />
                <span>Verified</span>
              </span>
            )}
            {opportunity.verification_state === 'provisional' && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-[#FEF3C7] text-[#B45309] border border-[#FDE68A]">
                <Clock className="w-3 h-3 text-[#B45309]" />
                <span>Provisional</span>
              </span>
            )}
            {opportunity.verification_state === 'demo' && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-[#F1F5F9] text-[#64748B] border border-[#E2E8F0]">
                <HelpCircle className="w-3 h-3 text-[#64748B]" />
                <span>Demo Fixture</span>
              </span>
            )}

            {/* Save Button */}
            <button
              onClick={(e) => onToggleSave(opportunity.id, e)}
              title={isSaved ? 'Remove from saved' : 'Save opportunity'}
              className={`p-1.5 rounded-md transition-colors ${
                isSaved
                  ? 'text-[#243B6B] bg-[#E5EEFF] hover:bg-[#D3E4FE]'
                  : 'text-[#94A3B8] hover:text-[#243B6B] hover:bg-[#F1F5F9]'
              }`}
            >
              <Bookmark className={`w-4 h-4 ${isSaved ? 'fill-[#243B6B]' : ''}`} />
            </button>
          </div>
        </div>

        {/* Opportunity Name & Academic Tier */}
        <div className="mb-2">
          <h3 className="font-display text-base sm:text-lg font-semibold text-[#1F2937] group-hover:text-[#243B6B] transition-colors line-clamp-2 leading-snug">
            {opportunity.title}
          </h3>
        </div>

        {/* Unboxed Metadata Line (Anti-Pill Principle) */}
        <div className="flex items-center gap-2 text-xs text-[#64748B] mb-3">
          <span className="capitalize font-medium text-[#243B6B]">{opportunity.category}</span>
          <span aria-hidden="true" className="text-[#CBD5E1]">·</span>
          <span>{opportunity.academic_level}</span>
          <span aria-hidden="true" className="text-[#CBD5E1]">·</span>
          <span className="font-mono text-[11px] text-[#0F9D8A]">{opportunity.verified_domain}</span>
        </div>

        {/* Eligibility Summary Snippet */}
        <p className="text-sm text-[#475569] line-clamp-2 leading-relaxed mb-4">
          {opportunity.eligibility_summary}
        </p>
      </div>

      {/* Footer: Benefit & Deadline Pill */}
      <div className="pt-3 border-t border-[#F1F5F9] flex items-center justify-between gap-3 text-xs">
        <div>
          {opportunity.financial_benefit && (
            <div className="font-semibold text-[#1F2937] tabular-nums line-clamp-1">
              {opportunity.financial_benefit}
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          {deadlineInfo.state === 'closing_soon' && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-[#FEF3C7] text-[#B45309] border border-[#FDE68A] tabular-nums">
              <Clock className="w-3.5 h-3.5 text-[#B45309]" />
              <span>{deadlineInfo.label}</span>
            </span>
          )}

          {deadlineInfo.state === 'open' && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-[#F1F5F9] text-[#475569] border border-[#E2E8F0] tabular-nums">
              <span>{deadlineInfo.label}</span>
            </span>
          )}

          {deadlineInfo.state === 'unannounced' && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-[#F1F5F9] text-[#64748B] border border-[#E2E8F0]">
              <span>Dates Pending</span>
            </span>
          )}

          {deadlineInfo.state === 'expired' && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-[#FEE2E2] text-[#B91C1C] border border-[#FECACA]">
              <span>Closed</span>
            </span>
          )}

          <ChevronRight className="w-4 h-4 text-[#94A3B8] group-hover:text-[#0F9D8A] group-hover:translate-x-0.5 transition-all" />
        </div>
      </div>
    </div>
  );
};
