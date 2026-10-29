import React, { useState } from 'react';
import { X, Sparkles, GraduationCap, Award, Compass, ArrowRight } from 'lucide-react';

interface QuickMatchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onApplyMatch: (academicLevel: string, category: string) => void;
}

export const QuickMatchModal: React.FC<QuickMatchModalProps> = ({
  isOpen,
  onClose,
  onApplyMatch
}) => {
  const [level, setLevel] = useState<string>('Undergraduate');
  const [goal, setGoal] = useState<'scholarship' | 'examination'>('scholarship');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onApplyMatch(level, goal);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div 
        className="bg-white rounded-2xl border border-[#E2E8F0] shadow-[0_12px_28px_rgba(26,43,76,0.12)] max-w-md w-full overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-[#E2E8F0] bg-[#F8F9FF] flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs font-semibold text-[#243B6B]">
            <Sparkles className="w-4 h-4 text-[#0F9D8A]" />
            <span>Civic Quick Match</span>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-md text-[#64748B] hover:text-[#1F2937] hover:bg-slate-200/50 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          <div>
            <h3 className="font-display text-lg font-bold text-[#1A2B4C] mb-1">
              Find Matching Verified Schemes
            </h3>
            <p className="text-xs text-[#64748B]">
              Quickly filter the repository based on your qualification tier and civic objective.
            </p>
          </div>

          {/* Academic Tier Choice */}
          <div className="space-y-2">
            <label className="block text-xs font-semibold text-[#1F2937]">
              Current Academic Qualification
            </label>
            <div className="grid grid-cols-2 gap-2">
              {['Undergraduate', 'Postgraduate', 'Doctorate', 'Graduate'].map((tier) => (
                <button
                  type="button"
                  key={tier}
                  onClick={() => setLevel(tier)}
                  className={`p-3 text-left rounded-xl border text-xs font-medium transition-all ${
                    level === tier
                      ? 'border-[#243B6B] bg-[#E5EEFF] text-[#243B6B] font-semibold'
                      : 'border-[#E2E8F0] hover:border-[#CBD5E1] text-[#475569]'
                  }`}
                >
                  {tier}
                </button>
              ))}
            </div>
          </div>

          {/* Goal Choice */}
          <div className="space-y-2">
            <label className="block text-xs font-semibold text-[#1F2937]">
              Primary Objective
            </label>
            <div className="space-y-2">
              <button
                type="button"
                onClick={() => setGoal('scholarship')}
                className={`w-full p-3.5 text-left rounded-xl border transition-all flex items-start gap-3 ${
                  goal === 'scholarship'
                    ? 'border-[#0F9D8A] bg-[#E6F7F5]/40 text-[#1F2937]'
                    : 'border-[#E2E8F0] hover:border-[#CBD5E1] text-[#475569]'
                }`}
              >
                <Award className="w-5 h-5 text-[#0F9D8A] shrink-0 mt-0.5" />
                <div>
                  <div className="text-xs font-bold text-[#1F2937]">Financial Support & Scholarships</div>
                  <div className="text-[11px] text-[#64748B]">Tuition fee assistance, living stipends, and research grants.</div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setGoal('examination')}
                className={`w-full p-3.5 text-left rounded-xl border transition-all flex items-start gap-3 ${
                  goal === 'examination'
                    ? 'border-[#0F9D8A] bg-[#E6F7F5]/40 text-[#1F2937]'
                    : 'border-[#E2E8F0] hover:border-[#CBD5E1] text-[#475569]'
                }`}
              >
                <GraduationCap className="w-5 h-5 text-[#243B6B] shrink-0 mt-0.5" />
                <div>
                  <div className="text-xs font-bold text-[#1F2937]">Public Service & Entrance Examinations</div>
                  <div className="text-[11px] text-[#64748B]">UPSC, UGC-NET, and national eligibility entrance exams.</div>
                </div>
              </button>
            </div>
          </div>

          {/* Action */}
          <div className="pt-2">
            <button
              type="submit"
              className="w-full flex items-center justify-center gap-2 py-2.5 text-xs sm:text-sm font-semibold text-white bg-[#243B6B] hover:bg-[#1A2B4C] rounded-xl shadow-sm transition-all"
            >
              <span>Apply Filters & View Results</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
