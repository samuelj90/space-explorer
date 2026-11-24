export interface Artifact {
  name: string;
  rel_path: string;
  abs_path: string;
  category: string;
  desc: string;
  size_bytes: number;
}

export interface Project {
  type: 'project';
  name: string;
  abs_path: string;
  reclaimable_bytes: number;
  artifacts: Artifact[];
}

export interface Cache {
  id: string;
  name: string;
  category: string;
  desc: string;
  path: string;
  exists: boolean;
  size_bytes: number;
}

export interface Rule {
  name: string;
  category: string;
  desc: string;
  is_dir: boolean;
  safe_to_delete: boolean;
  is_custom: boolean;
}

export interface Rules {
  project_artifacts: Rule[];
  custom_rules_path: string;
}

export interface SystemInfo {
  workspace: string;
  disk: { total_bytes: number; used_bytes: number; free_bytes: number };
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  if (!response.ok) {
    if (response.headers.get('content-type')?.includes('application/json')) {
      const body = await response.json() as { error?: string };
      if (body.error) throw new Error(body.error);
    }
    throw new Error(`Server returned ${response.status}`);
  }
  return response.json() as Promise<T>;
}

export function getInfo() { return request<SystemInfo>('/api/info'); }
export async function getCaches() { return (await request<{ caches: Cache[] }>('/api/caches')).caches; }
export function getRules() { return request<Rules>('/api/rules'); }

export async function scanProjects(onProject: (project: Project) => void) {
  const response = await fetch('/api/scan');
  if (!response.ok) throw new Error(`Server returned ${response.status}`);
  if (!response.body) throw new Error('Scan response has no body');
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  function consume(line: string) {
    if (!line.trim()) return;
    const item = JSON.parse(line) as Project;
    if (item.type === 'project') onProject(item);
  }
  while (true) {
    const { done, value } = await reader.read();
    buffer += decoder.decode(value, { stream: !done });
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';
    lines.forEach(consume);
    if (done) break;
  }
  consume(buffer);
}

export async function clean(url: string, body: object) {
  const data = await request<{ results: { success: boolean; error?: string; path?: string; id?: string }[] }>(url, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
  });
  const failures = data.results.filter((result) => !result.success);
  if (failures.length) {
    throw new Error(failures.map((result) => `${result.path || result.id || 'Item'}: ${result.error || 'Cleanup failed'}`).join('\n'));
  }
}

export async function changeRule(body: object) {
  const data = await request<{ success: boolean; error?: string }>('/api/rules', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
  });
  if (!data.success) throw new Error(data.error || 'Could not update rule');
}

export function formatBytes(bytes: number) {
  if (bytes <= 0) return '0 B';
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), sizes.length - 1);
  return `${Number((bytes / 1024 ** index).toFixed(2))} ${sizes[index]}`;
}
