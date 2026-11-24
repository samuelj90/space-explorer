import { useState } from 'react';
import { formatBytes, type Project } from './api';
import { Icon } from './Icon';

type Props = {
  projects: Project[];
  scanning: boolean;
  selected: Set<string>;
  setSelected: (value: Set<string>) => void;
  onClean: (paths: Set<string>) => void;
};

export function Projects({ projects, scanning, selected, setSelected, onClean }: Props) {
  const [query, setQuery] = useState('');
  const [onlyReclaimable, setOnlyReclaimable] = useState(true);
  const allPaths = projects.flatMap((project) => project.artifacts.map((artifact) => artifact.abs_path));
  const filtered = projects.filter((project) => {
    const text = query.toLowerCase();
    return (!onlyReclaimable || project.reclaimable_bytes > 0) &&
      (!text || project.name.toLowerCase().includes(text) || project.artifacts.some((artifact) =>
        artifact.name.toLowerCase().includes(text) || artifact.category.toLowerCase().includes(text)));
  }).sort((a, b) => b.reclaimable_bytes - a.reclaimable_bytes);
  const selectedSize = projects.flatMap((project) => project.artifacts)
    .filter((artifact) => selected.has(artifact.abs_path))
    .reduce((sum, artifact) => sum + artifact.size_bytes, 0);

  function toggle(paths: string[], checked: boolean) {
    const next = new Set(selected);
    paths.forEach((path) => checked ? next.add(path) : next.delete(path));
    setSelected(next);
  }

  return (
    <section aria-label="Project artifacts">
      <div className="toolbar">
        <div className="flex flex-wrap items-center gap-4">
          <label className="sr-only" htmlFor="project-search">Filter projects or artifacts</label>
          <div className="search-control"><Icon name="search" /><input id="project-search" className="field search" placeholder="Search projects or artifacts" value={query} onChange={(event) => setQuery(event.target.value)} /></div>
          <label className="check-label"><input type="checkbox" checked={onlyReclaimable} onChange={(event) => setOnlyReclaimable(event.target.checked)} /> Only projects with cleanable files</label>
        </div>
        <button className="button danger" disabled={!selected.size} onClick={() => onClean(selected)}>Clean selected <span>{formatBytes(selectedSize)}</span></button>
      </div>
      <p className="table-hint">Scroll horizontally to see more <span aria-hidden="true">→</span></p>
      <div className="table-wrap" role="region" aria-label="Project artifacts table" tabIndex={0}>
        <table>
          <thead><tr>
            <th><input aria-label="Select all project artifacts" type="checkbox" checked={allPaths.length > 0 && allPaths.every((path) => selected.has(path))} onChange={(event) => toggle(allPaths, event.target.checked)} /></th>
            <th>Project</th><th>Artifacts</th><th className="text-right">Reclaimable</th><th className="text-right">Action</th>
          </tr></thead>
          <tbody>
            {filtered.map((project) => {
              const paths = project.artifacts.map((artifact) => artifact.abs_path);
              return <tr key={project.abs_path}>
                <td>{paths.length > 0 && <input aria-label={`Select all artifacts in ${project.name}`} type="checkbox" checked={paths.every((path) => selected.has(path))} onChange={(event) => toggle(paths, event.target.checked)} />}</td>
                <td><div className="project-cell"><span className="row-icon"><Icon name="folder" /></span><div><div className="font-semibold">{project.name}</div><div className="muted text-xs">{paths.length} {paths.length === 1 ? 'artifact' : 'artifacts'}</div></div></div></td>
                <td><div className="flex flex-wrap gap-2">{project.artifacts.length ? project.artifacts.map((artifact) =>
                  <label className="artifact" key={artifact.abs_path}><input type="checkbox" checked={selected.has(artifact.abs_path)} onChange={(event) => toggle([artifact.abs_path], event.target.checked)} /> {artifact.name} <span>{formatBytes(artifact.size_bytes)}</span></label>
                ) : <span className="muted">Clean</span>}</div></td>
                <td className="text-right font-semibold">{formatBytes(project.reclaimable_bytes)}</td>
                <td className="text-right">{paths.length > 0 && <button className="button small" onClick={() => onClean(new Set(paths))}>Clean all</button>}</td>
              </tr>;
            })}
            {!filtered.length && <tr><td className="empty" colSpan={5}>{scanning ? 'Scanning projects…' : 'No projects match your filters.'}</td></tr>}
          </tbody>
        </table>
      </div>
    </section>
  );
}
