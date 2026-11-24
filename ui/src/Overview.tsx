import { formatBytes, type SystemInfo } from './api';
import { Icon } from './Icon';

export function Overview({ info, projectBytes, cacheBytes, cacheCount }: {
  info: SystemInfo | null;
  projectBytes: number;
  cacheBytes: number;
  cacheCount: number;
}) {
  const used = info?.disk.total_bytes ? Math.round(info.disk.used_bytes / info.disk.total_bytes * 100) : 0;
  return <>
    <section className="hero" aria-labelledby="overview-title">
      <div className="hero-copy">
        <div className="hero-kicker"><span className="status-dot" /> STORAGE OVERVIEW</div>
        <h2 id="overview-title">A little more space<br /><span>for the big ideas.</span></h2>
        <p>Find the files you can leave behind and get back to building.</p>
        <div className="hero-badges"><span><Icon name="spark" /> Local analysis</span><span>Review before cleanup</span></div>
      </div>
      <div className="hero-orbit" aria-hidden="true">
        <div className="orbit-line orbit-line-outer" />
        <div className="orbit-line orbit-line-inner" />
        <div className="orbit-dot orbit-dot-one" /><div className="orbit-dot orbit-dot-two" />
        <div className="orbit-center">
          <svg viewBox="0 0 120 120"><circle className="orbit-track" cx="60" cy="60" r="50" /><circle className="orbit-progress" cx="60" cy="60" r="50" pathLength="100" strokeDasharray={`${used} 100`} /></svg>
          <div><strong>{info ? `${used}%` : '—'}</strong><span>DISK USED</span></div>
        </div>
      </div>
    </section>
    <div className="stats">
      <div className="stat">
        <div className="stat-top"><span className="stat-icon stat-icon-blue"><Icon name="drive" /></span><span className="stat-tag">STORAGE</span></div>
        <p className="stat-label">Disk available</p><p className="stat-value">{info ? formatBytes(info.disk.free_bytes) : '—'}</p>
        <div className="stat-foot"><span>{info ? `${formatBytes(info.disk.used_bytes)} of ${formatBytes(info.disk.total_bytes)} used` : 'Loading disk information'}</span><span>{info ? `${used}%` : ''}</span></div>
        <div className="progress" role="progressbar" aria-label="Disk used" aria-valuemin={0} aria-valuemax={100} aria-valuenow={used}><div style={{ width: `${used}%` }} /></div>
      </div>
      <div className="stat">
        <div className="stat-top"><span className="stat-icon stat-icon-orange"><Icon name="folder" /></span><span className="stat-tag">PROJECTS</span></div>
        <p className="stat-label">Project artifacts</p><p className="stat-value">{formatBytes(projectBytes)}</p>
        <p className="stat-description"><span className="tiny-dot orange" /> Reclaimable build outputs</p>
      </div>
      <div className="stat">
        <div className="stat-top"><span className="stat-icon stat-icon-purple"><Icon name="cache" /></span><span className="stat-tag">CACHES</span></div>
        <p className="stat-label">Package &amp; system caches</p><p className="stat-value">{formatBytes(cacheBytes)}</p>
        <p className="stat-description"><span className="tiny-dot purple" /> {cacheCount} caches with data</p>
      </div>
    </div>
  </>;
}
