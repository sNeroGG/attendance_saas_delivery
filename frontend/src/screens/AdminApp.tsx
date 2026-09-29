import { FormEvent, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import {
  AlertTriangle,
  Building2,
  CalendarDays,
  CheckCircle2,
  ContactRound,
  ChevronDown,
  ChevronsLeft,
  ChevronsRight,
  ClipboardList,
  Clock,
  Download,
  KeyRound,
  LayoutDashboard,
  ListChecks,
  LogOut,
  MonitorSmartphone,
  PanelLeftOpen,
  Plus,
  RefreshCw,
  Settings2,
  Shield,
  ShieldCheck,
  UserRound,
  UserCheck,
  UserX,
  Users,
  UsersRound,
  X,
} from 'lucide-react';
import { ApiUser, api } from '../api/client';
import { SHIFT_LABEL, fmtLongDateSV, fmtDateSV, fmtSV, fmtTimeSV } from '../lib/time';

type SidebarMode = 'open' | 'mini' | 'closed';
const SIDEBAR_KEY = 'attendance.admin.sidebar';

function readSidebarMode(): SidebarMode {
  try {
    const value = localStorage.getItem(SIDEBAR_KEY);
    if (value === 'open' || value === 'mini' || value === 'closed') return value;
  } catch {
    /* ignore */
  }
  return 'open';
}

function persistSidebarMode(mode: SidebarMode) {
  try {
    localStorage.setItem(SIDEBAR_KEY, mode);
  } catch {
    /* ignore */
  }
}

type ScreenKey =
  | 'dashboard'
  | 'team'
  | 'reports'
  | 'employees'
  | 'schedules'
  | 'calendar'
  | 'tasks'
  | 'active'
  | 'users'
  | 'devices'
  | 'company'
  | 'pin'
  | 'security';

type TeamFocus = 'all' | 'present' | 'missing' | 'pending';
type NavigateTo = (key: ScreenKey, opts?: { teamFocus?: TeamFocus }) => void;

type DailyReport = {
  operational_day: { start: string; end: string; shift_window: string };
  summary: {
    total_employees: number;
    checked_in: number;
    missing_checkin: number;
    missing_checkout?: number;
    excused?: number;
    tasks_incomplete: number;
    compliant: number;
    non_compliant: number;
  };
  employees: DailyEmployee[];
  active_now?: ActiveNow[];
  pending_validation?: number;
};

type DailyEmployee = {
  employee_id: number;
  name: string;
  employee_code: string | null;
  job_title: string | null;
  checked_in: boolean;
  check_in_at: string | null;
  check_out_at: string | null;
  shift_state: string;
  tasks_assigned: number;
  tasks_completed: number;
  tasks_pending: number;
  pending_task_names: string[];
  compliant: boolean;
  issues: string[];
  schedule_label?: string | null;
  is_off?: boolean;
  late?: boolean;
  labels?: string[];
  excused?: boolean;
};

type ActiveNow = {
  employee_id: number;
  name: string;
  check_in_at: string;
  shift_id: number;
};

type Employee = {
  id: number;
  name: string;
  employee_code?: string;
  employee_type?: string;
  work_email?: string;
  mobile_phone?: string;
  job_title?: string;
  active?: boolean;
  is_active_for_work?: boolean;
  user_login?: string;
  user_pin?: string;
  role_id?: number | null;
  role_name?: string | null;
  notes?: string | null;
};

type TemplateTask = { id?: number; name: string; description?: string | null; sequence?: number };
type Template = { id: number; name: string; description?: string | null; active?: boolean; state?: string; tasks?: TemplateTask[] };
type Assignment = {
  id: number;
  employee_id: number;
  employee_name?: string;
  template_id: number;
  template_name?: string;
  assigned_at: string;
  required: boolean;
  blocks_check_out: boolean;
  state: string;
  tasks_total?: number;
  tasks_completed?: number;
  tasks?: Array<TemplateTask & { completed?: boolean }>;
};
type SystemUser = {
  id: number;
  name: string;
  login: string;
  email?: string;
  employee_id?: number | null;
  is_company_admin?: boolean;
  active?: boolean;
  pin_plain?: string | null;
};
type Device = {
  id: number;
  name: string;
  device_code: string;
  device_type?: string;
  active?: boolean;
  session_timeout?: number;
};
type Company = {
  id?: number;
  name: string;
  legal_name?: string | null;
  vat?: string | null;
  email?: string | null;
  phone?: string | null;
  street?: string | null;
  city?: string | null;
  timezone?: string | null;
  device_lock_enabled?: boolean;
};
type LedgerEntry = {
  at: string;
  kind: string;
  kind_label: string;
  title: string;
  detail: string;
  state?: string | null;
};
type Ledger = {
  employee: { id: number; name: string; employee_code?: string; job_title?: string } | null;
  entries: LedgerEntry[];
};

const NAV: { key: ScreenKey; label: string; icon: ReactNode; group: 'daily' | 'advanced' }[] = [
  { key: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard />, group: 'daily' },
  { key: 'team', label: 'Equipo de hoy', icon: <ContactRound />, group: 'daily' },
  { key: 'calendar', label: 'Calendario', icon: <CalendarDays />, group: 'daily' },
  { key: 'active', label: 'En jornada', icon: <Users />, group: 'daily' },
  { key: 'reports', label: 'Reportes del día', icon: <ClipboardList />, group: 'daily' },
  { key: 'tasks', label: 'Checklists', icon: <ListChecks />, group: 'daily' },
  { key: 'employees', label: 'Empleados', icon: <UsersRound />, group: 'advanced' },
  { key: 'users', label: 'Usuarios', icon: <UserRound />, group: 'advanced' },
  { key: 'schedules', label: 'Horarios', icon: <Clock />, group: 'advanced' },
  { key: 'devices', label: 'Dispositivos', icon: <MonitorSmartphone />, group: 'advanced' },
  { key: 'security', label: 'Seguridad', icon: <Shield />, group: 'advanced' },
  { key: 'pin', label: 'PIN gerente', icon: <ShieldCheck />, group: 'advanced' },
  { key: 'company', label: 'Empresa', icon: <Building2 />, group: 'advanced' },
];

function slugLogin(name: string) {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '.')
    .replace(/^\.|\.$/g, '') || 'usuario';
}

function nextCode(prefix: string, existing: string[]) {
  for (let index = 1; index < 1000; index += 1) {
    const code = `${prefix}-${String(index).padStart(3, '0')}`;
    if (!existing.includes(code)) return code;
  }
  return `${prefix}-${existing.length + 1}`;
}

function IconLabel({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <>
      {icon}
      <span className="btn-label">{children}</span>
    </>
  );
}

function assignmentStateLabel(state: string) {
  const labels: Record<string, string> = {
    pending: 'Pendiente',
    in_progress: 'En progreso',
    completed: 'Completado',
    validated: 'Validado',
    validation_pending: 'Por validar',
    rejected: 'Rechazado',
  };
  return labels[state] || state;
}

function Header({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <div className="topbar">
      <div>
        <h1>{title}</h1>
        {subtitle && <p className="subtle">{subtitle}</p>}
      </div>
      {actions ? <div className="header-actions">{actions}</div> : null}
    </div>
  );
}

function StatusPill({ ok, label }: { ok: boolean; label: string }) {
  return <span className={ok ? 'pill pill-ok' : 'pill pill-warn'}>{label}</span>;
}

function Modal({ title, onClose, children, wide }: { title: string; onClose: () => void; children: ReactNode; wide?: boolean }) {
  return (
    <div className="modal-backdrop" onClick={onClose} role="presentation">
      <div className={wide ? 'modal modal-wide' : 'modal'} onClick={(event) => event.stopPropagation()} role="dialog" aria-modal="true">
        <div className="modal-header">
          <strong>{title}</strong>
          <button className="icon-btn" type="button" onClick={onClose} aria-label="Cerrar">
            <X size={16} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function FormSection({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <fieldset className="form-section">
      <legend>{title}</legend>
      {hint ? <p className="field-help">{hint}</p> : null}
      <div className="form-section-body">{children}</div>
    </fieldset>
  );
}

function FormModal({
  title,
  onClose,
  onSubmit,
  submitLabel,
  hint,
  error,
  wide,
  children,
}: {
  title: string;
  onClose: () => void;
  onSubmit: (event: FormEvent) => void;
  submitLabel: string;
  hint?: string;
  error?: string;
  wide?: boolean;
  children: ReactNode;
}) {
  return (
    <Modal title={title} onClose={onClose} wide={wide}>
      <form className="modal-form" onSubmit={onSubmit}>
        {error && <div className="error">{error}</div>}
        {children}
        {hint && <p className="hint">{hint}</p>}
        <div className="modal-actions">
          <button className="ghost" type="button" onClick={onClose}>Cancelar</button>
          <button className="primary" type="submit">{submitLabel}</button>
        </div>
      </form>
    </Modal>
  );
}

function LedgerView({ ledger, loading }: { ledger: Ledger | null; loading: boolean }) {
  if (loading) return <p className="subtle">Cargando bitácora...</p>;
  if (!ledger?.employee) return <p className="subtle">Sin bitácora disponible.</p>;
  return (
    <div className="ledger">
      <div className="ledger-head">
        <strong>{ledger.employee.name}</strong>
        <span>{ledger.employee.employee_code || 'Sin código'} · {ledger.employee.job_title || 'Colaborador'}</span>
      </div>
      {ledger.entries.length === 0 && <p className="subtle">Aún no hay movimientos registrados.</p>}
      <ol className="ledger-list">
        {ledger.entries.map((entry, index) => (
          <li key={`${entry.at}-${index}`} className={entry.kind === 'task_answer' ? 'ledger-item done' : 'ledger-item'}>
            <span className="ledger-kind">{entry.kind_label}</span>
            <div>
              <strong>{entry.title}</strong>
              <p>{entry.detail}</p>
            </div>
            <time>{fmtSV(entry.at)}</time>
          </li>
        ))}
      </ol>
    </div>
  );
}

const ADVANCED_KEY = 'attendance.admin.advanced';

function readAdvancedOpen(): boolean {
  try {
    return localStorage.getItem(ADVANCED_KEY) === '1';
  } catch {
    return false;
  }
}

function persistAdvancedOpen(open: boolean) {
  try {
    localStorage.setItem(ADVANCED_KEY, open ? '1' : '0');
  } catch {
    /* ignore */
  }
}

function shiftProgress(startIso?: string, endIso?: string, now = new Date()) {
  if (!startIso || !endIso) return null;
  const start = new Date(startIso).getTime();
  const end = new Date(endIso).getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return null;
  const ratio = (now.getTime() - start) / (end - start);
  return {
    pct: Math.min(100, Math.max(0, ratio * 100)),
    upcoming: now.getTime() < start,
    ongoing: now.getTime() >= start && now.getTime() <= end,
    ended: now.getTime() > end,
  };
}

function ComplianceRing({ pct, label }: { pct: number; label: string }) {
  const radius = 34;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (Math.min(100, Math.max(0, pct)) / 100) * circumference;
  return (
    <div className="dash-ring" aria-hidden>
      <svg viewBox="0 0 80 80">
        <circle cx="40" cy="40" r={radius} />
        <circle cx="40" cy="40" r={radius} strokeDasharray={circumference} strokeDashoffset={offset} />
      </svg>
      <strong>{label}</strong>
    </div>
  );
}

function employeeStatus(item: DailyEmployee, present: ActiveNow[]) {
  if (item.is_off) return { label: 'Día libre', tone: 'muted' as const };
  if (item.excused) return { label: 'Con permiso', tone: 'muted' as const };
  if (item.check_out_at) return { label: 'Ya salió', tone: 'ok' as const };
  if (present.some((row) => row.employee_id === item.employee_id) || item.checked_in) {
    return { label: item.late ? 'En turno · tarde' : 'En turno', tone: item.late ? 'warn' as const : 'ok' as const };
  }
  return { label: 'No ha llegado', tone: 'warn' as const };
}

function DashboardScreen({ onNavigate }: { onNavigate: NavigateTo }) {
  const [data, setData] = useState<DailyReport | null>(null);
  const [error, setError] = useState('');
  const [now, setNow] = useState(() => new Date());

  async function load() {
    setError('');
    try {
      setData(await api.request<DailyReport>('/reports/dashboard'));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo cargar el dashboard');
    }
  }

  useEffect(() => { load(); }, []);
  useEffect(() => {
    const tick = window.setInterval(() => setNow(new Date()), 1000);
    const refresh = window.setInterval(load, 30000);
    return () => {
      window.clearInterval(tick);
      window.clearInterval(refresh);
    };
  }, []);

  const summary = data?.summary;
  const employees = data?.employees || [];
  const present = data?.active_now || [];
  const working = employees.filter((item) => !item.is_off);
  const missing = working.filter((item) => !item.checked_in && !item.excused);
  const pending = working.filter((item) => !item.compliant);
  const left = working.filter((item) => Boolean(item.check_out_at));
  const progress = shiftProgress(data?.operational_day.start, data?.operational_day.end, now);
  const total = summary?.total_employees || working.length;
  const compliant = summary?.compliant ?? 0;
  const compliancePct = total ? Math.round((compliant / total) * 100) : 0;
  const evaluatedDate = fmtLongDateSV(data?.operational_day.start);
  const closesOn = fmtDateSV(data?.operational_day.end);
  const shiftStart = fmtTimeSV(data?.operational_day.start);
  const shiftEnd = fmtTimeSV(data?.operational_day.end);
  const clock = now.toLocaleTimeString('es-SV', { hour: '2-digit', minute: '2-digit', hour12: true });
  const statusLabel = progress?.upcoming ? 'Aún no inicia' : progress?.ended ? 'Jornada cerrada' : progress?.ongoing ? 'En curso' : 'Jornada';

  let headline = 'Cargando la jornada…';
  let tone: 'ok' | 'warn' | 'danger' | 'muted' = 'muted';
  if (data) {
    if (progress?.upcoming) {
      headline = 'La jornada todavía no empieza';
      tone = 'muted';
    } else if (progress?.ended) {
      headline = missing.length || pending.length ? 'La jornada cerró con pendientes' : 'Jornada cerrada';
      tone = pending.length || missing.length ? 'warn' : 'ok';
    } else if (missing.length) {
      headline = `Faltan ${missing.length} por marcar entrada`;
      tone = 'warn';
    } else if (pending.length) {
      headline = `${pending.length} con checklist o salida pendiente`;
      tone = 'warn';
    } else if (present.length) {
      headline = 'Todo en orden en este momento';
      tone = 'ok';
    } else {
      headline = 'Nadie ha marcado entrada todavía';
      tone = 'muted';
    }
  }

  return (
    <div className="dashboard-page">
      <Header
        title="Hoy"
        subtitle={data ? `${evaluatedDate} · jornada ${data.operational_day.shift_window || SHIFT_LABEL}` : 'Cargando fecha de la jornada'}
        actions={<button className="ghost" type="button" onClick={load}><IconLabel icon={<RefreshCw size={16} />}>Actualizar</IconLabel></button>}
      />
      {error && <div className="error">{error}</div>}

      <section className={`dash-hero tone-${tone}`}>
        <ComplianceRing pct={compliancePct} label={total ? `${compliancePct}%` : '—'} />
        <div className="dash-hero-copy">
          <div className="dash-hero-meta">
            <div>
              <p className="dash-kicker">Fecha evaluada</p>
              <p className="dash-date">{data ? evaluatedDate : '—'}</p>
            </div>
            <span className={`dash-status tone-${tone}`}>{statusLabel}</span>
          </div>
          <h2>{headline}</h2>
          <p>
            {compliant} de {total || 0} cumplen check-in y checklist.
            {present.length ? ` ${present.length} en turno ahora.` : ''}
          </p>
          <div className="dash-shift">
            <span>{shiftStart === '—' ? '11:00' : shiftStart}</span>
            <div className="dash-track" title={`${Math.round(progress?.pct || 0)}% de la jornada`}>
              <i style={{ width: `${progress?.pct || 0}%` }} />
            </div>
            <span>{shiftEnd === '—' ? '03:00' : shiftEnd}</span>
          </div>
          <p className="dash-shift-note">
            Cierra el {closesOn === '—' ? '—' : closesOn} · hora actual {clock}
          </p>
          <div className="dash-actions">
            <button className="primary" type="button" onClick={() => onNavigate('team')}>
              <IconLabel icon={<ContactRound size={16} />}>Equipo de hoy</IconLabel>
            </button>
            <button className="ghost" type="button" onClick={() => onNavigate('calendar')}>
              <IconLabel icon={<CalendarDays size={16} />}>Ver calendario</IconLabel>
            </button>
            <button className="ghost" type="button" onClick={() => onNavigate('reports')}>
              <IconLabel icon={<ClipboardList size={16} />}>Reportes</IconLabel>
            </button>
            <button className="ghost" type="button" onClick={() => window.open('/', '_blank')}>
              <IconLabel icon={<KeyRound size={16} />}>Abrir kiosko</IconLabel>
            </button>
          </div>
        </div>
      </section>

      <section className="dashboard-summary">
      <div className="dashboard-section-heading">
        <div>
          <span className="dashboard-eyebrow">Seguimiento en tiempo real</span>
          <h2>Resumen de hoy</h2>
        </div>
        <span className="dashboard-updated"><i /> Actualización automática cada 30 s</span>
      </div>
      <div className="metric-grid">
        <button className={`metric-card ${present.length ? 'ok' : 'muted'}`} type="button" onClick={() => onNavigate('team', { teamFocus: 'present' })}>
          <span><UserCheck size={16} /> Presentes ahora</span>
          <strong>{present.length}</strong>
          <em className="metric-hint">Quién ya marcó entrada y sigue en turno</em>
          <div className="metric-track"><i style={{ width: `${total ? (present.length / total) * 100 : 0}%` }} /></div>
        </button>
        <button className={`metric-card ${missing.length ? 'warn' : 'ok'}`} type="button" onClick={() => onNavigate('team', { teamFocus: 'missing' })}>
          <span><UserX size={16} /> Sin check-in</span>
          <strong>{summary?.missing_checkin ?? missing.length}</strong>
          <em className="metric-hint">Gente que debía llegar y aún no marca</em>
          <div className="metric-track warn"><i style={{ width: `${total ? (missing.length / total) * 100 : 0}%` }} /></div>
        </button>
        <button className={`metric-card ${(summary?.missing_checkout || 0) ? 'danger' : 'muted'}`} type="button" onClick={() => onNavigate('calendar')}>
          <span><AlertTriangle size={16} /> No marcó salida</span>
          <strong>{summary?.missing_checkout ?? 0}</strong>
          <em className="metric-hint">Entraron y no han cerrado jornada</em>
        </button>
        <button className={`metric-card ${(summary?.tasks_incomplete || 0) ? 'warn' : 'ok'}`} type="button" onClick={() => onNavigate('tasks')}>
          <span><ListChecks size={16} /> Checklists pendientes</span>
          <strong>{summary?.tasks_incomplete ?? 0}</strong>
          <em className="metric-hint">Casillas del kiosko que faltan por marcar</em>
        </button>
        <button className={`metric-card ${compliancePct >= 80 ? 'ok' : compliancePct >= 40 ? 'warn' : 'danger'}`} type="button" onClick={() => onNavigate('reports')}>
          <span><CheckCircle2 size={16} /> Cumplimiento</span>
          <strong>{summary ? `${compliant}/${total}` : '—'}</strong>
          <em className="metric-hint">{left.length} ya salieron · {working.length} programados hoy</em>
          <div className="metric-track"><i style={{ width: `${compliancePct}%` }} /></div>
        </button>
      </div>
      </section>

      <div className="split">
        <section className="panel">
          <div className="panel-header">
            <div>
              <strong>En turno ahora</strong>
              <p className="hint">Toca a alguien para ver el calendario del día</p>
            </div>
            <button className="ghost" type="button" onClick={() => onNavigate('active')}>Ver lista</button>
          </div>
          <div className="stack">
            {present.map((item) => (
              <button className="row-card action" type="button" key={item.shift_id} onClick={() => onNavigate('calendar')}>
                <div>
                  <strong>{item.name}</strong>
                  <span>Entrada {fmtTimeSV(item.check_in_at)}</span>
                </div>
                <StatusPill ok label="En turno" />
              </button>
            ))}
            {!present.length && (
              <div className="empty-action">
                <p className="empty">Nadie ha hecho check-in en esta jornada.</p>
                <button className="ghost" type="button" onClick={() => onNavigate('calendar')}>Revisar calendario</button>
              </div>
            )}
          </div>
        </section>
        <section className="panel">
          <div className="panel-header">
            <div>
              <strong>Necesitan atención</strong>
              <p className="hint">Faltantes, retrasos o checklist incompleto</p>
            </div>
            <button className="ghost" type="button" onClick={() => onNavigate('reports')}>Ver reportes</button>
          </div>
          <div className="stack">
            {pending.slice(0, 8).map((item) => (
              <button className="row-card action" type="button" key={item.employee_id} onClick={() => onNavigate(item.checked_in ? 'tasks' : 'calendar')}>
                <div>
                  <strong>{item.name}</strong>
                  <span>{item.issues.join(' · ') || 'Pendiente de cumplimiento'}</span>
                </div>
                <StatusPill ok={false} label={item.checked_in ? 'Incompleto' : 'No llegó'} />
              </button>
            ))}
            {data && pending.length === 0 && <p className="empty">Nadie requiere atención ahora.</p>}
          </div>
        </section>
      </div>
    </div>
  );
}

function TeamScreen({ initialFocus, onNavigate }: { initialFocus: TeamFocus; onNavigate: NavigateTo }) {
  const [data, setData] = useState<DailyReport | null>(null);
  const [error, setError] = useState('');
  const [focus, setFocus] = useState<TeamFocus>(initialFocus);

  async function load() {
    setError('');
    try {
      setData(await api.request<DailyReport>('/reports/dashboard'));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo cargar el equipo');
    }
  }

  useEffect(() => { load(); }, []);
  useEffect(() => { setFocus(initialFocus); }, [initialFocus]);
  useEffect(() => {
    const refresh = window.setInterval(load, 30000);
    return () => window.clearInterval(refresh);
  }, []);

  const employees = data?.employees || [];
  const present = data?.active_now || [];
  const working = employees.filter((item) => !item.is_off);
  const missing = working.filter((item) => !item.checked_in && !item.excused);
  const pending = working.filter((item) => !item.compliant);
  const teamDate = data ? fmtDateSV(data.operational_day.start) : 'día';
  const roster = employees.filter((item) => {
    if (focus === 'present') return present.some((row) => row.employee_id === item.employee_id);
    if (focus === 'missing') return missing.some((row) => row.employee_id === item.employee_id);
    if (focus === 'pending') return pending.some((row) => row.employee_id === item.employee_id);
    return true;
  });

  return (
    <>
      <Header
        title={`Equipo del ${teamDate}`}
        subtitle={data ? `${fmtLongDateSV(data.operational_day.start)}. Quién está programado, en turno o falta en esta jornada.` : 'Cargando el equipo de la jornada'}
        actions={<button className="ghost" type="button" onClick={load}><IconLabel icon={<RefreshCw size={16} />}>Actualizar</IconLabel></button>}
      />
      {error && <div className="error">{error}</div>}

      <div className="dash-filters" role="tablist" aria-label="Filtrar equipo">
        <button className={focus === 'all' ? 'chip active' : 'chip'} type="button" onClick={() => setFocus('all')}>Todos ({employees.length})</button>
        <button className={focus === 'present' ? 'chip active' : 'chip'} type="button" onClick={() => setFocus('present')}>En turno ({present.length})</button>
        <button className={focus === 'missing' ? 'chip active' : 'chip'} type="button" onClick={() => setFocus('missing')}>Faltan ({missing.length})</button>
        <button className={focus === 'pending' ? 'chip active' : 'chip'} type="button" onClick={() => setFocus('pending')}>Pendientes ({pending.length})</button>
      </div>

      <section className="panel">
        <div className="panel-header">
          <div>
            <strong>Equipo del {teamDate}</strong>
            <p className="hint">Toca a alguien para abrir el calendario del día</p>
          </div>
          <span className="subtle">{roster.length} en esta vista</span>
        </div>
        <div className="stack">
          {roster.map((item) => {
            const status = employeeStatus(item, present);
            return (
              <button className="row-card action" type="button" key={item.employee_id} onClick={() => onNavigate('calendar')}>
                <div>
                  <strong>{item.name}</strong>
                  <span>{item.job_title || 'Colaborador'}{item.check_in_at ? ` · entrada ${fmtTimeSV(item.check_in_at)}` : ''}</span>
                </div>
                <span className={`pill pill-${status.tone === 'ok' ? 'ok' : status.tone === 'warn' ? 'warn' : 'muted'}`}>{status.label}</span>
              </button>
            );
          })}
          {!data && <p className="empty">Cargando el equipo…</p>}
          {data && !roster.length && <p className="empty">No hay personas en este filtro.</p>}
        </div>
      </section>
    </>
  );
}

function ReportsScreen() {
  const [data, setData] = useState<DailyReport | null>(null);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [employeeId, setEmployeeId] = useState('');
  const [error, setError] = useState('');

  async function load(filterId = employeeId) {
    setError('');
    try {
      const query = filterId ? `?employee_id=${filterId}` : '';
      const [report, people] = await Promise.all([
        api.request<DailyReport>(`/reports/daily${query}`),
        api.request<Employee[]>('/employees'),
      ]);
      setData(report);
      setEmployees(people);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo cargar el reporte');
    }
  }

  useEffect(() => { load(''); }, []);

  const people = data?.employees || [];
  return (
    <>
      <Header
        title="Reportes del día"
        subtitle={`Horario ${data?.operational_day.shift_window || SHIFT_LABEL}. Check-in y checklists del día.`}
        actions={<button className="ghost" type="button" onClick={() => load()}><IconLabel icon={<RefreshCw size={16} />}>Actualizar</IconLabel></button>}
      />
      {error && <div className="error">{error}</div>}
      <section className="panel">
        <div className="panel-header">
          <label className="inline-field">
            <span>Filtrar por empleado</span>
            <select
              value={employeeId}
              onChange={(event) => {
                const value = event.target.value;
                setEmployeeId(value);
                load(value);
              }}
            >
              <option value="">Todos</option>
              {employees.map((item) => (
                <option key={item.id} value={item.id}>{item.name}</option>
              ))}
            </select>
          </label>
          <div className="summary-inline">
            <span>{data?.summary.checked_in ?? 0} con check-in</span>
            <span>{data?.summary.missing_checkin ?? 0} ausentes</span>
            <span>{data?.summary.compliant ?? 0} en cumplimiento</span>
          </div>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Empleado</th>
                <th>Horario</th>
                <th>Check-in</th>
                <th>Check-out</th>
                <th>Checklist</th>
                <th>Estado</th>
              </tr>
            </thead>
            <tbody>
              {people.map((item) => (
                <tr key={item.employee_id}>
                  <td>
                    <strong>{item.name}</strong>
                    <div className="cell-sub">{item.employee_code || 'Sin código'}</div>
                  </td>
                  <td>{item.is_off ? 'Día libre' : (item.schedule_label || '—')}</td>
                  <td>{item.checked_in ? fmtTimeSV(item.check_in_at) : 'Sin check-in'}</td>
                  <td>{item.check_out_at ? fmtTimeSV(item.check_out_at) : item.checked_in ? 'En turno' : '—'}</td>
                  <td>
                    {item.tasks_completed}/{item.tasks_assigned || 0}
                    {item.pending_task_names.length > 0 && (
                      <div className="cell-sub">{item.pending_task_names.join(', ')}</div>
                    )}
                  </td>
                  <td>
                    <StatusPill ok={item.compliant} label={item.compliant ? 'Cumple' : item.issues.join(' · ')} />
                  </td>
                </tr>
              ))}
              {!people.length && <tr><td colSpan={6}>Sin empleados activos para esta jornada.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}

function EmployeesScreen() {
  const emptyForm = {
    name: '',
    job_title: '',
    employee_code: '',
    user_login: '',
    user_password: '',
    user_pin: '',
    mobile_phone: '',
    work_email: '',
    notes: '',
    role_id: '',
    task_template_ids: [] as number[],
  };
  const [items, setItems] = useState<Employee[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [roles, setRoles] = useState<{ id: number; name: string }[]>([]);
  const [editing, setEditing] = useState<Employee | null>(null);
  const [creating, setCreating] = useState(false);
  const [ledgerOpen, setLedgerOpen] = useState(false);
  const [ledger, setLedger] = useState<Ledger | null>(null);
  const [ledgerLoading, setLedgerLoading] = useState(false);
  const [error, setError] = useState('');
  const [formError, setFormError] = useState('');
  const [form, setForm] = useState(emptyForm);

  async function load() {
    setError('');
    try {
      const [employees, tpls, roleRows] = await Promise.all([
        api.request<Employee[]>('/employees'),
        api.request<Template[]>('/assignment-templates'),
        api.request<{ id: number; name: string }[]>('/roles'),
      ]);
      setItems(employees);
      setTemplates(tpls.filter((item) => item.active !== false));
      setRoles(roleRows);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo cargar empleados');
    }
  }

  useEffect(() => { load(); }, []);

  function openCreate() {
    setEditing(null);
    setForm(emptyForm);
    setFormError('');
    setCreating(true);
  }

  function openEdit(item: Employee) {
    setCreating(false);
    setEditing(item);
    setForm({
      name: item.name,
      job_title: item.job_title || '',
      employee_code: item.employee_code || '',
      user_login: item.user_login || '',
      user_password: '',
      user_pin: item.user_pin || '',
      mobile_phone: item.mobile_phone || '',
      work_email: item.work_email || '',
      notes: item.notes || '',
      role_id: item.role_id ? String(item.role_id) : '',
      task_template_ids: [],
    });
    setFormError('');
  }

  function closeForm() {
    setCreating(false);
    setEditing(null);
    setFormError('');
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setFormError('');
    try {
      const payload = {
        name: form.name.trim(),
        job_title: form.job_title.trim() || null,
        employee_code: form.employee_code.trim() || null,
        user_login: form.user_login.trim() || slugLogin(form.name),
        user_password: form.user_password.trim() || null,
        user_pin: form.user_pin.trim() || null,
        mobile_phone: form.mobile_phone.trim() || null,
        work_email: form.work_email.trim() || null,
        notes: form.notes.trim() || null,
        role_id: form.role_id ? Number(form.role_id) : null,
        create_user_profile: true,
      };
      if (editing) {
        await api.request(`/employees/${editing.id}`, {
          method: 'PUT',
          body: JSON.stringify(payload),
        });
        if (form.task_template_ids.length) {
          await Promise.all(form.task_template_ids.map((templateId) => api.request('/employee-assignments', {
            method: 'POST',
            body: JSON.stringify({
              employee_id: editing.id,
              template_id: templateId,
              required: true,
              blocks_check_out: true,
              state: 'pending',
            }),
          })));
        }
      } else {
        if (!form.user_pin.trim() || form.user_pin.trim().length < 4) {
          setFormError('El PIN de kiosko es obligatorio (4 a 12 dígitos).');
          return;
        }
        if (!form.user_password.trim() || form.user_password.trim().length < 6) {
          setFormError('La contraseña del usuario se crea junto al empleado (mínimo 6 caracteres).');
          return;
        }
        await api.request('/employees', {
          method: 'POST',
          body: JSON.stringify({
            ...payload,
            task_template_ids: form.task_template_ids,
          }),
        });
      }
      closeForm();
      await load();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'No se pudo guardar el empleado');
    }
  }

  async function openLedger(employeeId: number) {
    setLedgerOpen(true);
    setLedgerLoading(true);
    try {
      setLedger(await api.request<Ledger>(`/employees/${employeeId}/ledger`));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo cargar la bitácora');
    } finally {
      setLedgerLoading(false);
    }
  }

  function toggleTask(id: number) {
    setForm((current) => ({
      ...current,
      task_template_ids: current.task_template_ids.includes(id)
        ? current.task_template_ids.filter((item) => item !== id)
        : [...current.task_template_ids, id],
    }));
  }

  const formOpen = creating || editing !== null;

  return (
    <>
      <Header
        title="Empleados"
        subtitle="Al crear un colaborador se genera automáticamente su usuario de acceso, PIN de kiosko y ficha operativa."
        actions={
          <button className="primary" type="button" onClick={openCreate}>
            <IconLabel icon={<Plus size={16} />}>Crear empleado</IconLabel>
          </button>
        }
      />
      {error && <div className="error">{error}</div>}
      <section className="panel">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Código</th>
                <th>Usuario</th>
                <th>Puesto</th>
                <th>PIN</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id} className="click-row" onClick={() => openEdit(item)}>
                  <td><strong>{item.name}</strong></td>
                  <td>{item.employee_code || '—'}</td>
                  <td>{item.user_login || '—'}</td>
                  <td>{item.job_title || 'Colaborador'}</td>
                  <td>{item.user_pin || '—'}</td>
                  <td>
                    <div className="table-actions">
                      <button className="ghost" type="button" onClick={(event) => { event.stopPropagation(); openEdit(item); }}>Editar</button>
                      <button className="ghost" type="button" onClick={(event) => { event.stopPropagation(); openLedger(item.id); }}>Bitácora</button>
                    </div>
                  </td>
                </tr>
              ))}
              {!items.length && <tr><td colSpan={6}>No hay empleados. Crea el primero con el botón superior.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>

      {formOpen && (
        <FormModal
          title={editing ? 'Editar empleado' : 'Nuevo empleado'}
          onClose={closeForm}
          onSubmit={submit}
          submitLabel={editing ? 'Guardar cambios' : 'Crear empleado y usuario'}
          hint={editing ? 'Si dejas la contraseña vacía no se cambia. El horario se asigna en Horarios.' : 'Se crea la ficha, el usuario de acceso y, si eliges checklists, se le asignan al kiosko.'}
          error={formError}
          wide
        >
          <FormSection title="Datos del colaborador" hint="Nombre, puesto y contacto que usa el sistema en reportes y kiosko.">
            <div className="form-grid">
              <label className="field">
                <span>Nombre completo</span>
                <input
                  value={form.name}
                  onChange={(event) => {
                    const name = event.target.value;
                    setForm((current) => ({
                      ...current,
                      name,
                      user_login: creating && (!current.user_login || current.user_login === slugLogin(current.name))
                        ? slugLogin(name)
                        : current.user_login,
                    }));
                  }}
                  required
                  placeholder="Nombre y apellido"
                />
              </label>
              <label className="field">
                <span>Puesto</span>
                <input value={form.job_title} onChange={(event) => setForm({ ...form, job_title: event.target.value })} placeholder="Ej. Cajero, Mesero" />
              </label>
              <label className="field">
                <span>Código de empleado</span>
                <input value={form.employee_code} onChange={(event) => setForm({ ...form, employee_code: event.target.value })} placeholder="Se genera solo si lo dejas vacío (EMP-001)" />
              </label>
              <label className="field">
                <span>Rol operativo</span>
                <select value={form.role_id} onChange={(event) => setForm({ ...form, role_id: event.target.value })}>
                  <option value="">Sin rol (usa horario predeterminado)</option>
                  {roles.map((role) => (
                    <option key={role.id} value={role.id}>{role.name}</option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span>Teléfono</span>
                <input value={form.mobile_phone} onChange={(event) => setForm({ ...form, mobile_phone: event.target.value })} placeholder="Opcional" />
              </label>
              <label className="field">
                <span>Email de trabajo</span>
                <input type="email" value={form.work_email} onChange={(event) => setForm({ ...form, work_email: event.target.value })} placeholder="Opcional" />
              </label>
            </div>
            <label className="field">
              <span>Notas internas</span>
              <textarea value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} rows={2} placeholder="Turno, sucursal o indicaciones para supervisión" />
            </label>
          </FormSection>
          <FormSection title="Usuario de acceso (se crea automáticamente)" hint="Con este usuario entra al panel si tiene permiso, y con el PIN marca asistencia en el kiosko.">
            <div className="form-grid">
              <label className="field">
                <span>Usuario de login</span>
                <input value={form.user_login} onChange={(event) => setForm({ ...form, user_login: event.target.value })} placeholder="Se sugiere desde el nombre" />
              </label>
              <label className="field">
                <span>{editing ? 'Nueva contraseña' : 'Contraseña'}</span>
                <input
                  type="password"
                  value={form.user_password}
                  onChange={(event) => setForm({ ...form, user_password: event.target.value })}
                  required={!editing}
                  minLength={editing ? undefined : 6}
                  placeholder={editing ? 'Dejar vacía para no cambiar' : 'Mínimo 6 caracteres'}
                />
              </label>
              <label className="field">
                <span>PIN de kiosko</span>
                <input
                  value={form.user_pin}
                  onChange={(event) => setForm({ ...form, user_pin: event.target.value.replace(/\D/g, '') })}
                  required={!editing}
                  minLength={editing ? undefined : 4}
                  maxLength={12}
                  inputMode="numeric"
                  placeholder="4 a 12 dígitos"
                />
              </label>
            </div>
          </FormSection>
          <FormSection title="Checklists del kiosko" hint="El empleado verá cada ítem como una casilla. Al marcarla queda registrado en su bitácora.">
            <div className="check-list">
              {templates.map((template) => (
                <label key={template.id}>
                  <input
                    type="checkbox"
                    checked={form.task_template_ids.includes(template.id)}
                    onChange={() => toggleTask(template.id)}
                  />
                  <span>
                    <strong>{template.name}</strong>
                    {template.tasks?.length ? <small> · {template.tasks.length} ítems</small> : null}
                  </span>
                </label>
              ))}
              {!templates.length && <p className="subtle">Aún no hay checklists. Créalos en la pantalla Checklists.</p>}
            </div>
          </FormSection>
        </FormModal>
      )}

      {ledgerOpen && (
        <Modal title="Bitácora" onClose={() => setLedgerOpen(false)}>
          <LedgerView ledger={ledger} loading={ledgerLoading} />
        </Modal>
      )}
    </>
  );
}

function TasksScreen() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [assignOpen, setAssignOpen] = useState(false);
  const [templateOpen, setTemplateOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<Template | null>(null);
  const [employeeId, setEmployeeId] = useState('');
  const [templateId, setTemplateId] = useState('');
  const [templateForm, setTemplateForm] = useState({ name: '', description: '', tasks: [{ name: '', description: '' }] });
  const [error, setError] = useState('');
  const [formError, setFormError] = useState('');

  async function load() {
    setError('');
    try {
      const [emps, tpls, assigns] = await Promise.all([
        api.request<Employee[]>('/employees'),
        api.request<Template[]>('/assignment-templates'),
        api.request<Assignment[]>('/employee-assignments'),
      ]);
      setEmployees(emps);
      setTemplates(tpls.filter((item) => item.active !== false));
      setAssignments(assigns);
      if (emps[0]) setEmployeeId(String(emps[0].id));
      if (tpls[0]) setTemplateId(String(tpls[0].id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudieron cargar las tareas');
    }
  }

  useEffect(() => { load(); }, []);

  function openAssign() {
    setFormError('');
    setAssignOpen(true);
  }

  function openCreateTemplate() {
    setEditingTemplate(null);
    setTemplateForm({ name: '', description: '', tasks: [{ name: '', description: '' }] });
    setFormError('');
    setTemplateOpen(true);
  }

  async function openEditTemplate(item: Template) {
    setEditingTemplate(item);
    setFormError('');
    setTemplateOpen(true);
    const tasks = (item.tasks && item.tasks.length)
      ? item.tasks.map((task) => ({ name: task.name, description: task.description || '' }))
      : [{ name: '', description: '' }];
    setTemplateForm({ name: item.name, description: item.description || '', tasks });
    try {
      const detail = await api.request<Template>(`/assignment-templates/${item.id}`);
      const loaded = (detail.tasks && detail.tasks.length)
        ? detail.tasks.map((task) => ({ name: task.name, description: task.description || '' }))
        : tasks;
      setTemplateForm({ name: detail.name, description: detail.description || '', tasks: loaded });
    } catch {
      setTemplateForm({ name: item.name, description: item.description || '', tasks });
    }
  }

  async function assign(event: FormEvent) {
    event.preventDefault();
    if (!employeeId || !templateId) return;
    setFormError('');
    try {
      await api.request('/employee-assignments', {
        method: 'POST',
        body: JSON.stringify({
          employee_id: Number(employeeId),
          template_id: Number(templateId),
          required: true,
          blocks_check_out: true,
          state: 'pending',
        }),
      });
      setAssignOpen(false);
      await load();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'No se pudo asignar la tarea');
    }
  }

  async function saveTemplate(event: FormEvent) {
    event.preventDefault();
    setFormError('');
    try {
      const payload = {
        name: templateForm.name.trim(),
        description: templateForm.description.trim() || null,
        state: 'active',
        active: true,
        tasks: templateForm.tasks
          .map((task) => ({ name: task.name.trim(), description: task.description.trim() || null }))
          .filter((task) => task.name),
      };
      if (!payload.tasks.length) {
        setFormError('Agrega al menos un ítem que el empleado pueda marcar');
        return;
      }
      if (editingTemplate) {
        await api.request(`/assignment-templates/${editingTemplate.id}`, { method: 'PUT', body: JSON.stringify(payload) });
      } else {
        await api.request('/assignment-templates', { method: 'POST', body: JSON.stringify(payload) });
      }
      setTemplateOpen(false);
      setEditingTemplate(null);
      await load();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'No se pudo guardar la plantilla');
    }
  }

  return (
    <>
      <Header
        title="Checklists"
        subtitle="El empleado ve cada ítem como una casilla en el kiosko. Al marcarla, queda en su bitácora."
        actions={
          <>
            <button className="ghost" type="button" onClick={openCreateTemplate}><IconLabel icon={<Plus size={16} />}>Nuevo checklist</IconLabel></button>
            <button className="primary" type="button" onClick={openAssign}><IconLabel icon={<Plus size={16} />}>Asignar checklist</IconLabel></button>
          </>
        }
      />
      {error && <div className="error">{error}</div>}
      <section className="panel">
        <div className="panel-header"><strong>Checklists</strong></div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Ítems</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {templates.map((item) => (
                <tr key={item.id} className="click-row" onClick={() => openEditTemplate(item)}>
                  <td>
                    <strong>{item.name}</strong>
                    {item.description ? <div className="cell-sub">{item.description}</div> : null}
                  </td>
                  <td>{item.tasks?.length ? `${item.tasks.length} casillas` : 'Sin ítems'}</td>
                  <td>
                    <div className="table-actions">
                      <button className="ghost" type="button" onClick={(event) => { event.stopPropagation(); openEditTemplate(item); }}>Editar</button>
                    </div>
                  </td>
                </tr>
              ))}
              {!templates.length && <tr><td colSpan={3}>No hay checklists. Crea uno para asignarlo a los empleados.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
      <section className="panel">
        <div className="panel-header"><strong>Asignaciones</strong></div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Empleado</th>
                <th>Checklist</th>
                <th>Progreso</th>
                <th>Asignado</th>
                <th>Estado</th>
              </tr>
            </thead>
            <tbody>
              {assignments.map((item) => (
                <tr key={item.id}>
                  <td>{item.employee_name || `Empleado #${item.employee_id}`}</td>
                  <td>{item.template_name || `Checklist #${item.template_id}`}</td>
                  <td>
                    {item.tasks_completed ?? 0}/{item.tasks_total ?? item.tasks?.length ?? 0} hechos
                    {item.tasks?.length ? (
                      <div className="cell-sub">{item.tasks.filter((task) => task.completed).map((task) => task.name).join(', ') || 'Ningún ítem marcado'}</div>
                    ) : null}
                  </td>
                  <td>{fmtSV(item.assigned_at)}</td>
                  <td><StatusPill ok={item.state === 'completed' || item.state === 'validated'} label={assignmentStateLabel(item.state)} /></td>
                </tr>
              ))}
              {!assignments.length && <tr><td colSpan={5}>Sin checklists asignados.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>

      {assignOpen && (
        <FormModal
          title="Asignar checklist"
          onClose={() => setAssignOpen(false)}
          onSubmit={assign}
          submitLabel="Asignar"
          hint="Queda obligatorio: el empleado debe marcar todos los ítems en el kiosko y eso se registra en su bitácora."
          error={formError}
        >
          <label className="field">
            <span>Empleado</span>
            <select value={employeeId} onChange={(event) => setEmployeeId(event.target.value)} required>
              {employees.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select>
          </label>
          <label className="field">
            <span>Checklist</span>
            <select value={templateId} onChange={(event) => setTemplateId(event.target.value)} required>
              {templates.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}{item.tasks?.length ? ` (${item.tasks.length} ítems)` : ''}
                </option>
              ))}
            </select>
          </label>
        </FormModal>
      )}

      {templateOpen && (
        <FormModal
          title={editingTemplate ? 'Editar checklist' : 'Nuevo checklist'}
          onClose={() => { setTemplateOpen(false); setEditingTemplate(null); }}
          onSubmit={saveTemplate}
          submitLabel={editingTemplate ? 'Guardar cambios' : 'Guardar checklist'}
          hint="Cada ítem aparece como una casilla. El empleado marca que sí lo hizo y queda en la bitácora."
          error={formError}
          wide
        >
          <FormSection title="Datos del checklist">
            <label className="field">
              <span>Nombre</span>
              <input value={templateForm.name} onChange={(event) => setTemplateForm({ ...templateForm, name: event.target.value })} required placeholder="Ej. Apertura de sucursal" />
            </label>
            <label className="field">
              <span>Para qué sirve</span>
              <textarea
                value={templateForm.description}
                onChange={(event) => setTemplateForm({ ...templateForm, description: event.target.value })}
                rows={2}
                placeholder="Ej. Tareas que el colaborador debe confirmar al iniciar turno"
              />
            </label>
          </FormSection>
          <FormSection title="Ítems para marcar" hint="Escríbelos como el empleado los verá en el kiosko.">
            <div className="task-chain">
              {templateForm.tasks.map((task, index) => (
                <div className="task-chain-item" key={index}>
                  <div className="task-chain-head">
                    <label className="checklist-preview">
                      <span className="kiosk-check-box" />
                      <strong>Ítem {index + 1}</strong>
                    </label>
                    {templateForm.tasks.length > 1 && (
                      <button
                        className="ghost"
                        type="button"
                        onClick={() => setTemplateForm({
                          ...templateForm,
                          tasks: templateForm.tasks.filter((_, taskIndex) => taskIndex !== index),
                        })}
                      >
                        Quitar
                      </button>
                    )}
                  </div>
                  <label className="field">
                    <span>Qué debe marcar</span>
                    <input
                      value={task.name}
                      onChange={(event) => {
                        const tasks = templateForm.tasks.map((item, taskIndex) => taskIndex === index ? { ...item, name: event.target.value } : item);
                        setTemplateForm({ ...templateForm, tasks });
                      }}
                      required={index === 0}
                      placeholder="Ej. Revisar inventario de caja"
                    />
                  </label>
                  <label className="field">
                    <span>Detalle (opcional)</span>
                    <textarea
                      value={task.description}
                      onChange={(event) => {
                        const tasks = templateForm.tasks.map((item, taskIndex) => taskIndex === index ? { ...item, description: event.target.value } : item);
                        setTemplateForm({ ...templateForm, tasks });
                      }}
                      rows={2}
                      placeholder="Instrucción breve de cómo hacerlo"
                    />
                  </label>
                </div>
              ))}
            </div>
            <button
              className="ghost"
              type="button"
              onClick={() => setTemplateForm({ ...templateForm, tasks: [...templateForm.tasks, { name: '', description: '' }] })}
            >
              <IconLabel icon={<Plus size={16} />}>Agregar ítem</IconLabel>
            </button>
          </FormSection>
        </FormModal>
      )}
    </>
  );
}

function ActiveScreen() {
  const [data, setData] = useState<DailyReport | null>(null);
  const [error, setError] = useState('');

  async function load() {
    try {
      setData(await api.request<DailyReport>('/reports/dashboard'));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo cargar');
    }
  }
  useEffect(() => { load(); }, []);

  return (
    <>
      <Header title="En jornada" subtitle="Quién ya hizo check-in en la jornada 11:00–03:00." actions={<button className="ghost" type="button" onClick={load}><IconLabel icon={<RefreshCw size={16} />}>Actualizar</IconLabel></button>} />
      {error && <div className="error">{error}</div>}
      <section className="panel">
        <div className="stack">
          {(data?.active_now || []).map((item) => (
            <div className="row-card" key={item.shift_id}>
              <div>
                <strong>{item.name}</strong>
                <span>Entrada {fmtSV(item.check_in_at)}</span>
              </div>
              <StatusPill ok label="Activo" />
            </div>
          ))}
          {!data?.active_now?.length && <p className="empty">No hay empleados en turno.</p>}
        </div>
      </section>
    </>
  );
}

function UsersScreen() {
  const emptyForm = { name: '', login: '', email: '', password: '', pin: '', is_company_admin: false, create_employee: true, job_title: '' };
  const [items, setItems] = useState<SystemUser[]>([]);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<SystemUser | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [ledger, setLedger] = useState<Ledger | null>(null);
  const [ledgerOpen, setLedgerOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [formError, setFormError] = useState('');

  async function load() {
    try {
      setItems(await api.request<SystemUser[]>('/users'));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo cargar');
    }
  }

  useEffect(() => { load(); }, []);

  function openCreate() {
    setEditing(null);
    setForm(emptyForm);
    setFormError('');
    setCreating(true);
  }

  function openEdit(item: SystemUser) {
    setCreating(false);
    setEditing(item);
    setForm({
      name: item.name,
      login: item.login,
      email: item.email || '',
      password: '',
      pin: item.pin_plain || '',
      is_company_admin: Boolean(item.is_company_admin),
      create_employee: Boolean(item.employee_id),
      job_title: '',
    });
    setFormError('');
  }

  function closeForm() {
    setCreating(false);
    setEditing(null);
    setFormError('');
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setFormError('');
    try {
      const login = form.login.trim() || slugLogin(form.name);
      if (editing) {
        await api.request(`/users/${editing.id}`, {
          method: 'PUT',
          body: JSON.stringify({
            name: form.name.trim(),
            login,
            email: form.email.trim() || null,
            password: form.password.trim() || null,
            pin: form.pin.trim() || null,
            is_company_admin: form.is_company_admin,
          }),
        });
      } else {
        await api.request('/users', {
          method: 'POST',
          body: JSON.stringify({
            name: form.name.trim(),
            login,
            email: form.email.trim() || null,
            password: form.password.trim() || null,
            pin: form.pin.trim() || null,
            is_company_admin: form.is_company_admin,
            create_employee: form.create_employee,
            job_title: form.job_title.trim() || null,
            active: true,
          }),
        });
      }
      closeForm();
      await load();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'No se pudo guardar el usuario');
    }
  }

  async function openLedger(user: SystemUser) {
    setLedgerOpen(true);
    setLoading(true);
    setError('');
    try {
      setLedger(await api.request<Ledger>(`/users/${user.id}/ledger`));
    } catch (err) {
      setLedger(null);
      setError(err instanceof Error ? err.message : 'Sin bitácora para este usuario');
    } finally {
      setLoading(false);
    }
  }

  const formOpen = creating || editing !== null;

  return (
    <>
      <Header
        title="Usuarios"
        subtitle="Al crear un usuario se genera también la ficha de empleado, salvo que lo desactives. Sirve para login y PIN de kiosko."
        actions={<button className="primary" type="button" onClick={openCreate}><IconLabel icon={<Plus size={16} />}>Crear usuario</IconLabel></button>}
      />
      {error && <div className="error">{error}</div>}
      <section className="panel">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Usuario</th>
                <th>Rol</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id} className="click-row" onClick={() => openEdit(item)}>
                  <td><strong>{item.name}</strong></td>
                  <td>{item.login}</td>
                  <td>{item.is_company_admin ? 'Admin' : 'Usuario'}</td>
                  <td>
                    <div className="table-actions">
                      <button className="ghost" type="button" onClick={(event) => { event.stopPropagation(); openEdit(item); }}>Editar</button>
                      <button className="ghost" type="button" onClick={(event) => { event.stopPropagation(); openLedger(item); }}>Bitácora</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      {formOpen && (
        <FormModal
          title={editing ? 'Editar usuario' : 'Nuevo usuario'}
          onClose={closeForm}
          onSubmit={submit}
          submitLabel={editing ? 'Guardar cambios' : 'Crear usuario'}
          hint={editing ? 'Deja contraseña vacía si no quieres cambiarla.' : 'El usuario se crea al guardar. Si activas la ficha de empleado, también podrá marcar en kiosko.'}
          error={formError}
          wide
        >
          <FormSection title="Datos de acceso">
            <div className="form-grid">
              <label className="field">
                <span>Nombre</span>
                <input
                  value={form.name}
                  onChange={(event) => {
                    const name = event.target.value;
                    setForm((current) => ({
                      ...current,
                      name,
                      login: creating && (!current.login || current.login === slugLogin(current.name)) ? slugLogin(name) : current.login,
                    }));
                  }}
                  required
                />
              </label>
              <label className="field">
                <span>Usuario de login</span>
                <input value={form.login} onChange={(event) => setForm({ ...form, login: event.target.value })} placeholder="Se sugiere desde el nombre" />
              </label>
              <label className="field">
                <span>Email</span>
                <input type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} placeholder="Opcional" />
              </label>
              <label className="field">
                <span>{editing ? 'Nueva contraseña' : 'Contraseña'}</span>
                <input type="password" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} minLength={6} required={!editing} placeholder={editing ? 'Dejar vacía para no cambiar' : 'Mínimo 6 caracteres'} />
              </label>
              <label className="field">
                <span>PIN de kiosko</span>
                <input value={form.pin} onChange={(event) => setForm({ ...form, pin: event.target.value.replace(/\D/g, '') })} minLength={4} maxLength={12} inputMode="numeric" placeholder="4 a 12 dígitos" />
              </label>
            </div>
            <label className="check-list">
              <label>
                <input type="checkbox" checked={form.is_company_admin} onChange={(event) => setForm({ ...form, is_company_admin: event.target.checked })} />
                Administrador de la empresa (acceso al panel)
              </label>
            </label>
          </FormSection>
          {!editing && (
            <FormSection title="Ficha de empleado" hint="Si lo activas, el sistema crea automáticamente el colaborador ligado a este usuario.">
              <label className="check-list">
                <label>
                  <input type="checkbox" checked={form.create_employee} onChange={(event) => setForm({ ...form, create_employee: event.target.checked })} />
                  Crear también el empleado (recomendado)
                </label>
              </label>
              {form.create_employee && (
                <label className="field">
                  <span>Puesto</span>
                  <input value={form.job_title} onChange={(event) => setForm({ ...form, job_title: event.target.value })} placeholder="Ej. Supervisor de piso" />
                </label>
              )}
            </FormSection>
          )}
        </FormModal>
      )}
      {ledgerOpen && (
        <Modal title="Bitácora de usuario" onClose={() => setLedgerOpen(false)}>
          <LedgerView ledger={ledger} loading={loading} />
        </Modal>
      )}
    </>
  );
}

function DevicesScreen() {
  const emptyForm = { name: '', device_code: '', active: true, session_timeout: 30, device_lock_enabled: true };
  const [items, setItems] = useState<Device[]>([]);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Device | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState('');
  const [formError, setFormError] = useState('');

  async function load() {
    try {
      setItems(await api.request<Device[]>('/devices'));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo cargar');
    }
  }

  useEffect(() => { load(); }, []);

  function openCreate() {
    setEditing(null);
    setForm({ name: '', device_code: nextCode('KIOSK', items.map((item) => item.device_code)), active: true, session_timeout: 30, device_lock_enabled: true });
    setFormError('');
    setCreating(true);
  }

  function openEdit(item: Device) {
    setCreating(false);
    setEditing(item);
    setForm({
      name: item.name,
      device_code: item.device_code,
      active: Boolean(item.active),
      session_timeout: item.session_timeout || 30,
      device_lock_enabled: true,
    });
    setFormError('');
  }

  function closeForm() {
    setCreating(false);
    setEditing(null);
    setFormError('');
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setFormError('');
    try {
      const payload = {
        name: form.name.trim(),
        device_code: form.device_code.trim() || nextCode('KIOSK', items.map((item) => item.device_code)),
        device_type: 'kiosk',
        active: form.active,
        session_timeout: Number(form.session_timeout) || 30,
        device_lock_enabled: form.device_lock_enabled,
      };
      if (editing) {
        await api.request(`/devices/${editing.id}`, { method: 'PUT', body: JSON.stringify(payload) });
      } else {
        await api.request('/devices', { method: 'POST', body: JSON.stringify(payload) });
      }
      closeForm();
      await load();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'No se pudo guardar el dispositivo');
    }
  }

  const formOpen = creating || editing !== null;

  return (
    <>
      <Header
        title="Dispositivos"
        subtitle="Clic en una fila para editar. El código se sugiere automáticamente."
        actions={<button className="primary" type="button" onClick={openCreate}><IconLabel icon={<Plus size={16} />}>Crear dispositivo</IconLabel></button>}
      />
      {error && <div className="error">{error}</div>}
      <section className="panel">
        <div className="table-wrap">
          <table>
            <thead><tr><th>Nombre</th><th>Código</th><th>Estado</th><th></th></tr></thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id} className="click-row" onClick={() => openEdit(item)}>
                  <td><strong>{item.name}</strong></td>
                  <td>{item.device_code}</td>
                  <td><StatusPill ok={Boolean(item.active)} label={item.active ? 'Activo' : 'Inactivo'} /></td>
                  <td>
                    <div className="table-actions">
                      <button className="ghost" type="button" onClick={(event) => { event.stopPropagation(); openEdit(item); }}>Editar</button>
                    </div>
                  </td>
                </tr>
              ))}
              {!items.length && <tr><td colSpan={4}>No hay dispositivos. Crea el primero con el botón superior.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
      {formOpen && (
        <FormModal
          title={editing ? 'Editar dispositivo' : 'Nuevo dispositivo'}
          onClose={closeForm}
          onSubmit={submit}
          submitLabel={editing ? 'Guardar cambios' : 'Guardar dispositivo'}
          hint="Identifica el kiosko en la sucursal. El código lo usa el dispositivo al iniciar."
          error={formError}
        >
          <FormSection title="Identificación">
            <label className="field">
              <span>Nombre visible</span>
              <input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required placeholder="Ej. Kiosko sucursal centro" />
            </label>
            <label className="field">
              <span>Código del dispositivo</span>
              <input value={form.device_code} onChange={(event) => setForm({ ...form, device_code: event.target.value })} placeholder="Se genera solo si lo dejas vacío" />
            </label>
          </FormSection>
          <FormSection title="Operación">
            <label className="field">
              <span>Cierre de sesión por inactividad (segundos)</span>
              <input
                type="number"
                min={10}
                max={600}
                value={form.session_timeout}
                onChange={(event) => setForm({ ...form, session_timeout: Number(event.target.value) })}
              />
            </label>
            <label className="check-list">
              <label>
                <input type="checkbox" checked={form.active} onChange={(event) => setForm({ ...form, active: event.target.checked })} />
                Dispositivo activo
              </label>
              <label>
                <input type="checkbox" checked={form.device_lock_enabled} onChange={(event) => setForm({ ...form, device_lock_enabled: event.target.checked })} />
                Fijar al primer colaborador que marque
              </label>
            </label>
          </FormSection>
        </FormModal>
      )}
    </>
  );
}

function CompanyScreen() {
  const [company, setCompany] = useState<Company | null>(null);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: '', legal_name: '', vat: '', email: '', phone: '', street: '', city: '' });
  const [error, setError] = useState('');
  const [formError, setFormError] = useState('');

  async function load() {
    try {
      const data = await api.request<Company>('/companies/current');
      setCompany(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error');
    }
  }

  useEffect(() => { load(); }, []);

  function openEdit() {
    if (!company) return;
    setForm({
      name: company.name || '',
      legal_name: company.legal_name || '',
      vat: company.vat || '',
      email: company.email || '',
      phone: company.phone || '',
      street: company.street || '',
      city: company.city || '',
    });
    setFormError('');
    setOpen(true);
  }

  async function save(event: FormEvent) {
    event.preventDefault();
    setFormError('');
    try {
      const updated = await api.request<Company>('/companies/current', {
        method: 'PUT',
        body: JSON.stringify({
          name: form.name.trim(),
          legal_name: form.legal_name.trim() || null,
          vat: form.vat.trim() || null,
          email: form.email.trim() || null,
          phone: form.phone.trim() || null,
          street: form.street.trim() || null,
          city: form.city.trim() || null,
        }),
      });
      setCompany(updated);
      setOpen(false);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'No se pudo guardar');
    }
  }

  return (
    <>
      <Header
        title="Empresa"
        subtitle="Razón social y datos de contacto que usa el sistema."
        actions={<button className="primary" type="button" onClick={openEdit}>Editar</button>}
      />
      {error && <div className="error">{error}</div>}
      <section className="panel">
        <div className="record-card">
          <dl className="record-grid">
            <dt>Nombre</dt>
            <dd>{company?.name || '—'}</dd>
            <dt>Razón social</dt>
            <dd>{company?.legal_name || '—'}</dd>
            <dt>NIT / VAT</dt>
            <dd>{company?.vat || '—'}</dd>
            <dt>Email</dt>
            <dd>{company?.email || '—'}</dd>
            <dt>Teléfono</dt>
            <dd>{company?.phone || '—'}</dd>
            <dt>Dirección</dt>
            <dd>{[company?.street, company?.city].filter(Boolean).join(', ') || '—'}</dd>
            <dt>Horario</dt>
            <dd>{SHIFT_LABEL}</dd>
          </dl>
        </div>
      </section>
      {open && (
        <FormModal
          title="Editar empresa"
          onClose={() => setOpen(false)}
          onSubmit={save}
          submitLabel="Guardar cambios"
          hint="La zona horaria America/El_Salvador y el horario operativo 11:00–03:00 se mantienen."
          error={formError}
          wide
        >
          <FormSection title="Identidad">
            <div className="form-grid">
              <label className="field">
                <span>Nombre comercial</span>
                <input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required />
              </label>
              <label className="field">
                <span>Razón social</span>
                <input value={form.legal_name} onChange={(event) => setForm({ ...form, legal_name: event.target.value })} placeholder="Opcional" />
              </label>
              <label className="field">
                <span>NIT / registro</span>
                <input value={form.vat} onChange={(event) => setForm({ ...form, vat: event.target.value })} placeholder="Opcional" />
              </label>
            </div>
          </FormSection>
          <FormSection title="Contacto">
            <div className="form-grid">
              <label className="field">
                <span>Email</span>
                <input type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} />
              </label>
              <label className="field">
                <span>Teléfono</span>
                <input value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} />
              </label>
              <label className="field">
                <span>Dirección</span>
                <input value={form.street} onChange={(event) => setForm({ ...form, street: event.target.value })} />
              </label>
              <label className="field">
                <span>Ciudad</span>
                <input value={form.city} onChange={(event) => setForm({ ...form, city: event.target.value })} />
              </label>
            </div>
          </FormSection>
        </FormModal>
      )}
    </>
  );
}

function SecurityScreen() {
  const [enabled, setEnabled] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function load() {
    try {
      const data = await api.request<Company>('/companies/current');
      setEnabled(data.device_lock_enabled !== false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo cargar la configuración');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function toggle(next: boolean) {
    const previous = enabled;
    setEnabled(next);
    setSaving(true);
    setError('');
    try {
      const updated = await api.request<Company>('/companies/current', {
        method: 'PUT',
        body: JSON.stringify({ device_lock_enabled: next }),
      });
      setEnabled(updated.device_lock_enabled !== false);
    } catch (err) {
      setEnabled(previous);
      setError(err instanceof Error ? err.message : 'No se pudo guardar');
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <Header
        title="Seguridad"
        subtitle="Políticas de acceso en kiosko y dispositivos."
      />
      {error && <div className="error">{error}</div>}
      <section className="panel">
        {loading ? (
          <div className="record-card"><p className="subtle">Cargando...</p></div>
        ) : (
          <div className="setting-row">
            <div>
              <h2>Dispositivos fijados</h2>
              <p className="subtle">
                Si está activo, cada dispositivo queda vinculado al primer colaborador que marque asistencia.
                Solo esa persona puede usarlo hasta que un gerente lo desvincule.
              </p>
            </div>
            <label className="switch">
              <input
                type="checkbox"
                checked={enabled}
                disabled={saving}
                onChange={(event) => toggle(event.target.checked)}
                aria-label="Dispositivos fijados"
              />
              <span />
            </label>
          </div>
        )}
      </section>
    </>
  );
}

function PinScreen() {
  const [pin, setPin] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState('');

  async function generate() {
    setError('');
    try {
      const created = await api.request<{ pin: string }>('/temporary-pins', { method: 'POST' });
      setPin(created.pin);
      setOpen(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo generar el PIN');
    }
  }

  return (
    <>
      <Header
        title="PIN de gerente"
        subtitle="Código temporal para autorizar el kiosko."
        actions={<button className="primary" type="button" onClick={generate}>Generar PIN</button>}
      />
      {error && <div className="error">{error}</div>}
      <section className="panel">
        <div className="record-card">
          <p className="subtle">El PIN aparece en una ventana al generarlo. Vale unos minutos o hasta usarse una vez.</p>
        </div>
      </section>
      {open && pin && (
        <Modal title="PIN generado" onClose={() => setOpen(false)}>
          <div className="record-card">
            <p className="subtle">Compártelo con el gerente. Se cierra al usarse o al expirar.</p>
            <div className="pin-value">{pin}</div>
            <div className="modal-actions">
              <button className="primary" type="button" onClick={() => setOpen(false)}>Cerrar</button>
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}

const WEEKDAY_LABELS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];

type ScheduleLine = { weekday: number; start_time: string; end_time: string; is_off: boolean; overnight: boolean };
type WorkSchedule = {
  id: number;
  name: string;
  description?: string | null;
  is_default: boolean;
  active: boolean;
  lines: ScheduleLine[];
};
type RoleSchedule = { id: number; name: string; schedule_id: number | null; schedule_name: string | null };
type EmployeeSchedule = {
  id: number;
  name: string;
  employee_code?: string | null;
  job_title?: string | null;
  role_name?: string | null;
  schedule_id: number | null;
  resolved_schedule_id: number | null;
  resolved_schedule_name: string | null;
  source: string;
};

function defaultScheduleLines(): ScheduleLine[] {
  return WEEKDAY_LABELS.map((_, weekday) => ({
    weekday,
    start_time: '11:00',
    end_time: '03:00',
    is_off: false,
    overnight: true,
  }));
}

function sourceLabel(source: string) {
  if (source === 'employee') return 'Empleado';
  if (source === 'role') return 'Rol';
  return 'Predeterminado';
}

function SchedulesScreen() {
  const [schedules, setSchedules] = useState<WorkSchedule[]>([]);
  const [roles, setRoles] = useState<RoleSchedule[]>([]);
  const [employees, setEmployees] = useState<EmployeeSchedule[]>([]);
  const [error, setError] = useState('');
  const [formError, setFormError] = useState('');
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<WorkSchedule | null>(null);
  const [form, setForm] = useState({ name: '', description: '', is_default: false, lines: defaultScheduleLines() });

  async function load() {
    setError('');
    try {
      const data = await api.request<{
        schedules: WorkSchedule[];
        roles: RoleSchedule[];
        employees: EmployeeSchedule[];
      }>('/work-schedules/overview');
      setSchedules(data.schedules);
      setRoles(data.roles);
      setEmployees(data.employees);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudieron cargar los horarios');
    }
  }

  useEffect(() => { load(); }, []);

  function openCreate() {
    setEditing(null);
    setForm({ name: '', description: '', is_default: false, lines: defaultScheduleLines() });
    setFormError('');
    setCreating(true);
  }

  function openEdit(item: WorkSchedule) {
    setCreating(false);
    setEditing(item);
    const lines = defaultScheduleLines().map((line) => {
      const current = (item.lines || []).find((entry) => entry.weekday === line.weekday);
      return current ? { ...line, ...current, weekday: line.weekday } : line;
    });
    setForm({
      name: item.name,
      description: item.description || '',
      is_default: item.is_default,
      lines,
    });
    setFormError('');
  }

  function closeForm() {
    setCreating(false);
    setEditing(null);
    setFormError('');
  }

  function updateLine(weekday: number, patch: Partial<ScheduleLine>) {
    setForm((current) => ({
      ...current,
      lines: current.lines.map((line) => {
        if (line.weekday !== weekday) return line;
        const next = { ...line, ...patch };
        next.overnight = next.end_time < next.start_time;
        return next;
      }),
    }));
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setFormError('');
    try {
      const payload = {
        name: form.name.trim(),
        description: form.description.trim() || null,
        is_default: form.is_default,
        active: true,
        lines: form.lines,
      };
      if (editing) {
        await api.request(`/work-schedules/${editing.id}`, { method: 'PUT', body: JSON.stringify(payload) });
      } else {
        await api.request('/work-schedules', { method: 'POST', body: JSON.stringify(payload) });
      }
      closeForm();
      await load();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'No se pudo guardar el horario');
    }
  }

  async function makeDefault(item: WorkSchedule) {
    try {
      await api.request(`/work-schedules/${item.id}/set-default`, { method: 'POST', body: JSON.stringify({}) });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo marcar como predeterminado');
    }
  }

  async function assignRole(roleId: number, scheduleId: string) {
    try {
      await api.request(`/work-schedules/roles/${roleId}`, {
        method: 'PUT',
        body: JSON.stringify({ schedule_id: scheduleId ? Number(scheduleId) : null }),
      });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo asignar el horario al rol');
    }
  }

  async function assignEmployee(employeeId: number, scheduleId: string) {
    try {
      await api.request(`/work-schedules/employees/${employeeId}`, {
        method: 'PUT',
        body: JSON.stringify({ schedule_id: scheduleId ? Number(scheduleId) : null }),
      });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo asignar el horario al empleado');
    }
  }

  const formOpen = creating || editing !== null;

  return (
    <>
      <Header
        title="Horarios"
        subtitle="Predeterminado de la empresa, por rol o por empleado. El empleado tiene prioridad sobre el rol."
        actions={<button className="primary" type="button" onClick={openCreate}><IconLabel icon={<Plus size={16} />}>Crear horario</IconLabel></button>}
      />
      {error && <div className="error">{error}</div>}
      <section className="panel">
        <div className="panel-header"><strong>Plantillas de horario</strong></div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Jornada</th>
                <th>Uso</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {schedules.map((item) => {
                const workDays = (item.lines || []).filter((line) => !line.is_off);
                const sample = workDays[0];
                return (
                  <tr key={item.id} className="click-row" onClick={() => openEdit(item)}>
                    <td><strong>{item.name}</strong></td>
                    <td>{sample ? `${sample.start_time} – ${sample.end_time}` : '—'}</td>
                    <td>{item.is_default ? <StatusPill ok label="Predeterminado" /> : 'Opcional'}</td>
                    <td>
                      <div className="table-actions">
                        <button className="ghost" type="button" onClick={(event) => { event.stopPropagation(); openEdit(item); }}>Editar</button>
                        {!item.is_default && (
                          <button className="ghost" type="button" onClick={(event) => { event.stopPropagation(); makeDefault(item); }}>Usar por defecto</button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {!schedules.length && <tr><td colSpan={4}>No hay horarios. Crea el primero con el botón superior.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
      <section className="panel">
        <div className="panel-header"><strong>Por rol</strong></div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Rol</th>
                <th>Horario</th>
              </tr>
            </thead>
            <tbody>
              {roles.map((role) => (
                <tr key={role.id}>
                  <td><strong>{role.name}</strong></td>
                  <td>
                    <select value={role.schedule_id ? String(role.schedule_id) : ''} onChange={(event) => assignRole(role.id, event.target.value)}>
                      <option value="">Predeterminado de empresa</option>
                      {schedules.map((item) => (
                        <option key={item.id} value={item.id}>{item.name}</option>
                      ))}
                    </select>
                  </td>
                </tr>
              ))}
              {!roles.length && <tr><td colSpan={2}>No hay roles. El horario predeterminado se aplica a todos.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
      <section className="panel">
        <div className="panel-header"><strong>Por empleado</strong></div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Empleado</th>
                <th>Origen</th>
                <th>Horario efectivo</th>
                <th>Asignar</th>
              </tr>
            </thead>
            <tbody>
              {employees.map((item) => (
                <tr key={item.id}>
                  <td>
                    <strong>{item.name}</strong>
                    <div className="subtle">{item.role_name || item.job_title || 'Sin rol'}</div>
                  </td>
                  <td>{sourceLabel(item.source)}</td>
                  <td>{item.resolved_schedule_name || '—'}</td>
                  <td>
                    <select value={item.schedule_id ? String(item.schedule_id) : ''} onChange={(event) => assignEmployee(item.id, event.target.value)}>
                      <option value="">Heredar (rol o predeterminado)</option>
                      {schedules.map((schedule) => (
                        <option key={schedule.id} value={schedule.id}>{schedule.name}</option>
                      ))}
                    </select>
                  </td>
                </tr>
              ))}
              {!employees.length && <tr><td colSpan={4}>No hay empleados para asignar horario.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
      {formOpen && (
        <FormModal
          title={editing ? 'Editar horario' : 'Nuevo horario'}
          onClose={closeForm}
          onSubmit={submit}
          submitLabel={editing ? 'Guardar cambios' : 'Guardar horario'}
          hint="Si un empleado no tiene horario propio, usa el del rol; si el rol tampoco, usa el predeterminado."
          error={formError}
        >
          <label className="field">
            <span>Nombre</span>
            <input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required placeholder="Ej. Jornada 11:00–03:00" />
          </label>
          <label className="field">
            <span>Descripción</span>
            <input value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} placeholder="Opcional" />
          </label>
          <label className="field" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input type="checkbox" checked={form.is_default} onChange={(event) => setForm({ ...form, is_default: event.target.checked })} style={{ width: 16, height: 16, minHeight: 16 }} />
            <span>Usar como predeterminado de la empresa</span>
          </label>
          <div className="schedule-days">
            {form.lines.map((line) => (
              <div className="schedule-day" key={line.weekday}>
                <strong>{WEEKDAY_LABELS[line.weekday]}</strong>
                <label className="field">
                  <span>Entrada</span>
                  <input type="time" value={line.start_time} disabled={line.is_off} onChange={(event) => updateLine(line.weekday, { start_time: event.target.value })} />
                </label>
                <label className="field">
                  <span>Salida</span>
                  <input type="time" value={line.end_time} disabled={line.is_off} onChange={(event) => updateLine(line.weekday, { end_time: event.target.value })} />
                </label>
                <label className="field" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <input type="checkbox" checked={line.is_off} onChange={(event) => updateLine(line.weekday, { is_off: event.target.checked })} style={{ width: 16, height: 16, minHeight: 16 }} />
                  <span>Libre</span>
                </label>
              </div>
            ))}
          </div>
        </FormModal>
      )}
    </>
  );
}

const CALENDAR_DAYS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

type CalendarWeekDay = {
  date: string;
  weekday: number;
  status: 'ok' | 'issues';
  status_label: string;
  issue_count: number;
  present: number;
  absent: number;
  missing_checkout: number;
  late: number;
  excused: number;
  expected: number;
};

type CalendarLedgerEntry = {
  at: string | null;
  kind: string;
  kind_label: string;
  title: string;
  detail?: string | null;
  state?: string | null;
};

type CalendarEmployeeRow = {
  employee_id: number;
  name: string;
  employee_code?: string | null;
  job_title?: string | null;
  labels: string[];
  status_label: string;
  has_issue: boolean;
  excused: boolean;
  is_off: boolean;
  check_in_at: string | null;
  check_out_at: string | null;
  ledger: CalendarLedgerEntry[];
};

type CalendarDayDetail = CalendarWeekDay & { employees: CalendarEmployeeRow[] };

function startOfWeek(value: Date) {
  const date = new Date(value);
  const day = (date.getDay() + 6) % 7;
  date.setDate(date.getDate() - day);
  date.setHours(0, 0, 0, 0);
  return date;
}

function isoDate(value: Date) {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function monthBounds(iso: string) {
  const [year, month] = iso.split('-').map(Number);
  const start = `${year}-${String(month).padStart(2, '0')}-01`;
  const end = isoDate(new Date(year, month, 0));
  return { start, end, label: `${String(month).padStart(2, '0')}-${year}` };
}

function CalendarScreen() {
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()));
  const [days, setDays] = useState<CalendarWeekDay[]>([]);
  const [selectedDate, setSelectedDate] = useState(() => isoDate(new Date()));
  const [detail, setDetail] = useState<CalendarDayDetail | null>(null);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState<number | null>(null);
  const [pickingDate, setPickingDate] = useState(false);
  const [draftDate, setDraftDate] = useState(() => isoDate(new Date()));
  const [exporting, setExporting] = useState(false);

  const weekEnd = useMemo(() => {
    const end = new Date(weekStart);
    end.setDate(end.getDate() + 6);
    return end;
  }, [weekStart]);
  const month = monthBounds(selectedDate);

  function goToDate(value: string) {
    const parsed = new Date(`${value}T12:00:00`);
    if (Number.isNaN(parsed.getTime())) return;
    setSelectedDate(value);
    setWeekStart(startOfWeek(parsed));
    setPickingDate(false);
  }

  async function downloadMonthCsv() {
    setError('');
    setExporting(true);
    try {
      await api.download(
        `/reports/calendar/export?start=${month.start}&end=${month.end}`,
        `asistencia-${month.label}.csv`,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo descargar el CSV');
    } finally {
      setExporting(false);
    }
  }

  async function downloadMonthPdf() {
    setError('');
    setExporting(true);
    try {
      await api.download(`/reports/calendar/export.pdf?start=${month.start}&end=${month.end}`, `asistencia-${month.label}.pdf`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo descargar el PDF');
    } finally {
      setExporting(false);
    }
  }
  async function loadWeek(start = weekStart) {
    setError('');
    const end = new Date(start);
    end.setDate(end.getDate() + 6);
    try {
      const data = await api.request<{ days: CalendarWeekDay[] }>(`/reports/calendar?start=${isoDate(start)}&end=${isoDate(end)}`);
      setDays(data.days);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo cargar el calendario');
    }
  }

  async function loadDay(day = selectedDate) {
    if (!day) return;
    setError('');
    try {
      setDetail(await api.request<CalendarDayDetail>(`/reports/calendar/${day}`));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo cargar el día');
    }
  }

  useEffect(() => { loadWeek(weekStart); }, [weekStart]);
  useEffect(() => { loadDay(selectedDate); }, [selectedDate]);

  async function grantPermission(employee: CalendarEmployeeRow) {
    if (employee.excused || employee.is_off) return;
    setBusyId(employee.employee_id);
    setError('');
    try {
      await api.request('/no-attendance', {
        method: 'POST',
        body: JSON.stringify({
          employee_id: employee.employee_id,
          date: selectedDate,
          reason: 'permiso',
          note: 'Permiso de faltar',
          state: 'approved',
        }),
      });
      await loadDay(selectedDate);
      await loadWeek(weekStart);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo registrar el permiso');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <>
      <Header
        title="Calendario"
        subtitle={`Semana ${isoDate(weekStart)} a ${isoDate(weekEnd)}. Cada día muestra si todo está bien o si hubo faltas, tardanzas o salidas sin marcar.`}
      />
      <div className="calendar-toolbar">
        <div className="calendar-toolbar-group" aria-label="Navegación del calendario">
          <button className="ghost" type="button" onClick={() => setWeekStart((current) => { const next = new Date(current); next.setDate(next.getDate() - 7); return next; })}>Semana anterior</button>
          <button className="ghost" type="button" onClick={() => { const today = startOfWeek(new Date()); setWeekStart(today); setSelectedDate(isoDate(new Date())); }}>Esta semana</button>
          <button className="ghost" type="button" onClick={() => setWeekStart((current) => { const next = new Date(current); next.setDate(next.getDate() + 7); return next; })}>Semana siguiente</button>
          <button className="ghost" type="button" onClick={() => { setDraftDate(selectedDate); setPickingDate(true); }}><IconLabel icon={<CalendarDays size={16} />}>Elegir fecha</IconLabel></button>
        </div>
        <div className="calendar-toolbar-group calendar-export-group" aria-label="Descargar calendario del mes">
          <span className="calendar-export-label">Exportar {month.label}</span>
          <button className="primary" type="button" disabled={exporting} onClick={downloadMonthCsv}><IconLabel icon={<Download size={16} />}>CSV</IconLabel></button>
          <button className="primary calendar-pdf-button" type="button" disabled={exporting} onClick={downloadMonthPdf}><IconLabel icon={<Download size={16} />}>PDF</IconLabel></button>
        </div>
      </div>      {error && <div className="error">{error}</div>}
      <section className="panel">
        <div className="calendar-grid">
          {days.map((day) => (
            <button
              key={day.date}
              type="button"
              className={`calendar-day ${day.status === 'ok' ? 'ok' : 'issues'}${selectedDate === day.date ? ' selected' : ''}`}
              onClick={() => setSelectedDate(day.date)}
            >
              <strong>{CALENDAR_DAYS[day.weekday] || day.date}</strong>
              <span className="subtle">{day.date.slice(8)}</span>
              <span className={`calendar-status ${day.status}`}>{day.status_label}</span>
              {day.status === 'issues' && (
                <span className="subtle">
                  {day.absent ? `${day.absent} faltó` : ''}{day.absent && day.missing_checkout ? ' · ' : ''}{day.missing_checkout ? `${day.missing_checkout} sin salida` : ''}{!day.absent && !day.missing_checkout && day.late ? `${day.late} tarde` : ''}
                </span>
              )}
            </button>
          ))}
        </div>
      </section>
      <section className="panel">
        <div className="panel-header">
          <strong>Bitácora del {fmtLongDateSV(`${selectedDate}T12:00:00`)}</strong>
          <StatusPill ok={detail?.status !== 'issues'} label={detail?.status_label || '—'} />
        </div>
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Empleado</th>
                <th>Estado</th>
                <th>Entrada</th>
                <th>Salida</th>
                <th>Bitácora</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {(detail?.employees || []).map((employee) => (
                <tr key={employee.employee_id}>
                  <td>
                    <strong>{employee.name}</strong>
                    {employee.job_title ? <div className="subtle">{employee.job_title}</div> : null}
                  </td>
                  <td>
                    <div className="label-stack">
                      {employee.labels.map((label) => (
                        <span key={label} className={`pill ${employee.has_issue && label !== 'Permiso' && label !== 'Día libre' && label !== 'Todo bien' && label !== 'En jornada' && label !== 'Pendiente' && label !== 'Aún no inicia' ? 'pill-warn' : 'pill-ok'}`}>{label}</span>
                      ))}
                    </div>
                  </td>
                  <td>{employee.check_in_at ? fmtTimeSV(employee.check_in_at) : '—'}</td>
                  <td>{employee.check_out_at ? fmtTimeSV(employee.check_out_at) : '—'}</td>
                  <td>
                    {employee.ledger.length ? (
                      <ul className="mini-ledger">
                        {employee.ledger.map((entry, index) => (
                          <li key={`${employee.employee_id}-${index}`} className={entry.kind === 'task_answer' ? 'done' : undefined}>
                            <strong>{entry.title}</strong>
                            <span>{entry.kind_label}{entry.detail ? ` · ${entry.detail}` : ''}</span>
                          </li>
                        ))}
                      </ul>
                    ) : <span className="subtle">Sin movimientos</span>}
                  </td>
                  <td>
                    {!employee.is_off && !employee.excused && !employee.check_in_at ? (
                      <button className="ghost" type="button" disabled={busyId === employee.employee_id} onClick={() => grantPermission(employee)}>
                        Dar permiso
                      </button>
                    ) : null}
                  </td>
                </tr>
              ))}
              {!detail?.employees?.length && (
                <tr>
                  <td colSpan={6}><p className="empty">No hay empleados para este día.</p></td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
      {pickingDate && (
        <FormModal
          title="Fecha en específico"
          onClose={() => setPickingDate(false)}
          onSubmit={(event) => { event.preventDefault(); goToDate(draftDate); }}
          submitLabel="Ver esa fecha"
          hint="El calendario saltará a la semana de esa fecha y abrirá su bitácora."
        >
          <label className="field">
            <span>Día a revisar</span>
            <input type="date" value={draftDate} onChange={(event) => setDraftDate(event.target.value)} required />
          </label>
        </FormModal>
      )}
    </>
  );
}

type FirstRunResult = {
  branch: { id: number; name: string };
  device: { id: number; name: string; device_code: string };
  employees: Array<{ name: string; employee_code: string; login: string; pin: string }>;
};

function FirstRunSetup({ onClose, onComplete }: { onClose: () => void; onComplete: (result: FirstRunResult) => void }) {
  const [step, setStep] = useState(0);
  const [branchName, setBranchName] = useState('');
  const [deviceName, setDeviceName] = useState('');
  const [employeeNames, setEmployeeNames] = useState(['']);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<FirstRunResult | null>(null);

  async function createSetup(event: FormEvent) {
    event.preventDefault();
    setError('');
    setBusy(true);
    try {
      const data = await api.request<FirstRunResult>('/setup/first-run', {
        method: 'POST',
        body: JSON.stringify({
          branch_name: branchName.trim(),
          device_name: deviceName.trim(),
          employees: employeeNames.map((name) => ({ name: name.trim() })).filter((item) => item.name),
        }),
      });
      setResult(data);
      localStorage.setItem('kiosk_device_code', data.device.device_code);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo completar la configuración.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title="Introducción al sistema" onClose={() => { if (!result) onClose(); }} wide>
      {result ? (
        <div className="first-run-content">
          <div className="first-run-success">
            <CheckCircle2 size={24} />
            <div><strong>Configuración lista</strong><span>Guarda los PIN antes de continuar; no volverán a mostrarse.</span></div>
          </div>
          <div className="first-run-summary">
            <p><strong>Sucursal:</strong> {result.branch.name}</p>
            <p><strong>Dispositivo:</strong> {result.device.name} · código de kiosko <code>{result.device.device_code}</code></p>
          </div>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Empleado</th><th>Usuario</th><th>Código PIN</th></tr></thead>
              <tbody>{result.employees.map((employee) => (
                <tr key={employee.employee_code}>
                  <td>{employee.name}</td><td>{employee.login}</td><td><strong className="first-run-pin">{employee.pin}</strong></td>
                </tr>
              ))}</tbody>
            </table>
          </div>
          <p className="hint">Entrega cada PIN únicamente a su empleado. En el primer ingreso al kiosko, registrará su rostro después del PIN.</p>
          <div className="modal-actions"><button className="primary" type="button" onClick={() => onComplete(result)}>Ver panel administrativo</button></div>
        </div>
      ) : step === 0 ? (
        <div className="first-run-content">
          <p>Te guiaremos para dejar listo el acceso al sistema: crear una sucursal, registrar el kiosko y dar de alta a los empleados con un PIN personal.</p>
          <ol className="first-run-steps"><li>Nombre de sucursal</li><li>Nombre del dispositivo host</li><li>Empleados y sus códigos de acceso</li></ol>
          <div className="modal-actions">
            <button className="ghost" type="button" onClick={onClose}>Ahora no</button>
            <button className="primary" type="button" onClick={() => setStep(1)}>Iniciar introducción</button>
          </div>
        </div>
      ) : step === 1 ? (
        <form className="modal-form" onSubmit={(event) => { event.preventDefault(); setStep(2); }}>
          {error && <div className="error">{error}</div>}
          <p className="subtle">Paso 1 de 2 · Datos de la ubicación y del kiosko</p>
          <label className="field"><span>Nombre de la sucursal</span><input value={branchName} onChange={(event) => setBranchName(event.target.value)} minLength={2} maxLength={180} required placeholder="Ej. Sucursal Central" /></label>
          <label className="field"><span>Nombre del dispositivo host</span><input value={deviceName} onChange={(event) => setDeviceName(event.target.value)} minLength={2} maxLength={180} required placeholder="Ej. Kiosko de recepción" /></label>
          <div className="modal-actions"><button className="ghost" type="button" onClick={() => setStep(0)}>Atrás</button><button className="primary" type="submit">Continuar</button></div>
        </form>
      ) : (
        <form className="modal-form" onSubmit={createSetup}>
          {error && <div className="error">{error}</div>}
          <p className="subtle">Paso 2 de 2 · Añade los empleados que ingresarán al kiosko. El sistema asignará un PIN único de cuatro dígitos a cada uno.</p>
          <div className="first-run-employees">
            {employeeNames.map((name, index) => (
              <label className="field" key={index}>
                <span>Empleado {index + 1}</span>
                <div className="first-run-employee-input"><input value={name} onChange={(event) => setEmployeeNames((current) => current.map((item, i) => i === index ? event.target.value : item))} minLength={2} maxLength={180} required placeholder="Nombre completo" /><button className="ghost" type="button" aria-label={`Quitar empleado ${index + 1}`} disabled={employeeNames.length === 1} onClick={() => setEmployeeNames((current) => current.filter((_, i) => i !== index))}>Quitar</button></div>
              </label>
            ))}
            {employeeNames.length < 100 && <button className="ghost first-run-add" type="button" onClick={() => setEmployeeNames((current) => [...current, ''])}><Plus size={16} /> Añadir otro empleado</button>}
          </div>
          <div className="modal-actions"><button className="ghost" type="button" disabled={busy} onClick={() => setStep(1)}>Atrás</button><button className="primary" type="submit" disabled={busy}>{busy ? 'Preparando accesos…' : 'Crear accesos'}</button></div>
        </form>
      )}
    </Modal>
  );
}

export function AdminShell({ user, onLogout }: { user: ApiUser; onLogout: () => void }) {
  const [screen, setScreen] = useState<ScreenKey>('dashboard');
  const [showFirstRunNudge, setShowFirstRunNudge] = useState(false);
  const [firstRunOpen, setFirstRunOpen] = useState(false);
  const [teamFocus, setTeamFocus] = useState<TeamFocus>('all');
  const [sidebarMode, setSidebarMode] = useState<SidebarMode>(readSidebarMode);
  const [advancedOpen, setAdvancedOpen] = useState(readAdvancedOpen);
  const daily = useMemo(() => NAV.filter((item) => item.group === 'daily'), []);
  const advanced = useMemo(() => NAV.filter((item) => item.group === 'advanced'), []);
  const sidebarMini = sidebarMode === 'mini';
  const onAdvanced = advanced.some((item) => item.key === screen);

  useEffect(() => {
    if (localStorage.getItem('attendance.first-run.complete') === 'true') return;
    api.request<{ needs_setup: boolean }>('/setup/status')
      .then((status) => setShowFirstRunNudge(status.needs_setup))
      .catch(() => setShowFirstRunNudge(false));
  }, [user.id]);

  function setMode(mode: SidebarMode) {
    setSidebarMode(mode);
    persistSidebarMode(mode);
  }

  function toggleAdvanced() {
    const next = !advancedOpen;
    setAdvancedOpen(next);
    persistAdvancedOpen(next);
  }

  function goTo(key: ScreenKey, opts?: { teamFocus?: TeamFocus }) {
    const item = NAV.find((entry) => entry.key === key);
    if (item?.group === 'advanced') {
      setAdvancedOpen(true);
      persistAdvancedOpen(true);
    }
    if (opts?.teamFocus) setTeamFocus(opts.teamFocus);
    else if (key === 'team') setTeamFocus('all');
    setScreen(key);
  }

  return (
    <div className={`app-shell sidebar-${sidebarMode}`}>
      {sidebarMode === 'open' ? (
        <button className="sidebar-backdrop" type="button" aria-label="Cerrar menú" onClick={() => setMode('closed')} />
      ) : null}
      {sidebarMode !== 'closed' ? (
      <aside className={sidebarMini ? 'sidebar sidebar-mini' : 'sidebar'}>
        <div className="brand">
          <div className="brand-mark">A</div>
          <div className="brand-text">
            <strong>Attendance</strong>
            <span>Panel admin</span>
          </div>
          <div className="sidebar-controls">
            {sidebarMini ? (
              <button className="sidebar-ctrl" type="button" title="Expandir menú" aria-label="Expandir menú" onClick={() => setMode('open')}>
                <ChevronsRight size={16} />
              </button>
            ) : (
              <button className="sidebar-ctrl" type="button" title="Minimizar menú" aria-label="Minimizar menú" onClick={() => setMode('mini')}>
                <ChevronsLeft size={16} />
              </button>
            )}
            <button className="sidebar-ctrl" type="button" title="Cerrar menú" aria-label="Cerrar menú" onClick={() => setMode('closed')}>
              <X size={16} />
            </button>
          </div>
        </div>
        <nav className="nav">
          <p className="nav-hint">Día a día</p>
          {daily.map((item) => (
            <button key={item.key} className={screen === item.key ? 'active' : ''} type="button" title={item.label} aria-label={item.label} onClick={() => goTo(item.key)}>
              {item.icon}
              <span className="btn-label">{item.label}</span>
            </button>
          ))}
          <div className="nav-sep" />
          <button className="nav-utility" type="button" title="Abrir kiosko" aria-label="Abrir kiosko" onClick={() => window.open('/', '_blank')}>
            <IconLabel icon={<KeyRound size={16} />}>Abrir kiosko</IconLabel>
          </button>
          <div className="nav-sep" />
          <p className="nav-hint">Administración</p>
          <button
            className={`nav-group-toggle${onAdvanced ? ' current' : ''}${advancedOpen ? ' open' : ''}`}
            type="button"
            title="Opciones avanzadas"
            aria-label="Opciones avanzadas"
            aria-expanded={advancedOpen}
            onClick={toggleAdvanced}
          >
            <Settings2 />
            <span className="btn-label">Opciones avanzadas</span>
            <ChevronDown className={`nav-chevron${advancedOpen ? ' open' : ''}`} size={16} />
          </button>
          {advancedOpen ? advanced.map((item) => (
            <button key={item.key} className={screen === item.key ? 'active' : ''} type="button" title={item.label} aria-label={item.label} onClick={() => goTo(item.key)}>
              {item.icon}
              <span className="btn-label">{item.label}</span>
            </button>
          )) : null}
        </nav>
        <div className="session">
          <div className="session-profile">
            <span className="session-avatar">{user.name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase()}</span>
            <div className="session-identity"><strong>{user.name}</strong><span>{user.is_superadmin ? 'Superadministrador' : 'Administrador'}</span></div>
            <button className="session-logout" type="button" title="Cerrar sesión" aria-label="Cerrar sesión" onClick={onLogout}><LogOut size={16} /></button>
          </div>
        </div>
      </aside>
      ) : null}
      <main className="main">
        {sidebarMode === 'closed' || sidebarMode === 'mini' ? (
          <button className="sidebar-reopen" type="button" onClick={() => setMode('open')} title="Mostrar menú" aria-label="Mostrar menú">
            <PanelLeftOpen size={16} />
            <span className="btn-label">Menú</span>
          </button>
        ) : null}
        {showFirstRunNudge && screen === 'dashboard' && (
          <section className="first-run-banner">
            <div><strong>¡Bienvenido! Preparemos el sistema para tu equipo.</strong><span>Registra la sucursal, el kiosko y los empleados en unos pasos.</span></div>
            <button className="primary" type="button" onClick={() => setFirstRunOpen(true)}>Iniciar introducción</button>
          </section>
        )}
        {screen === 'dashboard' && <DashboardScreen onNavigate={goTo} />}
        {screen === 'team' && <TeamScreen initialFocus={teamFocus} onNavigate={goTo} />}
        {screen === 'reports' && <ReportsScreen />}
        {screen === 'employees' && <EmployeesScreen />}
        {screen === 'schedules' && <SchedulesScreen />}
        {screen === 'calendar' && <CalendarScreen />}
        {screen === 'tasks' && <TasksScreen />}
        {screen === 'active' && <ActiveScreen />}
        {screen === 'users' && <UsersScreen />}
        {screen === 'devices' && <DevicesScreen />}
        {screen === 'security' && <SecurityScreen />}
        {screen === 'company' && <CompanyScreen />}
        {screen === 'pin' && <PinScreen />}
      </main>
      {firstRunOpen && <FirstRunSetup
        onClose={() => setFirstRunOpen(false)}
        onComplete={() => {
          localStorage.setItem('attendance.first-run.complete', 'true');
          setShowFirstRunNudge(false);
          setFirstRunOpen(false);
          setScreen('dashboard');
        }}
      />}
    </div>
  );
}
