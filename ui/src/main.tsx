import { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Caches } from './Caches';
import { Dialog } from './Dialog';
import { Icon } from './Icon';
import { Overview } from './Overview';
import { Projects } from './Projects';
import { Rules } from './Rules';
import { changeRule, clean, formatBytes, getCaches, getInfo, getRules, scanProjects, type Cache, type Project, type Rule, type Rules as RulesData, type SystemInfo } from './api';
import { useTheme } from './theme';
import './styles.css';

type Tab = 'projects' | 'caches' | 'rules';
type CleanRequest = { mode: 'projects' | 'caches' | 'all-caches'; ids: Set<string> };
const emptyRules: RulesData = { project_artifacts: [], custom_rules_path: '' };
const message = (error: unknown) => error instanceof Error ? error.message : String(error);

function App() {
  const { theme, setTheme, ready: themeReady, error: themeError } = useTheme();
  const [tab, setTab] = useState<Tab>('projects');
  const [info, setInfo] = useState<SystemInfo | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [caches, setCaches] = useState<Cache[]>([]);
  const [rules, setRules] = useState<RulesData>(emptyRules);
  const [selectedProjects, setSelectedProjects] = useState<Set<string>>(new Set());
  const [selectedCaches, setSelectedCaches] = useState<Set<string>>(new Set());
  const [scanning, setScanning] = useState(false);
  const [cleaning, setCleaning] = useState(false);
  const [cleanRequest, setCleanRequest] = useState<CleanRequest | null>(null);
  const [trash, setTrash] = useState(true);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');

  async function refresh() {
    setScanning(true);
    setError('');
    setProjects([]);
    setSelectedProjects(new Set());
    setSelectedCaches(new Set());
    const results = await Promise.allSettled([
      getInfo().then(setInfo),
      getCaches().then(setCaches),
      getRules().then(setRules),
      scanProjects((project) => setProjects((current) => [...current, project]))
    ]);
    const labels = ['System information', 'Caches', 'Rules', 'Project scan'];
    const failures = results.flatMap((result, index) => result.status === 'rejected' ? [`${labels[index]}: ${message(result.reason)}`] : []);
    if (failures.length) setError(failures.join('\n'));
    setScanning(false);
  }
  useEffect(() => { void refresh(); }, []);

  const totalProjects = projects.reduce((sum, project) => sum + project.reclaimable_bytes, 0);
  const activeCaches = caches.filter((cache) => cache.exists && cache.size_bytes > 0);
  const totalCaches = activeCaches.reduce((sum, cache) => sum + cache.size_bytes, 0);
  const targets = cleanRequest?.mode === 'projects'
    ? projects.flatMap((project) => project.artifacts).filter((artifact) => cleanRequest.ids.has(artifact.abs_path)).map((artifact) => ({ name: artifact.abs_path, size: artifact.size_bytes }))
    : caches.filter((cache) => cleanRequest?.ids.has(cache.id)).map((cache) => ({ name: cache.name, size: cache.size_bytes }));
  const targetSize = targets.reduce((sum, target) => sum + target.size, 0);

  async function executeClean() {
    if (!cleanRequest) return;
    setCleaning(true);
    setError('');
    setNotice('');
    try {
      if (cleanRequest.mode === 'projects') {
        await clean('/api/clean', { targets: [...cleanRequest.ids], use_trash: trash });
      } else {
        await clean('/api/clean-caches', { cache_ids: [...cleanRequest.ids] });
      }
      setCleanRequest(null);
      setNotice('Cleanup completed.');
      await refresh();
    } catch (err) {
      setError(`Cleanup failed: ${message(err)}. Some items may have been cleaned; rescan before trying again.`);
      setCleanRequest(null);
    } finally { setCleaning(false); }
  }

  async function saveRule(rule: Pick<Rule, 'name' | 'category' | 'desc' | 'is_dir' | 'safe_to_delete'>) {
    await changeRule({ action: 'add_artifact', rule });
    setRules(await getRules());
    setNotice('Rule saved. Rescan to apply it.');
  }
  async function deleteRule(name: string) {
    try {
      await changeRule({ action: 'delete_artifact', name });
      setRules(await getRules());
      setNotice(`Rule "${name}" removed.`);
    } catch (err) { setError(`Could not delete rule: ${message(err)}`); }
  }

  return <div className="app-shell">
    <header className="header">
      <div className="brand"><div className="brand-mark"><Icon name="orbit" /></div><div><h1>Space Explorer</h1><p>STORAGE INTELLIGENCE</p></div></div>
      <div className="flex flex-wrap items-center gap-3">
        <label className="sr-only" htmlFor="theme">Theme</label>
        <select id="theme" className="field" value={theme} disabled={!themeReady} onChange={(event) => {
          const value = event.target.value;
          if (value === 'system' || value === 'light' || value === 'dark') setTheme(value);
        }}><option value="system">System theme</option><option value="light">Light theme</option><option value="dark">Dark theme</option></select>
        <button className="button primary" disabled={scanning || cleaning} onClick={() => void refresh()}><Icon name="scan" />{scanning ? 'Scanning…' : 'Scan everything'}</button>
      </div>
    </header>
    <main>
      {themeError && <div role="alert" className="alert error">{themeError}</div>}
      {error && <div role="alert" className="alert error"><span>{error}</span><button aria-label="Dismiss error" onClick={() => setError('')}>×</button></div>}
      {notice && <div role="status" className="alert success"><span>{notice}</span><button aria-label="Dismiss notification" onClick={() => setNotice('')}>×</button></div>}
      <Overview info={info} projectBytes={totalProjects} cacheBytes={totalCaches} cacheCount={activeCaches.length} />
      <div className="section-heading"><div><p className="eyebrow">STORAGE LIBRARY</p><h2>Explore your storage</h2></div><p>Review items before you clean</p></div>
      <div className="tabs" role="tablist" aria-label="Storage sections">
        {([['projects', 'Projects', projects.length], ['caches', 'Caches', activeCaches.length], ['rules', 'Rules', rules.project_artifacts.length]] as const).map(([id, label, count]) =>
          <button key={id} id={`tab-${id}`} role="tab" aria-selected={tab === id} aria-controls={`panel-${id}`} tabIndex={tab === id ? 0 : -1} className={`tab ${tab === id ? 'active' : ''}`} onClick={() => setTab(id)} onKeyDown={(event) => {
            const tabs: Tab[] = ['projects', 'caches', 'rules'];
            const index = tabs.indexOf(id);
            const next = event.key === 'Home' ? tabs[0] : event.key === 'End' ? tabs[tabs.length - 1] : event.key === 'ArrowRight' ? tabs[(index + 1) % tabs.length] : event.key === 'ArrowLeft' ? tabs[(index + tabs.length - 1) % tabs.length] : null;
            if (next) { event.preventDefault(); setTab(next); document.getElementById(`tab-${next}`)?.focus(); }
          }}><Icon name={id === 'projects' ? 'folder' : id === 'caches' ? 'cache' : 'rules'} />{label} <span className="tab-count">{count}</span></button>)}
      </div>
      <div id="panel-projects" role="tabpanel" aria-labelledby="tab-projects" hidden={tab !== 'projects'}><Projects projects={projects} scanning={scanning} selected={selectedProjects} setSelected={setSelectedProjects} onClean={(ids) => { setSelectedProjects(ids); setTrash(true); setCleanRequest({ mode: 'projects', ids }); }} /></div>
      <div id="panel-caches" role="tabpanel" aria-labelledby="tab-caches" hidden={tab !== 'caches'}><Caches caches={caches} selected={selectedCaches} setSelected={setSelectedCaches} onClean={(ids, all) => { setSelectedCaches(ids); setCleanRequest({ mode: all ? 'all-caches' : 'caches', ids }); }} /></div>
      <div id="panel-rules" role="tabpanel" aria-labelledby="tab-rules" hidden={tab !== 'rules'}><Rules rules={rules} onSave={saveRule} onDelete={deleteRule} /></div>
    </main>
    {cleanRequest && <Dialog title={cleanRequest.mode === 'projects' ? 'Confirm project cleanup' : 'Confirm cache cleanup'} onClose={() => { if (!cleaning) setCleanRequest(null); }}>
      <div className="p-6"><p className="muted text-sm">Review the items below before cleaning. This action may remove files permanently.</p>
        {cleanRequest.mode === 'projects' && <label className="check-label mt-4"><input type="checkbox" checked={trash} onChange={(event) => setTrash(event.target.checked)} /> Move to system trash when supported</label>}
        <ul className="target-list">{targets.map((target, index) => <li key={`${target.name}-${index}`}><span>{target.name}</span><strong>{formatBytes(target.size)}</strong></li>)}</ul>
        <p className="mt-4 text-sm font-semibold">Total: {formatBytes(targetSize)}</p>
      </div>
      <div className="dialog-actions"><button className="button" disabled={cleaning} onClick={() => setCleanRequest(null)}>Cancel</button><button className="button danger" disabled={cleaning || !targets.length} onClick={() => void executeClean()}>{cleaning ? 'Cleaning…' : 'Clean now'}</button></div>
    </Dialog>}
  </div>;
}

const root = document.getElementById('root');
if (!root) throw new Error('Missing application root');
createRoot(root).render(<App />);
