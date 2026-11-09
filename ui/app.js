let scannedProjects = [];
let scannedCaches = [];
let selectedProjectPaths = new Set();
let selectedCacheIds = new Set();
let workspaceInfo = null;
let currentModalMode = 'projects';

function formatBytes(bytes) {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function switchTab(tab) {
  const isProjects = tab === 'projects';
  document.getElementById('view-projects').style.display = isProjects ? 'block' : 'none';
  document.getElementById('view-caches').style.display = isProjects ? 'none' : 'block';
  document.getElementById('tab-btn-projects').classList.toggle('active', isProjects);
  document.getElementById('tab-btn-caches').classList.toggle('active', !isProjects);
}

async function loadSystemInfo() {
  try {
    const res = await fetch('/api/info');
    workspaceInfo = await res.json();
    document.getElementById('workspace-label').innerText = `Workspace: ${workspaceInfo.workspace}`;

    const disk = workspaceInfo.disk;
    const usedPercent = Math.round((disk.used_bytes / disk.total_bytes) * 100);
    document.getElementById('stat-disk-free').innerText = formatBytes(disk.free_bytes);
    document.getElementById('stat-disk-used').innerText = `${formatBytes(disk.used_bytes)} of ${formatBytes(disk.total_bytes)} used (${usedPercent}%)`;
    document.getElementById('disk-progress').style.width = `${usedPercent}%`;
  } catch (err) {
    console.error('Failed to load system info:', err);
  }
}

async function loadCaches() {
  try {
    const res = await fetch('/api/caches');
    const data = await res.json();
    scannedCaches = data.caches || [];
    renderCachesTable();
  } catch (err) {
    console.error('Failed to load caches:', err);
  }
}

async function startProjectScan() {
  scannedProjects = [];
  selectedProjectPaths.clear();
  updateSelectedProjectSize();

  const tbody = document.getElementById('projects-table-body');
  tbody.innerHTML = `<tr><td colspan="5" style="text-align: center; padding: 40px; color: var(--text-muted);">Scanning projects folder, please wait...</td></tr>`;

  try {
    const response = await fetch('/api/scan');
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop();

      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const item = JSON.parse(line);
          if (item.type === 'project') {
            scannedProjects.push(item);
            renderProjectsTable();
          }
        } catch (e) {
          console.error('JSON parse error', e);
        }
      }
    }
  } catch (err) {
    console.error('Project scan failed:', err);
  } finally {
    renderProjectsTable();
  }
}

async function refreshAll() {
  const btn = document.getElementById('btn-scan-all');
  btn.disabled = true;
  btn.innerText = 'Scanning...';
  try {
    await Promise.all([loadSystemInfo(), loadCaches(), startProjectScan()]);
  } finally {
    btn.disabled = false;
    btn.innerText = '🔄 Scan Everything';
  }
}

function renderProjectsTable() {
  const tbody = document.getElementById('projects-table-body');
  const query = document.getElementById('search-input').value.toLowerCase();
  const reclaimableOnly = document.getElementById('filter-reclaimable-only').checked;

  let totalReclaimable = 0;
  for (const p of scannedProjects) {
    totalReclaimable += p.reclaimable_bytes;
  }
  document.getElementById('stat-reclaimable').innerText = formatBytes(totalReclaimable);
  document.getElementById('tab-count-projects').innerText = scannedProjects.length;

  const filtered = scannedProjects.filter(p => {
    if (reclaimableOnly && p.reclaimable_bytes === 0) return false;
    if (!query) return true;
    if (p.name.toLowerCase().includes(query)) return true;
    return p.artifacts.some(a => a.name.toLowerCase().includes(query) || a.category.toLowerCase().includes(query));
  });

  if (filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" style="text-align: center; padding: 40px; color: var(--text-muted);">No projects found matching filter.</td></tr>`;
    return;
  }

  filtered.sort((a, b) => b.reclaimable_bytes - a.reclaimable_bytes);

  let html = '';
  for (const p of filtered) {
    const badges = p.artifacts.map(a => {
      const isChecked = selectedProjectPaths.has(a.abs_path);
      return `
        <label class="artifact-badge" style="cursor: pointer; ${isChecked ? 'background: #1f6feb; color: #fff;' : ''}">
          <input type="checkbox" style="margin-right: 4px;" value="${a.abs_path}" ${isChecked ? 'checked' : ''} onchange="toggleArtifactSelect('${a.abs_path}', this.checked)">
          ${a.name} (${formatBytes(a.size_bytes)})
        </label>
      `;
    }).join(' ');

    const projectAllChecked = p.artifacts.length > 0 && p.artifacts.every(a => selectedProjectPaths.has(a.abs_path));

    html += `
      <tr>
        <td style="text-align: center;">
          ${p.artifacts.length > 0 ? `<input type="checkbox" ${projectAllChecked ? 'checked' : ''} onchange="toggleProjectSelect('${p.name}', this.checked)">` : ''}
        </td>
        <td>
          <div class="project-name">📁 ${p.name}</div>
          <div style="font-size: 11px; color: var(--text-muted); font-family: var(--font-mono); margin-top: 2px;">${p.abs_path}</div>
        </td>
        <td>${badges || '<span style="color: var(--text-muted); font-size: 12px;">Clean</span>'}</td>
        <td style="text-align: right;"><span class="size-pill">${formatBytes(p.reclaimable_bytes)}</span></td>
        <td style="text-align: right;">
          ${p.artifacts.length > 0 ? `
            <button class="btn" style="padding: 4px 10px; font-size: 12px;" onclick="cleanProjectDirect('${p.name}')">Clean All</button>
          ` : '<span style="color: var(--text-muted); font-size: 12px;">-</span>'}
        </td>
      </tr>
    `;
  }
  tbody.innerHTML = html;
}

function renderCachesTable() {
  const tbody = document.getElementById('caches-table-body');
  let totalCacheSize = 0;
  let activeCaches = 0;

  for (const c of scannedCaches) {
    if (c.exists && c.size_bytes > 0) {
      totalCacheSize += c.size_bytes;
      activeCaches++;
    }
  }

  document.getElementById('stat-caches-total').innerText = formatBytes(totalCacheSize);
  document.getElementById('tab-count-caches').innerText = activeCaches;
  document.getElementById('all-caches-size').innerText = formatBytes(totalCacheSize);
  document.getElementById('btn-clean-all-caches').disabled = totalCacheSize === 0;

  if (scannedCaches.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" style="text-align: center; padding: 40px; color: var(--text-muted);">No caches detected.</td></tr>`;
    return;
  }

  let html = '';
  for (const c of scannedCaches) {
    const isChecked = selectedCacheIds.has(c.id);
    html += `
      <tr>
        <td style="text-align: center;">
          <input type="checkbox" ${c.exists && c.size_bytes > 0 ? '' : 'disabled'} ${isChecked ? 'checked' : ''} onchange="toggleCacheSelect('${c.id}', this.checked)">
        </td>
        <td>
          <div style="font-weight: 600;">${c.name}</div>
          <div style="font-size: 12px; color: var(--text-muted);">${c.desc}</div>
        </td>
        <td style="font-family: var(--font-mono); font-size: 12px; color: var(--text-muted);">${c.path}</td>
        <td style="text-align: right;">
          <span class="size-pill" style="color: ${c.size_bytes > 0 ? '#58a6ff' : 'var(--text-muted)'};">
            ${c.exists ? formatBytes(c.size_bytes) : 'Not Found'}
          </span>
        </td>
        <td style="text-align: right;">
          <button class="btn" style="padding: 4px 10px; font-size: 12px;" ${c.exists && c.size_bytes > 0 ? '' : 'disabled'} onclick="cleanSingleCacheDirect('${c.id}')">
            Purge
          </button>
        </td>
      </tr>
    `;
  }
  tbody.innerHTML = html;
}

function toggleArtifactSelect(absPath, isChecked) {
  if (isChecked) selectedProjectPaths.add(absPath);
  else selectedProjectPaths.delete(absPath);
  updateSelectedProjectSize();
  renderProjectsTable();
}

function toggleProjectSelect(projectName, isChecked) {
  const project = scannedProjects.find(p => p.name === projectName);
  if (!project) return;
  for (const a of project.artifacts) {
    if (isChecked) selectedProjectPaths.add(a.abs_path);
    else selectedProjectPaths.delete(a.abs_path);
  }
  updateSelectedProjectSize();
  renderProjectsTable();
}

function toggleSelectAll(checkbox) {
  const isChecked = checkbox.checked;
  for (const p of scannedProjects) {
    for (const a of p.artifacts) {
      if (isChecked) selectedProjectPaths.add(a.abs_path);
      else selectedProjectPaths.delete(a.abs_path);
    }
  }
  updateSelectedProjectSize();
  renderProjectsTable();
}

function updateSelectedProjectSize() {
  let size = 0;
  for (const p of scannedProjects) {
    for (const a of p.artifacts) {
      if (selectedProjectPaths.has(a.abs_path)) size += a.size_bytes;
    }
  }
  document.getElementById('selected-size').innerText = formatBytes(size);
  document.getElementById('btn-clean-selected').disabled = selectedProjectPaths.size === 0;
}

function toggleCacheSelect(id, isChecked) {
  if (isChecked) selectedCacheIds.add(id);
  else selectedCacheIds.delete(id);
  renderCachesTable();
}

function toggleSelectAllCaches(checkbox) {
  const isChecked = checkbox.checked;
  selectedCacheIds.clear();
  if (isChecked) {
    for (const c of scannedCaches) {
      if (c.exists && c.size_bytes > 0) selectedCacheIds.add(c.id);
    }
  }
  renderCachesTable();
}

function cleanProjectDirect(projectName) {
  const project = scannedProjects.find(p => p.name === projectName);
  if (!project) return;
  selectedProjectPaths.clear();
  for (const a of project.artifacts) selectedProjectPaths.add(a.abs_path);
  updateSelectedProjectSize();
  openCleanModal('projects');
}

function cleanSingleCacheDirect(cacheId) {
  selectedCacheIds.clear();
  selectedCacheIds.add(cacheId);
  openCleanModal('caches');
}

function openCleanModal(mode) {
  currentModalMode = mode;
  const modal = document.getElementById('clean-modal');
  const list = document.getElementById('modal-target-list');
  const trashToggle = document.getElementById('modal-trash-toggle');
  list.innerHTML = '';

  let totalSize = 0;

  if (mode === 'projects') {
    trashToggle.style.display = 'block';
    for (const p of scannedProjects) {
      for (const a of p.artifacts) {
        if (selectedProjectPaths.has(a.abs_path)) {
          totalSize += a.size_bytes;
          const li = document.createElement('li');
          li.className = 'target-item';
          li.innerHTML = `<span>${a.rel_path}</span><span>${formatBytes(a.size_bytes)}</span>`;
          list.appendChild(li);
        }
      }
    }
    document.getElementById('modal-title').innerText = `Clean Selected Project Artifacts (${formatBytes(totalSize)})`;
  } else if (mode === 'all-caches') {
    trashToggle.style.display = 'none';
    for (const c of scannedCaches) {
      if (c.exists && c.size_bytes > 0) {
        totalSize += c.size_bytes;
        const li = document.createElement('li');
        li.className = 'target-item';
        li.innerHTML = `<span>${c.name}</span><span>${formatBytes(c.size_bytes)}</span>`;
        list.appendChild(li);
      }
    }
    document.getElementById('modal-title').innerText = `Purge All Package Caches (${formatBytes(totalSize)})`;
  } else {
    // Single or selected caches
    trashToggle.style.display = 'none';
    for (const c of scannedCaches) {
      if (selectedCacheIds.has(c.id)) {
        totalSize += c.size_bytes;
        const li = document.createElement('li');
        li.className = 'target-item';
        li.innerHTML = `<span>${c.name}</span><span>${formatBytes(c.size_bytes)}</span>`;
        list.appendChild(li);
      }
    }
    document.getElementById('modal-title').innerText = `Purge Selected Caches (${formatBytes(totalSize)})`;
  }

  modal.style.display = 'flex';
}

function closeModal() {
  document.getElementById('clean-modal').style.display = 'none';
}

async function executeClean() {
  const btn = document.getElementById('btn-confirm-delete');
  btn.disabled = true;
  btn.innerText = 'Cleaning...';

  try {
    if (currentModalMode === 'projects') {
      const targets = Array.from(selectedProjectPaths);
      const useTrash = document.getElementById('use-trash-checkbox').checked;
      await fetch('/api/clean', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targets,
          root: workspaceInfo ? workspaceInfo.workspace : undefined,
          use_trash: useTrash
        })
      });
      selectedProjectPaths.clear();
      await startProjectScan();
    } else {
      let cacheIds = [];
      if (currentModalMode === 'all-caches') {
        cacheIds = scannedCaches.filter(c => c.exists && c.size_bytes > 0).map(c => c.id);
      } else {
        cacheIds = Array.from(selectedCacheIds);
      }
      await fetch('/api/clean-caches', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cache_ids: cacheIds })
      });
      selectedCacheIds.clear();
      await loadCaches();
    }
    closeModal();
    await loadSystemInfo();
  } catch (err) {
    alert('Cleanup failed: ' + err.message);
  } finally {
    btn.disabled = false;
    btn.innerText = 'Clean Now';
  }
}

// Initial boot
refreshAll();
