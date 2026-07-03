import { FormEvent, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import {
  BadgeCheck,
  CalendarClock,
  CalendarX,
  ClipboardList,
  ListChecks,
  ScanFace,
  BriefcaseBusiness,
  Building2,
  CheckSquare,
  DoorOpen,
  KeyRound,
  LayoutDashboard,
  LogOut,
  MapPin,
  MonitorSmartphone,
  RefreshCw,
  Save,
  ShieldCheck,
  UserRound,
  UsersRound,
} from 'lucide-react';
import { ApiUser, api } from '../api/client';

type Field = {
  name: string;
  label: string;
  type?: 'text' | 'email' | 'password' | 'date' | 'datetime-local' | 'checkbox' | 'textarea' | 'number';
  required?: boolean;
};

type ResourceConfig = {
  key: string;
  title: string;
  endpoint: string;
  fields: Field[];
  columns: string[];
  icon: ReactNode;
};

const resources: ResourceConfig[] = [
  {
    key: 'branches',
    title: 'Sucursales',
    endpoint: '/branches',
    icon: <MapPin />,
    columns: ['id', 'name', 'code', 'city', 'country', 'active'],
    fields: [
      { name: 'name', label: 'Nombre', required: true },
      { name: 'code', label: 'Codigo' },
      { name: 'street', label: 'Direccion' },
      { name: 'city', label: 'Ciudad' },
      { name: 'country', label: 'Pais' },
      { name: 'timezone', label: 'Zona horaria' },
      { name: 'active', label: 'Activo', type: 'checkbox' },
    ],
  },
  {
    key: 'users',
    title: 'Usuarios',
    endpoint: '/users',
    icon: <UserRound />,
    columns: ['id', 'name', 'login', 'email', 'is_company_admin', 'active'],
    fields: [
      { name: 'name', label: 'Nombre', required: true },
      { name: 'login', label: 'Login', required: true },
      { name: 'email', label: 'Email', type: 'email' },
      { name: 'password', label: 'Password', type: 'password', required: true },
      { name: 'pin', label: 'PIN', type: 'password' },
      { name: 'employee_id', label: 'Empleado ID', type: 'number' },
      { name: 'is_company_admin', label: 'Admin empresa', type: 'checkbox' },
      { name: 'active', label: 'Activo', type: 'checkbox' },
    ],
  },
  {
    key: 'employees',
    title: 'Empleados',
    endpoint: '/employees',
    icon: <UsersRound />,
    columns: ['id', 'name', 'employee_code', 'job_title', 'employee_type', 'is_active_for_work', 'active'],
    fields: [
      { name: 'name', label: 'Nombre visible', required: true },
      { name: 'first_name', label: 'Nombres' },
      { name: 'last_name', label: 'Apellidos' },
      { name: 'employee_code', label: 'Codigo empleado' },
      { name: 'branch_id', label: 'Sucursal ID', type: 'number' },
      { name: 'user_id', label: 'Usuario ID', type: 'number' },
      { name: 'work_email', label: 'Email trabajo', type: 'email' },
      { name: 'work_phone', label: 'Telefono trabajo' },
      { name: 'mobile_phone', label: 'Celular' },
      { name: 'department_id', label: 'Departamento ID', type: 'number' },
      { name: 'job_id', label: 'Puesto ID', type: 'number' },
      { name: 'job_title', label: 'Cargo' },
      { name: 'employee_type', label: 'Tipo empleado' },
      { name: 'employment_status_id', label: 'Estado laboral ID', type: 'number' },
      { name: 'hire_date', label: 'Fecha alta', type: 'date' },
      { name: 'termination_date', label: 'Fecha baja', type: 'date' },
      { name: 'rehire_date', label: 'Fecha recontratacion', type: 'date' },
      { name: 'is_active_for_work', label: 'Activo para trabajar', type: 'checkbox' },
      { name: 'notes', label: 'Notas', type: 'textarea' },
      { name: 'active', label: 'Activo', type: 'checkbox' },
    ],
  },
  {
    key: 'employee-statuses',
    title: 'Estados laborales',
    endpoint: '/employee-statuses',
    icon: <BadgeCheck />,
    columns: ['id', 'name', 'code', 'allows_check_in', 'allows_assignments', 'active'],
    fields: [
      { name: 'name', label: 'Nombre', required: true },
      { name: 'code', label: 'Codigo', required: true },
      { name: 'allows_check_in', label: 'Permite check-in', type: 'checkbox' },
      { name: 'allows_assignments', label: 'Permite asignaciones', type: 'checkbox' },
      { name: 'requires_note', label: 'Requiere nota', type: 'checkbox' },
      { name: 'is_terminated', label: 'Despedido', type: 'checkbox' },
      { name: 'is_suspended', label: 'Suspendido', type: 'checkbox' },
      { name: 'is_incapacitated', label: 'Incapacitado', type: 'checkbox' },
      { name: 'is_rehire', label: 'Recontratado', type: 'checkbox' },
      { name: 'active', label: 'Activo', type: 'checkbox' },
    ],
  },
  {
    key: 'departments',
    title: 'Departamentos',
    endpoint: '/departments',
    icon: <DoorOpen />,
    columns: ['id', 'name', 'manager_id', 'active'],
    fields: [
      { name: 'name', label: 'Nombre', required: true },
      { name: 'manager_id', label: 'Manager ID', type: 'number' },
      { name: 'active', label: 'Activo', type: 'checkbox' },
    ],
  },
  {
    key: 'jobs',
    title: 'Puestos',
    endpoint: '/jobs',
    icon: <BriefcaseBusiness />,
    columns: ['id', 'name', 'description', 'active'],
    fields: [
      { name: 'name', label: 'Nombre', required: true },
      { name: 'description', label: 'Descripcion', type: 'textarea' },
      { name: 'active', label: 'Activo', type: 'checkbox' },
    ],
  },
  {
    key: 'roles',
    title: 'Roles',
    endpoint: '/roles',
    icon: <ShieldCheck />,
    columns: ['id', 'name', 'description', 'active'],
    fields: [
      { name: 'name', label: 'Nombre', required: true },
      { name: 'description', label: 'Descripcion', type: 'textarea' },
      { name: 'active', label: 'Activo', type: 'checkbox' },
    ],
  },

  {
    key: 'devices',
    title: 'Dispositivos',
    endpoint: '/devices',
    icon: <MonitorSmartphone />,
    columns: ['id', 'name', 'device_code', 'device_type', 'branch_id', 'active'],
    fields: [
      { name: 'name', label: 'Nombre', required: true },
      { name: 'device_code', label: 'Codigo dispositivo', required: true },
      { name: 'device_type', label: 'Tipo' },
      { name: 'branch_id', label: 'Sucursal ID', type: 'number' },
      { name: 'last_ip', label: 'Ultima IP' },
      { name: 'active', label: 'Activo', type: 'checkbox' },
    ],
  },
  {
    key: 'attendance-event-types',
    title: 'Tipos de evento',
    endpoint: '/attendance/event-types',
    icon: <CalendarClock />,
    columns: ['id', 'name', 'code', 'direction', 'opens_shift', 'closes_shift', 'sequence', 'active'],
    fields: [
      { name: 'name', label: 'Nombre', required: true },
      { name: 'code', label: 'Codigo', required: true },
      { name: 'direction', label: 'Direccion in/out', required: true },
      { name: 'opens_shift', label: 'Abre jornada', type: 'checkbox' },
      { name: 'closes_shift', label: 'Cierra jornada', type: 'checkbox' },
      { name: 'counts_as_worked_time', label: 'Cuenta como trabajo', type: 'checkbox' },
      { name: 'counts_as_break', label: 'Cuenta como break', type: 'checkbox' },
      { name: 'counts_as_meal', label: 'Cuenta como comida', type: 'checkbox' },
      { name: 'counts_as_non_worked', label: 'No trabajado', type: 'checkbox' },
      { name: 'allows_assignments_after', label: 'Permite asignaciones despues', type: 'checkbox' },
      { name: 'blocks_assignments_after', label: 'Bloquea asignaciones despues', type: 'checkbox' },
      { name: 'requires_face_id', label: 'Requiere Face ID', type: 'checkbox' },
      { name: 'allows_pin', label: 'Permite PIN', type: 'checkbox' },
      { name: 'requires_supervisor_validation', label: 'Requiere supervisor', type: 'checkbox' },
      { name: 'requires_note', label: 'Requiere nota', type: 'checkbox' },
      { name: 'requires_evidence', label: 'Requiere evidencia', type: 'checkbox' },
      { name: 'sequence', label: 'Secuencia', type: 'number' },
      { name: 'active', label: 'Activo', type: 'checkbox' },
    ],
  },
  {
    key: 'attendance-events',
    title: 'Eventos',
    endpoint: '/attendance/events',
    icon: <ClipboardList />,
    columns: ['id', 'employee_id', 'event_type_id', 'shift_id', 'timestamp', 'method', 'source', 'state'],
    fields: [
      { name: 'employee_id', label: 'Empleado ID', type: 'number', required: true },
      { name: 'event_type_id', label: 'Tipo evento ID', type: 'number', required: true },
      { name: 'method', label: 'Metodo' },
      { name: 'device_id', label: 'Dispositivo ID', type: 'number' },
      { name: 'timestamp', label: 'Fecha/hora', type: 'datetime-local' },
      { name: 'note', label: 'Nota', type: 'textarea' },
      { name: 'evidence_url', label: 'Evidencia URL' },
      { name: 'source', label: 'Origen' },
    ],
  },
  {
    key: 'no-attendance',
    title: 'No attendance',
    endpoint: '/no-attendance',
    icon: <CalendarX />,
    columns: ['id', 'employee_id', 'date', 'reason', 'state'],
    fields: [
      { name: 'employee_id', label: 'Empleado ID', type: 'number', required: true },
      { name: 'date', label: 'Fecha', type: 'date', required: true },
      { name: 'reason', label: 'Motivo', required: true },
      { name: 'note', label: 'Nota', type: 'textarea' },
      { name: 'evidence_url', label: 'Evidencia URL' },
      { name: 'state', label: 'Estado' },
    ],
  },
  {
    key: 'assignment-templates',
    title: 'Plantillas asignacion',
    endpoint: '/assignment-templates',
    icon: <ListChecks />,
    columns: ['id', 'name', 'state', 'active'],
    fields: [
      { name: 'name', label: 'Nombre', required: true },
      { name: 'description', label: 'Descripcion', type: 'textarea' },
      { name: 'state', label: 'Estado' },
      { name: 'active', label: 'Activo', type: 'checkbox' },
    ],
  },
  {
    key: 'rules',
    title: 'Reglas',
    endpoint: '/rules',
    icon: <ListChecks />,
    columns: ['id', 'name', 'rule_type', 'assignment_template_id', 'priority', 'blocks_check_in', 'blocks_check_out', 'active'],
    fields: [
      { name: 'name', label: 'Nombre', required: true },
      { name: 'rule_type', label: 'Tipo regla' },
      { name: 'employee_id', label: 'Empleado ID', type: 'number' },
      { name: 'role_id', label: 'Rol ID', type: 'number' },
      { name: 'branch_id', label: 'Sucursal ID', type: 'number' },
      { name: 'event_type_id', label: 'Tipo evento ID', type: 'number' },
      { name: 'assignment_template_id', label: 'Plantilla ID', type: 'number' },
      { name: 'priority', label: 'Prioridad', type: 'number' },
      { name: 'frequency_type', label: 'Frecuencia' },
      { name: 'frequency_value', label: 'Valor frecuencia' },
      { name: 'required', label: 'Requerida', type: 'checkbox' },
      { name: 'blocks_check_in', label: 'Bloquea check-in', type: 'checkbox' },
      { name: 'blocks_check_out', label: 'Bloquea check-out', type: 'checkbox' },
      { name: 'requires_supervisor_validation', label: 'Requiere supervisor', type: 'checkbox' },
      { name: 'requires_note', label: 'Requiere nota', type: 'checkbox' },
      { name: 'requires_evidence', label: 'Requiere evidencia', type: 'checkbox' },
      { name: 'active', label: 'Activo', type: 'checkbox' },
    ],
  },
  {
    key: 'auto-checkout-rules',
    title: 'Auto checkout',
    endpoint: '/auto-checkout-rules',
    icon: <CalendarClock />,
    columns: ['id', 'employee_id', 'branch_id', 'checkout_time', 'auto_checkout_enabled', 'active'],
    fields: [
      { name: 'employee_id', label: 'Empleado ID', type: 'number' },
      { name: 'branch_id', label: 'Sucursal ID', type: 'number' },
      { name: 'role_id', label: 'Rol ID', type: 'number' },
      { name: 'auto_checkout_enabled', label: 'Habilitado', type: 'checkbox' },
      { name: 'checkout_time', label: 'Hora salida' },
      { name: 'timezone', label: 'Zona horaria' },
      { name: 'note', label: 'Nota', type: 'textarea' },
      { name: 'active', label: 'Activo', type: 'checkbox' },
    ],
  },
];


const tableScreens = [
  { key: 'attendance-shifts', title: 'Jornadas', endpoint: '/attendance/shifts', columns: ['id', 'employee_id', 'check_in_at', 'check_out_at', 'worked_time_minutes', 'break_time_minutes', 'meal_time_minutes', 'state'] },
  { key: 'hr-attendance', title: 'hr_attendance', endpoint: '/attendance/hr-attendance', columns: ['id', 'employee_id', 'check_in', 'check_out', 'worked_hours', 'x_shift_id'] },
  { key: 'employee-assignments', title: 'Asignaciones empleado', endpoint: '/employee-assignments', columns: ['id', 'employee_id', 'shift_id', 'template_id', 'required', 'blocks_check_out', 'state'] },
  { key: 'biometric-logs', title: 'Logs biometricos', endpoint: '/biometric-logs', columns: ['id', 'employee_id', 'event_type', 'method', 'success', 'confidence_score', 'timestamp'] },
  { key: 'audit-logs', title: 'Auditoria', endpoint: '/audit-logs', columns: ['id', 'action', 'model_name', 'record_id', 'employee_id', 'timestamp'] },
];

function blankPayload(fields: Field[]) {
  return Object.fromEntries(fields.map((field) => [field.name, field.type === 'checkbox' ? true : '']));
}

function normalizePayload(payload: Record<string, unknown>, fields: Field[]) {
  const output: Record<string, unknown> = {};
  for (const field of fields) {
    const value = payload[field.name];
    if (field.type === 'checkbox') output[field.name] = Boolean(value);
    else if (field.type === 'number') output[field.name] = value === '' || value === null ? null : Number(value);
    else output[field.name] = value === '' ? null : value;
  }
  return output;
}

function LoginScreen({ onLogin }: { onLogin: (user: ApiUser) => void }) {
  const [login, setLogin] = useState('admin');
  const [password, setPassword] = useState('admin123');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError('');
    try {
      const response = await api.login(login, password);
      api.setToken(response.access_token);
      onLogin(response.user);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo iniciar sesion');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="login-page">
      <section className="login-box">
        <div className="brand" style={{ color: '#17202a', border: 0, padding: 0 }}>
          <div className="brand-mark">A</div>
          <div>
            <strong>Attendance SaaS</strong>
            <span>Core multiempresa</span>
          </div>
        </div>
        <form className="login-form" onSubmit={submit}>
          {error && <div className="error">{error}</div>}
          <label className="field">
            <span>Login</span>
            <input value={login} onChange={(event) => setLogin(event.target.value)} autoComplete="username" />
          </label>
          <label className="field">
            <span>Password</span>
            <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" />
          </label>
          <button className="primary" type="submit" disabled={loading}>
            <KeyRound size={18} /> {loading ? 'Entrando...' : 'Entrar'}
          </button>
        </form>
      </section>
    </main>
  );
}

function Dashboard({ user }: { user: ApiUser }) {
  return (
    <>
      <Header title="Dashboard" subtitle={`Empresa ${user.company_id} - ${user.name}`} />
      <div className="dashboard-grid">
        <div className="metric"><strong>1</strong><span>Fase activa</span></div>
        <div className="metric"><strong>JWT</strong><span>Autenticacion habilitada</span></div>
        <div className="metric"><strong>SQL</strong><span>MySQL + Alembic</span></div>
        <div className="metric"><strong>x_</strong><span>Tablas SaaS custom</span></div>
      </div>
    </>
  );
}

function Header({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="topbar">
      <div>
        <h1>{title}</h1>
        {subtitle && <p className="subtle">{subtitle}</p>}
      </div>
    </div>
  );
}

function CompanyScreen() {
  const fields: Field[] = [
    { name: 'name', label: 'Nombre', required: true },
    { name: 'legal_name', label: 'Razon social' },
    { name: 'vat', label: 'VAT/NIT' },
    { name: 'email', label: 'Email', type: 'email' },
    { name: 'phone', label: 'Telefono' },
    { name: 'website', label: 'Website' },
    { name: 'street', label: 'Direccion' },
    { name: 'city', label: 'Ciudad' },
    { name: 'country', label: 'Pais' },
    { name: 'timezone', label: 'Zona horaria' },
    { name: 'plan', label: 'Plan' },
    { name: 'state', label: 'Estado' },
    { name: 'active', label: 'Activo', type: 'checkbox' },
  ];
  const [payload, setPayload] = useState<Record<string, unknown>>({});
  const [error, setError] = useState('');

  async function load() {
    setError('');
    try {
      const data = await api.request<Record<string, unknown>>('/companies/current');
      setPayload(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo cargar la empresa');
    }
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError('');
    try {
      const data = await api.request<Record<string, unknown>>('/companies/current', { method: 'PUT', body: JSON.stringify(normalizePayload(payload, fields)) });
      setPayload(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar');
    }
  }

  useEffect(() => { load(); }, []);

  return (
    <>
      <Header title="Empresa" subtitle="Configuracion de la empresa actual" />
      {error && <div className="error">{error}</div>}
      <form className="panel" onSubmit={submit}>
        <div className="panel-header">
          <strong>Datos generales</strong>
          <button className="primary" type="submit"><Save size={16} /> Guardar</button>
        </div>
        <FormGrid fields={fields} payload={payload} setPayload={setPayload} />
      </form>
    </>
  );
}

function ResourceScreen({ config }: { config: ResourceConfig }) {
  const [items, setItems] = useState<Record<string, unknown>[]>([]);
  const [payload, setPayload] = useState<Record<string, unknown>>(blankPayload(config.fields));
  const [editingId, setEditingId] = useState<number | null>(null);
  const [error, setError] = useState('');

  async function load() {
    setError('');
    try {
      const data = await api.request<Record<string, unknown>[]>(config.endpoint);
      setItems(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo cargar');
    }
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError('');
    const path = editingId ? `${config.endpoint}/${editingId}` : config.endpoint;
    const method = editingId ? 'PUT' : 'POST';
    try {
      await api.request(path, { method, body: JSON.stringify(normalizePayload(payload, config.fields)) });
      setPayload(blankPayload(config.fields));
      setEditingId(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar');
    }
  }

  useEffect(() => { load(); }, [config.key]);

  return (
    <>
      <Header title={config.title} subtitle="CRUD administrativo" />
      {error && <div className="error">{error}</div>}
      <form className="panel" onSubmit={submit}>
        <div className="panel-header">
          <strong>{editingId ? `Editando #${editingId}` : 'Nuevo registro'}</strong>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="ghost" type="button" onClick={load}><RefreshCw size={16} /> Actualizar</button>
            <button className="primary" type="submit"><Save size={16} /> Guardar</button>
          </div>
        </div>
        <FormGrid fields={config.fields} payload={payload} setPayload={setPayload} />
      </form>
      <div style={{ height: 14 }} />
      <section className="panel">
        <div className="panel-header"><strong>Registros</strong><span className="badge">{items.length}</span></div>
        <div className="table-wrap">
          <table>
            <thead><tr>{config.columns.map((column) => <th key={column}>{column}</th>)}<th></th></tr></thead>
            <tbody>
              {items.map((item) => (
                <tr key={String(item.id)}>
                  {config.columns.map((column) => <td key={column}>{renderValue(item[column])}</td>)}
                  <td><button className="ghost" type="button" onClick={() => { setEditingId(Number(item.id)); setPayload({ ...blankPayload(config.fields), ...item, password: '', pin: '' }); }}>Editar</button></td>
                </tr>
              ))}
              {!items.length && <tr><td colSpan={config.columns.length + 1}>Sin registros</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}

function PermissionScreen() {
  const [items, setItems] = useState<Record<string, unknown>[]>([]);
  const [error, setError] = useState('');
  async function load() {
    try { setItems(await api.request<Record<string, unknown>[]>('/permissions')); }
    catch (err) { setError(err instanceof Error ? err.message : 'No se pudo cargar'); }
  }
  useEffect(() => { load(); }, []);
  return (
    <>
      <Header title="Permisos" subtitle="Catalogo seed inicial" />
      {error && <div className="error">{error}</div>}
      <section className="panel">
        <div className="panel-header"><strong>Permisos disponibles</strong><button className="ghost" type="button" onClick={load}><RefreshCw size={16} /> Actualizar</button></div>
        <div className="table-wrap">
          <table>
            <thead><tr><th>id</th><th>category</th><th>code</th><th>name</th><th>active</th></tr></thead>
            <tbody>{items.map((item) => <tr key={String(item.id)}><td>{renderValue(item.id)}</td><td>{renderValue(item.category)}</td><td>{renderValue(item.code)}</td><td>{renderValue(item.name)}</td><td>{renderValue(item.active)}</td></tr>)}</tbody>
          </table>
        </div>
      </section>
    </>
  );
}


function TableScreen({ config }: { config: { title: string; endpoint: string; columns: string[] } }) {
  const [items, setItems] = useState<Record<string, unknown>[]>([]);
  const [error, setError] = useState('');
  async function load() {
    setError('');
    try { setItems(await api.request<Record<string, unknown>[]>(config.endpoint)); }
    catch (err) { setError(err instanceof Error ? err.message : 'No se pudo cargar'); }
  }
  useEffect(() => { load(); }, [config.endpoint]);
  return (
    <>
      <Header title={config.title} subtitle="Vista administrativa Fase 2" />
      {error && <div className="error">{error}</div>}
      <section className="panel">
        <div className="panel-header"><strong>Registros</strong><button className="ghost" type="button" onClick={load}><RefreshCw size={16} /> Actualizar</button></div>
        <div className="table-wrap">
          <table>
            <thead><tr>{config.columns.map((column) => <th key={column}>{column}</th>)}</tr></thead>
            <tbody>
              {items.map((item) => <tr key={String(item.id)}>{config.columns.map((column) => <td key={column}>{renderValue(item[column])}</td>)}</tr>)}
              {!items.length && <tr><td colSpan={config.columns.length}>Sin registros</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}

function KioskScreen() {
  const [deviceCode, setDeviceCode] = useState(localStorage.getItem('kiosk_device_code') ?? 'KIOSK-DEMO');
  const [pin, setPin] = useState('');
  const [employee, setEmployee] = useState<Record<string, unknown> | null>(null);
  const [events, setEvents] = useState<Record<string, unknown>[]>([]);
  const [assignments, setAssignments] = useState<Record<string, unknown>[]>([]);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [showConfig, setShowConfig] = useState(false);
  const [tempDeviceCode, setTempDeviceCode] = useState(deviceCode);

  const [loginMethod, setLoginMethod] = useState<'face' | 'pin' | 'manager_override'>('face');
  const [authMethodUsed, setAuthMethodUsed] = useState<'pin' | 'face_id'>('pin');
  const [cameraActive, setCameraActive] = useState(true);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [mockFace, setMockFace] = useState('demo-face-admin');
  const [employeeNeedsFaceRegistration, setEmployeeNeedsFaceRegistration] = useState(false);

  const [managerPin, setManagerPin] = useState('');
  const [employeePin, setEmployeePin] = useState('');

  useEffect(() => {
    const shouldBeActive = (loginMethod === 'face' && !employee && cameraActive) || (employee && employeeNeedsFaceRegistration && cameraActive);
    if (shouldBeActive) {
      navigator.mediaDevices.getUserMedia({ video: { width: 320, height: 240 } })
        .then((s) => {
          setStream(s);
          const videoId = employee ? 'kiosk-register-webcam' : 'kiosk-webcam';
          const videoElement = document.getElementById(videoId) as HTMLVideoElement;
          if (videoElement) {
            videoElement.srcObject = s;
          }
        })
        .catch((err) => {
          console.error("No se pudo iniciar la camara:", err);
          setError("No se pudo acceder a la cámara. Usando fallback de prueba.");
          setCameraActive(false);
        });
    } else {
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
        setStream(null);
      }
    }
    return () => {
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }
    };
  }, [loginMethod, employee, employeeNeedsFaceRegistration, cameraActive]);

  async function loadEvents(employeeId: number) {
    const data = await api.request<Record<string, unknown>[]>(`/kiosk/employees/${employeeId}/available-events?device_code=${encodeURIComponent(deviceCode)}`);
    setEvents(data);
  }

  async function loadAssignments(employeeId: number) {
    const data = await api.request<Record<string, unknown>[]>(`/kiosk/employees/${employeeId}/assignments`);
    setAssignments(data);
  }

  async function identify(event: FormEvent) {
    event.preventDefault();
    setError('');
    setMessage('');
    try {
      await api.request(`/kiosk/${encodeURIComponent(deviceCode)}/config`);
      const data = await api.request<{ employee: Record<string, unknown> & { has_face_template?: boolean }; access_token?: string }>('/kiosk/identify-pin', {
        method: 'POST',
        body: JSON.stringify({ device_code: deviceCode, pin }),
      });
      
      const emp = data.employee;
      if (emp.has_face_template) {
        api.clearToken();
        throw new Error("Ya tienes un rostro registrado. Debes iniciar sesión con Face ID.");
      }
      
      if (data.access_token) {
        api.setToken(data.access_token);
      }
      setEmployee(emp);
      setAuthMethodUsed('pin');
      setEmployeeNeedsFaceRegistration(true);
      setCameraActive(true);
      setPin('');
    } catch (err) {
      setEmployee(null);
      setEvents([]);
      setAssignments([]);
      setError(err instanceof Error ? err.message : 'No se pudo identificar');
    }
  }

  async function identifyFace(customFace?: string) {
    setError('');
    setMessage('');
    let base64Image = '';
    
    if (customFace) {
      base64Image = customFace;
    } else if (cameraActive && stream) {
      const videoElement = document.getElementById('kiosk-webcam') as HTMLVideoElement;
      if (videoElement) {
        const canvas = document.createElement('canvas');
        canvas.width = videoElement.videoWidth || 320;
        canvas.height = videoElement.videoHeight || 240;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(videoElement, 0, 0, canvas.width, canvas.height);
          base64Image = canvas.toDataURL('image/jpeg');
        }
      }
    }
    
    if (!base64Image) {
      base64Image = mockFace;
    }
    
    try {
      await api.request(`/kiosk/${encodeURIComponent(deviceCode)}/config`);
      const data = await api.request<{ 
        success: boolean; 
        employee_id?: number; 
        employee_name?: string; 
        confidence_score?: number; 
        access_token?: string; 
        employee?: Record<string, unknown>;
      }>('/kiosk/identify-face', {
        method: 'POST',
        body: JSON.stringify({ image_base64: base64Image, device_code: deviceCode }),
      });
      
      if (!data.success) {
        throw new Error(`Identificación fallida (Confianza: ${data.confidence_score?.toFixed(2) ?? 0})`);
      }
      
      if (data.access_token && data.employee) {
        api.setToken(data.access_token);
        setEmployee(data.employee);
        setAuthMethodUsed('face_id');
        setEmployeeNeedsFaceRegistration(false);
        await loadEvents(Number(data.employee.id));
        await loadAssignments(Number(data.employee.id));
        setMessage(`Identificado con éxito (Confianza: ${data.confidence_score?.toFixed(2) ?? 0})`);
        setCameraActive(false);
      } else {
        throw new Error("No se pudo obtener el token de acceso para el empleado identificado.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo identificar por rostro');
    }
  }

  async function identifyManagerOverride(event: FormEvent) {
    event.preventDefault();
    setError('');
    setMessage('');
    try {
      await api.request(`/kiosk/${encodeURIComponent(deviceCode)}/config`);
      const data = await api.request<{ employee: Record<string, unknown>; access_token?: string }>('/kiosk/identify-manager-override', {
        method: 'POST',
        body: JSON.stringify({ device_code: deviceCode, employee_pin: employeePin, manager_pin: managerPin }),
      });
      
      if (data.access_token) {
        api.setToken(data.access_token);
      }
      setEmployee(data.employee);
      setAuthMethodUsed('pin');
      setEmployeeNeedsFaceRegistration(false);
      await loadEvents(Number(data.employee.id));
      await loadAssignments(Number(data.employee.id));
      setManagerPin('');
      setEmployeePin('');
      setCameraActive(false);
      setMessage("Inicio de sesión autorizado por Gerente.");
    } catch (err) {
      setEmployee(null);
      setEvents([]);
      setAssignments([]);
      setError(err instanceof Error ? err.message : 'No se pudo autorizar');
    }
  }

  async function registerEmployeeFace(customFace?: string) {
    if (!employee) return;
    setError('');
    setMessage('');
    let base64Image = '';
    
    if (customFace) {
      base64Image = customFace;
    } else if (cameraActive && stream) {
      const videoElement = document.getElementById('kiosk-register-webcam') as HTMLVideoElement;
      if (videoElement) {
        const canvas = document.createElement('canvas');
        canvas.width = videoElement.videoWidth || 320;
        canvas.height = videoElement.videoHeight || 240;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(videoElement, 0, 0, canvas.width, canvas.height);
          base64Image = canvas.toDataURL('image/jpeg');
        }
      }
    }
    
    if (!base64Image) {
      base64Image = mockFace;
    }
    
    try {
      await api.request(`/employees/${employee.id}/register-face`, {
        method: 'POST',
        body: JSON.stringify({ image_base64: base64Image, device_code: deviceCode }),
      });
      
      await loadEvents(Number(employee.id));
      await loadAssignments(Number(employee.id));
      setEmployeeNeedsFaceRegistration(false);
      setMessage('Rostro registrado y sesión iniciada con éxito.');
      setCameraActive(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo registrar el rostro');
    }
  }

  function logoutEmployee() {
    api.clearToken();
    setEmployee(null);
    setEvents([]);
    setAssignments([]);
    setMessage('');
    setError('');
    setPin('');
    setManagerPin('');
    setEmployeePin('');
    setAuthMethodUsed('pin');
    setEmployeeNeedsFaceRegistration(false);
    setLoginMethod('face');
    setCameraActive(true);
  }

  async function register(eventTypeId: number) {
    if (!employee) return;
    setError('');
    setMessage('');
    try {
      await api.request('/kiosk/attendance-events', {
        method: 'POST',
        body: JSON.stringify({ 
          employee_id: Number(employee.id), 
          event_type_id: eventTypeId, 
          device_code: deviceCode,
          method: authMethodUsed
        }),
      });
      setMessage('Evento registrado con éxito');
      await loadEvents(Number(employee.id));
      await loadAssignments(Number(employee.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo registrar el evento');
    }
  }

  async function completeAssignment(assignment: Record<string, unknown>) {
    setError('');
    setMessage('');
    try {
      const questions = await api.request<Record<string, unknown>[]>(`/assignment-templates/${assignment.template_id}/questions`);
      const answers = questions.map((question) => ({ question_id: Number(question.id), answer_boolean: question.question_type === 'boolean' ? true : undefined, answer_text: question.question_type === 'boolean' ? undefined : 'Completado' }));
      await api.request(`/employee-assignments/${assignment.id}/answers`, { method: 'POST', body: JSON.stringify({ answers }) });
      await api.request(`/employee-assignments/${assignment.id}/complete`, { method: 'POST', body: JSON.stringify({}) });
      setMessage('Asignación completada con éxito');
      if (employee) {
        await loadAssignments(Number(employee.id));
        await loadEvents(Number(employee.id));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo completar la asignación');
    }
  }

  if (!employee) {
    return (
      <div className="login-page" style={{ minHeight: '80vh', background: 'transparent', padding: '0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div className="login-box" style={{ width: '100%', position: 'relative', border: '1px solid #dce3ea', borderRadius: '16px', padding: '32px 24px', background: 'white' }}>
          <button 
            className="ghost" 
            type="button" 
            onClick={() => {
              setShowConfig(!showConfig);
              setTempDeviceCode(deviceCode);
            }}
            style={{ 
              position: 'absolute', 
              top: '16px', 
              right: '16px', 
              minHeight: '32px', 
              height: '32px', 
              width: '32px', 
              padding: '0', 
              borderRadius: '50%',
              display: 'grid',
              placeItems: 'center',
              border: 'none',
              background: '#e9eef3'
            }}
            title="Configurar dispositivo"
          >
            ⚙️
          </button>

          <div className="brand" style={{ color: '#17202a', border: 0, padding: 0, justifyContent: 'center', marginBottom: '28px', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div className="brand-mark" style={{ background: '#2f7dd1', color: 'white', fontWeight: 'bold' }}>K</div>
            <div>
              <strong>Kiosko Operativo</strong>
              <span style={{ fontSize: '12px', color: '#657487', display: 'block' }}>Marcación de Asistencia</span>
            </div>
          </div>

          {showConfig && (
            <div className="panel" style={{ padding: '16px', marginBottom: '20px', background: '#f8fafc', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
              <strong style={{ fontSize: '14px', display: 'block', marginBottom: '8px', color: '#1e293b' }}>Configurar Dispositivo</strong>
              <div style={{ display: 'flex', gap: '8px' }}>
                <input 
                  value={tempDeviceCode} 
                  onChange={(e) => setTempDeviceCode(e.target.value)} 
                  placeholder="Código de Dispositivo"
                  style={{ minHeight: '38px', height: '38px', padding: '8px 12px', borderRadius: '8px', border: '1px solid #cbd5e1' }}
                />
                <button 
                  className="primary" 
                  type="button" 
                  onClick={() => {
                    setDeviceCode(tempDeviceCode);
                    localStorage.setItem('kiosk_device_code', tempDeviceCode);
                    setShowConfig(false);
                  }}
                  style={{ minHeight: '38px', height: '38px', padding: '0 16px', borderRadius: '8px' }}
                >
                  Guardar
                </button>
              </div>
              <small style={{ color: '#64748b', marginTop: '6px', display: 'block' }}>Dispositivo actual: <code>{deviceCode}</code></small>
            </div>
          )}

          {loginMethod === 'face' && (
            <div style={{ display: 'grid', gap: '16px', marginTop: '0' }}>
              {error && <div className="error" style={{ fontSize: '13px', margin: '0' }}>{error}</div>}
              {message && <div className="badge" style={{ margin: '0', display: 'flex', justifyContent: 'center', padding: '6px' }}>{message}</div>}
              
              <div style={{ textAlign: 'center', display: 'grid', gap: '10px' }}>
                <span style={{ fontSize: '14px', color: '#475569', fontWeight: 'bold' }}>Reconocimiento Facial</span>
                
                <div style={{ 
                  width: '100%', 
                  height: '240px', 
                  background: '#0f172a', 
                  borderRadius: '12px', 
                  overflow: 'hidden', 
                  position: 'relative',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  border: '2px dashed #2f7dd1'
                }}>
                  {cameraActive ? (
                    <video 
                      id="kiosk-webcam" 
                      autoPlay 
                      playsInline 
                      muted 
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    />
                  ) : (
                    <div style={{ color: '#94a3b8', fontSize: '14px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
                      <ScanFace size={48} style={{ color: '#64748b' }} />
                      <span>Cámara desactivada</span>
                    </div>
                  )}
                  
                  {cameraActive && (
                    <div style={{
                      position: 'absolute',
                      top: '0',
                      left: '0',
                      width: '100%',
                      height: '2px',
                      background: 'rgba(47, 125, 209, 0.8)',
                      boxShadow: '0 0 8px 2px #2f7dd1',
                      animation: 'scan-line 3s linear infinite'
                    }} />
                  )}
                </div>
                
                <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                  <button 
                    type="button" 
                    className="ghost" 
                    onClick={() => setCameraActive(!cameraActive)}
                    style={{ minHeight: '38px', borderRadius: '8px' }}
                  >
                    {cameraActive ? 'Apagar' : 'Encender'}
                  </button>
                  <button 
                    type="button" 
                    className="primary" 
                    onClick={() => identifyFace()}
                    style={{ minHeight: '38px', borderRadius: '8px', flex: '1', fontWeight: 'bold' }}
                  >
                    <ScanFace size={18} /> Iniciar con Face ID
                  </button>
                </div>
              </div>

              {/* Fallback panel */}
              <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '10px', border: '1px solid #e2e8f0', display: 'grid', gap: '8px' }}>
                <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 'bold', textTransform: 'uppercase' }}>Prueba / Fallback Rostro</span>
                <div style={{ display: 'flex', gap: '6px' }}>
                  <input 
                    value={mockFace} 
                    onChange={(e) => setMockFace(e.target.value)} 
                    placeholder="ID de rostro (ej: demo-face-admin)"
                    style={{ minHeight: '34px', height: '34px', padding: '6px 10px', borderRadius: '6px', fontSize: '13px' }}
                  />
                  <button 
                    type="button" 
                    className="primary" 
                    onClick={() => identifyFace(mockFace)}
                    style={{ minHeight: '34px', height: '34px', fontSize: '12px', borderRadius: '6px', whiteSpace: 'nowrap' }}
                  >
                    Usar Mock
                  </button>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '10px' }}>
                <button 
                  type="button" 
                  className="ghost" 
                  onClick={() => {
                    setLoginMethod('pin');
                    setCameraActive(false);
                  }}
                  style={{ width: '100%', minHeight: '40px', borderRadius: '10px', fontSize: '13px', fontWeight: 'bold' }}
                >
                  🔢 Primera vez del empleado (Ingreso por PIN)
                </button>
                <button 
                  type="button" 
                  className="ghost" 
                  onClick={() => {
                    setLoginMethod('manager_override');
                    setCameraActive(false);
                  }}
                  style={{ width: '100%', minHeight: '40px', borderRadius: '10px', fontSize: '13px', fontWeight: 'bold' }}
                >
                  🔑 Autorización Gerente (Login manual)
                </button>
              </div>

              <style>{`
                @keyframes scan-line {
                  0% { top: 0%; }
                  50% { top: 100%; }
                  100% { top: 0%; }
                }
              `}</style>
            </div>
          )}

          {loginMethod === 'pin' && (
            <form className="login-form" onSubmit={identify} style={{ marginTop: '0', display: 'grid', gap: '16px' }}>
              {error && <div className="error" style={{ fontSize: '13px', margin: '0' }}>{error}</div>}
              {message && <div className="badge" style={{ margin: '0', display: 'flex', justifyContent: 'center', padding: '6px' }}>{message}</div>}
              
              <label className="field" style={{ textAlign: 'center', gap: '8px', display: 'grid' }}>
                <span style={{ fontSize: '14px', color: '#475569', fontWeight: 'bold' }}>Primera Vez - Ingresa tu PIN</span>
                <input 
                  type="password" 
                  inputMode="numeric" 
                  pattern="[0-9]*" 
                  maxLength={12}
                  value={pin} 
                  onChange={(event) => setPin(event.target.value)} 
                  placeholder="••••"
                  style={{ 
                    fontSize: '28px', 
                    textAlign: 'center', 
                    letterSpacing: '14px',
                    fontWeight: 'bold',
                    borderColor: '#3b82f6',
                    borderRadius: '12px',
                    padding: '12px',
                    outline: 'none',
                    background: '#f8fafc'
                  }} 
                  autoComplete="off"
                  required
                />
              </label>

              <button className="primary" type="submit" style={{ minHeight: '48px', fontSize: '16px', borderRadius: '12px', marginTop: '8px', fontWeight: 'bold' }}>
                <KeyRound size={20} /> Autenticar PIN
              </button>

              <button 
                type="button" 
                className="ghost" 
                onClick={() => {
                  setLoginMethod('face');
                  setCameraActive(true);
                }}
                style={{ width: '100%', minHeight: '44px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', fontWeight: 'bold' }}
              >
                Volver a Iniciar con Face ID
              </button>
            </form>
          )}

          {loginMethod === 'manager_override' && (
            <form className="login-form" onSubmit={identifyManagerOverride} style={{ marginTop: '0', display: 'grid', gap: '16px' }}>
              {error && <div className="error" style={{ fontSize: '13px', margin: '0' }}>{error}</div>}
              {message && <div className="badge" style={{ margin: '0', display: 'flex', justifyContent: 'center', padding: '6px' }}>{message}</div>}
              
              <span style={{ fontSize: '14px', color: '#475569', fontWeight: 'bold', textAlign: 'center' }}>Autorización de Gerente</span>
              
              <label className="field">
                <span>PIN del Empleado</span>
                <input 
                  type="password" 
                  inputMode="numeric"
                  value={employeePin}
                  onChange={(e) => setEmployeePin(e.target.value)}
                  placeholder="••••"
                  style={{ textAlign: 'center', fontSize: '18px', letterSpacing: '4px' }}
                  required
                />
              </label>

              <label className="field">
                <span>PIN del Gerente</span>
                <input 
                  type="password" 
                  inputMode="numeric"
                  value={managerPin}
                  onChange={(e) => setManagerPin(e.target.value)}
                  placeholder="••••"
                  style={{ textAlign: 'center', fontSize: '18px', letterSpacing: '4px' }}
                  required
                />
              </label>

              <button className="primary" type="submit" style={{ minHeight: '48px', fontSize: '16px', borderRadius: '12px', marginTop: '8px', fontWeight: 'bold' }}>
                <ShieldCheck size={20} /> Autorizar y Entrar
              </button>

              <button 
                type="button" 
                className="ghost" 
                onClick={() => {
                  setLoginMethod('face');
                  setCameraActive(true);
                }}
                style={{ width: '100%', minHeight: '44px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', fontWeight: 'bold' }}
              >
                Volver a Iniciar con Face ID
              </button>
            </form>
          )}
        </div>
      </div>
    );
  }

  if (employee && employeeNeedsFaceRegistration) {
    return (
      <div style={{ display: 'grid', gap: '16px', width: '100%', padding: '4px' }}>
        <div className="panel" style={{ background: 'linear-gradient(135deg, #16202a, #233243)', color: 'white', border: '0', borderRadius: '16px', padding: '20px', boxShadow: '0 8px 24px rgba(0,0,0,0.12)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <span style={{ color: '#94a3b8', fontSize: '12px', textTransform: 'uppercase', fontWeight: 'bold' }}>Primer Ingreso</span>
              <h2 style={{ fontSize: '20px', margin: '4px 0 0 0', fontWeight: '800' }}>{String(employee.name)}</h2>
              <small style={{ color: '#f59e0b', marginTop: '4px', display: 'block', fontWeight: '600' }}>Registro de Rostro Obligatorio</small>
            </div>
            <button type="button" onClick={logoutEmployee} style={{ background: 'rgba(255,255,255,0.15)', color: 'white', border: '0', borderRadius: '12px', padding: '8px 16px', fontSize: '13px', fontWeight: 'bold' }}>
              Cancelar
            </button>
          </div>
        </div>

        {error && <div className="error" style={{ margin: '0', fontSize: '13px' }}>{error}</div>}
        {message && <div className="badge" style={{ margin: '0', background: '#ecfdf5', color: '#047857', padding: '10px 14px', borderRadius: '10px' }}>{message}</div>}

        <div className="panel" style={{ borderRadius: '16px', padding: '20px', background: 'white', border: '1px solid #e2e8f0', display: 'grid', gap: '16px' }}>
          <div style={{ textAlign: 'center', display: 'grid', gap: '8px' }}>
            <span style={{ fontSize: '15px', color: '#1e293b', fontWeight: 'bold' }}>Registra tu rostro para poder ingresar en el futuro</span>
            
            <div style={{ 
              width: '100%', 
              height: '240px', 
              background: '#0f172a', 
              borderRadius: '12px', 
              overflow: 'hidden', 
              position: 'relative',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: '2px dashed #cbd5e1'
            }}>
              {cameraActive ? (
                <video 
                  id="kiosk-register-webcam" 
                  autoPlay 
                  playsInline 
                  muted 
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
              ) : (
                <div style={{ color: '#94a3b8', fontSize: '14px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
                  <ScanFace size={48} style={{ color: '#64748b' }} />
                  <span>Cámara desactivada</span>
                </div>
              )}
            </div>
            
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', marginTop: '10px' }}>
              <button 
                type="button" 
                className="ghost" 
                onClick={() => setCameraActive(!cameraActive)}
                style={{ minHeight: '38px', borderRadius: '8px' }}
              >
                {cameraActive ? 'Apagar Cámara' : 'Encender Cámara'}
              </button>
              <button 
                type="button" 
                className="primary" 
                onClick={() => registerEmployeeFace()}
                style={{ minHeight: '38px', borderRadius: '8px', flex: '1', fontWeight: 'bold' }}
              >
                Registrar Rostro y Entrar
              </button>
            </div>
          </div>

          {/* Test Fallback Section */}
          <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '10px', border: '1px solid #e2e8f0', display: 'grid', gap: '8px' }}>
            <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 'bold', textTransform: 'uppercase' }}>Simular / Fallback de Prueba</span>
            <div style={{ display: 'flex', gap: '6px' }}>
              <input 
                value={mockFace} 
                onChange={(e) => setMockFace(e.target.value)} 
                placeholder="Valor mock de rostro"
                style={{ minHeight: '34px', height: '34px', padding: '6px 10px', borderRadius: '6px', fontSize: '13px' }}
              />
              <button 
                type="button" 
                className="primary" 
                onClick={() => registerEmployeeFace(mockFace)}
                style={{ minHeight: '34px', height: '34px', fontSize: '12px', borderRadius: '6px' }}
              >
                Completar Mock
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'grid', gap: '16px', width: '100%', padding: '4px' }}>
      {/* Cabecera del Empleado */}
      <div className="panel" style={{ background: 'linear-gradient(135deg, #16202a, #233243)', color: 'white', border: '0', borderRadius: '16px', padding: '20px', boxShadow: '0 8px 24px rgba(0,0,0,0.12)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <span style={{ color: '#94a3b8', fontSize: '12px', textTransform: 'uppercase', fontWeight: 'bold', letterSpacing: '0.5px' }}>Bienvenido</span>
            <h2 style={{ fontSize: '22px', margin: '4px 0 0 0', fontWeight: '800' }}>{String(employee.name)}</h2>
            <small style={{ color: '#10b981', marginTop: '4px', display: 'block', fontWeight: '600' }}>Código: {String(employee.employee_code || '-')}</small>
          </div>
          <button 
            type="button" 
            onClick={logoutEmployee}
            style={{ 
              background: 'rgba(255,255,255,0.15)', 
              color: 'white', 
              border: '0', 
              borderRadius: '12px', 
              padding: '8px 16px', 
              fontSize: '13px', 
              fontWeight: 'bold',
              cursor: 'pointer',
              transition: 'background 0.2s'
            }}
          >
            Salir
          </button>
        </div>
      </div>

      {error && <div className="error" style={{ margin: '0', fontSize: '13px' }}>{error}</div>}
      {message && <div className="badge" style={{ margin: '0', background: '#ecfdf5', color: '#047857', padding: '10px 14px', width: '100%', justifyContent: 'center', fontWeight: 'bold', fontSize: '13px', borderRadius: '10px' }}>{message}</div>}

      {/* PANEL 1: REGISTRO DE EVENTOS */}
      <div className="panel" style={{ borderRadius: '16px', padding: '16px', background: 'white', border: '1px solid #e2e8f0' }}>
        <h3 style={{ fontSize: '15px', margin: '0 0 14px 0', color: '#1e293b', borderBottom: '1px solid #f1f5f9', paddingBottom: '10px', fontWeight: 'bold' }}>
          Marcaciones Disponibles
        </h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '10px' }}>
          {events.map((item) => (
            <button 
              className="primary" 
              key={String(item.id)} 
              type="button" 
              onClick={() => register(Number(item.id))}
              style={{ 
                minHeight: '54px', 
                fontSize: '16px', 
                fontWeight: 'bold', 
                borderRadius: '12px', 
                background: '#2f7dd1',
                boxShadow: '0 4px 12px rgba(47,125,209,0.15)',
                border: 'none'
              }}
            >
              {String(item.name)}
            </button>
          ))}
          {!events.length && (
            <div style={{ textAlign: 'center', padding: '24px', color: '#64748b', fontSize: '14px' }}>
              No tienes eventos disponibles en este momento.
            </div>
          )}
        </div>
      </div>

      {/* PANEL 2: ASIGNACIONES PENDIENTES */}
      <div className="panel" style={{ borderRadius: '16px', padding: '16px', background: 'white', border: '1px solid #e2e8f0' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', borderBottom: '1px solid #f1f5f9', paddingBottom: '10px' }}>
          <h3 style={{ fontSize: '15px', margin: '0', color: '#1e293b', fontWeight: 'bold' }}>Tareas / Asignaciones</h3>
          <span className="badge" style={{ background: '#f1f5f9', color: '#1e293b', fontWeight: 'bold', borderRadius: '8px' }}>{assignments.length}</span>
        </div>
        <div style={{ display: 'grid', gap: '10px' }}>
          {assignments.map((item) => (
            <div 
              key={String(item.id)} 
              style={{ 
                padding: '14px', 
                borderRadius: '12px', 
                border: '1px solid #e2e8f0', 
                background: '#f8fafc',
                display: 'flex',
                flexDirection: 'column',
                gap: '10px'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '14px', fontWeight: 'bold', color: '#1e293b' }}>Asignación #{String(item.id)}</span>
                <span className="badge" style={{ textTransform: 'uppercase', fontSize: '11px', fontWeight: 'bold' }}>{String(item.state)}</span>
              </div>
              <button 
                className="ghost" 
                type="button" 
                onClick={() => completeAssignment(item)}
                style={{ 
                  width: '100%', 
                  minHeight: '38px', 
                  fontSize: '13px', 
                  fontWeight: 'bold',
                  background: '#cbd5e1', 
                  color: '#1e293b',
                  borderRadius: '8px',
                  border: 'none'
                }}
              >
                Completar Tarea
              </button>
            </div>
          ))}
          {!assignments.length && (
            <div style={{ textAlign: 'center', padding: '24px', color: '#64748b', fontSize: '14px' }}>
              ¡Excelente! No tienes tareas pendientes.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}



function AssignmentQuestionsScreen() {
  const fields: Field[] = [
    { name: 'name', label: 'Nombre', required: true },
    { name: 'question_text', label: 'Pregunta', type: 'textarea', required: true },
    { name: 'question_type', label: 'Tipo' },
    { name: 'options_json', label: 'Opciones JSON', type: 'textarea' },
    { name: 'required', label: 'Requerida', type: 'checkbox' },
    { name: 'requires_evidence', label: 'Requiere evidencia', type: 'checkbox' },
    { name: 'requires_supervisor_validation', label: 'Requiere supervisor', type: 'checkbox' },
    { name: 'sequence', label: 'Secuencia', type: 'number' },
    { name: 'active', label: 'Activo', type: 'checkbox' },
  ];
  const [templateId, setTemplateId] = useState('1');
  const [items, setItems] = useState<Record<string, unknown>[]>([]);
  const [payload, setPayload] = useState<Record<string, unknown>>(blankPayload(fields));
  const [error, setError] = useState('');

  async function load() {
    setError('');
    try { setItems(await api.request<Record<string, unknown>[]>(`/assignment-templates/${templateId}/questions`)); }
    catch (err) { setError(err instanceof Error ? err.message : 'No se pudo cargar'); }
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError('');
    try {
      await api.request(`/assignment-templates/${templateId}/questions`, { method: 'POST', body: JSON.stringify(normalizePayload(payload, fields)) });
      setPayload(blankPayload(fields));
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar');
    }
  }

  return (
    <>
      <Header title="Preguntas" subtitle="Preguntas por plantilla" />
      {error && <div className="error">{error}</div>}
      <form className="panel" onSubmit={submit}>
        <div className="panel-header"><strong>Nueva pregunta</strong><button className="primary" type="submit"><Save size={16} /> Guardar</button></div>
        <div className="grid"><label className="field"><span>Plantilla ID</span><input value={templateId} onChange={(event) => setTemplateId(event.target.value)} /></label></div>
        <FormGrid fields={fields} payload={payload} setPayload={setPayload} />
      </form>
      <section className="panel" style={{ marginTop: 14 }}>
        <div className="panel-header"><strong>Preguntas</strong><button className="ghost" type="button" onClick={load}><RefreshCw size={16} /> Actualizar</button></div>
        <div className="table-wrap"><table><thead><tr><th>id</th><th>name</th><th>question_type</th><th>required</th><th>active</th></tr></thead><tbody>{items.map((item) => <tr key={String(item.id)}><td>{renderValue(item.id)}</td><td>{renderValue(item.name)}</td><td>{renderValue(item.question_type)}</td><td>{renderValue(item.required)}</td><td>{renderValue(item.active)}</td></tr>)}</tbody></table></div>
      </section>
    </>
  );
}


function ReportsScreen() {
  const reports = [
    { key: 'hours', title: 'Horas', endpoint: '/reports/hours' },
    { key: 'assignments', title: 'Asignaciones', endpoint: '/reports/assignments' },
    { key: 'attendance-exceptions', title: 'Excepciones', endpoint: '/reports/attendance-exceptions' },
    { key: 'biometric', title: 'Biometria', endpoint: '/reports/biometric' },
    { key: 'audit', title: 'Auditoria', endpoint: '/reports/audit' },
  ];
  const [active, setActive] = useState(reports[0]);
  const [items, setItems] = useState<Record<string, unknown>[]>([]);
  const [error, setError] = useState('');
  async function load(report = active) {
    setError('');
    setActive(report);
    try {
      const data = await api.request<{ items: Record<string, unknown>[] }>(report.endpoint);
      setItems(data.items);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo cargar');
    }
  }
  useEffect(() => { load(active); }, []);
  const columns = Array.from(new Set(items.flatMap((item) => Object.keys(item))));
  return (
    <>
      <Header title="Reportes" subtitle="Resumen operativo" />
      {error && <div className="error">{error}</div>}
      <section className="panel">
        <div className="panel-header"><strong>{active.title}</strong><div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>{reports.map((item) => <button className="ghost" key={item.key} type="button" onClick={() => load(item)}>{item.title}</button>)}</div></div>
        <div className="table-wrap"><table><thead><tr>{columns.map((column) => <th key={column}>{column}</th>)}</tr></thead><tbody>{items.map((item, index) => <tr key={index}>{columns.map((column) => <td key={column}>{renderValue(item[column])}</td>)}</tr>)}{!items.length && <tr><td>Sin datos</td></tr>}</tbody></table></div>
      </section>
    </>
  );
}

function FaceIdScreen() {
  const [employeeId, setEmployeeId] = useState('1');
  const [imageBase64, setImageBase64] = useState('demo-face-admin');
  const [deviceCode, setDeviceCode] = useState('KIOSK-DEMO');
  const [result, setResult] = useState('');
  const [error, setError] = useState('');
  const [cameraActive, setCameraActive] = useState(false);
  const [stream, setStream] = useState<MediaStream | null>(null);

  useEffect(() => {
    if (cameraActive) {
      navigator.mediaDevices.getUserMedia({ video: { width: 320, height: 240 } })
        .then((s) => {
          setStream(s);
          const videoElement = document.getElementById('admin-webcam') as HTMLVideoElement;
          if (videoElement) {
            videoElement.srcObject = s;
          }
        })
        .catch((err) => {
          console.error("No se pudo iniciar la camara:", err);
          setError("No se pudo acceder a la cámara. Usando fallback de prueba.");
          setCameraActive(false);
        });
    } else {
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
        setStream(null);
      }
    }
    return () => {
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }
    };
  }, [cameraActive]);

  async function capturePhoto() {
    if (cameraActive && stream) {
      const videoElement = document.getElementById('admin-webcam') as HTMLVideoElement;
      if (videoElement) {
        const canvas = document.createElement('canvas');
        canvas.width = videoElement.videoWidth || 320;
        canvas.height = videoElement.videoHeight || 240;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(videoElement, 0, 0, canvas.width, canvas.height);
          const base64 = canvas.toDataURL('image/jpeg');
          setImageBase64(base64);
          setResult('Foto capturada con éxito de la cámara.');
        }
      }
    }
  }

  async function registerFace(event: FormEvent) {
    event.preventDefault();
    setError('');
    setResult('');
    try {
      const data = await api.request<Record<string, unknown>>(`/employees/${employeeId}/register-face`, { method: 'POST', body: JSON.stringify({ image_base64: imageBase64, device_code: deviceCode }) });
      setResult(`Face template #${data.id} registrado para el empleado #${employeeId}`);
    } catch (err) { setError(err instanceof Error ? err.message : 'No se pudo registrar'); }
  }

  async function identifyFace() {
    setError('');
    setResult('');
    try {
      const data = await api.request<Record<string, unknown>>('/kiosk/identify-face', { method: 'POST', body: JSON.stringify({ image_base64: imageBase64, device_code: deviceCode }) });
      setResult(`Resultado Identificación: ${JSON.stringify(data)}`);
    } catch (err) { setError(err instanceof Error ? err.message : 'No se pudo identificar'); }
  }

  async function processAutoCheckout() {
    setError('');
    try {
      const data = await api.request<Record<string, unknown>>('/jobs/process-auto-checkout', { method: 'POST', body: JSON.stringify({}) });
      setResult(JSON.stringify(data));
    } catch (err) { setError(err instanceof Error ? err.message : 'No se pudo procesar'); }
  }

  return (
    <>
      <Header title="Face ID" subtitle="Provider mock" />
      {error && <div className="error">{error}</div>}
      {result && <div className="badge" style={{ marginBottom: 12 }}>{result}</div>}
      
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '16px' }}>
        <form className="panel" onSubmit={registerFace}>
          <div className="panel-header"><strong>Registro Face ID</strong><button className="primary" type="submit"><ScanFace size={16} /> Registrar Plantilla</button></div>
          <div className="grid">
            <label className="field"><span>Empleado ID</span><input value={employeeId} onChange={(event) => setEmployeeId(event.target.value)} /></label>
            <label className="field"><span>Dispositivo</span><input value={deviceCode} onChange={(event) => setDeviceCode(event.target.value)} /></label>
            <label className="field">
              <span>Imagen base64 o Mock Text</span>
              <textarea 
                value={imageBase64} 
                onChange={(event) => setImageBase64(event.target.value)} 
                rows={4}
                style={{ fontFamily: 'monospace', fontSize: '11px' }}
              />
            </label>
          </div>
        </form>

        <div className="panel" style={{ display: 'flex', flexDirection: 'column' }}>
          <div className="panel-header"><strong>Capturar Foto</strong></div>
          <div style={{ padding: '14px', flex: '1', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ 
              width: '100%', 
              height: '200px', 
              background: '#0f172a', 
              borderRadius: '8px', 
              overflow: 'hidden', 
              position: 'relative',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: '1px solid #cbd5df'
            }}>
              {cameraActive ? (
                <video 
                  id="admin-webcam" 
                  autoPlay 
                  playsInline 
                  muted 
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
              ) : (
                <span style={{ color: '#94a3b8', fontSize: '13px' }}>Cámara apagada</span>
              )}
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button 
                type="button" 
                className="ghost" 
                onClick={() => setCameraActive(!cameraActive)}
                style={{ flex: '1' }}
              >
                {cameraActive ? 'Apagar Cámara' : 'Encender Cámara'}
              </button>
              <button 
                type="button" 
                className="primary" 
                onClick={capturePhoto}
                disabled={!cameraActive}
                style={{ flex: '1' }}
              >
                Tomar Foto
              </button>
            </div>
          </div>
        </div>
      </div>

      <section className="panel" style={{ marginTop: 14 }}>
        <div className="panel-header">
          <strong>Acciones de Simulación</strong>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="ghost" type="button" onClick={identifyFace}><ScanFace size={16} /> Identificar usando esta plantilla</button>
            <button className="ghost" type="button" onClick={processAutoCheckout}><CalendarClock size={16} /> Auto checkout</button>
          </div>
        </div>
      </section>
    </>
  );
}

function FormGrid({ fields, payload, setPayload }: { fields: Field[]; payload: Record<string, unknown>; setPayload: (value: Record<string, unknown>) => void }) {
  return (
    <div className="grid">
      {fields.map((field) => (
        <label className="field" key={field.name}>
          <span>{field.label}</span>
          {field.type === 'textarea' ? (
            <textarea value={String(payload[field.name] ?? '')} onChange={(event) => setPayload({ ...payload, [field.name]: event.target.value })} />
          ) : field.type === 'checkbox' ? (
            <input type="checkbox" checked={Boolean(payload[field.name])} onChange={(event) => setPayload({ ...payload, [field.name]: event.target.checked })} />
          ) : (
            <input type={field.type ?? 'text'} required={field.required} value={String(payload[field.name] ?? '')} onChange={(event) => setPayload({ ...payload, [field.name]: event.target.value })} />
          )}
        </label>
      ))}
    </div>
  );
}

function renderValue(value: unknown) {
  if (typeof value === 'boolean') return value ? <span className="badge">Si</span> : 'No';
  if (value === null || value === undefined || value === '') return '-';
  return String(value);
}

export function App() {
  const isBackendAdminPath = window.location.pathname.includes('admindash');
  const [mode, setMode] = useState<'admin' | 'kiosk'>(isBackendAdminPath ? 'admin' : 'kiosk');

  const [user, setUser] = useState<ApiUser | null>(null);
  const [screen, setScreen] = useState('dashboard');
  const resource = useMemo(() => resources.find((item) => item.key === screen), [screen]);
  const tableScreen = useMemo(() => tableScreens.find((item) => item.key === screen), [screen]);

  useEffect(() => {
    if (mode === 'admin') {
      if (!api.token) return;
      api.request<ApiUser>('/auth/me').then(setUser).catch(() => api.clearToken());
    } else {
      api.clearToken();
    }
  }, [mode]);

  if (mode === 'kiosk') {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: '#f6f7f9', padding: '24px 16px' }}>
        <main style={{ maxWidth: '800px', width: '100%', margin: '0 auto' }}>
          <KioskScreen />
        </main>
      </div>
    );
  }

  if (!user) return <LoginScreen onLogin={setUser} />;

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">A</div>
          <div><strong>Attendance SaaS</strong><span>Fase 4</span></div>
        </div>
        <nav className="nav">
          <button className={screen === 'dashboard' ? 'active' : ''} onClick={() => setScreen('dashboard')}><LayoutDashboard /> Dashboard</button>
          <button className={screen === 'company' ? 'active' : ''} onClick={() => setScreen('company')}><Building2 /> Empresa</button>
          {resources.map((item) => <button key={item.key} className={screen === item.key ? 'active' : ''} onClick={() => setScreen(item.key)}>{item.icon} {item.title}</button>)}
          <button className={screen === 'permissions' ? 'active' : ''} onClick={() => setScreen('permissions')}><CheckSquare /> Permisos</button>
          <button className={screen === 'assignment-questions' ? 'active' : ''} onClick={() => setScreen('assignment-questions')}><ListChecks /> Preguntas</button>
          <button className={screen === 'face-id' ? 'active' : ''} onClick={() => setScreen('face-id')}><ScanFace /> Face ID</button>
          <button className={screen === 'reports' ? 'active' : ''} onClick={() => setScreen('reports')}><ClipboardList /> Reportes</button>
          {tableScreens.map((item) => <button key={item.key} className={screen === item.key ? 'active' : ''} onClick={() => setScreen(item.key)}><ClipboardList /> {item.title}</button>)}
          <button onClick={() => window.open('/', '_blank')}><KeyRound /> Kiosko PIN</button>
        </nav>
        <div className="session">
          <span>{user.login}</span>
          <button className="ghost" onClick={() => { api.clearToken(); setUser(null); }}><LogOut size={16} /> Salir</button>
        </div>
      </aside>
      <main className="main">
        {screen === 'dashboard' && <Dashboard user={user} />}
        {screen === 'company' && <CompanyScreen />}
        {screen === 'permissions' && <PermissionScreen />}
        {screen === 'assignment-questions' && <AssignmentQuestionsScreen />}
        {screen === 'face-id' && <FaceIdScreen />}
        {screen === 'reports' && <ReportsScreen />}
        {resource && <ResourceScreen config={resource} />}
        {tableScreen && <TableScreen config={tableScreen} />}
        {screen === 'kiosk' && <KioskScreen />}
      </main>
    </div>
  );
}
