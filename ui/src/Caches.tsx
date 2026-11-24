import { formatBytes, type Cache } from './api';

type Props = {
  caches: Cache[];
  selected: Set<string>;
  setSelected: (value: Set<string>) => void;
  onClean: (ids: Set<string>, all: boolean) => void;
};

export function Caches({ caches, selected, setSelected, onClean }: Props) {
  const available = caches.filter((cache) => cache.exists && cache.size_bytes > 0);
  const size = available.reduce((sum, cache) => sum + cache.size_bytes, 0);
  function toggle(id: string, checked: boolean) {
    const next = new Set(selected);
    if (checked) next.add(id); else next.delete(id);
    setSelected(next);
  }
  return <section aria-label="Package and system caches">
    <div className="toolbar">
      <p className="muted text-sm">Cache definitions are configurable in the rules files.</p>
      <button className="button danger" disabled={!available.length} onClick={() => onClean(new Set(available.map((cache) => cache.id)), true)}>Purge all caches <span>{formatBytes(size)}</span></button>
    </div>
    <p className="table-hint">Scroll horizontally to see more <span aria-hidden="true">→</span></p>
    <div className="table-wrap" role="region" aria-label="Caches table" tabIndex={0}><table>
      <thead><tr>
        <th><input aria-label="Select all caches" type="checkbox" checked={available.length > 0 && available.every((cache) => selected.has(cache.id))} onChange={(event) => setSelected(new Set(event.target.checked ? available.map((cache) => cache.id) : []))} /></th>
        <th>Cache</th><th>Target path</th><th className="text-right">Current size</th><th className="text-right">Action</th>
      </tr></thead>
      <tbody>{caches.map((cache) => <tr key={cache.id}>
        <td><input aria-label={`Select ${cache.name}`} type="checkbox" disabled={!cache.exists || cache.size_bytes <= 0} checked={selected.has(cache.id)} onChange={(event) => toggle(cache.id, event.target.checked)} /></td>
        <td><div className="font-semibold">{cache.name}</div><div className="muted text-xs">{cache.desc}</div></td>
        <td className="path">{cache.path}</td>
        <td className="text-right font-semibold">{cache.exists ? formatBytes(cache.size_bytes) : 'Not found'}</td>
        <td className="text-right"><button className="button small" disabled={!cache.exists || cache.size_bytes <= 0} onClick={() => onClean(new Set([cache.id]), false)}>Purge</button></td>
      </tr>)}
      {!caches.length && <tr><td className="empty" colSpan={5}>No caches detected.</td></tr>}</tbody>
    </table></div>
  </section>;
}
