import { FormEvent, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import {
  Building2,
  ClipboardList,
  KeyRound,
  LayoutDashboard,
  ListChecks,
  LogOut,
  Clock,
  CalendarDays,
  MonitorSmartphone,
  Plus,
  RefreshCw,
  Shield,
  ShieldCheck,
  UserRound,
  Users,
  UsersRound,
  X,
} from 'lucide-react';
import { ApiUser, api } from '../api/client';
import { SHIFT_LABEL, fmtSV, fmtTimeSV } from '../lib/time';

type ScreenKey =
  | 'dashboard'
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
  email?: string | null;
  phone?: string | null;
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

const NAV: { key: ScreenKey; label: string; icon: ReactNode; group: 'main' | 'ops' }[] = [
  { key: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard />, group: 'main' },
  { key: 'reports', label: 'Reportes del día', icon: <ClipboardList />, group: 'main' },
  { key: 'employees', label: 'Empleados', icon: <UsersRound />, group: 'main' },
  { key: 'schedules', label: 'Horarios', icon: <Clock />, group: 'main' },
  { key: 'calendar', label: 'Calendario', icon: <CalendarDays />, group: 'main' },
  { key: 'tasks', label: 'Asignar tareas', icon: <ListChecks />, group: 'main' },
  { key: 'active', label: 'Empleados activos', icon: <Users />, group: 'main' },
  { key: 'users', label: 'Usuarios', icon: <UserRound />, group: 'main' },
  { key: 'devices', label: 'Dispositivos', icon: <MonitorSmartphone />, group: 'ops' },
  { key: 'security', label: 'Seguridad', icon: <Shield />, group: 'ops' },
  { key: 'pin', label: 'PIN gerente', icon: <ShieldCheck />, group: 'ops' },
  { key: 'company', label: 'Empresa', icon: <Building2 />, group: 'ops' },
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

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  return (
    <div className="modal-backdrop" onClick={onClose} role="presentation">
      <div className="modal" onClick={(event) => event.stopPropagation()} role="dialog" aria-modal="true">
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

function FormModal({
  title,
  onClose,
  onSubmit,
  submitLabel,
  hint,
  error,
  children,
}: {
  title: string;
  onClose: () => void;
  onSubmit: (event: FormEvent) => void;
  submitLabel: string;
  hint?: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <Modal title={title} onClose={onClose}>
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
          <li key={`${entry.at}-${index}`}>
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

function DashboardScreen({ onNavigate }: { onNavigate: (key: ScreenKey) => void }) {
  const [data, setData] = useState<DailyReport | null>(null);
  const [error, setError] = useState('');

  async function load() {
    setError('');
    try {
      setData(await api.request<DailyReport>('/reports/dashboard'));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo cargar el dashboard');
    }
  }

  useEffect(() => { load(); }, []);

  const summary = data?.summary;
  return (
    <>
      <Header
        title="Dashboard"
        subtitle={`Jornada operativa ${data?.operational_day.shift_window || SHIFT_LABEL}`}
        actions={<button className="ghost" type="button" onClick={load}><RefreshCw size={14} /> Actualizar</button>}
      />
      {error && <div className="error">{error}</div>}
      <div className="metric-grid">
        <button className="metric-card" type="button" onClick={() => onNavigate('active')}>
          <span>Presentes ahora</span>
          <strong>{data?.active_now?.length ?? 0}</strong>
        </button>
        <button className="metric-card" type="button" onClick={() => onNavigate('calendar')}>
          <span>Sin check-in</span>
          <strong>{summary?.missing_checkin ?? 0}</strong>
        </button>
        <button className="metric-card" type="button" onClick={() => onNavigate('calendar')}>
          <span>No marcó salida</span>
          <strong>{summary?.missing_checkout ?? 0}</strong>
        </button>
        <button className="metric-card" type="button" onClick={() => onNavigate('tasks')}>
          <span>Tareas pendientes</span>
          <strong>{summary?.tasks_incomplete ?? 0}</strong>
        </button>
        <button className="metric-card" type="button" onClick={() => onNavigate('reports')}>
          <span>Cumplimiento del día</span>
          <strong>{summary ? `${summary.compliant}/${summary.total_employees}` : '—'}</strong>
        </button>
      </div>
      <div className="split">
        <section className="panel">
          <div className="panel-header">
            <strong>Empleados en jornada</strong>
            <button className="ghost" type="button" onClick={() => onNavigate('active')}>Ver todos</button>
          </div>
          <div className="stack">
            {(data?.active_now || []).map((item) => (
              <div className="row-card" key={item.shift_id}>
                <div>
                  <strong>{item.name}</strong>
                  <span>Entrada {fmtTimeSV(item.check_in_at)}</span>
                </div>
                <StatusPill ok label="En turno" />
              </div>
            ))}
            {!data?.active_now?.length && <p className="empty">Nadie ha hecho check-in en esta jornada.</p>}
          </div>
        </section>
        <section className="panel">
          <div className="panel-header">
            <strong>Pendientes de cumplimiento</strong>
            <button className="ghost" type="button" onClick={() => onNavigate('reports')}>Ver reportes</button>
          </div>
          <div className="stack">
            {(data?.employees || []).filter((item) => !item.compliant).slice(0, 8).map((item) => (
              <div className="row-card" key={item.employee_id}>
                <div>
                  <strong>{item.name}</strong>
                  <span>{item.issues.join(' · ')}</span>
                </div>
                <StatusPill ok={false} label="Incompleto" />
              </div>
            ))}
            {data && data.employees.every((item) => item.compliant) && <p className="empty">Todos los empleados activos cumplen check-in y tareas.</p>}
          </div>
        </section>
      </div>
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
        subtitle={`Horario ${data?.operational_day.shift_window || SHIFT_LABEL}. Check-in y tareas diarias.`}
        actions={<button className="ghost" type="button" onClick={() => load()}><RefreshCw size={14} /> Actualizar</button>}
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
                <th>Tareas</th>
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
  const emptyForm = { name: '', user_pin: '', mobile_phone: '', work_email: '', role_id: '', task_template_ids: [] as number[] };
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
      user_pin: item.user_pin || '',
      mobile_phone: item.mobile_phone || '',
      work_email: item.work_email || '',
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
      if (editing) {
        await api.request(`/employees/${editing.id}`, {
          method: 'PUT',
          body: JSON.stringify({
            name: form.name.trim(),
            user_pin: form.user_pin.trim() || null,
            mobile_phone: form.mobile_phone.trim() || null,
            work_email: form.work_email.trim() || null,
            role_id: form.role_id ? Number(form.role_id) : null,
          }),
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
        await api.request('/employees', {
          method: 'POST',
          body: JSON.stringify({
            name: form.name.trim(),
            user_pin: form.user_pin.trim(),
            mobile_phone: form.mobile_phone.trim() || null,
            work_email: form.work_email.trim() || null,
            role_id: form.role_id ? Number(form.role_id) : null,
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
        subtitle="Clic en una fila para editar. Tipo, sucursal y puesto se asignan solos. El horario se define en Horarios."
        actions={
          <button className="primary" type="button" onClick={openCreate}>
            <Plus size={14} /> Crear empleado
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
                <th>Puesto</th>
                <th>Rol</th>
                <th>PIN</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id} className="click-row" onClick={() => openEdit(item)}>
                  <td><strong>{item.name}</strong></td>
                  <td>{item.employee_code || '—'}</td>
                  <td>{item.job_title || 'Colaborador'}</td>
                  <td>{item.role_name || '—'}</td>
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
          title={editing ? `Editar empleado` : 'Nuevo empleado'}
          onClose={closeForm}
          onSubmit={submit}
          submitLabel={editing ? 'Guardar cambios' : 'Guardar empleado'}
          hint={editing ? 'El tipo de empleado se mantiene. El horario se asigna en Horarios.' : 'Se crea con tipo fijo, usuario de acceso y sucursal. El horario predeterminado se asigna en Horarios.'}
          error={formError}
        >
          <label className="field">
            <span>Nombre completo</span>
            <input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required placeholder="Nombre y apellido" />
          </label>
          <label className="field">
            <span>{editing ? 'PIN de marcación' : 'PIN de marcación'}</span>
            <input
              value={form.user_pin}
              onChange={(event) => setForm({ ...form, user_pin: event.target.value })}
              required={!editing}
              minLength={editing ? undefined : 4}
              maxLength={12}
              placeholder={editing ? 'Dejar igual o escribir uno nuevo' : '4 a 12 dígitos'}
            />
          </label>
          <label className="field">
            <span>Teléfono (opcional)</span>
            <input value={form.mobile_phone} onChange={(event) => setForm({ ...form, mobile_phone: event.target.value })} />
          </label>
          <label className="field">
            <span>Email (opcional)</span>
            <input type="email" value={form.work_email} onChange={(event) => setForm({ ...form, work_email: event.target.value })} />
          </label>
          <label className="field">
            <span>Rol</span>
            <select value={form.role_id} onChange={(event) => setForm({ ...form, role_id: event.target.value })}>
              <option value="">Sin rol (usa horario predeterminado)</option>
              {roles.map((role) => (
                <option key={role.id} value={role.id}>{role.name}</option>
              ))}
            </select>
          </label>
          <fieldset className="field">
            <span>{editing ? 'Agregar tareas' : 'Tareas iniciales'}</span>
            <div className="check-list">
              {templates.map((template) => (
                <label key={template.id}>
                  <input
                    type="checkbox"
                    checked={form.task_template_ids.includes(template.id)}
                    onChange={() => toggleTask(template.id)}
                  />
                  {template.name}
                </label>
              ))}
              {!templates.length && <p className="subtle">No hay plantillas. Puedes asignar tareas después.</p>}
            </div>
          </fieldset>
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
  const [templateForm, setTemplateForm] = useState({ name: '', tasks: [{ name: '', description: '' }] });
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
    setTemplateForm({ name: '', tasks: [{ name: '', description: '' }] });
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
    setTemplateForm({ name: item.name, tasks });
    try {
      const detail = await api.request<Template>(`/assignment-templates/${item.id}`);
      const loaded = (detail.tasks && detail.tasks.length)
        ? detail.tasks.map((task) => ({ name: task.name, description: task.description || '' }))
        : tasks;
      setTemplateForm({ name: detail.name, tasks: loaded });
    } catch {
      setTemplateForm({ name: item.name, tasks });
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
        description: null,
        state: 'active',
        active: true,
        tasks: templateForm.tasks
          .map((task) => ({ name: task.name.trim(), description: task.description.trim() || null }))
          .filter((task) => task.name),
      };
      if (!payload.tasks.length) {
        setFormError('Agrega al menos una tarea en la cadena');
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
        title="Asignar tareas"
        subtitle="Las tareas requeridas deben completarse además del check-in."
        actions={
          <>
            <button className="ghost" type="button" onClick={openCreateTemplate}><Plus size={14} /> Nueva plantilla</button>
            <button className="primary" type="button" onClick={openAssign}><Plus size={14} /> Asignar tarea</button>
          </>
        }
      />
      {error && <div className="error">{error}</div>}
      <section className="panel">
        <div className="panel-header"><strong>Plantillas</strong></div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Tareas</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {templates.map((item) => (
                <tr key={item.id} className="click-row" onClick={() => openEditTemplate(item)}>
                  <td><strong>{item.name}</strong></td>
                  <td>{item.tasks?.length ? `${item.tasks.length} en cadena` : 'Sin tareas'}</td>
                  <td>
                    <div className="table-actions">
                      <button className="ghost" type="button" onClick={(event) => { event.stopPropagation(); openEditTemplate(item); }}>Editar</button>
                    </div>
                  </td>
                </tr>
              ))}
              {!templates.length && <tr><td colSpan={3}>No hay plantillas. Crea una para poder asignar tareas.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
      <section className="panel">
        <div className="panel-header"><strong>Tareas asignadas</strong></div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Empleado</th>
                <th>Tarea</th>
                <th>Asignada</th>
                <th>Estado</th>
              </tr>
            </thead>
            <tbody>
              {assignments.map((item) => (
                <tr key={item.id}>
                  <td>{item.employee_name || `Empleado #${item.employee_id}`}</td>
                  <td>{item.template_name || `Plantilla #${item.template_id}`}</td>
                  <td>{fmtSV(item.assigned_at)}</td>
                  <td><StatusPill ok={item.state === 'completed' || item.state === 'validated'} label={item.state} /></td>
                </tr>
              ))}
              {!assignments.length && <tr><td colSpan={4}>Sin tareas asignadas.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>

      {assignOpen && (
        <FormModal
          title="Asignar tarea"
          onClose={() => setAssignOpen(false)}
          onSubmit={assign}
          submitLabel="Asignar"
          hint="La tarea queda obligatoria y bloquea la salida hasta completarse."
          error={formError}
        >
          <label className="field">
            <span>Empleado</span>
            <select value={employeeId} onChange={(event) => setEmployeeId(event.target.value)} required>
              {employees.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select>
          </label>
          <label className="field">
            <span>Tarea</span>
            <select value={templateId} onChange={(event) => setTemplateId(event.target.value)} required>
              {templates.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select>
          </label>
        </FormModal>
      )}

      {templateOpen && (
        <FormModal
          title={editingTemplate ? 'Editar plantilla' : 'Nueva plantilla'}
          onClose={() => { setTemplateOpen(false); setEditingTemplate(null); }}
          onSubmit={saveTemplate}
          submitLabel={editingTemplate ? 'Guardar cambios' : 'Guardar plantilla'}
          hint="En el kiosko esta plantilla se muestra como una sección con las tareas en checklist."
          error={formError}
        >
          <label className="field">
            <span>Nombre de plantilla</span>
            <input value={templateForm.name} onChange={(event) => setTemplateForm({ ...templateForm, name: event.target.value })} required placeholder="Ej. Limpieza" />
          </label>
          <div className="field">
            <span>Tareas en cadena</span>
            <div className="task-chain">
              {templateForm.tasks.map((task, index) => (
                <div className="task-chain-item" key={index}>
                  <div className="task-chain-head">
                    <strong>Tarea {index + 1}</strong>
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
                    <span>Nombre de la tarea</span>
                    <input
                      value={task.name}
                      onChange={(event) => {
                        const tasks = templateForm.tasks.map((item, taskIndex) => taskIndex === index ? { ...item, name: event.target.value } : item);
                        setTemplateForm({ ...templateForm, tasks });
                      }}
                      required={index === 0}
                      placeholder="Ej. Revisar inventario"
                    />
                  </label>
                  <label className="field">
                    <span>Descripción de la tarea</span>
                    <textarea
                      value={task.description}
                      onChange={(event) => {
                        const tasks = templateForm.tasks.map((item, taskIndex) => taskIndex === index ? { ...item, description: event.target.value } : item);
                        setTemplateForm({ ...templateForm, tasks });
                      }}
                      rows={2}
                      placeholder="Qué debe hacer el empleado"
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
              <Plus size={14} /> Agregar tarea
            </button>
          </div>
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
      <Header title="Empleados activos" subtitle="Quién ya hizo check-in en la jornada 11:00–03:00." actions={<button className="ghost" type="button" onClick={load}><RefreshCw size={14} /> Actualizar</button>} />
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
  const emptyForm = { name: '', login: '', email: '', password: '', pin: '', is_company_admin: false };
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
        subtitle="Clic en una fila para editar. El usuario de acceso se sugiere a partir del nombre."
        actions={<button className="primary" type="button" onClick={openCreate}><Plus size={14} /> Crear usuario</button>}
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
          submitLabel={editing ? 'Guardar cambios' : 'Guardar usuario'}
          hint={editing ? 'Deja contraseña vacía si no quieres cambiarla.' : 'Si no escribes usuario o contraseña, se generan solos.'}
          error={formError}
        >
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
            <span>Usuario de acceso (opcional)</span>
            <input value={form.login} onChange={(event) => setForm({ ...form, login: event.target.value })} placeholder="Se sugiere desde el nombre" />
          </label>
          <label className="field">
            <span>Email (opcional)</span>
            <input type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} />
          </label>
          <label className="field">
            <span>{editing ? 'Nueva contraseña (opcional)' : 'Contraseña (opcional)'}</span>
            <input type="password" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} minLength={6} placeholder={editing ? 'Dejar vacía para no cambiar' : 'Mínimo 6 caracteres'} />
          </label>
          <label className="field">
            <span>PIN (opcional)</span>
            <input value={form.pin} onChange={(event) => setForm({ ...form, pin: event.target.value })} minLength={4} maxLength={12} />
          </label>
          <label className="field" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input type="checkbox" checked={form.is_company_admin} onChange={(event) => setForm({ ...form, is_company_admin: event.target.checked })} style={{ width: 16, height: 16, minHeight: 16 }} />
            <span>Administrador</span>
          </label>
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
  const emptyForm = { name: '', device_code: '', active: true };
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
    setForm({ name: '', device_code: nextCode('KIOSK', items.map((item) => item.device_code)), active: true });
    setFormError('');
    setCreating(true);
  }

  function openEdit(item: Device) {
    setCreating(false);
    setEditing(item);
    setForm({ name: item.name, device_code: item.device_code, active: Boolean(item.active) });
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
        session_timeout: 30,
        device_lock_enabled: true,
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
        actions={<button className="primary" type="button" onClick={openCreate}><Plus size={14} /> Crear dispositivo</button>}
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
          hint="Tipo kiosko, bloqueo y tiempo de sesión se asignan solos."
          error={formError}
        >
          <label className="field">
            <span>Nombre</span>
            <input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required placeholder="Ej. Kiosko sucursal" />
          </label>
          <label className="field">
            <span>Código (opcional)</span>
            <input value={form.device_code} onChange={(event) => setForm({ ...form, device_code: event.target.value })} placeholder="Se genera solo" />
          </label>
          <label className="field" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input type="checkbox" checked={form.active} onChange={(event) => setForm({ ...form, active: event.target.checked })} style={{ width: 16, height: 16, minHeight: 16 }} />
            <span>Activo</span>
          </label>
        </FormModal>
      )}
    </>
  );
}

function CompanyScreen() {
  const [company, setCompany] = useState<Company | null>(null);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', phone: '' });
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
    setForm({ name: company.name || '', email: company.email || '', phone: company.phone || '' });
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
          email: form.email.trim() || null,
          phone: form.phone.trim() || null,
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
        subtitle="Datos básicos de la compañía."
        actions={<button className="primary" type="button" onClick={openEdit}>Editar</button>}
      />
      {error && <div className="error">{error}</div>}
      <section className="panel">
        <div className="record-card">
          <dl className="record-grid">
            <dt>Nombre</dt>
            <dd>{company?.name || '—'}</dd>
            <dt>Email</dt>
            <dd>{company?.email || '—'}</dd>
            <dt>Teléfono</dt>
            <dd>{company?.phone || '—'}</dd>
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
          hint="La zona horaria y el horario 11:00–03:00 se mantienen."
          error={formError}
        >
          <label className="field">
            <span>Nombre</span>
            <input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required />
          </label>
          <label className="field">
            <span>Email (opcional)</span>
            <input type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} />
          </label>
          <label className="field">
            <span>Teléfono (opcional)</span>
            <input value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} />
          </label>
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
        actions={<button className="primary" type="button" onClick={openCreate}><Plus size={14} /> Crear horario</button>}
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

function CalendarScreen() {
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()));
  const [days, setDays] = useState<CalendarWeekDay[]>([]);
  const [selectedDate, setSelectedDate] = useState(() => isoDate(new Date()));
  const [detail, setDetail] = useState<CalendarDayDetail | null>(null);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState<number | null>(null);

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
        subtitle="Cada día muestra si todo está bien o si hubo faltas, tardanzas o salidas sin marcar."
        actions={
          <div className="header-actions">
            <button className="ghost" type="button" onClick={() => setWeekStart((current) => { const next = new Date(current); next.setDate(next.getDate() - 7); return next; })}>Semana anterior</button>
            <button className="ghost" type="button" onClick={() => { const today = startOfWeek(new Date()); setWeekStart(today); setSelectedDate(isoDate(new Date())); }}>Esta semana</button>
            <button className="ghost" type="button" onClick={() => setWeekStart((current) => { const next = new Date(current); next.setDate(next.getDate() + 7); return next; })}>Semana siguiente</button>
          </div>
        }
      />
      {error && <div className="error">{error}</div>}
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
          <strong>Bitácora del {selectedDate}</strong>
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
                          <li key={`${employee.employee_id}-${index}`}>
                            <strong>{entry.title}</strong>
                            <span>{entry.detail || entry.kind_label}</span>
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
    </>
  );
}

export function AdminShell({ user, onLogout }: { user: ApiUser; onLogout: () => void }) {
  const [screen, setScreen] = useState<ScreenKey>('dashboard');
  const main = useMemo(() => NAV.filter((item) => item.group === 'main'), []);
  const ops = useMemo(() => NAV.filter((item) => item.group === 'ops'), []);

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">A</div>
          <div>
            <strong>Attendance</strong>
            <span>Panel admin</span>
          </div>
        </div>
        <nav className="nav">
          {main.map((item) => (
            <button key={item.key} className={screen === item.key ? 'active' : ''} type="button" onClick={() => setScreen(item.key)}>
              {item.icon} {item.label}
            </button>
          ))}
          <div className="nav-sep" />
          {ops.map((item) => (
            <button key={item.key} className={screen === item.key ? 'active' : ''} type="button" onClick={() => setScreen(item.key)}>
              {item.icon} {item.label}
            </button>
          ))}
          <div className="nav-sep" />
          <button type="button" onClick={() => window.open('/', '_blank')}><KeyRound /> Abrir kiosko</button>
        </nav>
        <div className="session">
          <span>{user.name}</span>
          <button className="ghost" type="button" onClick={onLogout}><LogOut size={16} /> Salir</button>
        </div>
      </aside>
      <main className="main">
        {screen === 'dashboard' && <DashboardScreen onNavigate={setScreen} />}
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
    </div>
  );
}
