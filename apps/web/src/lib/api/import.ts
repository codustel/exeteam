import { ImportEntityType, ImportJobStatus } from '@exeteam/shared';

const BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
    ...init,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error(err.message ?? 'API error');
  }
  return res.json() as Promise<T>;
}

// ── File handling ─────────────────────────────────────────────

export interface UploadResult {
  fileUrl: string;
  fileName: string;
  headers: string[];
}

export async function uploadImportFile(file: File): Promise<UploadResult> {
  const form = new FormData();
  form.append('file', file);
  const res = await fetch(`${BASE}/import/upload`, {
    method: 'POST',
    credentials: 'include',
    body: form,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error(err.message ?? 'Upload failed');
  }
  return res.json() as Promise<UploadResult>;
}

export async function parseImportHeaders(fileUrl: string): Promise<string[]> {
  const result = await apiFetch<{ headers: string[] }>('/import/parse-headers', {
    method: 'POST',
    body: JSON.stringify({ fileUrl }),
  });
  return result.headers;
}

// ── Jobs ──────────────────────────────────────────────────────

export interface StartImportPayload {
  entityType: ImportEntityType;
  fileUrl: string;
  fileName: string;
  mappings: Record<string, string>;
  onDuplicate: 'skip' | 'update';
  templateId?: string;
}

export interface ImportJobDto {
  id: string;
  entityType: ImportEntityType;
  status: ImportJobStatus;
  totalRows: number;
  processedRows: number;
  errorRows: number;
  errors: { row: number; field: string; message: string }[] | null;
  fileUrl: string;
  fileName: string;
  mappings: Record<string, string>;
  onDuplicate: string;
  templateId: string | null;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
}

export async function startImport(payload: StartImportPayload): Promise<{ jobId: string }> {
  return apiFetch('/import/start', { method: 'POST', body: JSON.stringify(payload) });
}

export async function getImportJob(id: string): Promise<ImportJobDto> {
  return apiFetch(`/import/jobs/${id}`);
}

export interface ListImportJobsParams {
  page?: number;
  limit?: number;
  entityType?: ImportEntityType;
  status?: ImportJobStatus;
}

export interface PaginatedJobs {
  data: ImportJobDto[];
  total: number;
  page: number;
  limit: number;
  pages: number;
}

export async function listImportJobs(params: ListImportJobsParams = {}): Promise<PaginatedJobs> {
  const qs = new URLSearchParams();
  if (params.page) qs.set('page', String(params.page));
  if (params.limit) qs.set('limit', String(params.limit));
  if (params.entityType) qs.set('entityType', params.entityType);
  if (params.status) qs.set('status', params.status);
  return apiFetch(`/import/jobs?${qs.toString()}`);
}

// ── Templates ─────────────────────────────────────────────────

export interface ImportTemplateDto {
  id: string;
  name: string;
  entityType: ImportEntityType;
  mappings: Record<string, string>;
  createdById: string | null;
  createdAt: string;
  updatedAt: string;
}

export async function listImportTemplates(entityType?: ImportEntityType): Promise<ImportTemplateDto[]> {
  const qs = entityType ? `?entityType=${entityType}` : '';
  return apiFetch(`/import/templates${qs}`);
}

export async function saveImportTemplate(payload: {
  name: string;
  entityType: ImportEntityType;
  mappings: Record<string, string>;
}): Promise<ImportTemplateDto> {
  return apiFetch('/import/templates', { method: 'POST', body: JSON.stringify(payload) });
}

export async function deleteImportTemplate(id: string): Promise<{ success: boolean }> {
  return apiFetch(`/import/templates/${id}`, { method: 'DELETE' });
}
