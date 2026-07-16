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
      const detail = await response.text();
      throw new Error(detail || response.statusText);
    }
    return response.json() as Promise<T>;
  }

  login(login: string, password: string) {
    return this.request<{ access_token: string; user: ApiUser }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ login, password }),
    });
  }
}

export const api = new ApiClient();
