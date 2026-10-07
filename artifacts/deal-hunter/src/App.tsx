import { useMemo, useState, type FormEvent, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import { Route, Switch, Link, Router as WouterRouter, useLocation } from 'wouter';
import {
  Activity, Bell, Bookmark, Check, CheckCheck, ChevronRight, CircleAlert, Clock3,
  ExternalLink, Eye, Filter, Gauge, ListFilter, LoaderCircle, PackageSearch, Pause,
  Play, Plus, Radar, RefreshCw, Search, Settings2, ShieldCheck, SlidersHorizontal,
  Sparkles, Tag, Trash2, X, Zap,
} from 'lucide-react';
import {
  useAddDealHunterWatchlistItem, useCreateDealHunterTask, useDeleteDealHunterTask,
  useDeleteDealHunterWatchlistItem, useGetDealHunterDashboard, useGetDealHunterDeals,
  useGetDealHunterNotifications, useGetDealHunterTasks, useGetDealHunterWatchlist,
  useGetProductPriceHistory, useHealthCheck, useMarkDealHunterNotificationRead,
  useParseDealHunterTask, useRunDealHunterScan, useUpdateDealHunterTask,
  getGetDealHunterDashboardQueryKey, getGetDealHunterDealsQueryKey,
  getGetDealHunterNotificationsQueryKey, getGetDealHunterTasksQueryKey,
  getGetDealHunterWatchlistQueryKey,
} from '@workspace/api-client-react';
import type {
  Deal, DealClassification, DealTask, DealTaskPriority, ParsedTask, TaskInput,
  WatchlistInput,
} from '@workspace/api-client-react';
import NotFound from '@/pages/not-found';

const queryClient = new QueryClient();
const navItems = [
  { href: '/', label: 'Overview', icon: Gauge },
  { href: '/tasks', label: 'Monitors', icon: Radar },
  { href: '/deals', label: 'Deal desk', icon: Tag },
  { href: '/watchlist', label: 'Watchlist', icon: Bookmark },
  { href: '/notifications', label: 'Alerts', icon: Bell },
  { href: '/settings', label: 'Connections', icon: Settings2 },
];
const rupees = (value: number | null | undefined) => value == null ? '—' : `₹${value.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
const compact = (value: number) => Intl.NumberFormat('en-IN', { notation: 'compact', maximumFractionDigits: 1 }).format(value);
const relativeTime = (value: string | null | undefined) => {
  if (!value) return 'Not yet';
  const delta = Math.max(0, Date.now() - new Date(value).getTime());
  const mins = Math.floor(delta / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
};
const clsLabel = (value: DealClassification) => ({
  normal_deal: 'Normal deal',
  great_deal: 'Great deal',
  extreme_deal: 'Extreme deal',
  price_anomaly: 'Price anomaly',
  possible_pricing_error: 'Possible pricing error',
  critical_price_anomaly: 'Critical anomaly',
}[value] || value.replaceAll('_', ' '));
const clsClass = (value: DealClassification) => value === 'great_deal' ? 'class-great' :
  value === 'extreme_deal' ? 'class-extreme' :
    value.includes('anomaly') ? 'class-anomaly' : value.includes('error') ? 'class-error' : 'class-normal';
const invalidate = (client: ReturnType<typeof useQueryClient>) => {
  void client.invalidateQueries({ queryKey: getGetDealHunterDashboardQueryKey() });
  void client.invalidateQueries({ queryKey: getGetDealHunterTasksQueryKey() });
  void client.invalidateQueries({ queryKey: getGetDealHunterDealsQueryKey() });
  void client.invalidateQueries({ queryKey: getGetDealHunterNotificationsQueryKey() });
  void client.invalidateQueries({ queryKey: getGetDealHunterWatchlistQueryKey() });
};

function AppShell({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  const dashboard = useGetDealHunterDashboard();
  return <div className="app-shell">
    <aside className="sidebar" aria-label="Main navigation">
      <Link href="/" className="brand" data-testid="link-brand-home">
        <span className="brand-mark">₹</span>
        <span className="brand-name">Deal Hunter<span className="brand-sub">Price truth, not noise</span></span>
      </Link>
      <div className="nav-label">Workspace</div>
      <nav className="nav-list">
        {navItems.map(({ href, label, icon: Icon }) => <Link key={href} href={href}
          className={`nav-link ${location === href ? 'active' : ''}`}
          aria-current={location === href ? 'page' : undefined} data-testid={`link-nav-${label.toLowerCase().replaceAll(' ', '-')}`}>
          <Icon size={16} strokeWidth={1.8} /><span>{label}</span>
          {label === 'Alerts' && (dashboard.data?.unreadAlerts ?? 0) > 0 && <span className="nav-count">{dashboard.data?.unreadAlerts}</span>}
        </Link>)}
      </nav>
      <div className="side-bottom">
        <div className="side-note"><strong>Demo catalog only</strong>Price checks use seeded sample data. Retailer feeds are not connected; no offer is live.</div>
        <div className="profile-line"><span className="profile-dot" />Local monitoring workspace</div>
      </div>
    </aside>
    <div className="main-wrap">
      <header className="topbar">
        <div className="top-context">India · price intelligence workspace</div>
        <div className="top-right"><span className="demo-pill"><span>DEMO DATA</span></span><span>Retailer feeds offline</span></div>
      </header>
      {children}
    </div>
  </div>;
}

function PageTitle({ eyebrow, title, subtitle, action }: { eyebrow: string; title: string; subtitle: string; action?: ReactNode }) {
  return <div className="page-head"><div><div className="eyebrow">{eyebrow}</div><h1 className="page-title">{title}</h1><p className="page-subtitle">{subtitle}</p></div>{action}</div>;
}
function ErrorPanel({ message, retry }: { message: string; retry: () => void }) {
  return <div className="card error-state"><div className="empty-mark"><CircleAlert size={20} /></div><h3>Couldn’t load this view</h3><p>{message || 'The service did not respond. Your data has not been changed.'}</p><button className="button button-quiet" onClick={retry} data-testid="button-retry"><RefreshCw size={13} />Try again</button></div>;
}
function EmptyPanel({ title, detail, action }: { title: string; detail: string; action?: ReactNode }) {
  return <div className="card empty-state"><div className="empty-mark"><PackageSearch size={20} /></div><h3>{title}</h3><p>{detail}</p>{action}</div>;
}
function SkeletonRows({ count = 4 }: { count?: number }) {
  return <div className="card" aria-label="Loading data">{Array.from({ length: count }, (_, i) => <div className="skeleton-line" key={i}><div className="skeleton" style={{ width: `${i % 2 ? 56 : 72}%` }} /></div>)}</div>;
}
function Toast({ text, close }: { text: string; close: () => void }) {
  return <div role="status" className="toast-msg">{text}<button aria-label="Dismiss message" onClick={close} className="icon-button" style={{ color: 'inherit', display: 'inline-grid', marginLeft: 8 }}><X size={13} /></button></div>;
}
function useToastMessage() {
  const [message, setMessage] = useState('');
  const show = (text: string) => { setMessage(text); window.setTimeout(() => setMessage(''), 3500); };
  return { message, show, close: () => setMessage('') };
}
function Classification({ deal }: { deal: Deal }) {
  return <span className={`classification ${clsClass(deal.classification)}`}>{clsLabel(deal.classification)}</span>;
}
function DemoFlag() { return <span className="demo-pill"><span>DEMO</span></span>; }
type RetailerStore = 'Amazon.in' | 'Flipkart';
function retailerSearchUrl(store: RetailerStore, productTitle: string): string {
  const query = encodeURIComponent(productTitle);
  return store === 'Amazon.in'
    ? `https://www.amazon.in/s?k=${query}`
    : `https://www.flipkart.com/search?q=${query}`;
}
function RetailerSearchLink({ store, productTitle, dealId }: { store: RetailerStore; productTitle: string; dealId: string }) {
  return <a
    className="button button-quiet"
    href={retailerSearchUrl(store, productTitle)}
    target="_blank"
    rel="noopener noreferrer"
    aria-label={`Find ${productTitle} in official ${store} search results`}
    data-testid={`link-${store === 'Amazon.in' ? 'amazon' : 'flipkart'}-${dealId}`}
  >
    <ExternalLink size={13} />{store}
  </a>;
}
function DealSummaryRow({ deal }: { deal: Deal }) {
  return <div className="deal-row" data-testid={`row-deal-${deal.id}`}>
    <div><p className="deal-title">{deal.title}</p><div className="deal-meta"><DemoFlag /><span>{deal.marketplace}</span><span>·</span><span>{deal.brand}</span><span>·</span><Classification deal={deal} /></div></div>
    <div className="deal-price">{rupees(deal.currentPrice)}<small><span className="discount">{deal.realDiscountPercent}% vs observed high</span></small></div>
  </div>;
}
function NotificationPreview({ notification }: { notification: { id: string; title: string; message: string; createdAt: string; read: boolean } }) {
  return <div className="notification-item" data-testid={`notification-preview-${notification.id}`}><span className={`notif-marker ${notification.read ? 'read' : ''}`} /><div><p className="notif-title">{notification.title}</p><p className="notif-copy">{notification.message}</p><div className="notif-time">{relativeTime(notification.createdAt)}</div></div></div>;
}

function DashboardPage() {
  const queryClient = useQueryClient();
  const summary = useGetDealHunterDashboard();
  const scan = useRunDealHunterScan();
  const toast = useToastMessage();
  const handleScan = () => scan.mutate({ data: { source: 'mock' } }, {
    onSuccess: (result) => { invalidate(queryClient); toast.show(`Mock catalog scan complete · ${result.matchedDeals} matches`); },
    onError: () => toast.show('Scan did not complete. Try again.'),
  });
  if (summary.isLoading) return <main className="page"><PageTitle eyebrow="Workspace / Today" title="Your deal radar" subtitle="A grounded view of price movement and matching rules." /><div className="metric-grid">{Array.from({ length: 5 }, (_, i) => <div className="card metric" key={i}><div className="skeleton" style={{ width: 75 }} /><div className="skeleton" style={{ width: 48, height: 28, marginTop: 17 }} /></div>)}</div><SkeletonRows /></main>;
  if (summary.isError || !summary.data) return <main className="page"><PageTitle eyebrow="Workspace / Today" title="Your deal radar" subtitle="Monitor meaningful price changes without list-price tricks." /><ErrorPanel message="Dashboard summary is temporarily unavailable." retry={() => void summary.refetch()} /></main>;
  const data = summary.data;
  return <main className="page">
    <PageTitle eyebrow="Workspace / Today" title="Your deal radar" subtitle="A grounded view of price movement and matching rules."
      action={<button className="button button-primary" disabled={scan.isPending} onClick={handleScan} data-testid="button-run-scan">{scan.isPending ? <LoaderCircle size={14} /> : <RefreshCw size={14} />}{scan.isPending ? 'Scanning sample catalog' : 'Run mock scan'}</button>} />
    <div className="scan-banner"><div><h2>Monitoring, with the fine print visible.</h2><p>Catalog scan checks seeded examples only. Retailer availability is not connected.</p></div><div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}><span className={`status-pill ${data.agentStatus === 'degraded' ? 'off' : ''}`}><Activity size={11} />Agent {data.agentStatus}</span><span className="status-pill off"><CircleAlert size={11} />Retailers unavailable</span></div></div>
    <section className="metric-grid" aria-label="Monitoring summary">
      {[['Active monitors', data.activeTasks, 'Rules running'], ['Matches today', data.dealsToday, 'From sample catalog'], ['Extreme deals', data.extremeDeals, 'Historical comparison'], ['Price drops', data.priceDrops, 'Observed movement'], ['Unread alerts', data.unreadAlerts, 'Needs a look']].map(([label, value, foot]) => <div className="card metric" key={String(label)} data-testid={`metric-${String(label).toLowerCase().replaceAll(' ', '-')}`}><div className="metric-label">{label}</div><div className="metric-value">{value}</div><div className="metric-foot">{foot}</div></div>)}
    </section>
    <div className="dashboard-grid">
      <section className="card"><div className="panel-head"><div><div className="section-kicker">Signals / latest</div><h2 className="section-title" style={{ marginTop: 5 }}>Recently matched</h2></div><Link className="button button-quiet" href="/deals">Browse deals <ChevronRight size={13} /></Link></div>
        <div className="panel-body">{data.recentDeals?.length ? data.recentDeals.slice(0, 5).map(deal => <DealSummaryRow deal={deal} key={deal.id} />) : <EmptyPanel title="No matches yet" detail="A mock scan will compare active monitors against the seeded catalog." action={<button className="button button-primary" onClick={handleScan} disabled={scan.isPending} data-testid="button-scan-empty"><RefreshCw size={13} />Run mock scan</button>} />}</div>
      </section>
      <section className="card"><div className="panel-head"><div><div className="section-kicker">Inbox / recent</div><h2 className="section-title" style={{ marginTop: 5 }}>Latest alerts</h2></div><Link href="/notifications" className="icon-button" aria-label="Open all alerts" data-testid="link-all-alerts"><ChevronRight size={16} /></Link></div><div className="panel-body">{data.recentNotifications?.length ? data.recentNotifications.slice(0, 5).map(item => <NotificationPreview notification={item} key={item.id} />) : <div className="empty-state"><p>No alerts to review yet.</p></div>}</div></section>
    </div>
    <div style={{ display: 'flex', gap: 18, marginTop: 18, flexWrap: 'wrap', color: 'hsl(var(--muted-foreground))', fontSize: 10 }}>
      <span><Clock3 size={12} style={{ verticalAlign: 'middle', marginRight: 5 }} />Last scan {relativeTime(data.lastScanAt)}</span><span><Zap size={12} style={{ verticalAlign: 'middle', marginRight: 5 }} />{data.scanLatencyMs} ms scan time</span><span>Observed-price history is distinct from seller list prices.</span>
    </div>
    {toast.message && <Toast text={toast.message} close={toast.close} />}
  </main>;
}

const initialTask: TaskInput = { name: '', query: '', category: 'Electronics', keywords: [], maxPrice: null, minDiscount: 10, minRating: 0, minReviews: 0, marketplaces: ['Amazon.in', 'Flipkart'], priority: 'normal' };
function taskToInput(task: DealTask): TaskInput {
  return { name: task.name, query: task.query, category: task.category, keywords: task.keywords, maxPrice: task.maxPrice, minDiscount: task.minDiscount, minRating: task.minRating, minReviews: task.minReviews, marketplaces: task.marketplaces, priority: task.priority };
}
function TaskEditor({ task, onClose, onSaved }: { task?: DealTask; onClose: () => void; onSaved: () => void }) {
  const client = useQueryClient();
  const create = useCreateDealHunterTask();
  const update = useUpdateDealHunterTask();
  const parse = useParseDealHunterTask();
  const [draft, setDraft] = useState<TaskInput>(task ? taskToInput(task) : initialTask);
  const [natural, setNatural] = useState('');
  const [parseResult, setParseResult] = useState<ParsedTask | null>(null);
  const [error, setError] = useState('');
  const setField = <K extends keyof TaskInput>(key: K, value: TaskInput[K]) => setDraft(prev => ({ ...prev, [key]: value }));
  const applyParsed = (parsed: ParsedTask) => {
    setDraft({ name: parsed.name, query: parsed.query, category: parsed.category, keywords: parsed.keywords, maxPrice: parsed.maxPrice, minDiscount: parsed.minDiscount, minRating: parsed.minRating, minReviews: parsed.minReviews, marketplaces: parsed.marketplaces, priority: parsed.priority });
    setParseResult(parsed);
  };
  const parseFromButton = () => {
    setError('');
    if (natural.trim().length < 3) { setError('Add a little more detail to describe the rule.'); return; }
    parse.mutate({ data: { text: natural.trim() } }, { onSuccess: applyParsed, onError: () => setError('Could not turn that request into a draft. Edit the fields manually.') });
  };
  const save = (e: FormEvent) => {
    e.preventDefault(); setError('');
    const payload: TaskInput = { ...draft, name: draft.name.trim(), query: draft.query.trim(), category: draft.category.trim(), keywords: draft.keywords.map(k => k.trim()).filter(Boolean) };
    if (!payload.name || !payload.query || !payload.category) { setError('Name, search query, and category are required.'); return; }
    const done = () => { invalidate(client); onSaved(); };
    if (task) update.mutate({ id: task.id, data: payload }, { onSuccess: done, onError: () => setError('The monitor could not be updated. Please try again.') });
    else create.mutate({ data: payload }, { onSuccess: done, onError: () => setError('The monitor could not be saved. Please try again.') });
  };
  const busy = create.isPending || update.isPending;
  const changeMarket = (market: string, checked: boolean) => setField('marketplaces', checked ? [...draft.marketplaces, market] : draft.marketplaces.filter(item => item !== market));
  return <div className="dialog-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
    <section className="dialog" role="dialog" aria-modal="true" aria-labelledby="task-editor-title">
      <div className="dialog-head"><div><h2 id="task-editor-title">{task ? 'Tune monitor' : 'Create a monitor'}</h2><p>Set a real-price threshold. No buying actions are involved.</p></div><button className="icon-button" aria-label="Close" onClick={onClose} data-testid="button-close-task-editor"><X size={17} /></button></div>
      <form onSubmit={save}>
        <div className="dialog-content">
          <div style={{ padding: 14, borderRadius: 10, background: '#edf1e9', marginBottom: 19 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, font: '10px var(--app-font-mono)', textTransform: 'uppercase', color: '#3b6f58', marginBottom: 9 }}><Sparkles size={13} />Draft from a plain-language request</div>
            <div style={{ display: 'flex', gap: 8 }}><input className="control" value={natural} onChange={e => setNatural(e.target.value)} placeholder="e.g. Track noise-cancelling headphones under ₹8,000" aria-label="Describe a monitor in plain language" data-testid="input-natural-rule" /><button type="button" className="button button-quiet" onClick={parseFromButton} disabled={parse.isPending} data-testid="button-parse-rule">{parse.isPending ? <LoaderCircle size={13} /> : <Sparkles size={13} />}Draft</button></div>
            {parseResult && <p style={{ fontSize: 10, margin: '9px 0 0', color: '#587467' }}>{parseResult.explanation} Review the fields below before saving.</p>}
          </div>
          <div className="form-grid">
            <div className="field"><label htmlFor="task-name">Monitor name</label><input id="task-name" className="control" value={draft.name} onChange={e => setField('name', e.target.value)} maxLength={100} required placeholder="Headphones under 8k" data-testid="input-task-name" /></div>
            <div className="field"><label htmlFor="task-category">Category</label><input id="task-category" className="control" value={draft.category} onChange={e => setField('category', e.target.value)} maxLength={80} required placeholder="Audio" data-testid="input-task-category" /></div>
            <div className="field full"><label htmlFor="task-query">Search query</label><input id="task-query" className="control" value={draft.query} onChange={e => setField('query', e.target.value)} maxLength={300} required placeholder="What products should match?" data-testid="input-task-query" /></div>
            <div className="field full"><label htmlFor="task-keywords">Keywords <span style={{ textTransform: 'none' }}>· comma separated</span></label><input id="task-keywords" className="control" value={draft.keywords.join(', ')} onChange={e => setField('keywords', e.target.value.split(',').map(v => v.trim()).filter(Boolean))} placeholder="wireless, ANC, over-ear" data-testid="input-task-keywords" /></div>
            <div className="field"><label htmlFor="task-max-price">Maximum price (₹)</label><input id="task-max-price" className="control" type="number" min="0" value={draft.maxPrice ?? ''} onChange={e => setField('maxPrice', e.target.value === '' ? null : Number(e.target.value))} placeholder="No limit" data-testid="input-task-max-price" /></div>
            <div className="field"><label htmlFor="task-min-discount">Minimum historical discount (%)</label><input id="task-min-discount" className="control" type="number" min="0" max="100" value={draft.minDiscount} onChange={e => setField('minDiscount', Number(e.target.value))} data-testid="input-task-min-discount" /></div>
            <div className="field"><label htmlFor="task-rating">Minimum rating</label><input id="task-rating" className="control" type="number" min="0" max="5" step=".1" value={draft.minRating} onChange={e => setField('minRating', Number(e.target.value))} data-testid="input-task-min-rating" /></div>
            <div className="field"><label htmlFor="task-reviews">Minimum review count</label><input id="task-reviews" className="control" type="number" min="0" value={draft.minReviews} onChange={e => setField('minReviews', Number(e.target.value))} data-testid="input-task-min-reviews" /></div>
            <div className="field"><label htmlFor="task-priority">Priority</label><select id="task-priority" className="control" value={draft.priority} onChange={e => setField('priority', e.target.value as DealTaskPriority)} data-testid="select-task-priority">{(['low', 'normal', 'high', 'critical'] as const).map(v => <option key={v} value={v}>{v[0].toUpperCase() + v.slice(1)}</option>)}</select></div>
            <div className="field"><label>Marketplace sample sources</label><div style={{ display: 'flex', gap: 14, padding: '10px 0', fontSize: 11 }}>{['Amazon.in', 'Flipkart'].map(m => <label key={m} style={{ display: 'flex', alignItems: 'center', gap: 5, color: 'hsl(var(--foreground))', textTransform: 'none', letterSpacing: 0, font: '11px var(--app-font-sans)' }}><input type="checkbox" checked={draft.marketplaces.includes(m)} onChange={e => changeMarket(m, e.target.checked)} data-testid={`checkbox-market-${m.toLowerCase().replace('.', '-')}`} />{m}</label>)}</div><small style={{ color: '#a05f36', fontSize: 9 }}>Sample catalog only; marketplace feeds are unavailable.</small></div>
          </div>
          {error && <p role="alert" style={{ color: '#a33e2d', fontSize: 10, margin: '14px 0 0' }}>{error}</p>}
        </div>
        <div className="dialog-footer"><button type="button" className="button button-quiet" onClick={onClose} data-testid="button-cancel-task">Cancel</button><button type="submit" className="button button-primary" disabled={busy} data-testid="button-save-task">{busy ? <LoaderCircle size={13} /> : <Check size={13} />}{task ? 'Save changes' : 'Create monitor'}</button></div>
      </form>
    </section>
  </div>;
}
function TasksPage() {
  const client = useQueryClient();
  const tasks = useGetDealHunterTasks();
  const update = useUpdateDealHunterTask();
  const remove = useDeleteDealHunterTask();
  const [editing, setEditing] = useState<DealTask | undefined>();
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState<'all' | 'active' | 'paused'>('all');
  const [notice, setNotice] = useState('');
  const shown = (tasks.data ?? []).filter(t => filter === 'all' || (filter === 'active' ? t.active : !t.active));
  const confirmDelete = (task: DealTask) => {
    if (!window.confirm(`Delete “${task.name}”? This cannot be undone.`)) return;
    remove.mutate({ id: task.id }, { onSuccess: () => { invalidate(client); setNotice('Monitor deleted.'); }, onError: () => setNotice('Could not delete this monitor.') });
  };
  const toggle = (task: DealTask) => update.mutate({ id: task.id, data: { active: !task.active } }, { onSuccess: () => invalidate(client), onError: () => setNotice('Could not update monitor status.') });
  const edit = (task?: DealTask) => { setEditing(task); setOpen(true); };
  return <main className="page">
    <PageTitle eyebrow="Rules / Monitoring" title="Monitors" subtitle="Your rules decide what deserves attention. Pause or refine them any time." action={<button className="button button-primary" onClick={() => edit()} data-testid="button-new-task"><Plus size={14} />New monitor</button>} />
    <div className="filter-row">{(['all', 'active', 'paused'] as const).map(v => <button className={`filter-chip ${filter === v ? 'selected' : ''}`} key={v} onClick={() => setFilter(v)} data-testid={`button-task-filter-${v}`}>{v} {(tasks.data ?? []).filter(t => v === 'all' || t.active === (v === 'active')).length}</button>)}</div>
    {tasks.isLoading ? <SkeletonRows /> : tasks.isError ? <ErrorPanel message="Monitor rules could not be loaded." retry={() => void tasks.refetch()} /> : shown.length === 0 ? <EmptyPanel title={filter === 'all' ? 'No monitors yet' : `No ${filter} monitors`} detail="Create a rule around a product, category, or price threshold. Plain-language drafting is available in the editor." action={<button className="button button-primary" onClick={() => edit()} data-testid="button-create-first-monitor"><Plus size={13} />Create monitor</button>} /> : <div className="card table-wrap"><table className="task-table"><thead><tr><th>Monitor</th><th>Threshold</th><th>Sources</th><th>Priority</th><th>Status</th><th aria-label="Actions" /></tr></thead><tbody>{shown.map(task => <tr key={task.id} data-testid={`row-task-${task.id}`}><td><span className="task-name">{task.name}</span><span className="task-sub">{task.query} · {task.category}</span></td><td>{task.maxPrice == null ? 'Any price' : `≤ ${rupees(task.maxPrice)}`}<span className="task-sub">At least {task.minDiscount}% below observed high</span></td><td>{task.marketplaces.join(', ') || 'None selected'}<span className="task-sub">{task.keywords.slice(0, 3).join(', ') || 'No keywords'}</span></td><td><span className="tag" style={{ background: '#f1eee4', color: '#6d6958' }}>{task.priority}</span></td><td><span className={`status-pill ${task.active ? '' : 'off'}`}>{task.active ? 'Active' : 'Paused'}</span></td><td><div className="actions"><button className="icon-button" aria-label={task.active ? 'Pause monitor' : 'Resume monitor'} title={task.active ? 'Pause' : 'Resume'} onClick={() => toggle(task)} disabled={update.isPending} data-testid={`button-toggle-task-${task.id}`}>{task.active ? <Pause size={14} /> : <Play size={14} />}</button><button className="icon-button" aria-label="Edit monitor" title="Edit" onClick={() => edit(task)} data-testid={`button-edit-task-${task.id}`}><SlidersHorizontal size={14} /></button><button className="icon-button" aria-label="Delete monitor" title="Delete" onClick={() => confirmDelete(task)} disabled={remove.isPending} data-testid={`button-delete-task-${task.id}`}><Trash2 size={14} /></button></div></td></tr>)}</tbody></table></div>}
    <div className="alert-box" style={{ marginTop: 16 }}><ShieldCheck size={15} /><span>Monitoring uses a historical baseline. A retailer’s displayed list price can change independently, and sample matches are not live offers.</span></div>
    {notice && <Toast text={notice} close={() => setNotice('')} />}
    {open && <TaskEditor task={editing} onClose={() => setOpen(false)} onSaved={() => { setOpen(false); setNotice(editing ? 'Monitor updated.' : 'Monitor created.'); }} />}
  </main>;
}

function PriceHistory({ productId, onClose }: { productId: string; onClose: () => void }) {
  const query = useGetProductPriceHistory(productId);
  const points = query.data ?? [];
  const sorted = useMemo(() => [...points].sort((a, b) => new Date(a.observedAt).getTime() - new Date(b.observedAt).getTime()), [points]);
  const min = Math.min(...sorted.map(p => p.price), 0);
  const max = Math.max(...sorted.map(p => p.price), 1);
  const coords = sorted.map((p, i) => `${sorted.length < 2 ? 50 : i / (sorted.length - 1) * 100},${88 - ((p.price - min) / (max - min || 1)) * 70}`).join(' ');
  return <div className="dialog-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}><section className="dialog" role="dialog" aria-modal="true" aria-labelledby="history-title"><div className="dialog-head"><div><div className="eyebrow" style={{ marginBottom: 6 }}>Product / observed history</div><h2 id="history-title">Price record</h2><p>Observed prices only. Historical data may include demo samples.</p></div><button className="icon-button" aria-label="Close price history" onClick={onClose} data-testid="button-close-history"><X size={17} /></button></div><div className="dialog-content">{query.isLoading ? <SkeletonRows count={3} /> : query.isError ? <ErrorPanel message="Price history could not be loaded." retry={() => void query.refetch()} /> : sorted.length === 0 ? <EmptyPanel title="No recorded history" detail="There are no price points available for this product yet." /> : <><div style={{ height: 190, border: '1px solid hsl(var(--border))', borderRadius: 10, padding: 12, background: '#f7f5ed' }}><svg viewBox="0 0 100 100" preserveAspectRatio="none" style={{ width: '100%', height: '100%', overflow: 'visible' }} role="img" aria-label="Observed price trend"><line x1="0" y1="88" x2="100" y2="88" stroke="#d8d6c9" strokeDasharray="2 2" /><polyline points={coords} fill="none" stroke="#2d7053" strokeWidth="2" vectorEffect="non-scaling-stroke" />{sorted.map((p, i) => <circle key={p.id} cx={sorted.length < 2 ? 50 : i / (sorted.length - 1) * 100} cy={88 - ((p.price - min) / (max - min || 1)) * 70} r="1.5" fill="#dd9861" />)}</svg></div><div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 2px 14px', color: 'hsl(var(--muted-foreground))', font: '9px var(--app-font-mono)' }}><span>{relativeTime(sorted[0].observedAt)} earliest shown</span><span>{sorted.length} observed points</span></div><div className="table-wrap"><table className="task-table" style={{ minWidth: 0 }}><thead><tr><th>Observed</th><th>Price</th><th>Record</th></tr></thead><tbody>{[...sorted].reverse().map(p => <tr key={p.id}><td>{new Date(p.observedAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}</td><td>{rupees(p.price)}</td><td>{p.demo ? <DemoFlag /> : 'Observed'}</td></tr>)}</tbody></table></div></>}</div><div className="dialog-footer"><button className="button button-quiet" onClick={onClose} data-testid="button-close-history-footer">Close</button></div></section></div>;
}
function DealsPage() {
  const [classification, setClassification] = useState('');
  const [historyId, setHistoryId] = useState<string | null>(null);
  const params = useMemo(() => classification ? { classification } : undefined, [classification]);
  const deals = useGetDealHunterDeals(params);
  const filters = [['', 'All signals'], ['great_deal', 'Great'], ['extreme_deal', 'Extreme'], ['price_anomaly', 'Anomalies'], ['possible_pricing_error', 'Pricing errors']];
  return <main className="page">
    <PageTitle eyebrow="Signals / Matched deals" title="Deal desk" subtitle="Compare today’s price with observed history; treat anomalies with care." action={<span className="demo-pill">SAMPLE CATALOG</span>} />
     <div className="alert-box" style={{ marginBottom: 16 }}><CircleAlert size={15} /><span><strong>Availability is not verified.</strong> Every seeded result is marked DEMO. Retailer buttons open official search results, not verified product listings; confirm the exact model, seller, availability, and checkout price before ordering. The sample price is not a live retailer price.</span></div>
    <div className="filter-row" aria-label="Deal classification filter">{filters.map(([value, label]) => <button key={value} className={`filter-chip ${classification === value ? 'selected' : ''}`} onClick={() => setClassification(value)} data-testid={`button-deal-filter-${value || 'all'}`}><Filter size={11} />{label}</button>)}</div>
    {deals.isLoading ? <div className="deals-grid">{[1, 2, 3, 4].map(n => <div className="card deal-card" key={n}><div className="skeleton" style={{ width: '45%' }} /><div className="skeleton" style={{ width: '90%', marginTop: 16 }} /><div className="skeleton" style={{ width: '70%', marginTop: 10 }} /><div className="skeleton" style={{ height: 50, marginTop: 20 }} /></div>)}</div> : deals.isError ? <ErrorPanel message="Matched deal data could not be loaded." retry={() => void deals.refetch()} /> : (deals.data ?? []).length === 0 ? <EmptyPanel title="No matches in this view" detail="Try another classification or add a monitor and run a mock catalog scan." /> : <div className="deals-grid">{(deals.data ?? []).map(deal => <article className="card deal-card" key={deal.id} data-testid={`card-deal-${deal.id}`}><div className="deal-card-top"><div><div className="deal-brand">{deal.brand} · {deal.category}</div><h3>{deal.title}</h3></div><DemoFlag /></div><div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}><Classification deal={deal} /><span className="tag" style={{ background: '#edf0e8', color: '#627366' }}>{deal.marketplace}</span></div>
      {(deal.classification.includes('anomaly') || deal.classification.includes('error')) && <div className="warning-line"><CircleAlert size={12} style={{ verticalAlign: 'middle', marginRight: 5 }} />Potential pricing anomaly · score {deal.anomalyScore}/100. Verify the history, not the crossed-out price.</div>}
      <div className="price-compare"><div><span>Current sample</span><strong>{rupees(deal.currentPrice)}</strong></div><div><span>Observed median</span><strong>{rupees(deal.historicalMedian)}</strong></div><div><span>Observed low</span><strong>{rupees(deal.historicalLow)}</strong></div></div>
      <div className="deal-meta" style={{ marginBottom: 13 }}><span>{deal.rating.toFixed(1)} rating</span><span>·</span><span>{compact(deal.reviewCount)} reviews</span><span>·</span><span>Seller: {deal.seller}</span></div>
       <div className="deal-foot">
         <div className="trust-note">Historical discount <strong>{deal.historicalDiscountPercent}%</strong> · confidence {deal.confidence}%<br />Matched by: {deal.matchedTaskNames.join(', ') || '—'}</div>
         <div className="deal-actions">
           <button className="button button-quiet" onClick={() => setHistoryId(deal.productId)} data-testid={`button-history-${deal.id}`}><Eye size={13} />History</button>
           <RetailerSearchLink store="Amazon.in" productTitle={deal.title} dealId={deal.id} />
           <RetailerSearchLink store="Flipkart" productTitle={deal.title} dealId={deal.id} />
         </div>
       </div>
    </article>)}</div>}
    {historyId && <PriceHistory productId={historyId} onClose={() => setHistoryId(null)} />}
  </main>;
}

function WatchlistPage() {
  const client = useQueryClient();
  const query = useGetDealHunterWatchlist();
  const add = useAddDealHunterWatchlistItem();
  const remove = useDeleteDealHunterWatchlistItem();
  const [label, setLabel] = useState('');
  const [kind, setKind] = useState<WatchlistInput['kind']>('keyword');
  const [error, setError] = useState('');
  const submit = (e: FormEvent) => {
    e.preventDefault(); const clean = label.trim();
    if (!clean) { setError('Enter a product, brand, category, or keyword.'); return; }
    setError('');
    add.mutate({ data: { label: clean, kind } }, { onSuccess: () => { setLabel(''); invalidate(client); }, onError: () => setError('Could not add this item. Please try again.') });
  };
  const del = (id: string) => { if (window.confirm('Remove this item from your watchlist?')) remove.mutate({ id }, { onSuccess: () => invalidate(client), onError: () => setError('Could not remove that item.') }); };
  const IconFor = ({ type }: { type: string }) => type === 'brand' ? <Tag size={15} /> : type === 'category' ? <ListFilter size={15} /> : type === 'product' ? <PackageSearch size={15} /> : <Search size={15} />;
  return <main className="page">
    <PageTitle eyebrow="Saved / Keep close" title="Watchlist" subtitle="Save the terms you want to keep an eye on. Items are not retailer subscriptions." />
    <form className="card form-card" onSubmit={submit} style={{ marginBottom: 17 }}>
      <div className="section-kicker">Add something to watch</div><div className="watchlist-add" style={{ marginTop: 12, marginBottom: 0 }}><input className="control" value={label} onChange={e => setLabel(e.target.value)} maxLength={120} placeholder="Product, brand, category, or search term" aria-label="Watchlist label" data-testid="input-watchlist-label" /><select className="control" value={kind} onChange={e => setKind(e.target.value as WatchlistInput['kind'])} aria-label="Watchlist type" data-testid="select-watchlist-kind">{['keyword', 'product', 'brand', 'category'].map(v => <option value={v} key={v}>{v[0].toUpperCase() + v.slice(1)}</option>)}</select><button className="button button-primary" disabled={add.isPending} type="submit" data-testid="button-add-watchlist">{add.isPending ? <LoaderCircle size={13} /> : <Plus size={13} />}Add to list</button></div>
      {error && <p role="alert" style={{ color: '#a33e2d', fontSize: 10, margin: '10px 0 0' }}>{error}</p>}
    </form>
    {query.isLoading ? <div className="watchlist-grid">{[1, 2, 3].map(i => <div className="card watch-card" key={i}><div className="skeleton" style={{ width: 32, height: 32 }} /><div style={{ flex: 1 }}><div className="skeleton" /><div className="skeleton" style={{ width: '45%', marginTop: 8 }} /></div></div>)}</div> : query.isError ? <ErrorPanel message="Watchlist items could not be loaded." retry={() => void query.refetch()} /> : (query.data ?? []).length === 0 ? <EmptyPanel title="Your watchlist is clear" detail="Add a product name, brand, category, or keyword to save it here." /> : <div className="watchlist-grid">{(query.data ?? []).map(item => <div className="card watch-card" key={item.id} data-testid={`card-watchlist-${item.id}`}><div className="watch-icon"><IconFor type={item.kind} /></div><div style={{ minWidth: 0 }}><div className="watch-label">{item.label}</div><div className="watch-kind">{item.kind} · added {relativeTime(item.createdAt)}</div></div><button className="icon-button watch-delete" aria-label={`Remove ${item.label}`} title="Remove" onClick={() => del(item.id)} disabled={remove.isPending} data-testid={`button-delete-watchlist-${item.id}`}><Trash2 size={14} /></button></div>)}</div>}
    <div className="alert-box" style={{ marginTop: 16 }}><CircleAlert size={15} /><span>Watchlist entries are saved in this workspace. Retailer monitoring and stock availability are not connected in this slice.</span></div>
  </main>;
}

function NotificationsPage() {
  const client = useQueryClient();
  const query = useGetDealHunterNotifications();
  const mark = useMarkDealHunterNotificationRead();
  const [filter, setFilter] = useState<'all' | 'unread' | 'read'>('all');
  const [notice, setNotice] = useState('');
  const items = (query.data ?? []).filter(n => filter === 'all' || n.read === (filter === 'read'));
  const markRead = (id: string) => mark.mutate({ id }, { onSuccess: () => { void client.invalidateQueries({ queryKey: getGetDealHunterNotificationsQueryKey() }); void client.invalidateQueries({ queryKey: getGetDealHunterDashboardQueryKey() }); }, onError: () => setNotice('Could not mark this alert as read.') });
  const markVisible = () => {
    const unread = items.filter(n => !n.read);
    if (!unread.length) return;
    let left = unread.length;
    unread.forEach(n => mark.mutate({ id: n.id }, { onSuccess: () => { left -= 1; if (!left) { void client.invalidateQueries({ queryKey: getGetDealHunterNotificationsQueryKey() }); void client.invalidateQueries({ queryKey: getGetDealHunterDashboardQueryKey() }); setNotice('Visible alerts marked as read.'); } }, onError: () => setNotice('Some alerts could not be updated.') }));
  };
  return <main className="page">
    <PageTitle eyebrow="Inbox / Review signals" title="Alerts" subtitle="A record of matches and warnings. Demo alerts are clearly identified." action={<button className="button button-quiet" onClick={markVisible} disabled={mark.isPending || !items.some(n => !n.read)} data-testid="button-mark-visible-read"><CheckCheck size={14} />Mark visible read</button>} />
    <div className="filter-row">{(['all', 'unread', 'read'] as const).map(v => <button className={`filter-chip ${filter === v ? 'selected' : ''}`} key={v} onClick={() => setFilter(v)} data-testid={`button-alert-filter-${v}`}>{v === 'all' ? 'Everything' : v}</button>)}</div>
    {query.isLoading ? <SkeletonRows /> : query.isError ? <ErrorPanel message="Alerts could not be loaded." retry={() => void query.refetch()} /> : items.length === 0 ? <EmptyPanel title={filter === 'all' ? 'No alerts yet' : `No ${filter} alerts`} detail="When a monitor matches a demo catalog item or flags a price anomaly, it will appear here." /> : <div className="card" style={{ padding: '4px 19px' }}>{items.map(item => <div className="notification-item" key={item.id} data-testid={`notification-${item.id}`}><span className={`notif-marker ${item.read ? 'read' : ''}`} /><div style={{ flex: 1 }}><div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}><p className="notif-title" style={{ margin: 0 }}>{item.title}</p><span className="tag" style={{ background: '#f0eee5', color: '#696b5d' }}>{item.kind}</span>{item.demo && <DemoFlag />}</div><p className="notif-copy" style={{ marginTop: 6 }}>{item.message}</p><div className="notif-time">{new Date(item.createdAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}</div></div>{!item.read && <button className="button button-quiet" onClick={() => markRead(item.id)} disabled={mark.isPending} data-testid={`button-mark-read-${item.id}`}><Check size={13} />Read</button>}</div>)}</div>}
    {notice && <Toast text={notice} close={() => setNotice('')} />}
  </main>;
}

function SettingsPage() {
  const health = useHealthCheck();
  return <main className="page">
    <PageTitle eyebrow="Workspace / Availability" title="Connections" subtitle="A transparent view of what this first slice can and cannot reach." />
    <div className="alert-box" style={{ marginBottom: 17 }}><ShieldCheck size={15} /><span><strong>No live retailer integrations are active.</strong> Scan and offer records in this workspace use the demo catalog. No checkout, ordering, or stock verification is available.</span></div>
    <div className="settings-grid">
      <section className="card setting-card"><div className="section-kicker">Marketplaces</div><h3>Retailer access</h3><p>Supported destinations are shown as integration targets only. They are not connected or queried.</p>{['Amazon.in', 'Flipkart'].map(name => <div className="connection-row" key={name}><span>{name}<small>Price feed and availability unavailable</small></span><span className="status-pill off"><CircleAlert size={11} />Not connected</span></div>)}</section>
      <section className="card setting-card"><div className="section-kicker">Delivery</div><h3>Notification channels</h3><p>Alerts are available inside this workspace. No external notification channel is configured.</p>{['Email', 'SMS / WhatsApp', 'Browser push'].map(name => <div className="connection-row" key={name}><span>{name}<small>Connection not configured</small></span><span className="status-pill off">Unavailable</span></div>)}</section>
      <section className="card setting-card"><div className="section-kicker">Service / health</div><h3>Workspace service</h3><p>Health reports service status only; it does not indicate live retailer coverage.</p><div className="connection-row"><span>API status<small>{health.data?.status ?? (health.isError ? 'Could not reach service' : 'Checking service')}</small></span>{health.isLoading ? <span className="status-pill off"><LoaderCircle size={11} />Checking</span> : health.isError ? <button className="button button-quiet" onClick={() => void health.refetch()} data-testid="button-health-retry"><RefreshCw size={12} />Retry</button> : <span className="status-pill"><Check size={11} />Responding</span>}</div></section>
      <section className="card setting-card"><div className="section-kicker">Price confidence</div><h3>How to read a deal</h3><p>We compare current sample price against recorded historical median, low, and high. This is separate from list-price discount claims.</p><div className="connection-row"><span>Historical baseline<small>Observed points may be demo samples</small></span><span className="status-pill off">Not live</span></div></section>
    </div>
  </main>;
}

function Router() {
  return <AppShell><Switch>
    <Route path="/" component={DashboardPage} />
    <Route path="/tasks" component={TasksPage} />
    <Route path="/deals" component={DealsPage} />
    <Route path="/watchlist" component={WatchlistPage} />
    <Route path="/notifications" component={NotificationsPage} />
    <Route path="/settings" component={SettingsPage} />
    <Route component={NotFound} />
  </Switch></AppShell>;
}
function App() {
  return <QueryClientProvider client={queryClient}><WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}><Router /></WouterRouter></QueryClientProvider>;
}
export default App;
