export type ApiUser = {
  id: number;
  company_id: number;
  name: string;
  login: string;
  email?: string;
  is_superadmin: boolean;
  is_company_admin: boolean;
};

const API_BASE_URL = (() => {
  const envUrl = import.meta.env.VITE_API_BASE_URL;
  if (envUrl && !envUrl.includes('localhost') && !envUrl.includes('127.0.0.1')) {
    return envUrl;
  }
  const protocol = window.location.protocol;
  const hostname = window.location.hostname;
  const port = window.location.port;

  // Si estamos navegando por HTTPS (proxy reverso), hacemos la llamada por el mismo puerto seguro
  if (protocol === 'https:') {
    return `${protocol}//${hostname}${port ? ':' + port : ''}/api`;
  }
  return `http://${hostname}:8095/api`;
})();

export class ApiClient {
  token = localStorage.getItem('attendance_saas_token') ?? '';

  setToken(token: string) {
    this.token = token;
    localStorage.setItem('attendance_saas_token', token);
  }

  clearToken() {
    this.token = '';
    localStorage.removeItem('attendance_saas_token');
  }

  async request<T>(path: string, options: RequestInit = {}): Promise<T> {
    const headers = new Headers(options.headers);
    headers.set('Content-Type', 'application/json');
    if (this.token) headers.set('Authorization', `Bearer ${this.token}`);
    const response = await fetch(`${API_BASE_URL}${path}`, { ...options, headers });
    if (!response.ok) {
      let message = response.statusText;
      let detail: unknown;
      try {
        const body = await response.json();
        detail = body?.detail ?? body;
        if (body && typeof body === 'object') {
          if (typeof body.detail === 'string') {
            message = body.detail;
          } else if (body.detail && typeof body.detail === 'object' && 'message' in body.detail) {
            message = String((body.detail as { message: unknown }).message);
          } else if ('message' in body) {
            message = String(body.message);
          } else {
            message = JSON.stringify(body.detail ?? body);
          }
        }
      } catch {
        try {
          const text = await response.text();
          if (text) message = text;
        } catch {}
      }
      const error = new Error(message) as Error & { status?: number; detail?: unknown };
      error.status = response.status;
      error.detail = detail;
      throw error;
    }
    return response.json() as Promise<T>;
  }

  async download(path: string, filename: string) {
    const headers = new Headers();
    if (this.token) headers.set('Authorization', `Bearer ${this.token}`);
    const response = await fetch(`${API_BASE_URL}${path}`, { headers });
    if (!response.ok) {
      let message = response.statusText;
      try {
        const body = await response.json();
        if (typeof body?.detail === 'string') message = body.detail;
      } catch {
        /* ignore */
      }
      throw new Error(message || 'No se pudo descargar el archivo');
    }
    const blob = await response.blob();
    const href = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = href;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(href);
  }

  login(login: string, password: string) {
    return this.request<{ access_token: string; user: ApiUser }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ login, password }),
    });
  }
}

export const api = new ApiClient();
