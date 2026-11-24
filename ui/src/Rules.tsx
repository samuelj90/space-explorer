import { useState } from 'react';
import { type Rule, type Rules as RulesData } from './api';
import { Dialog } from './Dialog';

type RuleDraft = Pick<Rule, 'name' | 'category' | 'desc' | 'is_dir' | 'safe_to_delete'>;
const blank: RuleDraft = { name: '', category: 'Custom', desc: '', is_dir: true, safe_to_delete: true };
const presets: RuleDraft[] = [
  ['.turbo', 'Monorepo', 'Turborepo build cache'],
  ['build', 'Build Output', 'Compiled artifacts folder'],
  ['coverage', 'Testing', 'Test coverage reports'],
  ['.parcel-cache', 'Bundler', 'Parcel compiler cache'],
  ['.gradle', 'Java / Android', 'Gradle project cache'],
  ['.dart_tool', 'Flutter / Dart', 'Dart tooling and packages cache'],
  ['tmp', 'General', 'Temporary artifacts directory']
].map(([name, category, desc]) => ({ name, category, desc, is_dir: true, safe_to_delete: true }));

export function Rules({ rules, onSave, onDelete }: {
  rules: RulesData;
  onSave: (rule: RuleDraft) => Promise<void>;
  onDelete: (name: string) => Promise<void>;
}) {
  const [query, setQuery] = useState('');
  const [source, setSource] = useState('all');
  const [draft, setDraft] = useState<RuleDraft | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const filtered = rules.project_artifacts.filter((rule) =>
    (source === 'all' || (source === 'custom') === !!rule.is_custom) &&
    [rule.name, rule.category, rule.desc].some((value) => (value || '').toLowerCase().includes(query.toLowerCase())));
  async function save() {
    if (!draft || !draft.name.trim()) { setError('Enter a rule pattern or name.'); return; }
    setBusy(true);
    setError('');
    try { await onSave({ ...draft, name: draft.name.trim(), category: draft.category.trim() || 'Custom' }); setDraft(null); }
    catch (err) { setError(err instanceof Error ? err.message : String(err)); }
    finally { setBusy(false); }
  }
  return <section aria-label="Rules configuration">
    <div className="toolbar">
      <div className="flex flex-wrap gap-3">
        <label className="sr-only" htmlFor="rule-search">Search rules</label>
        <input id="rule-search" className="field search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search rules" />
        <label className="sr-only" htmlFor="rule-source">Rule source</label>
        <select id="rule-source" className="field" value={source} onChange={(event) => setSource(event.target.value)}><option value="all">All sources</option><option value="builtin">Built-in</option><option value="custom">Custom</option></select>
      </div>
      <button className="button primary" onClick={() => { setError(''); setDraft({ ...blank }); }}>Add custom rule</button>
    </div>
    <div className="panel mb-4 flex flex-wrap items-center gap-2 p-4"><span className="muted mr-2 text-sm font-semibold">Quick add</span>{presets.map((preset) => <button key={preset.name} className="chip" onClick={() => { setError(''); setDraft({ ...preset }); }}>+ {preset.name}</button>)}</div>
    <p className="table-hint">Scroll horizontally to see more <span aria-hidden="true">→</span></p>
    <div className="table-wrap" role="region" aria-label="Rules table" tabIndex={0}><table>
      <thead><tr><th>Pattern</th><th>Category</th><th>Description</th><th>Type</th><th>Safety</th><th>Source</th><th className="text-right">Action</th></tr></thead>
      <tbody>{filtered.map((rule, index) => <tr key={`${rule.name}-${index}`}>
        <td className="font-mono font-semibold">{rule.name}</td><td>{rule.category}</td><td className="muted">{rule.desc}</td>
        <td>{rule.is_dir === false ? 'File' : 'Directory'}</td><td><span className={rule.safe_to_delete === false ? 'badge caution' : 'badge safe'}>{rule.safe_to_delete === false ? 'Caution' : 'Safe'}</span></td>
        <td><span className="badge">{rule.is_custom ? 'Custom' : 'Built-in'}</span></td>
        <td className="text-right">{rule.is_custom ? <button className="button small" onClick={() => { if (window.confirm(`Delete rule "${rule.name}"?`)) void onDelete(rule.name); }}>Delete</button> : <span className="muted">Default</span>}</td>
      </tr>)}
      {!filtered.length && <tr><td className="empty" colSpan={7}>No rules match your filters.</td></tr>}</tbody>
    </table></div>
    <p className="muted mt-4 text-xs">Rules stored at <code>{rules.custom_rules_path || '~/.space-explorer-rules.json'}</code>. Changes apply to subsequent scans.</p>
    {draft && <Dialog title="Add custom rule" onClose={() => { if (!busy) setDraft(null); }}>
      <div className="space-y-4 p-6">
        <p className="muted text-sm">Define a file or folder pattern to detect as an artifact.</p>
        <label className="form-label">Pattern<input className="field w-full" autoFocus value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} placeholder="e.g. .cache" /></label>
        <label className="form-label">Category<input className="field w-full" value={draft.category} onChange={(event) => setDraft({ ...draft, category: event.target.value })} /></label>
        <label className="form-label">Description<input className="field w-full" value={draft.desc} onChange={(event) => setDraft({ ...draft, desc: event.target.value })} /></label>
        <label className="form-label">Target type<select className="field w-full" value={draft.is_dir ? 'dir' : 'file'} onChange={(event) => setDraft({ ...draft, is_dir: event.target.value === 'dir' })}><option value="dir">Directory</option><option value="file">File</option></select></label>
        <label className="check-label"><input type="checkbox" checked={draft.safe_to_delete} onChange={(event) => setDraft({ ...draft, safe_to_delete: event.target.checked })} /> Safe to delete</label>
        {error && <p className="error" role="alert">{error}</p>}
      </div>
      <div className="dialog-actions"><button className="button" disabled={busy} onClick={() => setDraft(null)}>Cancel</button><button className="button primary" disabled={busy} onClick={() => void save()}>{busy ? 'Saving…' : 'Save rule'}</button></div>
    </Dialog>}
  </section>;
}
