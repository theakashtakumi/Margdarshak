import React, { useState, useEffect } from 'react';
import { Opportunity, DashboardStats, StepStatus } from './types.ts';
import { Header } from './components/Header.tsx';
import { DashboardView } from './components/DashboardView.tsx';
import { OpportunitiesView } from './components/OpportunitiesView.tsx';
import { PortalsView } from './components/PortalsView.tsx';
import { ChecklistView } from './components/ChecklistView.tsx';
import { SavedView } from './components/SavedView.tsx';
import { OpportunityDetailModal } from './components/OpportunityDetailModal.tsx';
import { QuickMatchModal } from './components/QuickMatchModal.tsx';
import {
  fetchOpportunities,
  fetchSavedOpportunities,
  toggleSaveOpportunity,
  fetchChecklistProgress,
  updateChecklistStep,
  fetchDashboardStats,
  ensureSession
} from './lib/api.ts';
import { Compass, ShieldCheck, Lock, ExternalLink } from 'lucide-react';

export default function App() {
  const [currentView, setCurrentView] = useState<'dashboard' | 'opportunities' | 'portals' | 'checklist' | 'saved'>('dashboard');
  const [allOpportunities, setAllOpportunities] = useState<Opportunity[]>([]);
  const [savedIds, setSavedIds] = useState<string[]>([]);
  const [savedOpportunities, setSavedOpportunities] = useState<Opportunity[]>([]);
  const [checklistProgress, setChecklistProgress] = useState<Record<string, Record<string, StepStatus>>>({});
  const [dashboardStats, setDashboardStats] = useState<DashboardStats | null>(null);

  const [selectedOpportunity, setSelectedOpportunity] = useState<Opportunity | null>(null);
  const [isQuickMatchOpen, setIsQuickMatchOpen] = useState(false);
  const [initialFilterCategory, setInitialFilterCategory] = useState<string>('all');

  // Initialize session and load foundational datasets
  const loadInitialData = async () => {
    try {
      await ensureSession();

      const [opps, savedData, checklist, stats] = await Promise.all([
        fetchOpportunities(),
        fetchSavedOpportunities(),
        fetchChecklistProgress(),
        fetchDashboardStats()
      ]);

      setAllOpportunities(opps);
      setSavedIds(savedData.saved_ids);
      setSavedOpportunities(savedData.items);
      setChecklistProgress(checklist);
      setDashboardStats(stats);
    } catch (err) {
      console.error('Failed to load initial data:', err);
    }
  };

  useEffect(() => {
    loadInitialData();
  }, []);

  const handleToggleSave = async (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    try {
      const res = await toggleSaveOpportunity(id);
      setSavedIds(res.saved_ids);

      // Refresh saved opportunities and dashboard stats
      const [savedData, stats] = await Promise.all([
        fetchSavedOpportunities(),
        fetchDashboardStats()
      ]);
      setSavedOpportunities(savedData.items);
      setDashboardStats(stats);
    } catch (err) {
      console.error('Failed to toggle save:', err);
    }
  };

  const handleUpdateChecklistStep = async (
    opportunityId: string,
    stepId: string,
    status: StepStatus
  ) => {
    // Optimistic update
    setChecklistProgress((prev) => ({
      ...prev,
      [opportunityId]: {
        ...(prev[opportunityId] || {}),
        [stepId]: status
      }
    }));

    try {
      await updateChecklistStep(opportunityId, stepId, status);
      const [savedData, stats] = await Promise.all([
        fetchSavedOpportunities(),
        fetchDashboardStats()
      ]);
      setSavedOpportunities(savedData.items);
      setDashboardStats(stats);
    } catch (err) {
      console.error('Failed to persist checklist step:', err);
      // Revert if error
      const fresh = await fetchChecklistProgress();
      setChecklistProgress(fresh);
    }
  };

  const handleApplyQuickMatch = (level: string, category: string) => {
    setInitialFilterCategory(category);
    setCurrentView('opportunities');
  };

  return (
    <div className="min-h-screen bg-[#F7F9FC] text-[#1F2937] flex flex-col font-sans">
      {/* Top Bar Contract (Wordmark, Nav Links, Quick Match Action) */}
      <Header
        currentView={currentView}
        onNavigate={(view) => setCurrentView(view)}
        onOpenQuickMatch={() => setIsQuickMatchOpen(true)}
        savedCount={savedIds.length}
      />

      {/* Main Content Viewport */}
      <main className="flex-1 max-w-[1280px] w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {currentView === 'dashboard' && (
          <DashboardView
            stats={dashboardStats}
            opportunities={allOpportunities}
            savedIds={savedIds}
            onToggleSave={handleToggleSave}
            onSelectOpportunity={(opp) => setSelectedOpportunity(opp)}
            onNavigate={(view) => setCurrentView(view)}
          />
        )}

        {currentView === 'opportunities' && (
          <OpportunitiesView
            savedIds={savedIds}
            onToggleSave={handleToggleSave}
            onSelectOpportunity={(opp) => setSelectedOpportunity(opp)}
            initialCategory={initialFilterCategory}
          />
        )}

        {currentView === 'portals' && <PortalsView />}

        {currentView === 'checklist' && (
          <ChecklistView
            savedOpportunities={savedOpportunities}
            checklistProgress={checklistProgress}
            onUpdateStep={handleUpdateChecklistStep}
            onSelectOpportunity={(opp) => setSelectedOpportunity(opp)}
            onBrowseOpportunities={() => setCurrentView('opportunities')}
          />
        )}

        {currentView === 'saved' && (
          <SavedView
            savedOpportunities={savedOpportunities}
            savedIds={savedIds}
            onToggleSave={handleToggleSave}
            onSelectOpportunity={(opp) => setSelectedOpportunity(opp)}
            onBrowseOpportunities={() => setCurrentView('opportunities')}
            onOpenChecklist={() => setCurrentView('checklist')}
          />
        )}
      </main>

      {/* Detail Modal */}
      <OpportunityDetailModal
        opportunity={selectedOpportunity}
        isOpen={Boolean(selectedOpportunity)}
        onClose={() => setSelectedOpportunity(null)}
        isSaved={selectedOpportunity ? savedIds.includes(selectedOpportunity.id) : false}
        onToggleSave={handleToggleSave}
        checklistProgress={selectedOpportunity ? checklistProgress[selectedOpportunity.id] || {} : {}}
        onUpdateStep={handleUpdateChecklistStep}
      />

      {/* Quick Match Modal */}
      <QuickMatchModal
        isOpen={isQuickMatchOpen}
        onClose={() => setIsQuickMatchOpen(false)}
        onApplyMatch={handleApplyQuickMatch}
      />

      {/* Civic Footer (Anti-Slop Discipline) */}
      <footer className="mt-auto border-t border-[#E2E8F0] bg-white py-8 text-xs text-[#64748B]">
        <div className="max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded bg-[#243B6B] flex items-center justify-center text-white">
              <Compass className="w-3.5 h-3.5 text-[#80F3DD]" />
            </div>
            <span className="font-display font-semibold text-[#1A2B4C]">Margdarshak</span>
            <span>· Civic Clarity for Indian Scholars</span>
          </div>

          <div className="flex items-center gap-4 text-[11px]">
            <span className="inline-flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5 text-[#0F9D8A]" />
              <span>Official .gov.in & .nic.in verification</span>
            </span>
            <span>·</span>
            <span>Zero advertising or third-party data tracking</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
