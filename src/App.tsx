import React, { useState, useEffect, useCallback } from 'react';
import { Opportunity, DashboardStats, StepStatus, Portal } from './types.ts';
import { Header } from './components/Header.tsx';
import { DashboardView } from './components/DashboardView.tsx';
import { OpportunitiesView } from './components/OpportunitiesView.tsx';
import { PortalsView } from './components/PortalsView.tsx';
import { ChecklistView } from './components/ChecklistView.tsx';
import { SavedView } from './components/SavedView.tsx';
import { OpportunityDetailModal } from './components/OpportunityDetailModal.tsx';
import { PortalDetailModal } from './components/PortalDetailModal.tsx';
import { QuickMatchModal } from './components/QuickMatchModal.tsx';
import {
  fetchOpportunities,
  fetchOpportunityById,
  fetchSavedOpportunities,
  toggleSaveOpportunity,
  fetchChecklistProgress,
  updateChecklistStep,
  fetchDashboardStats,
  ensureSession
} from './lib/api.ts';
import { Compass, ShieldCheck, AlertCircle, RefreshCw } from 'lucide-react';

export default function App() {
  const [currentView, setCurrentView] = useState<'dashboard' | 'opportunities' | 'portals' | 'checklist' | 'saved'>('dashboard');
  const [allOpportunities, setAllOpportunities] = useState<Opportunity[]>([]);
  const [savedIds, setSavedIds] = useState<string[]>([]);
  const [savedOpportunities, setSavedOpportunities] = useState<Opportunity[]>([]);
  const [checklistProgress, setChecklistProgress] = useState<Record<string, Record<string, StepStatus>>>({});
  const [dashboardStats, setDashboardStats] = useState<DashboardStats | null>(null);

  const [selectedOpportunity, setSelectedOpportunity] = useState<Opportunity | null>(null);
  const [selectedPortalId, setSelectedPortalId] = useState<string | null>(null);
  const [isQuickMatchOpen, setIsQuickMatchOpen] = useState(false);
  const [initialFilterCategory, setInitialFilterCategory] = useState<string>('all');
  const [initialLoading, setInitialLoading] = useState(true);
  const [globalError, setGlobalError] = useState<string | null>(null);

  // Synchronize view state with window.location.hash
  const syncHashToState = useCallback((opportunitiesList: Opportunity[]) => {
    const hash = window.location.hash.replace(/^#/, '');
    if (!hash) return;

    if (hash.startsWith('opportunity/')) {
      const oppId = hash.replace('opportunity/', '');
      const found = opportunitiesList.find((o) => o.id === oppId);
      if (found) {
        setSelectedOpportunity(found);
      } else {
        fetchOpportunityById(oppId)
          .then((opp) => setSelectedOpportunity(opp))
          .catch(() => {});
      }
    } else if (hash.startsWith('portal/')) {
      const portalId = hash.replace('portal/', '');
      setSelectedPortalId(portalId);
    } else if (['dashboard', 'opportunities', 'portals', 'checklist', 'saved'].includes(hash)) {
      setCurrentView(hash as any);
      setSelectedOpportunity(null);
      setSelectedPortalId(null);
    }
  }, []);

  const handleNavigate = (view: 'dashboard' | 'opportunities' | 'portals' | 'checklist' | 'saved') => {
    setCurrentView(view);
    setSelectedOpportunity(null);
    setSelectedPortalId(null);
    window.location.hash = view;
  };

  const handleSelectOpportunity = async (oppOrId: Opportunity | string) => {
    const oppId = typeof oppOrId === 'string' ? oppOrId : oppOrId.id;
    try {
      const full = await fetchOpportunityById(oppId);
      setSelectedOpportunity(full);
      window.location.hash = `opportunity/${oppId}`;
    } catch {
      if (typeof oppOrId !== 'string') {
        setSelectedOpportunity(oppOrId);
        window.location.hash = `opportunity/${oppOrId.id}`;
      }
    }
  };

  const handleCloseDetailModal = () => {
    setSelectedOpportunity(null);
    window.location.hash = currentView;
  };

  const handleSelectPortal = (portalId: string) => {
    setSelectedPortalId(portalId);
    window.location.hash = `portal/${portalId}`;
  };

  const handleClosePortalModal = () => {
    setSelectedPortalId(null);
    window.location.hash = currentView;
  };

  // Load foundational datasets
  const loadInitialData = async () => {
    setInitialLoading(true);
    setGlobalError(null);
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

      // Handle initial hash routing
      syncHashToState(opps);
    } catch (err: any) {
      console.error('Failed to load initial data:', err);
      setGlobalError(err.message || 'Unable to connect to Margdarshak service.');
    } finally {
      setInitialLoading(false);
    }
  };

  useEffect(() => {
    loadInitialData();

    const handleHashChange = () => {
      syncHashToState(allOpportunities);
    };

    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  const handleToggleSave = async (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    try {
      const res = await toggleSaveOpportunity(id);
      setSavedIds(res.saved_ids);

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
    // Optimistic UI update
    setChecklistProgress((prev) => ({
      ...prev,
      [opportunityId]: {
        ...(prev[opportunityId] || {}),
        [stepId]: status
      }
    }));

    try {
      const res = await updateChecklistStep(opportunityId, stepId, status);
      setSavedIds(res.saved_ids);

      const [savedData, stats] = await Promise.all([
        fetchSavedOpportunities(),
        fetchDashboardStats()
      ]);
      setSavedOpportunities(savedData.items);
      setDashboardStats(stats);
    } catch (err) {
      console.error('Failed to persist checklist step:', err);
      const fresh = await fetchChecklistProgress();
      setChecklistProgress(fresh);
    }
  };

  const handleApplyQuickMatch = (level: string, category: string) => {
    setInitialFilterCategory(category);
    handleNavigate('opportunities');
  };

  return (
    <div className="min-h-screen bg-[#F7F9FC] text-[#1F2937] flex flex-col font-sans">
      {/* Top Bar Contract (Wordmark, Nav Links, Quick Match Action) */}
      <Header
        currentView={currentView}
        onNavigate={handleNavigate}
        onOpenQuickMatch={() => setIsQuickMatchOpen(true)}
        savedCount={savedIds.length}
      />

      {/* Main Content Viewport */}
      <main className="flex-1 max-w-[1280px] w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {globalError ? (
          <div className="p-8 bg-white rounded-2xl border border-[#FECACA] text-center space-y-4 max-w-lg mx-auto my-12 shadow-sm">
            <AlertCircle className="w-10 h-10 text-[#DC2626] mx-auto" />
            <h2 className="text-lg font-bold text-[#1F2937]">Service Connection Error</h2>
            <p className="text-xs text-[#64748B] leading-relaxed">{globalError}</p>
            <button
              onClick={loadInitialData}
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-[#243B6B] hover:bg-[#1A2B4C] rounded-lg transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Retry Connection</span>
            </button>
          </div>
        ) : initialLoading ? (
          <div className="space-y-6">
            <div className="h-44 bg-slate-200/60 rounded-2xl animate-pulse"></div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-28 bg-white rounded-xl border border-[#E2E8F0] animate-pulse"></div>
              ))}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[1, 2].map((i) => (
                <div key={i} className="h-44 bg-white rounded-xl border border-[#E2E8F0] animate-pulse"></div>
              ))}
            </div>
          </div>
        ) : (
          <>
            {currentView === 'dashboard' && (
              <DashboardView
                stats={dashboardStats}
                opportunities={allOpportunities}
                savedIds={savedIds}
                onToggleSave={handleToggleSave}
                onSelectOpportunity={handleSelectOpportunity}
                onNavigate={handleNavigate}
              />
            )}

            {currentView === 'opportunities' && (
              <OpportunitiesView
                savedIds={savedIds}
                onToggleSave={handleToggleSave}
                onSelectOpportunity={handleSelectOpportunity}
                initialCategory={initialFilterCategory}
              />
            )}

            {currentView === 'portals' && (
              <PortalsView onSelectPortal={handleSelectPortal} />
            )}

            {currentView === 'checklist' && (
              <ChecklistView
                savedOpportunities={savedOpportunities}
                checklistProgress={checklistProgress}
                onUpdateStep={handleUpdateChecklistStep}
                onSelectOpportunity={handleSelectOpportunity}
                onBrowseOpportunities={() => handleNavigate('opportunities')}
              />
            )}

            {currentView === 'saved' && (
              <SavedView
                savedOpportunities={savedOpportunities}
                savedIds={savedIds}
                onToggleSave={handleToggleSave}
                onSelectOpportunity={handleSelectOpportunity}
                onBrowseOpportunities={() => handleNavigate('opportunities')}
                onOpenChecklist={() => handleNavigate('checklist')}
              />
            )}
          </>
        )}
      </main>

      {/* Opportunity Detail Modal */}
      <OpportunityDetailModal
        opportunity={selectedOpportunity}
        isOpen={Boolean(selectedOpportunity)}
        onClose={handleCloseDetailModal}
        isSaved={selectedOpportunity ? savedIds.includes(selectedOpportunity.id) : false}
        onToggleSave={handleToggleSave}
        checklistProgress={selectedOpportunity ? checklistProgress[selectedOpportunity.id] || {} : {}}
        onUpdateStep={handleUpdateChecklistStep}
        onSelectPortal={handleSelectPortal}
      />

      {/* Portal Detail Modal */}
      {selectedPortalId && (
        <PortalDetailModal
          portalId={selectedPortalId}
          onClose={handleClosePortalModal}
          onSelectOpportunity={handleSelectOpportunity}
        />
      )}

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
