import { type ReactNode, useMemo, useState } from 'react';
import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  BarChart3,
  Bell,
  Check,
  ChevronDown,
  CircleHelp,
  CircleX,
  Clock3,
  Database,
  FileBarChart,
  FileCheck2,
  FileText,
  Gauge,
  Info,
  LayoutDashboard,
  Lightbulb,
  ListFilter,
  LoaderCircle,
  Menu,
  Moon,
  PanelLeftClose,
  PanelLeftOpen,
  Play,
  Printer,
  RefreshCw,
  Settings2,
  ShieldAlert,
  Sparkles,
  Sun,
  Target,
  Upload,
  UserRound,
  X,
  Zap,
  type LucideIcon,
} from 'lucide-react';
import {
  getGetDashboardQueryKey,
  getGetPredictionHistoryQueryKey,
  getGetPredictionQueryKey,
  getGetReportQueryKey,
  useCreatePrediction,
  useGetDashboard,
  useGetPrediction,
  useGetPredictionHistory,
  useGetReport,
  useUploadDataset,
} from '@workspace/api-client-react';
import type {
  DatasetRow,
  DatasetValidation,
  DashboardSummary,
  Prediction,
  PredictionHistoryItem,
  Recommendation,
  Report,
  RiskFactor,
  Warning,
} from '@workspace/api-client-react';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import NotFound from '@/pages/not-found';
import { Route, Switch, useLocation, Router as WouterRouter } from 'wouter';
import './index.css';

const queryClient = new QueryClient();

type View =
  | 'overview'
  | 'upload'
  | 'prediction'
  | 'analysis'
  | 'warnings'
  | 'advisor'
  | 'history'
  | 'reports'
  | 'settings';

type NavItem = {
  id: View;
  label: string;
  icon: LucideIcon;
  note?: string;
};

const primaryNav: NavItem[] = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'upload', label: 'Upload data', icon: Upload, note: 'New assessment' },
  { id: 'prediction', label: 'Prediction detail', icon: Gauge },
  { id: 'analysis', label: 'Risk analysis', icon: BarChart3 },
  { id: 'warnings', label: 'Early warnings', icon: ShieldAlert },
  { id: 'advisor', label: 'AI advisor', icon: Sparkles },
];

const secondaryNav: NavItem[] = [
  { id: 'history', label: 'History', icon: Clock3 },
  { id: 'reports', label: 'Reports', icon: FileBarChart },
  { id: 'settings', label: 'Settings', icon: Settings2 },
];

const demoRows: DatasetRow[] = [
  { month: '2024-01', revenue: 48200, expenses: 39100, cash_balance: 21800, current_ratio: 1.48, late_payments: 2 },
  { month: '2024-02', revenue: 46750, expenses: 40200, cash_balance: 19600, current_ratio: 1.35, late_payments: 4 },
  { month: '2024-03', revenue: 45300, expenses: 41900, cash_balance: 16800, current_ratio: 1.21, late_payments: 6 },
  { month: '2024-04', revenue: 42900, expenses: 43100, cash_balance: 13900, current_ratio: 1.09, late_payments: 8 },
  { month: '2024-05', revenue: 44100, expenses: 42600, cash_balance: 12400, current_ratio: 1.03, late_payments: 9 },
  { month: '2024-06', revenue: 45800, expenses: 41800, cash_balance: 13100, current_ratio: 1.08, late_payments: 7 },
];

function formatDate(value?: string) {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat('en', { day: 'numeric', month: 'short', year: 'numeric' }).format(date);
}

function formatPercent(value: number | undefined, digits = 1) {
  return `${((value ?? 0) * 100).toFixed(digits)}%`;
}

function riskTone(level = '') {
  const normalized = level.toLowerCase();
  if (normalized.includes('high') || normalized.includes('critical')) return 'critical';
  if (normalized.includes('medium') || normalized.includes('moderate')) return 'watch';
  return 'stable';
}

function riskLabel(level = '') {
  return level ? level.charAt(0).toUpperCase() + level.slice(1).toLowerCase() : 'Not assessed';
}

function cls(...values: Array<string | false | undefined>) {
  return values.filter(Boolean).join(' ');
}

function IconButton({
  label,
  onClick,
  children,
  className = '',
}: {
  label: string;
  onClick: () => void;
  children: ReactNode;
  className?: string;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className={cls('inline-flex h-9 w-9 items-center justify-center rounded-xl border border-border bg-card text-muted-foreground transition hover:-translate-y-0.5 hover:border-primary/40 hover:text-primary', className)}
      data-testid={`button-${label.toLowerCase().replaceAll(' ', '-')}`}
    >
      {children}
    </button>
  );
}

function StatusPill({ level, children }: { level: string; children?: ReactNode }) {
  const tone = riskTone(level);
  return (
    <span className={cls('inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.12em]', tone === 'critical' && 'border-[#e8b9b1] bg-[#fff0ed] text-[#a9473f]', tone === 'watch' && 'border-[#efd99c] bg-[#fff8dd] text-[#8a6812]', tone === 'stable' && 'border-[#a9d6cc] bg-[#eaf8f3] text-[#19715e]')}>
      <span className={cls('h-1.5 w-1.5 rounded-full', tone === 'critical' && 'bg-[#ce554a]', tone === 'watch' && 'bg-[#d49d12]', tone === 'stable' && 'bg-[#24977e]')} />
      {children ?? riskLabel(level)}
    </span>
  );
}

function EmptyState({ icon: Icon, title, description, action }: { icon: LucideIcon; title: string; description: string; action?: ReactNode }) {
  return (
    <div className="flex min-h-[360px] flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-card/60 px-6 text-center">
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-secondary text-secondary-foreground"><Icon size={25} /></div>
      <h3 className="font-display text-2xl text-foreground">{title}</h3>
      <p className="mt-2 max-w-sm text-sm leading-6 text-muted-foreground">{description}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

function LoadingState({ label = 'Loading your workspace' }: { label?: string }) {
  return (
    <div className="space-y-5" aria-label={label} data-testid="status-loading">
      <div className="h-7 w-52 animate-pulse rounded-lg bg-muted" />
      <div className="grid gap-4 md:grid-cols-3"><div className="h-36 animate-pulse rounded-2xl bg-muted" /><div className="h-36 animate-pulse rounded-2xl bg-muted" /><div className="h-36 animate-pulse rounded-2xl bg-muted" /></div>
      <div className="h-72 animate-pulse rounded-2xl bg-muted" />
    </div>
  );
}

function QueryError({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="flex min-h-[300px] flex-col items-center justify-center rounded-2xl border border-[#e8b9b1] bg-[#fff6f3] p-6 text-center" data-testid="status-error">
      <CircleX className="mb-3 text-[#b34b41]" size={30} />
      <h3 className="font-display text-2xl text-foreground">The signal went quiet</h3>
      <p className="mt-2 max-w-sm text-sm leading-6 text-muted-foreground">We could not reach the risk workspace. Your saved assessments are safe. Try again in a moment.</p>
      <button type="button" onClick={onRetry} className="mt-5 inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground transition hover:-translate-y-0.5" data-testid="button-retry-query"><RefreshCw size={15} /> Try again</button>
    </div>
  );
}

function GaugeRing({ score, large = false }: { score: number; large?: boolean }) {
  const safeScore = Math.max(0, Math.min(100, score || 0));
  return (
    <div className={cls('relative flex shrink-0 items-center justify-center rounded-full', large ? 'h-48 w-48' : 'h-28 w-28')} style={{ background: `conic-gradient(hsl(var(--chart-1)) ${safeScore * 3.6}deg, hsl(var(--muted)) 0deg)` }}>
      <div className={cls('flex flex-col items-center justify-center rounded-full bg-card', large ? 'h-[calc(100%-14px)] w-[calc(100%-14px)]' : 'h-[calc(100%-10px)] w-[calc(100%-10px)]')}>
        <span className={cls('font-display leading-none text-foreground', large ? 'text-5xl' : 'text-3xl')} data-testid="text-health-score">{Math.round(safeScore)}</span>
        <span className="mt-1 font-mono-ui text-[10px] uppercase tracking-[0.14em] text-muted-foreground">health</span>
      </div>
    </div>
  );
}

function AppShell({ view, setView, children, latest, onNewAssessment }: { view: View; setView: (view: View) => void; children: ReactNode; latest: Prediction | null; onNewAssessment: () => void }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const nav = (items: NavItem[]) => items.map((item) => {
    const Icon = item.icon;
    return (
      <button type="button" key={item.id} onClick={() => { setView(item.id); setMobileOpen(false); }} className={cls('group flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-semibold transition', view === item.id ? 'bg-sidebar-accent text-sidebar-accent-foreground' : 'text-sidebar-foreground/65 hover:bg-sidebar-accent/70 hover:text-sidebar-foreground', collapsed && 'justify-center px-2')} data-testid={`nav-${item.id}`}>
        <Icon size={18} strokeWidth={view === item.id ? 2.4 : 1.8} />
        {!collapsed && <span className="flex-1">{item.label}</span>}
        {!collapsed && item.note && <span className="rounded-md bg-sidebar-primary/15 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-sidebar-primary">{item.note}</span>}
      </button>
    );
  });
  return (
    <div className="min-h-[100dvh] bg-background text-foreground">
      <aside className={cls('fixed inset-y-0 left-0 z-40 hidden flex-col bg-sidebar px-3 py-5 text-sidebar-foreground transition-all duration-300 lg:flex', collapsed ? 'w-[76px]' : 'w-[254px]')}>
        <div className={cls('mb-8 flex items-center gap-3 px-2', collapsed && 'justify-center')}>
          <div className="flex h-10 w-10 items-center justify-center rounded-[13px] bg-sidebar-primary text-sidebar-primary-foreground shadow-lg shadow-black/10"><Target size={21} strokeWidth={2.5} /></div>
          {!collapsed && <div><div className="font-display text-[22px] leading-none text-sidebar-foreground">MSME <span className="text-sidebar-primary">Sentinel</span></div><div className="mt-1 font-mono-ui text-[9px] uppercase tracking-[0.19em] text-sidebar-foreground/45">risk intelligence</div></div>}
        </div>
        {!collapsed && <div className="mb-2 px-3 font-mono-ui text-[9px] font-medium uppercase tracking-[0.2em] text-sidebar-foreground/35">Workspace</div>}
        <nav className="space-y-1">{nav(primaryNav)}</nav>
        {!collapsed && <div className="mb-2 mt-8 px-3 font-mono-ui text-[9px] font-medium uppercase tracking-[0.2em] text-sidebar-foreground/35">Records</div>}
        <nav className="space-y-1">{nav(secondaryNav)}</nav>
        <div className={cls('mt-auto border-t border-sidebar-border pt-4', collapsed ? 'px-1' : 'px-2')}>
          {!collapsed && <div className="mb-4 rounded-xl bg-sidebar-accent/70 p-3"><div className="flex items-center gap-2 text-xs font-bold"><span className="h-2 w-2 rounded-full bg-[#50c9a9]" /> API connected</div><div className="mt-1 text-[11px] text-sidebar-foreground/45">Models ready for analysis</div></div>}
          <button type="button" onClick={() => setCollapsed(!collapsed)} className={cls('flex w-full items-center gap-3 rounded-xl px-3 py-2 text-xs font-semibold text-sidebar-foreground/50 hover:bg-sidebar-accent hover:text-sidebar-foreground', collapsed && 'justify-center px-2')} data-testid="button-collapse-sidebar">{collapsed ? <PanelLeftOpen size={17} /> : <><PanelLeftClose size={17} /><span>Collapse sidebar</span></>}</button>
        </div>
      </aside>
      {mobileOpen && <div className="fixed inset-0 z-30 bg-[#102333]/35 backdrop-blur-sm lg:hidden" onClick={() => setMobileOpen(false)} />}
      <aside className={cls('fixed inset-y-0 left-0 z-40 flex w-[270px] flex-col bg-sidebar px-3 py-5 text-sidebar-foreground shadow-2xl transition-transform lg:hidden', mobileOpen ? 'translate-x-0' : '-translate-x-full')}>
        <div className="mb-8 flex items-center justify-between px-2"><div className="flex items-center gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-[13px] bg-sidebar-primary text-sidebar-primary-foreground"><Target size={21} /></div><div className="font-display text-[22px]">MSME <span className="text-sidebar-primary">Sentinel</span></div></div><IconButton label="Close navigation" onClick={() => setMobileOpen(false)} className="border-sidebar-border bg-transparent text-sidebar-foreground" ><X size={17} /></IconButton></div>
        <nav className="space-y-1">{nav(primaryNav)}<div className="mb-2 mt-8 px-3 font-mono-ui text-[9px] uppercase tracking-[0.2em] text-sidebar-foreground/35">Records</div>{nav(secondaryNav)}</nav>
      </aside>
      <main className={cls('min-h-[100dvh] transition-all duration-300', collapsed ? 'lg:pl-[76px]' : 'lg:pl-[254px]')}>
        <header className="sticky top-0 z-20 flex h-[76px] items-center justify-between border-b border-border/80 bg-background/90 px-4 backdrop-blur-md sm:px-7 lg:px-10">
          <div className="flex items-center gap-3"><IconButton label="Open navigation" onClick={() => setMobileOpen(true)} className="lg:hidden"><Menu size={18} /></IconButton><div><p className="font-mono-ui text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Command center</p><p className="mt-0.5 hidden text-sm font-semibold text-foreground sm:block">{latest?.businessName ?? 'Set up your first business signal'}</p></div></div>
          <div className="flex items-center gap-2 sm:gap-3"><button type="button" onClick={onNewAssessment} className="hidden items-center gap-2 rounded-xl bg-primary px-3.5 py-2.5 text-xs font-bold text-primary-foreground shadow-sm transition hover:-translate-y-0.5 sm:inline-flex" data-testid="button-header-new-assessment"><Zap size={15} /> New assessment</button><IconButton label="Notifications" onClick={() => setView('warnings')}><Bell size={17} /></IconButton><div className="hidden h-8 w-px bg-border sm:block" /><div className="flex h-9 w-9 items-center justify-center rounded-xl bg-secondary text-secondary-foreground"><UserRound size={17} /></div></div>
        </header>
        <div className="mx-auto max-w-[1480px] px-4 py-6 sm:px-7 lg:px-10 lg:py-9">{children}</div>
      </main>
    </div>
  );
}

function PageHeading({ eyebrow, title, description, action }: { eyebrow: string; title: string; description: string; action?: ReactNode }) {
  return <div className="mb-7 flex flex-col justify-between gap-5 sm:flex-row sm:items-end"><div><div className="mb-2 flex items-center gap-2 font-mono-ui text-[10px] font-medium uppercase tracking-[0.2em] text-primary"><span className="h-1.5 w-1.5 rounded-full bg-accent" />{eyebrow}</div><h1 className="font-display text-4xl leading-[1.04] tracking-[-0.025em] text-foreground sm:text-5xl">{title}</h1><p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">{description}</p></div>{action && <div className="shrink-0">{action}</div>}</div>;
}

function TrendBars({ trend }: { trend: DashboardSummary['trend'] }) {
  if (!trend?.length) return <div className="flex h-48 items-center justify-center text-sm text-muted-foreground">Trend data will appear after your first assessment.</div>;
  const max = Math.max(...trend.map((item) => Math.max(item.health, item.risk)), 100);
  return <div className="flex h-48 items-end gap-2 border-b border-border px-1 pb-0 pt-5 sm:gap-4">{trend.map((item, index) => <div className="group flex h-full flex-1 flex-col justify-end gap-2" key={`${item.label}-${index}`}><div className="relative flex h-full items-end justify-center gap-1.5"><div className="w-2.5 rounded-t-md bg-primary/80 transition-all group-hover:bg-primary sm:w-4" style={{ height: `${Math.max(6, (item.health / max) * 100)}%` }} /><div className="w-2.5 rounded-t-md bg-accent transition-all group-hover:bg-[#d8a92c] sm:w-4" style={{ height: `${Math.max(5, (item.risk / max) * 100)}%` }} /></div><span className="truncate text-center font-mono-ui text-[9px] text-muted-foreground">{item.label}</span></div>)}</div>;
}

function Overview({ dashboard, loading, error, retry, onView, onUpload }: { dashboard?: DashboardSummary; loading: boolean; error: boolean; retry: () => void; onView: (view: View) => void; onUpload: () => void }) {
  if (loading) return <LoadingState />;
  if (error) return <QueryError onRetry={retry} />;
  const latest = dashboard?.latest;
  if (!latest) return <><PageHeading eyebrow="Your first signal" title="Start with a clear view of risk." description="Upload a simple CSV of business performance data and Sentinel will turn it into a practical health assessment." action={<button type="button" onClick={onUpload} className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-bold text-primary-foreground transition hover:-translate-y-0.5" data-testid="button-upload-first-data"><Upload size={16} /> Upload business data</button>} /><EmptyState icon={Database} title="No assessment yet" description="Your overview will come alive once the first dataset has been assessed." action={<button type="button" onClick={() => onUpload()} className="rounded-xl border border-border bg-card px-4 py-2.5 text-sm font-bold text-foreground hover:border-primary/40" data-testid="button-empty-upload">Bring in a CSV</button>} /></>;
  const activeWarnings = latest.warnings?.slice(0, 3) ?? [];
  return <div className="space-y-7">
    <PageHeading eyebrow="Overview / latest signal" title={`Know where ${latest.businessName} stands.`} description={`Your latest assessment was run ${formatDate(latest.createdAt)}. Sentinel found a ${riskLabel(latest.riskLevel).toLowerCase()} level of financial distress risk over the next ${latest.horizon}.`} action={<button type="button" onClick={onUpload} className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-3 text-sm font-bold text-foreground transition hover:-translate-y-0.5 hover:border-primary/40" data-testid="button-upload-another"><Upload size={16} /> Assess new data</button>} />
    <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-[1.1fr_0.9fr_0.9fr]">
      <div className="relative overflow-hidden rounded-2xl bg-primary p-6 text-primary-foreground shadow-sentinel"><div className="absolute -right-12 -top-12 h-40 w-40 rounded-full border-[18px] border-primary-foreground/10" /><div className="absolute -bottom-20 right-14 h-44 w-44 rounded-full border border-primary-foreground/10" /><div className="relative"><div className="flex items-start justify-between"><div><div className="font-mono-ui text-[10px] uppercase tracking-[0.18em] text-primary-foreground/60">Latest health score</div><div className="mt-5 flex items-end gap-3"><span className="font-display text-7xl leading-none">{Math.round(latest.healthScore)}</span><span className="mb-1 text-sm text-primary-foreground/60">/ 100</span></div></div><Gauge size={25} className="text-accent" /></div><div className="mt-7 flex items-center justify-between border-t border-primary-foreground/15 pt-4"><StatusPill level={latest.riskLevel} /><span className="text-xs text-primary-foreground/60">confidence {formatPercent(latest.confidence)}</span></div></div></div>
      <div className="rounded-2xl border border-border bg-card p-6 shadow-sentinel"><div className="flex items-start justify-between"><div><div className="font-mono-ui text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Failure probability</div><div className="mt-4 font-display text-5xl text-foreground">{formatPercent(latest.failureProbability)}</div></div><div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#fff0ed] text-[#b34b41]"><ArrowUpRight size={19} /></div></div><div className="mt-8 text-xs leading-5 text-muted-foreground">Model horizon: <span className="font-semibold text-foreground">{latest.horizon}</span><br />Survival probability <span className="font-semibold text-foreground">{formatPercent(latest.survivalProbability)}</span></div></div>
      <div className="rounded-2xl border border-border bg-card p-6 shadow-sentinel"><div className="flex items-start justify-between"><div><div className="font-mono-ui text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Active warnings</div><div className="mt-4 font-display text-5xl text-foreground">{latest.warnings?.length ?? 0}</div></div><div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#fff8dd] text-[#977316]"><Bell size={19} /></div></div><button type="button" onClick={() => onView('warnings')} className="mt-8 inline-flex items-center gap-1.5 text-xs font-bold text-primary hover:underline" data-testid="button-view-warnings">Review signal details <ArrowRight size={14} /></button></div>
    </section>
    <section className="grid gap-5 xl:grid-cols-[1.3fr_0.7fr]">
      <div className="rounded-2xl border border-border bg-card p-5 shadow-sentinel sm:p-6"><div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="font-display text-2xl">Health trajectory</h2><p className="mt-1 text-xs text-muted-foreground">Recent assessments, health against modeled risk</p></div><div className="flex items-center gap-4 font-mono-ui text-[10px] uppercase tracking-wider text-muted-foreground"><span className="flex items-center gap-1.5"><i className="h-2 w-2 rounded-full bg-primary" /> Health</span><span className="flex items-center gap-1.5"><i className="h-2 w-2 rounded-full bg-accent" /> Risk</span></div></div><TrendBars trend={dashboard?.trend ?? []} /></div>
      <div className="rounded-2xl border border-border bg-card p-5 shadow-sentinel sm:p-6"><div className="mb-5 flex items-center justify-between"><div><h2 className="font-display text-2xl">Watch now</h2><p className="mt-1 text-xs text-muted-foreground">Signals needing context</p></div><button type="button" onClick={() => onView('warnings')} className="text-xs font-bold text-primary" data-testid="button-open-all-warnings">View all</button></div>{activeWarnings.length ? <div className="space-y-4">{activeWarnings.map((warning) => <div key={warning.id} className="flex gap-3"><div className={cls('mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg', warning.severity.toLowerCase().includes('high') ? 'bg-[#fff0ed] text-[#b34b41]' : 'bg-[#fff8dd] text-[#977316]')}><AlertTriangle size={15} /></div><div className="min-w-0"><div className="flex items-center gap-2"><p className="truncate text-sm font-bold">{warning.title}</p><StatusPill level={warning.severity} /></div><p className="mt-1 text-xs leading-5 text-muted-foreground">{warning.value} · {warning.reference}</p></div></div>)}</div> : <p className="text-sm text-muted-foreground">No active warnings in this assessment.</p>}</div>
    </section>
    <section className="grid gap-5 md:grid-cols-3"><MetricCard label="Assessments run" value={String(dashboard?.stats.totalPredictions ?? 0)} note="Saved in your workspace" icon={FileCheck2} /><MetricCard label="Average health" value={`${Math.round(dashboard?.stats.averageHealth ?? 0)}`} note="Across saved assessments" icon={Gauge} /><MetricCard label="Average modeled risk" value={formatPercent(dashboard?.stats.averageRisk)} note="Failure probability" icon={Target} /></section>
  </div>;
}

function MetricCard({ label, value, note, icon: Icon }: { label: string; value: string; note: string; icon: LucideIcon }) {
  return <div className="flex items-start justify-between rounded-2xl border border-border bg-card p-5 shadow-sentinel"><div><div className="font-mono-ui text-[10px] uppercase tracking-[0.16em] text-muted-foreground">{label}</div><div className="mt-3 font-display text-4xl">{value}</div><div className="mt-1 text-xs text-muted-foreground">{note}</div></div><div className="flex h-9 w-9 items-center justify-center rounded-xl bg-secondary text-secondary-foreground"><Icon size={17} /></div></div>;
}

function parseCsv(text: string): DatasetRow[] {
  const lines = text.trim().split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) return [];
  const headers = lines[0].split(',').map((header) => header.trim());
  return lines.slice(1).map((line) => {
    const values = line.split(',');
    return headers.reduce<DatasetRow>((row, header, index) => {
      const raw = (values[index] ?? '').trim();
      row[header] = raw === '' ? null : /^-?\d+(\.\d+)?$/.test(raw) ? Number(raw) : raw;
      return row;
    }, {});
  });
}

function UploadView({ onValidated, onRun }: { onValidated: (validation: DatasetValidation, rows: DatasetRow[], businessName: string) => void; onRun: (validation: DatasetValidation, rows: DatasetRow[], businessName: string) => void }) {
  const [businessName, setBusinessName] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [rows, setRows] = useState<DatasetRow[]>([]);
  const [localError, setLocalError] = useState('');
  const [validation, setValidation] = useState<DatasetValidation | null>(null);
  const upload = useUploadDataset();
  const readFile = (selected: File) => {
    setFile(selected);
    setLocalError('');
    const reader = new FileReader();
    reader.onload = () => {
      const parsed = parseCsv(String(reader.result ?? ''));
      if (!parsed.length) { setLocalError('This file needs a header row and at least one record.'); setRows([]); return; }
      setRows(parsed);
      upload.mutate({ data: { filename: selected.name, rows: parsed, businessName: businessName || null } }, { onSuccess: (result) => { setValidation(result); onValidated(result, parsed, businessName); } });
    };
    reader.onerror = () => setLocalError('We could not read this file. Try exporting the CSV again.');
    reader.readAsText(selected);
  };
  const useDemo = () => {
    setBusinessName('Northstar Fabrication');
    setFile(new File(['demo'], 'northstar-demo.csv', { type: 'text/csv' }));
    setRows(demoRows);
    setLocalError('');
    upload.mutate({ data: { filename: 'northstar-demo.csv', rows: demoRows, businessName: 'Northstar Fabrication' } }, { onSuccess: (result) => { setValidation(result); onValidated(result, demoRows, 'Northstar Fabrication'); } });
  };
  const columns = validation?.rows?.[0] ? Object.keys(validation.rows[0]) : rows[0] ? Object.keys(rows[0]) : [];
  return <div className="space-y-7">
    <PageHeading eyebrow="Data intake" title="Bring the books into focus." description="Upload a monthly operating snapshot. Sentinel validates the shape first, then lets you run a transparent risk assessment." action={<button type="button" onClick={useDemo} className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-3 text-sm font-bold transition hover:-translate-y-0.5 hover:border-primary/40" data-testid="button-use-demo-data"><Sparkles size={16} /> Use demo dataset</button>} />
    <div className="grid gap-5 xl:grid-cols-[0.85fr_1.15fr]">
      <section className="space-y-5">
        <div className="rounded-2xl border border-border bg-card p-5 shadow-sentinel sm:p-6"><div className="mb-5"><h2 className="font-display text-2xl">Dataset details</h2><p className="mt-1 text-xs text-muted-foreground">A name helps you recognize this business later.</p></div><label className="mb-1.5 block text-xs font-bold text-foreground" htmlFor="business-name">Business name <span className="font-normal text-muted-foreground">(optional)</span></label><input id="business-name" value={businessName} onChange={(event) => setBusinessName(event.target.value)} placeholder="e.g. Northstar Fabrication" className="mb-5 w-full rounded-xl border border-input bg-background px-3.5 py-3 text-sm outline-none transition placeholder:text-muted-foreground/60 focus:border-primary focus:ring-2 focus:ring-primary/10" data-testid="input-business-name" /><label htmlFor="csv-file" className="group flex cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed border-primary/35 bg-primary/[0.035] px-5 py-10 text-center transition hover:border-primary hover:bg-primary/[0.06]"><input id="csv-file" type="file" accept=".csv,text/csv" className="sr-only" onChange={(event) => { const selected = event.target.files?.[0]; if (selected) readFile(selected); }} data-testid="input-csv-file" /><div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-secondary text-secondary-foreground transition group-hover:-translate-y-1"><Upload size={21} /></div><div className="text-sm font-bold">{file?.name ?? 'Choose a CSV file'}</div><div className="mt-1 text-xs text-muted-foreground">Monthly records · headers in first row</div></label>{upload.isPending && <div className="mt-4 flex items-center gap-2 text-xs text-primary"><LoaderCircle className="animate-spin" size={14} /> Validating dataset…</div>}{localError && <div className="mt-4 rounded-xl bg-[#fff0ed] p-3 text-xs leading-5 text-[#a9473f]" data-testid="status-upload-error">{localError}</div>}</div>
        <div className="rounded-2xl border border-border bg-secondary/45 p-5"><div className="flex gap-3"><CircleHelp className="mt-0.5 shrink-0 text-primary" size={17} /><div><h3 className="text-sm font-bold">What makes a useful file?</h3><p className="mt-1 text-xs leading-5 text-muted-foreground">Include at least six time-ordered records with revenue, expenses, cash, and any payment or liquidity indicators you track.</p></div></div></div>
      </section>
      <section className="rounded-2xl border border-border bg-card p-5 shadow-sentinel sm:p-6">{validation ? <><div className="flex flex-wrap items-start justify-between gap-3"><div><div className="flex items-center gap-2"><div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#eaf8f3] text-[#19715e]"><Check size={17} /></div><div><h2 className="font-display text-2xl">Validation complete</h2><p className="text-xs text-muted-foreground">{validation.filename}</p></div></div></div><div className="rounded-xl bg-secondary px-3 py-2 text-right"><div className="font-display text-2xl text-foreground">{Math.round(validation.qualityScore)}<span className="text-sm">/100</span></div><div className="font-mono-ui text-[9px] uppercase tracking-wider text-muted-foreground">quality score</div></div></div><div className="mt-7 grid grid-cols-2 gap-3 sm:grid-cols-4"><MiniStat label="Records" value={String(validation.records)} /><MiniStat label="Columns" value={String(validation.columns)} /><MiniStat label="Missing" value={String(validation.missingValues)} /><MiniStat label="Duplicates" value={String(validation.duplicates)} /></div>{validation.warnings?.length ? <div className="mt-5 rounded-xl border border-[#efd99c] bg-[#fff8dd] p-4"><div className="flex gap-2 text-xs font-bold text-[#76570e]"><AlertTriangle size={15} /> Review before running</div><ul className="mt-2 space-y-1 text-xs leading-5 text-[#76570e]">{validation.warnings.map((warning) => <li key={warning}>· {warning}</li>)}</ul></div> : <div className="mt-5 rounded-xl border border-[#a9d6cc] bg-[#eaf8f3] p-4 text-xs leading-5 text-[#19715e]">Dataset structure looks healthy. You can run an assessment now.</div>}<button type="button" disabled={upload.isPending || !validation.valid} onClick={() => onRun(validation, rows, businessName)} className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3.5 text-sm font-bold text-primary-foreground transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50" data-testid="button-run-assessment"><Play size={16} /> Run risk assessment <ArrowRight size={15} /></button></> : <><div className="mb-6"><div className="mb-2 flex items-center gap-2 font-mono-ui text-[10px] uppercase tracking-[0.18em] text-muted-foreground"><FileText size={14} /> Preview</div><h2 className="font-display text-2xl">Your data, before the model sees it.</h2><p className="mt-1 text-xs leading-5 text-muted-foreground">We will show the first rows here and check the file for missing values and duplicates.</p></div>{rows.length ? <PreviewTable rows={rows} columns={columns} /> : <EmptyState icon={FileText} title="Nothing loaded yet" description="Choose a CSV or use the demo dataset to see a validation preview." />}</>}</section>
    </div>
  </div>;
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl bg-secondary/65 p-3"><div className="font-mono-ui text-[9px] uppercase tracking-wider text-muted-foreground">{label}</div><div className="mt-1 font-display text-2xl">{value}</div></div>;
}

function PreviewTable({ rows, columns }: { rows: DatasetRow[]; columns: string[] }) {
  return <div className="overflow-hidden rounded-xl border border-border"><div className="max-h-[370px] overflow-auto"><table className="w-full text-left text-xs"><thead className="sticky top-0 bg-secondary text-[10px] uppercase tracking-wider text-muted-foreground"><tr>{columns.map((column) => <th className="whitespace-nowrap px-3 py-3 font-mono-ui font-medium" key={column}>{column.replaceAll('_', ' ')}</th>)}</tr></thead><tbody className="divide-y divide-border">{rows.slice(0, 10).map((row, index) => <tr key={index} className="hover:bg-secondary/35">{columns.map((column) => <td className="whitespace-nowrap px-3 py-3 text-foreground/80" key={column}>{row[column] === null || row[column] === undefined ? <span className="text-muted-foreground/50">—</span> : String(row[column])}</td>)}</tr>)}</tbody></table></div><div className="border-t border-border bg-secondary/35 px-3 py-2 text-[11px] text-muted-foreground">Showing {Math.min(10, rows.length)} of {rows.length} records</div></div>;
}

function PredictionHero({ prediction, onView }: { prediction: Prediction; onView: (view: View) => void }) {
  const tone = riskTone(prediction.riskLevel);
  return <section className="grid gap-5 xl:grid-cols-[0.75fr_1.25fr]"><div className={cls('relative overflow-hidden rounded-2xl p-6 shadow-sentinel sm:p-8', tone === 'critical' ? 'bg-[#7d3f3a] text-white' : tone === 'watch' ? 'bg-[#82651e] text-white' : 'bg-[#1b6557] text-white')}><div className="absolute -right-10 -top-10 h-44 w-44 rounded-full border-[22px] border-white/10" /><div className="relative flex h-full flex-col items-center justify-center text-center"><div className="font-mono-ui text-[10px] uppercase tracking-[0.18em] text-white/60">Composite health score</div><div className="my-6"><GaugeRing score={prediction.healthScore} large /></div><StatusPill level={prediction.riskLevel} /><p className="mt-4 max-w-xs text-sm leading-6 text-white/70">The model sees a {riskLabel(prediction.riskLevel).toLowerCase()} level of distress risk within {prediction.horizon}.</p></div></div><div className="rounded-2xl border border-border bg-card p-6 shadow-sentinel sm:p-8"><div className="flex flex-wrap items-start justify-between gap-4"><div><div className="font-mono-ui text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Risk assessment</div><h2 className="mt-2 font-display text-3xl sm:text-4xl">{prediction.businessName}</h2><p className="mt-2 text-xs text-muted-foreground">Assessed {formatDate(prediction.createdAt)} · ID {prediction.id.slice(0, 8)}</p></div><button type="button" onClick={() => onView('reports')} className="inline-flex items-center gap-2 rounded-xl border border-border bg-background px-3 py-2 text-xs font-bold hover:border-primary/40" data-testid="button-open-report"><FileBarChart size={15} /> Open report</button></div><div className="mt-10 grid gap-6 sm:grid-cols-2"><div><div className="font-mono-ui text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Failure probability</div><div className="mt-2 font-display text-5xl text-foreground">{formatPercent(prediction.failureProbability)}</div><div className="mt-2 flex items-center gap-1 text-xs text-muted-foreground"><ArrowUpRight size={13} className="text-[#b34b41]" /> Model horizon {prediction.horizon}</div></div><div><div className="font-mono-ui text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Model confidence</div><div className="mt-2 font-display text-5xl text-foreground">{formatPercent(prediction.confidence)}</div><div className="mt-2 text-xs text-muted-foreground">Based on data quality and model certainty</div></div></div><div className="mt-9 flex flex-wrap gap-2 border-t border-border pt-5"><button type="button" onClick={() => onView('analysis')} className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-xs font-bold text-primary-foreground" data-testid="button-explore-factors">Explore risk factors <ArrowRight size={14} /></button><button type="button" onClick={() => onView('advisor')} className="inline-flex items-center gap-2 rounded-xl border border-border bg-background px-4 py-2.5 text-xs font-bold hover:border-primary/40" data-testid="button-open-advisor"><Sparkles size={14} /> Ask the advisor</button></div></div></section>;
}

function PredictionView({ prediction, loading, error, retry, onView }: { prediction?: Prediction; loading: boolean; error: boolean; retry: () => void; onView: (view: View) => void }) {
  if (loading) return <LoadingState label="Loading assessment" />;
  if (error) return <QueryError onRetry={retry} />;
  if (!prediction) return <><PageHeading eyebrow="Prediction detail" title="No prediction selected." description="Run an assessment or choose one from your history to see the full model readout." /><EmptyState icon={Gauge} title="Assessment detail lives here" description="Once a prediction is selected, you will see the score, horizon, and confidence behind the signal." /></>;
  return <div className="space-y-7"><PageHeading eyebrow="Prediction detail / model readout" title="A signal you can act on." description="This is the model's current view. Pair the score with the contributing factors and recommended next moves." /><PredictionHero prediction={prediction} onView={onView} /><section className="grid gap-5 lg:grid-cols-[1fr_1fr_1fr]"><MetricCard label="Survival probability" value={formatPercent(prediction.survivalProbability)} note="Within the modeled horizon" icon={ShieldAlert} /><MetricCard label="Risk factors" value={String(prediction.factors?.length ?? 0)} note="Signals contributing to score" icon={ListFilter} /><MetricCard label="Warnings surfaced" value={String(prediction.warnings?.length ?? 0)} note="Early indicators to review" icon={Bell} /></section></div>;
}

function FactorCard({ factor }: { factor: RiskFactor }) {
  const isPositive = factor.impact < 0;
  return <div className="rounded-xl border border-border bg-background/60 p-4 transition hover:-translate-y-0.5 hover:border-primary/35"><div className="flex items-start justify-between gap-3"><div><h3 className="text-sm font-bold">{factor.name}</h3><p className="mt-1 text-xs text-muted-foreground">{factor.value}</p></div><span className={cls('font-mono-ui text-xs font-medium', isPositive ? 'text-[#19715e]' : 'text-[#b34b41')}>{isPositive ? '−' : '+'}{Math.abs(factor.impact).toFixed(1)} impact</span></div><div className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted"><div className={cls('h-full rounded-full', isPositive ? 'bg-[#24977e]' : 'bg-[#ce554a]')} style={{ width: `${Math.min(100, Math.max(10, Math.abs(factor.impact) * 100))}%` }} /></div><p className="mt-3 text-xs leading-5 text-muted-foreground">{factor.explanation}</p></div>;
}

function AnalysisView({ prediction, onView }: { prediction?: Prediction; onView: (view: View) => void }) {
  if (!prediction) return <><PageHeading eyebrow="Risk analysis" title="The why behind the score." description="Select an assessment to see which financial, operational, and external factors are moving the signal." /><EmptyState icon={BarChart3} title="No factors to unpack yet" description="Run an assessment first, then come back here to inspect the model's reasoning." action={<button type="button" onClick={() => onView('upload')} className="rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground" data-testid="button-analysis-upload">Upload data</button>} /></>;
  const groups = ['financial', 'operational', 'external'];
  const labels: Record<string, string> = { financial: 'Financial health', operational: 'Operating rhythm', external: 'External exposure' };
  return <div className="space-y-7"><PageHeading eyebrow="Risk analysis / explainability" title="Why Sentinel is concerned." description="A transparent view of the signals that shaped this assessment. Positive impacts reduce modeled risk; negative impacts increase it." action={<StatusPill level={prediction.riskLevel} />}/><div className="grid gap-5 xl:grid-cols-[1fr_0.36fr]"><div className="space-y-5">{groups.map((group) => { const factors = prediction.factors?.filter((factor) => factor.category.toLowerCase() === group) ?? []; return <section className="rounded-2xl border border-border bg-card p-5 shadow-sentinel sm:p-6" key={group}><div className="mb-5 flex items-center justify-between"><div><h2 className="font-display text-2xl">{labels[group]}</h2><p className="mt-1 text-xs text-muted-foreground">{factors.length} contributing signal{factors.length === 1 ? '' : 's'}</p></div><div className="flex h-9 w-9 items-center justify-center rounded-xl bg-secondary text-secondary-foreground">{group === 'financial' ? <BarChart3 size={17} /> : group === 'operational' ? <Database size={17} /> : <ArrowUpRight size={17} />}</div></div>{factors.length ? <div className="grid gap-3 md:grid-cols-2">{factors.map((factor) => <FactorCard factor={factor} key={factor.name} />)}</div> : <p className="text-sm text-muted-foreground">No {group} factors were returned for this assessment.</p>}</section>; })}</div><aside className="h-fit rounded-2xl border border-border bg-primary p-5 text-primary-foreground shadow-sentinel sm:p-6"><div className="font-mono-ui text-[10px] uppercase tracking-[0.18em] text-primary-foreground/60">Read the signal</div><div className="mt-5 flex justify-center"><GaugeRing score={prediction.healthScore} /></div><p className="mt-5 text-center text-sm leading-6 text-primary-foreground/70">The model weighs these factors together. No single metric decides the outcome.</p><button type="button" onClick={() => onView('advisor')} className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-accent px-4 py-3 text-xs font-bold text-accent-foreground" data-testid="button-analysis-advisor"><Sparkles size={15} /> Turn this into a plan</button></aside></div></div>;
}

function WarningRow({ warning, index }: { warning: Warning; index: number }) {
  const tone = riskTone(warning.severity);
  return <div className="group rounded-2xl border border-border bg-card p-5 shadow-sentinel transition hover:-translate-y-0.5 sm:p-6" data-testid={`card-warning-${warning.id || index}`}><div className="flex gap-4"><div className={cls('flex h-10 w-10 shrink-0 items-center justify-center rounded-xl', tone === 'critical' ? 'bg-[#fff0ed] text-[#b34b41]' : tone === 'watch' ? 'bg-[#fff8dd] text-[#977316]' : 'bg-[#eaf8f3] text-[#19715e]')}><AlertTriangle size={19} /></div><div className="min-w-0 flex-1"><div className="flex flex-wrap items-start justify-between gap-2"><div><div className="flex flex-wrap items-center gap-2"><h3 className="font-display text-2xl">{warning.title}</h3><StatusPill level={warning.severity} /></div><p className="mt-1 text-xs font-medium text-muted-foreground">{warning.indicator} · {warning.value} · reference {warning.reference}</p></div></div><p className="mt-4 max-w-3xl text-sm leading-6 text-muted-foreground">{warning.explanation}</p><div className="mt-4 flex items-start gap-2 rounded-xl bg-secondary/55 p-3 text-xs leading-5 text-foreground/75"><Zap size={14} className="mt-0.5 shrink-0 text-primary" /><span><strong className="text-foreground">Suggested response:</strong> {warning.action}</span></div></div></div></div>;
}

function WarningsView({ prediction, onView }: { prediction?: Prediction; onView: (view: View) => void }) {
  const warnings = prediction?.warnings ?? [];
  return <div className="space-y-7"><PageHeading eyebrow="Early warnings / signal queue" title="See the pressure before it becomes urgent." description="Warnings are not verdicts. They are the specific indicators worth discussing while there is still room to move." action={prediction ? <StatusPill level={`${warnings.length} warnings`} /> : undefined} />{prediction ? warnings.length ? <div className="space-y-3">{warnings.map((warning, index) => <WarningRow warning={warning} index={index} key={warning.id || index} />)}</div> : <EmptyState icon={Check} title="No active warnings" description="This assessment did not surface any early-warning indicators. Keep monitoring the next reporting period." /> : <EmptyState icon={ShieldAlert} title="No assessment selected" description="Choose an assessment to review its early-warning indicators." action={<button type="button" onClick={() => onView('history')} className="rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground" data-testid="button-warnings-history">Open history</button>} />}</div>;
}

function AdvisorView({ prediction, onView }: { prediction?: Prediction; onView: (view: View) => void }) {
  const recommendations = prediction?.recommendations ?? [];
  return <div className="space-y-7"><PageHeading eyebrow="AI advisor / practical next moves" title="From signal to next Tuesday." description="A rule-based action brief generated from this assessment. Priorities are ordered by the likely effect on business resilience." action={<div className="flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2 text-xs font-semibold text-muted-foreground"><Sparkles size={15} className="text-primary" /> Grounded in your latest data</div>} />{prediction ? recommendations.length ? <div className="grid gap-4 lg:grid-cols-2">{recommendations.map((recommendation, index) => <RecommendationCard recommendation={recommendation} index={index} key={recommendation.id || index} />)}</div> : <EmptyState icon={Lightbulb} title="No recommendations yet" description="The advisor needs a completed prediction before it can suggest focused action." /> : <EmptyState icon={Sparkles} title="Give the advisor a signal" description="Run an assessment and Sentinel will translate the model output into a short, prioritized action brief." action={<button type="button" onClick={() => onView('upload')} className="rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground" data-testid="button-advisor-upload">Start an assessment</button>} />}</div>;
}

function RecommendationCard({ recommendation, index }: { recommendation: Recommendation; index: number }) {
  const priority = recommendation.priority.toLowerCase();
  return <article className="relative overflow-hidden rounded-2xl border border-border bg-card p-5 shadow-sentinel sm:p-6"><div className={cls('absolute left-0 top-0 h-full w-1', priority.includes('high') ? 'bg-[#ce554a]' : priority.includes('medium') ? 'bg-accent' : 'bg-[#24977e]')} /><div className="flex items-start justify-between gap-3"><div className="flex items-center gap-3"><span className="font-mono-ui text-[10px] text-muted-foreground">0{index + 1}</span><span className={cls('rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider', priority.includes('high') ? 'bg-[#fff0ed] text-[#a9473f]' : priority.includes('medium') ? 'bg-[#fff8dd] text-[#76570e]' : 'bg-[#eaf8f3] text-[#19715e]')}>{recommendation.priority} priority</span></div><Lightbulb size={18} className="text-primary" /></div><h3 className="mt-5 font-display text-2xl">{recommendation.problem}</h3><p className="mt-2 text-sm leading-6 text-muted-foreground">{recommendation.impact}</p><div className="mt-5 border-t border-border pt-4"><div className="font-mono-ui text-[10px] uppercase tracking-[0.15em] text-muted-foreground">Recommended move</div><p className="mt-2 text-sm font-semibold leading-6 text-foreground">{recommendation.action}</p></div></article>;
}

function HistoryView({ history, loading, error, retry, onSelect }: { history?: PredictionHistoryItem[]; loading: boolean; error: boolean; retry: () => void; onSelect: (id: string) => void }) {
  if (loading) return <LoadingState label="Loading assessment history" />;
  if (error) return <QueryError onRetry={retry} />;
  return <div className="space-y-7"><PageHeading eyebrow="Records / assessment history" title="A timeline of your signals." description="Open any saved assessment to compare the story over time and see what changed." />{history?.length ? <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sentinel"><div className="hidden grid-cols-[1.35fr_1fr_0.75fr_0.8fr_0.8fr_28px] gap-4 border-b border-border bg-secondary/50 px-5 py-3 font-mono-ui text-[10px] uppercase tracking-wider text-muted-foreground md:grid"><span>Business</span><span>Assessed</span><span>Health</span><span>Failure risk</span><span>Top factor</span><span /></div><div className="divide-y divide-border">{history.map((item) => <button type="button" onClick={() => onSelect(item.id)} key={item.id} className="grid w-full gap-3 px-5 py-4 text-left transition hover:bg-secondary/45 md:grid-cols-[1.35fr_1fr_0.75fr_0.8fr_0.8fr_28px] md:items-center md:gap-4" data-testid={`row-history-${item.id}`}><div><div className="font-bold">{item.businessName}</div><div className="mt-1 font-mono-ui text-[10px] text-muted-foreground md:hidden">{formatDate(item.createdAt)}</div></div><div className="hidden text-xs text-muted-foreground md:block">{formatDate(item.createdAt)}</div><div className="flex items-center gap-2 text-sm font-bold md:block">{Math.round(item.healthScore)} <span className="text-xs font-normal text-muted-foreground md:hidden">health</span></div><div className="flex items-center gap-2 md:block"><StatusPill level={item.riskLevel} /><span className="ml-2 text-xs text-muted-foreground">{formatPercent(item.failureProbability)}</span></div><div className="hidden text-xs text-muted-foreground md:block">{item.topFactor}</div><ArrowRight size={16} className="text-muted-foreground" /></button>)}</div></div> : <EmptyState icon={Clock3} title="Your timeline is empty" description="Completed assessments are saved here so you can see the business story change over time." />}</div>;
}

function ReportsView({ report, loading, error, retry, prediction, onSelect }: { report?: Report; loading: boolean; error: boolean; retry: () => void; prediction?: Prediction; onSelect: () => void }) {
  if (!prediction) return <><PageHeading eyebrow="Reports / print-ready" title="A clean record for the room." description="Select an assessment to generate a print-friendly report for your next review." /><EmptyState icon={FileBarChart} title="No report selected" description="Open an assessment from history, then return here to generate its report." action={<button type="button" onClick={onSelect} className="rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground" data-testid="button-report-select">Choose from history</button>} /></>;
  if (loading) return <LoadingState label="Preparing report" />;
  if (error) return <QueryError onRetry={retry} />;
  const source = report?.prediction ?? prediction;
  return <div className="space-y-7"><div className="no-print"><PageHeading eyebrow="Reports / print-ready" title="A clean record for the room." description="Print or save this assessment as a PDF for your next operating review." action={<button type="button" onClick={() => window.print()} className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-bold text-primary-foreground" data-testid="button-print-report"><Printer size={16} /> Print report</button>} /></div><article className="print-paper rounded-2xl border border-border bg-card p-6 shadow-sentinel sm:p-10"><div className="flex flex-wrap items-start justify-between gap-5 border-b border-border pb-7"><div><div className="flex items-center gap-2 font-display text-2xl"><Target size={21} className="text-primary" /> MSME <span className="text-primary">Sentinel</span></div><div className="mt-4 font-mono-ui text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Business risk assessment</div><h2 className="mt-2 font-display text-4xl">{source.businessName}</h2></div><div className="text-right text-xs text-muted-foreground"><div>Assessment date</div><div className="mt-1 font-semibold text-foreground">{formatDate(source.createdAt)}</div><div className="mt-3">Assessment ID</div><div className="mt-1 font-mono-ui text-[10px] text-foreground">{source.id}</div></div></div><div className="grid gap-4 border-b border-border py-7 sm:grid-cols-4"><MiniStat label="Health score" value={`${Math.round(source.healthScore)}/100`} /><MiniStat label="Risk level" value={riskLabel(source.riskLevel)} /><MiniStat label="Failure probability" value={formatPercent(source.failureProbability)} /><MiniStat label="Confidence" value={formatPercent(source.confidence)} /></div><div className="grid gap-8 py-7 lg:grid-cols-[1fr_1fr]"><div><h3 className="font-display text-2xl">Key warnings</h3><div className="mt-4 space-y-3">{source.warnings?.slice(0, 4).map((warning) => <div key={warning.id} className="border-l-2 border-accent pl-3"><div className="text-sm font-bold">{warning.title}</div><div className="mt-1 text-xs leading-5 text-muted-foreground">{warning.explanation}</div></div>)}</div></div><div><h3 className="font-display text-2xl">Recommended actions</h3><div className="mt-4 space-y-3">{source.recommendations?.slice(0, 4).map((rec) => <div key={rec.id} className="border-l-2 border-primary pl-3"><div className="text-sm font-bold">{rec.problem}</div><div className="mt-1 text-xs leading-5 text-muted-foreground">{rec.action}</div></div>)}</div></div></div><div className="border-t border-border pt-5 text-xs leading-5 text-muted-foreground">This report is an intelligence aid, not a financial guarantee. Review the supporting data and use professional judgment before making material decisions.</div></article></div>;
}

function SettingsView() {
  const [dark, setDark] = useState(() => document.documentElement.classList.contains('dark'));
  const [notifications, setNotifications] = useState(true);
  const toggleTheme = () => { const next = !dark; setDark(next); document.documentElement.classList.toggle('dark', next); };
  return <div className="space-y-7"><PageHeading eyebrow="Workspace / preferences" title="Set Sentinel to your rhythm." description="A few quiet controls for how the command center looks and when it calls your attention." /><div className="grid max-w-4xl gap-5"><SettingsRow icon={dark ? Moon : Sun} title="Appearance" description="Choose the visual mode for your workspace." action={<button type="button" onClick={toggleTheme} className="inline-flex items-center gap-2 rounded-xl border border-border bg-background px-3 py-2 text-xs font-bold" data-testid="button-toggle-theme">{dark ? <Moon size={15} /> : <Sun size={15} />}{dark ? 'Dark mode' : 'Light mode'}<ChevronDown size={13} /></button>} /><SettingsRow icon={Bell} title="Signal notifications" description="Keep early warnings visible when a new assessment surfaces them." action={<button type="button" onClick={() => setNotifications(!notifications)} className={cls('relative h-7 w-12 rounded-full transition', notifications ? 'bg-primary' : 'bg-muted')} onKeyDown={(event) => { if (event.key === 'Enter') setNotifications(!notifications); }} data-testid="button-toggle-notifications"><span className={cls('absolute top-1 h-5 w-5 rounded-full bg-card shadow transition-all', notifications ? 'left-6' : 'left-1')} /></button>} /><SettingsRow icon={Database} title="Data handling" description="Datasets are used to produce your assessments and remain attached to your saved records." action={<span className="rounded-full bg-[#eaf8f3] px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-[#19715e]">Protected</span>} /></div><div className="max-w-4xl rounded-2xl border border-border bg-secondary/45 p-5 text-xs leading-5 text-muted-foreground"><Info size={15} className="mb-2 text-primary" /> Sentinel is designed for early visibility, not automated decision-making. Keep a human review in the loop for lending, staffing, and other high-impact decisions.</div></div>;
}

function SettingsRow({ icon: Icon, title, description, action }: { icon: LucideIcon; title: string; description: string; action: ReactNode }) {
  return <div className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-5 shadow-sentinel sm:flex-row sm:items-center sm:justify-between sm:p-6"><div className="flex items-start gap-3"><div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-secondary text-secondary-foreground"><Icon size={18} /></div><div><h3 className="text-sm font-bold">{title}</h3><p className="mt-1 max-w-lg text-xs leading-5 text-muted-foreground">{description}</p></div></div><div className="shrink-0">{action}</div></div>;
}

function Workspace() {
  const [view, setView] = useState<View>('overview');
  const [selectedId, setSelectedId] = useState('');
  const dashboard = useGetDashboard();
  const history = useGetPredictionHistory();
  const predictionQuery = useGetPrediction(selectedId, { query: { enabled: !!selectedId, queryKey: getGetPredictionQueryKey(selectedId) } });
  const reportQuery = useGetReport(selectedId, { query: { enabled: view === 'reports' && !!selectedId, queryKey: getGetReportQueryKey(selectedId) } });
  const createPrediction = useCreatePrediction();
  const client = useQueryClient();
  const latest = dashboard.data?.latest ?? null;
  const selectedPrediction = predictionQuery.data ?? (selectedId === latest?.id ? latest : undefined);
  const invalidate = () => { void client.invalidateQueries({ queryKey: getGetDashboardQueryKey() }); void client.invalidateQueries({ queryKey: getGetPredictionHistoryQueryKey() }); if (selectedId) void client.invalidateQueries({ queryKey: getGetPredictionQueryKey(selectedId) }); };
  const goToPrediction = (id: string) => { setSelectedId(id); setView('prediction'); };
  const runAssessment = (validation: DatasetValidation, rows: DatasetRow[], businessName: string) => {
    createPrediction.mutate({ data: { datasetId: validation.datasetId, rows, businessName: businessName || null } }, { onSuccess: (prediction) => { setSelectedId(prediction.id); setView('prediction'); invalidate(); } });
  };
  const content = (() => {
    if (view === 'overview') return <Overview dashboard={dashboard.data} loading={dashboard.isLoading} error={dashboard.isError} retry={() => void dashboard.refetch()} onView={setView} onUpload={() => setView('upload')} />;
    if (view === 'upload') return <UploadView onValidated={() => undefined} onRun={runAssessment} />;
    if (view === 'prediction') return <PredictionView prediction={selectedPrediction} loading={!!selectedId && predictionQuery.isLoading} error={!!selectedId && predictionQuery.isError} retry={() => void predictionQuery.refetch()} onView={setView} />;
    if (view === 'analysis') return <AnalysisView prediction={selectedPrediction} onView={setView} />;
    if (view === 'warnings') return <WarningsView prediction={selectedPrediction} onView={setView} />;
    if (view === 'advisor') return <AdvisorView prediction={selectedPrediction} onView={setView} />;
    if (view === 'history') return <HistoryView history={history.data} loading={history.isLoading} error={history.isError} retry={() => void history.refetch()} onSelect={goToPrediction} />;
    if (view === 'reports') return <ReportsView report={reportQuery.data} loading={!!selectedId && reportQuery.isLoading} error={!!selectedId && reportQuery.isError} retry={() => void reportQuery.refetch()} prediction={selectedPrediction} onSelect={() => setView('history')} />;
    return <SettingsView />;
  })();
  return <AppShell view={view} setView={setView} latest={latest} onNewAssessment={() => setView('upload')}><div className="relative">{createPrediction.isPending && <div className="mb-5 flex items-center gap-2 rounded-xl border border-primary/20 bg-primary/[0.05] px-4 py-3 text-xs font-semibold text-primary" data-testid="status-prediction-loading"><LoaderCircle size={15} className="animate-spin" /> Sentinel is reading the new dataset…</div>}{content}</div></AppShell>;
}

function Router() {
  return <ErrorBoundary><Switch><Route path="/" component={Workspace} /><Route component={NotFound} /></Switch></ErrorBoundary>;
}

function App() {
  return <QueryClientProvider client={queryClient}><TooltipProvider><WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}><Router /></WouterRouter><Toaster /></TooltipProvider></QueryClientProvider>;
}

export default App;