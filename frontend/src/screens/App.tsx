import { FormEvent, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import {
  BadgeCheck,
  CalendarClock,
  CalendarX,
  ClipboardList,
  ListChecks,
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
  Settings,
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
    columns: ['id', 'name', 'login', 'email', 'pin_plain', 'is_company_admin', 'active'],
    fields: [
      { name: 'name', label: 'Nombre', required: true },
      { name: 'login', label: 'Login', required: true },
      { name: 'email', label: 'Email', type: 'email' },
      { name: 'password', label: 'Password (Opcional)', type: 'password' },
      { name: 'pin', label: 'PIN (Obligatorio para Kiosko)', type: 'text' },
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
      { name: 'name', label: 'Nombre visible (Obligatorio)', required: true },
      { name: 'employee_code', label: 'Código empleado (Obligatorio)', required: true },
      { name: 'create_user_profile', label: '¿Crear usuario de acceso automáticamente?', type: 'checkbox' },
      { name: 'user_login', label: 'Nombre de usuario (Login)', type: 'text' },
      { name: 'user_pin', label: 'PIN de Kiosko (Para marcación)', type: 'text' },
      { name: 'first_name', label: 'Nombres' },
      { name: 'last_name', label: 'Apellidos' },
      { name: 'branch_id', label: 'Sucursal ID', type: 'number' },
      { name: 'user_id', label: 'Usuario ID (Solo si ya existe)', type: 'number' },
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
    columns: ['id', 'employee_name', 'event_type_name', 'shift_id', 'timestamp', 'method', 'source', 'state'],
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
  { key: 'audit-logs', title: 'Auditoria', endpoint: '/audit-logs', columns: ['id', 'action', 'model_name', 'record_id', 'employee_id', 'timestamp'] },
];

function blankPayload(fields: Field[], itemsLength = 0) {
  const payload = Object.fromEntries(fields.map((field) => [field.name, field.type === 'checkbox' ? true : '']));
  if (fields.some(f => f.name === 'employee_code')) {
    payload['employee_code'] = `EMP-${String(itemsLength + 1).padStart(3, '0')}`;
    payload['branch_id'] = 1;
    payload['department_id'] = 1;
    payload['job_id'] = 1;
    payload['employment_status_id'] = 1;
  }
  return payload;
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
  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');
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
      setError(err instanceof Error ? err.message : 'No se pudo iniciar sesión');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="login-page">
      <section className="login-box">
        <div className="brand" style={{ color: '#17202a', border: 0, padding: 0, justifyContent: 'center', marginBottom: '24px' }}>
          <div className="brand-mark">A</div>
          <div>
            <strong>Attendance SaaS</strong>
            <span>Control de Asistencia</span>
          </div>
        </div>
        <div style={{ textAlign: 'center', marginBottom: '20px' }}>
          <h2 style={{ fontSize: '20px', fontWeight: 700, color: '#1e293b', margin: '0 0 6px 0' }}>Iniciar Sesión</h2>
          <p style={{ fontSize: '13px', color: '#64748b', margin: 0 }}>Accede al portal administrativo</p>
        </div>
        <form className="login-form" onSubmit={submit}>
          {error && <div className="error" style={{ fontSize: '13px', margin: '0 0 4px 0' }}>{error}</div>}
          <label className="field">
            <span>Usuario</span>
            <input 
              value={login} 
              onChange={(event) => setLogin(event.target.value)} 
              autoComplete="username" 
              placeholder="Ingresa tu usuario" 
              required
            />
          </label>
          <label className="field">
            <span>Contraseña</span>
            <input 
              type="password" 
              value={password} 
              onChange={(event) => setPassword(event.target.value)} 
              autoComplete="current-password" 
              placeholder="••••••••"
              required
            />
          </label>
          <button className="primary" type="submit" disabled={loading} style={{ minHeight: '44px', borderRadius: '10px', marginTop: '10px', fontWeight: 'bold', fontSize: '14px' }}>
            {loading ? 'Iniciando sesión...' : 'Entrar al Sistema'}
          </button>
        </form>
      </section>
    </main>
  );
}

function Dashboard({ user }: { user: ApiUser }) {
  const [metrics, setMetrics] = useState({
    totalEmployees: 0,
    activeShifts: 0,
    pendingTasks: 0,
    totalDevices: 0
  });
  const [activeWorkers, setActiveWorkers] = useState<{ id: number; name: string; time: string }[]>([]);
  const [tasksToApprove, setTasksToApprove] = useState<{ id: number; employeeName: string; templateId: number }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadDashboardData() {
      try {
        const emps = await api.request<any[]>('/employees');
        const sfts = await api.request<any[]>('/attendance/shifts');
        const assigns = await api.request<any[]>('/employee-assignments');
        const devs = await api.request<any[]>('/devices');

        const activeSfts = sfts.filter(s => s.state === 'open');
        const pendingAssigns = assigns.filter(a => a.state === 'validation_pending');

        setMetrics({
          totalEmployees: emps.length,
          activeShifts: activeSfts.length,
          pendingTasks: pendingAssigns.length,
          totalDevices: devs.length
        });

        // Resolver nombres de trabajadores activos
        const workers = activeSfts.map(s => {
          const emp = emps.find(e => e.id === s.employee_id);
          const time = s.check_in_at ? new Date(s.check_in_at).toLocaleTimeString() : 'N/A';
          return {
            id: s.id,
            name: emp ? emp.name : `Empleado #${s.employee_id}`,
            time
          };
        });
        setActiveWorkers(workers);

        // Resolver nombres de tareas que necesitan aprobación
        const tasks = pendingAssigns.map(a => {
          const emp = emps.find(e => e.id === a.employee_id);
          return {
            id: a.id,
            employeeName: emp ? emp.name : `Empleado #${a.employee_id}`,
            templateId: a.template_id
          };
        });
        setTasksToApprove(tasks);
      } catch (err) {
        console.error("Error loading dashboard data", err);
      } finally {
        setLoading(false);
      }
    }
    loadDashboardData();
  }, []);

  if (loading) {
    return (
      <div style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>
        <strong>Cargando resumen operacional...</strong>
      </div>
    );
  }

  return (
    <>
      <Header title="Dashboard" subtitle={`Consola de control de ${user.name}`} />
      
      {/* Tarjetas de Métricas */}
      <div className="dashboard-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', marginBottom: '24px' }}>
        <div className="metric" style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: '16px', padding: '20px', display: 'flex', flexDirection: 'column', gap: '4px', boxShadow: '0 4px 10px rgba(0,0,0,0.02)' }}>
          <strong style={{ fontSize: '32px', color: '#2f7dd1' }}>{metrics.totalEmployees}</strong>
          <span style={{ color: '#64748b', fontSize: '13px', fontWeight: 'bold' }}>Colaboradores Registrados</span>
        </div>
        <div className="metric" style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: '16px', padding: '20px', display: 'flex', flexDirection: 'column', gap: '4px', boxShadow: '0 4px 10px rgba(0,0,0,0.02)' }}>
          <strong style={{ fontSize: '32px', color: '#10b981' }}>{metrics.activeShifts}</strong>
          <span style={{ color: '#64748b', fontSize: '13px', fontWeight: 'bold' }}>Jornadas Activas Hoy</span>
        </div>
        <div className="metric" style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: '16px', padding: '20px', display: 'flex', flexDirection: 'column', gap: '4px', boxShadow: '0 4px 10px rgba(0,0,0,0.02)' }}>
          <strong style={{ fontSize: '32px', color: metrics.pendingTasks > 0 ? '#f59e0b' : '#64748b' }}>{metrics.pendingTasks}</strong>
          <span style={{ color: '#64748b', fontSize: '13px', fontWeight: 'bold' }}>Tareas por Validar</span>
        </div>
        <div className="metric" style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: '16px', padding: '20px', display: 'flex', flexDirection: 'column', gap: '4px', boxShadow: '0 4px 10px rgba(0,0,0,0.02)' }}>
          <strong style={{ fontSize: '32px', color: '#6366f1' }}>{metrics.totalDevices}</strong>
          <span style={{ color: '#64748b', fontSize: '13px', fontWeight: 'bold' }}>Dispositivos Kiosko</span>
        </div>
      </div>

      {/* Contenido Operacional */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px' }}>
        
        {/* Colaboradores Activos */}
        <div className="panel" style={{ borderRadius: '16px', background: 'white', border: '1px solid #e2e8f0', padding: '20px' }}>
          <h3 style={{ fontSize: '15px', margin: '0 0 16px 0', borderBottom: '1px solid #f1f5f9', paddingBottom: '10px', color: '#1e293b', fontWeight: 'bold' }}>
            🟢 Trabajando Actualmente ({activeWorkers.length})
          </h3>
          <div style={{ display: 'grid', gap: '10px' }}>
            {activeWorkers.map(w => (
              <div key={w.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', background: '#f8fafc', borderRadius: '8px', fontSize: '13px' }}>
                <strong>{w.name}</strong>
                <span style={{ color: '#64748b' }}>Entró: {w.time}</span>
              </div>
            ))}
            {activeWorkers.length === 0 && (
              <div style={{ padding: '20px', textAlign: 'center', color: '#94a3b8', fontSize: '13px' }}>
                No hay jornadas activas registradas en este momento.
              </div>
            )}
          </div>
        </div>

        {/* Tareas por Validar */}
        <div className="panel" style={{ borderRadius: '16px', background: 'white', border: '1px solid #e2e8f0', padding: '20px' }}>
          <h3 style={{ fontSize: '15px', margin: '0 0 16px 0', borderBottom: '1px solid #f1f5f9', paddingBottom: '10px', color: '#1e293b', fontWeight: 'bold' }}>
            ⚠️ Tareas Pendientes de Aprobación ({tasksToApprove.length})
          </h3>
          <div style={{ display: 'grid', gap: '10px' }}>
            {tasksToApprove.map(t => (
              <div key={t.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', background: '#fffbeb', border: '1px solid #fef3c7', borderRadius: '8px', fontSize: '13px' }}>
                <div>
                  <strong>{t.employeeName}</strong>
                  <span style={{ display: 'block', fontSize: '11px', color: '#b45309' }}>Plantilla de Tarea #{t.templateId}</span>
                </div>
                <span className="badge" style={{ background: '#fef3c7', color: '#b45309', fontWeight: 'bold', fontSize: '11px' }}>Por Validar</span>
              </div>
            ))}
            {tasksToApprove.length === 0 && (
              <div style={{ padding: '20px', textAlign: 'center', color: '#94a3b8', fontSize: '13px' }}>
                No hay tareas pendientes de validación por gerentes.
              </div>
            )}
          </div>
        </div>

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
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Tab states and data states
  const [templates, setTemplates] = useState<Record<string, any>[]>([]);
  const [allAssignments, setAllAssignments] = useState<Record<string, any>[]>([]);
  const [allShifts, setAllShifts] = useState<Record<string, any>[]>([]);
  const [allAuditLogs, setAllAuditLogs] = useState<Record<string, any>[]>([]);
  const [activeTab, setActiveTab] = useState<'ficha' | 'tareas' | 'historial' | 'auditoria'>('ficha');

  // Sub-formulario de nueva asignación
  const [newAssignTemplateId, setNewAssignTemplateId] = useState('');
  const [newAssignRequired, setNewAssignRequired] = useState(true);
  const [newAssignBlockIn, setNewAssignBlockIn] = useState(false);
  const [newAssignBlockOut, setNewAssignBlockOut] = useState(false);

  async function load() {
    setError('');
    try {
      const data = await api.request<Record<string, unknown>[]>(config.endpoint);
      setItems(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo cargar');
    }
  }

  async function fetchExtraData() {
    try {
      const tmps = await api.request<Record<string, any>[]>('/assignment-templates');
      setTemplates(tmps);
      if (tmps.length > 0) setNewAssignTemplateId(String(tmps[0].id));
      
      const assigns = await api.request<Record<string, any>[]>('/employee-assignments');
      setAllAssignments(assigns);
      
      const sfts = await api.request<Record<string, any>[]>('/attendance/shifts');
      setAllShifts(sfts);

      const logs = await api.request<Record<string, any>[]>('/audit-logs');
      setAllAuditLogs(logs);
    } catch (e) {
      console.error("No se pudo cargar la data extra del empleado", e);
    }
  }

  async function assignTask() {
    if (!newAssignTemplateId) return;
    setError('');
    setSuccess('');
    try {
      await api.request('/employee-assignments', {
        method: 'POST',
        body: JSON.stringify({
          employee_id: editingId,
          template_id: Number(newAssignTemplateId),
          required: newAssignRequired,
          blocks_check_in: newAssignBlockIn,
          blocks_check_out: newAssignBlockOut,
          state: 'pending'
        })
      });
      setSuccess('Tarea asignada correctamente');
      await fetchExtraData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo asignar tarea');
    }
  }

  async function handleValidation(assignmentId: number, approve: boolean) {
    setError('');
    setSuccess('');
    const supervisorPin = prompt("Ingrese su PIN de Gerente para confirmar:") || "";
    if (!supervisorPin) return;
    const notes = prompt("Notas adicionales (opcional):") || "";
    
    const endpoint = approve 
      ? `/employee-assignments/${assignmentId}/validate-supervisor` 
      : `/employee-assignments/${assignmentId}/reject`;
      
    try {
      await api.request(endpoint, {
        method: 'POST',
        body: JSON.stringify({ supervisor_pin: supervisorPin, notes: notes })
      });
      setSuccess(approve ? 'Tarea aprobada correctamente' : 'Tarea rechazada correctamente');
      await fetchExtraData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error en la validación');
    }
  }

  async function handleAdminComplete(assignmentId: number) {
    setError('');
    setSuccess('');
    try {
      await api.request(`/employee-assignments/${assignmentId}/complete`, { method: 'POST' });
      setSuccess('Tarea marcada como completada');
      await fetchExtraData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al completar tarea');
    }
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError('');
    setSuccess('');
    const path = editingId ? `${config.endpoint}/${editingId}` : config.endpoint;
    const method = editingId ? 'PUT' : 'POST';
    try {
      await api.request(path, { method, body: JSON.stringify(normalizePayload(payload, config.fields)) });
      setPayload(blankPayload(config.fields, items.length + (editingId ? 0 : 1)));
      setEditingId(null);
      setShowForm(false);
      setSuccess('Cambios registrados correctamente');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar');
    }
  }

  useEffect(() => { 
    load(); 
    setShowForm(false);
    setEditingId(null);
    setSuccess('');
    setError('');
  }, [config.key]);

  useEffect(() => {
    setSuccess('');
    setError('');
    setActiveTab('ficha');
    if (!editingId) {
      setPayload(blankPayload(config.fields, items.length));
    } else if (config.key === 'employees') {
      fetchExtraData();
    }
  }, [editingId, items.length]);

  useEffect(() => {
    if (success) {
      const timer = setTimeout(() => setSuccess(''), 4000);
      return () => clearTimeout(timer);
    }
  }, [success]);

  const tabs = [
    { id: 'ficha', label: 'Ficha del Empleado' },
    { id: 'tareas', label: 'Tareas / Asignaciones' },
    { id: 'historial', label: 'Historial de Jornadas' },
    { id: 'auditoria', label: 'Registro de Auditoría' },
  ];

  return (
    <>
      <Header title={config.title} subtitle="Gestión administrativa" />
      {error && <div className="error">{error}</div>}
      {success && (
        <div 
          className="badge" 
          style={{ 
            background: '#ecfdf5', 
            color: '#047857', 
            border: '1px solid #a7f3d0', 
            padding: '10px 14px', 
            borderRadius: '8px', 
            marginBottom: '12px', 
            width: '100%', 
            display: 'block', 
            textAlign: 'center', 
            fontWeight: 'bold',
            fontSize: '14px' 
          }}
        >
          {success}
        </div>
      )}
      
      {showForm && (
        <form className="panel" onSubmit={submit} style={{ marginBottom: 20 }}>
          <div className="panel-header" style={{ background: '#f8fafc' }}>
            <strong>{editingId ? `Editar Registro #${editingId}` : 'Crear Nuevo Registro'}</strong>
            <div style={{ display: 'flex', gap: 8 }}>
              <button 
                className="ghost" 
                type="button" 
                onClick={() => { 
                  setShowForm(false); 
                  setEditingId(null); 
                  setError(''); 
                }}
                style={{ minHeight: '34px', height: '34px', padding: '0 12px' }}
              >
                Cancelar
              </button>
              {(!editingId || config.key !== 'employees' || activeTab === 'ficha') && (
                <button className="primary" type="submit" style={{ minHeight: '34px', height: '34px', padding: '0 16px' }}><Save size={14} /> Guardar</button>
              )}
            </div>
          </div>

          <div style={{ padding: '16px' }}>
            {config.key === 'employees' && editingId !== null && (
              <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid #e2e8f0', marginBottom: '16px', paddingBottom: '4px' }}>
                {tabs.map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveTab(tab.id as any)}
                    style={{ 
                      minHeight: '34px', 
                      height: '34px', 
                      fontSize: '13px', 
                      fontWeight: 'bold', 
                      padding: '0 14px', 
                      borderRadius: '6px',
                      background: activeTab === tab.id ? '#2f7dd1' : 'transparent',
                      color: activeTab === tab.id ? 'white' : '#64748b',
                      border: activeTab === tab.id ? 'none' : '1px solid transparent',
                      cursor: 'pointer',
                      transition: 'all 0.2s'
                    }}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            )}

            {/* TAB CONTENT: FICHA */}
            {(!editingId || config.key !== 'employees' || activeTab === 'ficha') && (
              <FormGrid fields={config.fields} payload={payload} setPayload={setPayload} />
            )}

            {/* TAB CONTENT: TAREAS (Solo Empleados editando) */}
            {config.key === 'employees' && editingId !== null && activeTab === 'tareas' && (
              <div>
                {/* Formulario Asignación Manual */}
                <div style={{ display: 'grid', gap: '14px', background: '#f8fafc', padding: '14px', borderRadius: '12px', border: '1px solid #e2e8f0', marginBottom: '20px' }}>
                  <strong style={{ fontSize: '14px', color: '#1e293b' }}>Asignar Nueva Tarea</strong>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'flex-end' }}>
                    <label className="field" style={{ flex: '1 1 200px', display: 'grid', gap: '4px' }}>
                      <span style={{ fontSize: '11px', fontWeight: 'bold', color: '#64748b' }}>Plantilla de Tarea</span>
                      <select value={newAssignTemplateId} onChange={e => setNewAssignTemplateId(e.target.value)} style={{ minHeight: '38px', border: '1px solid #cbd5df', borderRadius: '8px', padding: '0 8px' }}>
                        {templates.map(t => <option key={t.id} value={t.id}>{t.name} (ID: {t.id})</option>)}
                        {templates.length === 0 && <option value="">Sin plantillas de tarea</option>}
                      </select>
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '6px', minHeight: '38px', cursor: 'pointer' }}>
                      <input type="checkbox" checked={newAssignRequired} onChange={e => setNewAssignRequired(e.target.checked)} style={{ width: '16px', height: '16px' }} />
                      <span style={{ fontSize: '12px', fontWeight: 'bold', color: '#475569' }}>Obligatorio</span>
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '6px', minHeight: '38px', cursor: 'pointer' }}>
                      <input type="checkbox" checked={newAssignBlockIn} onChange={e => setNewAssignBlockIn(e.target.checked)} style={{ width: '16px', height: '16px' }} />
                      <span style={{ fontSize: '12px', fontWeight: 'bold', color: '#475569' }}>Bloquear Check-In</span>
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '6px', minHeight: '38px', cursor: 'pointer' }}>
                      <input type="checkbox" checked={newAssignBlockOut} onChange={e => setNewAssignBlockOut(e.target.checked)} style={{ width: '16px', height: '16px' }} />
                      <span style={{ fontSize: '12px', fontWeight: 'bold', color: '#475569' }}>Bloquear Check-Out</span>
                    </label>
                    <button 
                      type="button" 
                      onClick={assignTask} 
                      disabled={!newAssignTemplateId}
                      className="primary" 
                      style={{ minHeight: '38px', height: '38px', padding: '0 16px', fontWeight: 'bold', cursor: 'pointer' }}
                    >
                      Asignar Tarea
                    </button>
                  </div>
                </div>

                {/* Tabla de Asignaciones */}
                <div className="table-wrap" style={{ border: '1px solid #e2e8f0', borderRadius: '12px', overflow: 'hidden' }}>
                  <table style={{ width: '100%', fontSize: '13px' }}>
                    <thead>
                      <tr style={{ background: '#f8fafc' }}>
                        <th style={{ padding: '10px 12px' }}>ID</th>
                        <th style={{ padding: '10px 12px' }}>ID Plantilla</th>
                        <th style={{ padding: '10px 12px' }}>Asignada el</th>
                        <th style={{ padding: '10px 12px' }}>Obligatoria</th>
                        <th style={{ padding: '10px 12px' }}>Bloquea Salida</th>
                        <th style={{ padding: '10px 12px' }}>Estado</th>
                        <th style={{ padding: '10px 12px' }}>Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {allAssignments.filter(a => Number(a.employee_id) === editingId).map(a => (
                        <tr key={a.id}>
                          <td style={{ padding: '10px 12px' }}><strong>#{a.id}</strong></td>
                          <td style={{ padding: '10px 12px' }}>{a.template_id}</td>
                          <td style={{ padding: '10px 12px' }}>{new Date(a.assigned_at).toLocaleString()}</td>
                          <td style={{ padding: '10px 12px' }}>{a.required ? '✅ Sí' : '❌ No'}</td>
                          <td style={{ padding: '10px 12px' }}>{a.blocks_check_out ? '✅ Sí' : '❌ No'}</td>
                          <td style={{ padding: '10px 12px' }}>
                            <span 
                              className="badge" 
                              style={{
                                background: a.state === 'completed' ? '#ecfdf5' : a.state === 'validation_pending' ? '#fffbeb' : a.state === 'rejected' ? '#fdf2f2' : '#f1f5f9',
                                color: a.state === 'completed' ? '#047857' : a.state === 'validation_pending' ? '#b45309' : a.state === 'rejected' ? '#b91c1c' : '#475569',
                                fontWeight: 'bold',
                                textTransform: 'uppercase',
                                fontSize: '11px',
                                padding: '2px 6px',
                                borderRadius: '4px'
                              }}
                            >
                              {a.state}
                            </span>
                          </td>
                          <td style={{ padding: '10px 12px' }}>
                            <div style={{ display: 'flex', gap: '6px' }}>
                              {a.state === 'validation_pending' && (
                                <>
                                  <button type="button" className="primary" onClick={() => handleValidation(Number(a.id), true)} style={{ minHeight: '26px', height: '26px', padding: '0 8px', fontSize: '11px', background: '#10b981', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>Aprobar</button>
                                  <button type="button" className="ghost" onClick={() => handleValidation(Number(a.id), false)} style={{ minHeight: '26px', height: '26px', padding: '0 8px', fontSize: '11px', color: '#ef4444', borderColor: '#fecaca', borderRadius: '4px', cursor: 'pointer' }}>Rechazar</button>
                                </>
                              )}
                              {a.state === 'pending' && (
                                <button type="button" className="ghost" onClick={() => handleAdminComplete(Number(a.id))} style={{ minHeight: '26px', height: '26px', padding: '0 8px', fontSize: '11px', borderRadius: '4px', cursor: 'pointer' }}>Completar</button>
                              )}
                              {a.state !== 'pending' && a.state !== 'validation_pending' && <span style={{ color: '#94a3b8', fontSize: '11px' }}>Sin acciones</span>}
                            </div>
                          </td>
                        </tr>
                      ))}
                      {allAssignments.filter(a => Number(a.employee_id) === editingId).length === 0 && (
                        <tr><td colSpan={7} style={{ textAlign: 'center', padding: '20px', color: '#64748b' }}>No hay tareas asignadas a este colaborador</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* TAB CONTENT: HISTORIAL (Solo Empleados editando) */}
            {config.key === 'employees' && editingId !== null && activeTab === 'historial' && (
              <div className="table-wrap" style={{ border: '1px solid #e2e8f0', borderRadius: '12px', overflow: 'hidden' }}>
                <table style={{ width: '100%', fontSize: '13px' }}>
                  <thead>
                    <tr style={{ background: '#f8fafc' }}>
                      <th style={{ padding: '10px 12px' }}>ID Jornada</th>
                      <th style={{ padding: '10px 12px' }}>Entrada</th>
                      <th style={{ padding: '10px 12px' }}>Salida</th>
                      <th style={{ padding: '10px 12px' }}>Min. Trabajados</th>
                      <th style={{ padding: '10px 12px' }}>Min. Break</th>
                      <th style={{ padding: '10px 12px' }}>Min. Comida</th>
                      <th style={{ padding: '10px 12px' }}>Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {allShifts.filter(s => Number(s.employee_id) === editingId).map(s => (
                      <tr key={s.id}>
                        <td style={{ padding: '10px 12px' }}><strong>#{s.id}</strong></td>
                        <td style={{ padding: '10px 12px' }}>{s.check_in_at ? new Date(s.check_in_at).toLocaleString() : '-'}</td>
                        <td style={{ padding: '10px 12px' }}>{s.check_out_at ? new Date(s.check_out_at).toLocaleString() : '-'}</td>
                        <td style={{ padding: '10px 12px' }}>{s.worked_time_minutes ?? 0} min</td>
                        <td style={{ padding: '10px 12px' }}>{s.break_time_minutes ?? 0} min</td>
                        <td style={{ padding: '10px 12px' }}>{s.meal_time_minutes ?? 0} min</td>
                        <td style={{ padding: '10px 12px' }}>
                          <span 
                            className="badge" 
                            style={{
                              background: s.state === 'closed' ? '#f1f5f9' : '#eef6ff',
                              color: s.state === 'closed' ? '#475569' : '#2f7dd1',
                              fontWeight: 'bold',
                              textTransform: 'uppercase',
                              fontSize: '11px',
                              padding: '2px 6px',
                              borderRadius: '4px'
                            }}
                          >
                            {s.state}
                          </span>
                        </td>
                      </tr>
                    ))}
                    {allShifts.filter(s => Number(s.employee_id) === editingId).length === 0 && (
                      <tr><td colSpan={7} style={{ textAlign: 'center', padding: '20px', color: '#64748b' }}>No se registran marcas de jornadas para este colaborador</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}

            {/* TAB CONTENT: AUDITORIA (Solo Empleados editando) */}
            {config.key === 'employees' && editingId !== null && activeTab === 'auditoria' && (
              <div className="table-wrap" style={{ border: '1px solid #e2e8f0', borderRadius: '12px', overflow: 'hidden' }}>
                <table style={{ width: '100%', fontSize: '13px' }}>
                  <thead>
                    <tr style={{ background: '#f8fafc' }}>
                      <th style={{ padding: '10px 12px' }}>ID Log</th>
                      <th style={{ padding: '10px 12px' }}>Fecha</th>
                      <th style={{ padding: '10px 12px' }}>Acción</th>
                      <th style={{ padding: '10px 12px' }}>Modelo</th>
                      <th style={{ padding: '10px 12px' }}>Detalles</th>
                    </tr>
                  </thead>
                  <tbody>
                    {allAuditLogs.filter(l => Number(l.employee_id) === editingId).map(l => (
                      <tr key={l.id}>
                        <td style={{ padding: '10px 12px' }}><strong>#{l.id}</strong></td>
                        <td style={{ padding: '10px 12px' }}>{new Date(l.timestamp).toLocaleString()}</td>
                        <td style={{ padding: '10px 12px' }}><span className="badge" style={{ textTransform: 'uppercase', fontSize: '10px', padding: '2px 6px', borderRadius: '4px' }}>{l.action}</span></td>
                        <td style={{ padding: '10px 12px' }}><code>{l.model_name}</code></td>
                        <td style={{ padding: '10px 12px' }}>ID Registro: {l.record_id}</td>
                      </tr>
                    ))}
                    {allAuditLogs.filter(l => Number(l.employee_id) === editingId).length === 0 && (
                      <tr><td colSpan={5} style={{ textAlign: 'center', padding: '20px', color: '#64748b' }}>No se registran logs de auditoría para este colaborador</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </form>
      )}

      <section className="panel">
        <div className="panel-header">
          <strong>Registros</strong>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span className="badge" style={{ marginRight: 8 }}>{items.length}</span>
            <button className="ghost" type="button" onClick={load} style={{ minHeight: '34px', height: '34px', padding: '0 12px' }}><RefreshCw size={14} /> Actualizar</button>
            {config.key !== 'users' && (
              <button 
                className="primary" 
                type="button" 
                onClick={() => {
                  setEditingId(null);
                  setPayload(blankPayload(config.fields, items.length));
                  setShowForm(true);
                  setSuccess('');
                  setError('');
                }}
                style={{ minHeight: '34px', height: '34px', padding: '0 16px', fontWeight: 'bold' }}
              >
                {config.key === 'employees' ? 'Crear empleado' : 'Crear nuevo'}
              </button>
            )}
          </div>
        </div>
        <div className="table-wrap">
          <table>
            <thead><tr>{config.columns.map((column) => <th key={column}>{column}</th>)}<th>Acciones</th></tr></thead>
            <tbody>
              {items.map((item) => (
                <tr key={String(item.id)}>
                  {config.columns.map((column) => <td key={column}>{renderValue(item[column])}</td>)}
                  <td>
                    <button 
                      className="ghost" 
                      type="button" 
                      onClick={() => { 
                        setEditingId(Number(item.id)); 
                        setPayload({ ...blankPayload(config.fields, items.length), ...item, password: '', pin: '' }); 
                        setShowForm(true);
                        setSuccess('');
                        setError('');
                      }}
                      style={{ padding: '4px 10px', fontSize: '13px', minHeight: '28px' }}
                    >
                      Editar
                    </button>
                  </td>
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

  const [loginMethod, setLoginMethod] = useState<'pin' | 'manager_override'>('pin');
  const [managerPin, setManagerPin] = useState('');
  const [employeePin, setEmployeePin] = useState('');

  // Estados de dispositivo vinculado a un solo empleado
  const [lockedEmployeeId, setLockedEmployeeId] = useState<string | null>(localStorage.getItem('kiosk_locked_employee_id'));
  const [lockedEmployeeName, setLockedEmployeeName] = useState<string | null>(localStorage.getItem('kiosk_locked_employee_name'));

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
      const data = await api.request<{ employee: Record<string, unknown>; access_token?: string }>('/kiosk/identify-pin', {
        method: 'POST',
        body: JSON.stringify({ device_code: deviceCode, pin }),
      });
      
      const emp = data.employee;
      const curLockedId = localStorage.getItem('kiosk_locked_employee_id');
      if (curLockedId && String(emp.id) !== curLockedId) {
        throw new Error(`Este dispositivo móvil está registrado a nombre de: ${localStorage.getItem('kiosk_locked_employee_name') || 'otro colaborador'}. Solo esa persona puede marcar asistencia aquí.`);
      }

      if (!curLockedId) {
        localStorage.setItem('kiosk_locked_employee_id', String(emp.id));
        localStorage.setItem('kiosk_locked_employee_name', String(emp.name));
        setLockedEmployeeId(String(emp.id));
        setLockedEmployeeName(String(emp.name));
      }

      if (data.access_token) {
        api.setToken(data.access_token);
      }
      setEmployee(emp);
      setPin('');
      await loadEvents(Number(emp.id));
      await loadAssignments(Number(emp.id));
    } catch (err) {
      setEmployee(null);
      setEvents([]);
      setAssignments([]);
      setError(err instanceof Error ? err.message : 'No se pudo identificar');
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
      
      
      const emp = data.employee;
      // El PIN de Gerente permite autorizar el ingreso de cualquier empleado en este dispositivo, saltando el bloqueo local.
      // No modificamos ni bloqueamos el dispositivo a este usuario si ya está registrado a nombre de otro.

      if (data.access_token) {
        api.setToken(data.access_token);
      }
      setEmployee(emp);
      await loadEvents(Number(emp.id));
      await loadAssignments(Number(emp.id));
      setManagerPin('');
      setEmployeePin('');
      setMessage("Inicio de sesión autorizado por Gerente.");
    } catch (err) {
      setEmployee(null);
      setEvents([]);
      setAssignments([]);
      setError(err instanceof Error ? err.message : 'No se pudo autorizar');
    }
  }

  async function unlockDevice() {
    const mgrPin = prompt("Ingrese el PIN de Gerente para desvincular este dispositivo:");
    if (!mgrPin) return;
    setError('');
    setMessage('');
    try {
      await api.request('/kiosk/unlock-device', {
        method: 'POST',
        body: JSON.stringify({ device_code: deviceCode, pin: mgrPin })
      });
      localStorage.removeItem('kiosk_locked_employee_id');
      localStorage.removeItem('kiosk_locked_employee_name');
      setLockedEmployeeId(null);
      setLockedEmployeeName(null);
      setMessage("Dispositivo desvinculado con éxito. Ahora otros colaboradores pueden ingresar.");
    } catch (err) {
      setError(err instanceof Error ? err.message : 'PIN de Gerente inválido o sin permisos');
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
    setLoginMethod('pin');
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
          method: loginMethod
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
            <Settings size={18} />
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

          {loginMethod === 'pin' && (
            <form className="login-form" onSubmit={identify} style={{ marginTop: '0', display: 'grid', gap: '16px' }}>
              {lockedEmployeeId && (
                <div style={{ background: '#fef2f2', border: '1px solid #fee2e2', padding: '12px', borderRadius: '12px', textAlign: 'center' }}>
                  <span style={{ fontSize: '11px', fontWeight: 'bold', color: '#b91c1c', display: 'block', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '2px' }}>🔒 Dispositivo Vinculado</span>
                  <strong style={{ display: 'block', fontSize: '13px', color: '#991b1b' }}>Solo {lockedEmployeeName}</strong>
                  <button 
                    type="button" 
                    onClick={unlockDevice} 
                    style={{ 
                      background: 'transparent', 
                      border: 'none', 
                      color: '#2f7dd1', 
                      fontSize: '11px', 
                      fontWeight: 'bold', 
                      cursor: 'pointer',
                      marginTop: '6px', 
                      textDecoration: 'underline' 
                    }}
                  >
                    Desvincular (PIN Gerente)
                  </button>
                </div>
              )}

              {error && <div className="error" style={{ fontSize: '13px', margin: '0' }}>{error}</div>}
              {message && <div className="badge" style={{ margin: '0', display: 'flex', justifyContent: 'center', padding: '6px' }}>{message}</div>}
              
              <label className="field" style={{ textAlign: 'center', gap: '8px', display: 'grid' }}>
                <span style={{ fontSize: '14px', color: '#475569', fontWeight: 'bold' }}>Ingresa tu PIN</span>
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
                onClick={() => setLoginMethod('manager_override')}
                style={{ width: '100%', minHeight: '44px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', fontWeight: 'bold' }}
              >
                Autorización de Gerente
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
                onClick={() => setLoginMethod('pin')}
                style={{ width: '100%', minHeight: '44px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', fontWeight: 'bold' }}
              >
                Volver a Ingresar PIN de Empleado
              </button>
            </form>
          )}
        </div>
      </div>
    );
  }

  // (Registro biométrico multi-ángulo eliminado)

  const inJornadaActiva = events.some(e => e.code === 'break_out' || e.code === 'meal_out' || e.code === 'shift_out');
  const hasShiftIn = events.some(e => e.opens_shift);
  const inBreak = events.some(e => e.code === 'break_in');
  const inMeal = events.some(e => e.code === 'meal_in');
  const isFinalized = events.length === 0;

  let statusText = 'En Jornada';
  let statusColor = '#2f7dd1';
  let statusBg = '#eef6ff';
  
  if (hasShiftIn) {
    statusText = 'Sin Iniciar Jornada';
    statusColor = '#64748b';
    statusBg = '#f1f5f9';
  } else if (inBreak) {
    statusText = 'En Break';
    statusColor = '#d97706';
    statusBg = '#fffbeb';
  } else if (inMeal) {
    statusText = 'En Comida';
    statusColor = '#d97706';
    statusBg = '#fffbeb';
  } else if (isFinalized) {
    statusText = 'Jornada Finalizada';
    statusColor = '#059669';
    statusBg = '#ecfdf5';
  }

  const currentDateStr = new Date().toLocaleDateString('es-ES', { 
    weekday: 'long', 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  });

  return (
    <div style={{ display: 'grid', gap: '14px', width: '100%', padding: '0 4px', maxWidth: '480px', margin: '0 auto' }}>
      
      {/* Título de la Vista */}
      <div style={{ textAlign: 'center', margin: '10px 0 2px 0' }}>
        <h1 style={{ fontSize: '28px', fontWeight: '900', color: '#0f172a', margin: '0 0 2px 0', letterSpacing: '-0.8px' }}>Check in</h1>
        <span style={{ fontSize: '13px', color: '#64748b', fontWeight: '600' }}>Control de Asistencia Kiosko</span>
      </div>

      {/* Cabecera del Empleado & Parámetros del Día */}
      <div className="panel" style={{ background: 'linear-gradient(135deg, #1e293b, #0f172a)', color: 'white', border: '0', borderRadius: '18px', padding: '18px', boxShadow: '0 10px 25px rgba(15,23,42,0.15)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '12px', marginBottom: '12px' }}>
          <div>
            <span style={{ color: '#94a3b8', fontSize: '10px', textTransform: 'uppercase', fontWeight: 'bold', letterSpacing: '0.5px' }}>Colaborador</span>
            <h2 style={{ fontSize: '18px', margin: '2px 0 0 0', fontWeight: '800', letterSpacing: '-0.3px', color: '#ffffff' }}>{String(employee.name)}</h2>
            <span style={{ color: '#38bdf8', fontSize: '11px', fontWeight: '600', display: 'block', marginTop: '2px' }}>ID: {String(employee.employee_code || '-')}</span>
          </div>
          <button 
            type="button" 
            onClick={logoutEmployee}
            style={{ 
              background: 'rgba(239,68,68,0.15)', 
              color: '#f87171', 
              border: '1px solid rgba(239,68,68,0.25)', 
              borderRadius: '8px', 
              padding: '6px 12px', 
              fontSize: '11px', 
              fontWeight: 'bold',
              cursor: 'pointer',
              transition: 'background 0.2s'
            }}
          >
            Cerrar Sesión
          </button>
        </div>

        {/* Parámetros del día */}
        <div style={{ display: 'grid', gap: '8px', fontSize: '12px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: '#94a3b8' }}>Fecha actual:</span>
            <strong style={{ color: '#f8fafc', textTransform: 'capitalize' }}>{currentDateStr}</strong>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: '#94a3b8' }}>Salida automática:</span>
            <strong style={{ color: events.some(e => e.closes_shift) ? '#f87171' : '#34d399' }}>
              {events.some(e => e.closes_shift) ? 'Deshabilitada (Manual)' : 'Habilitada (Auto-checkout)'}
            </strong>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: '#94a3b8' }}>Tareas pendientes:</span>
            <strong style={{ color: assignments.length > 0 ? '#fbcfe8' : '#34d399' }}>
              {assignments.length > 0 ? `${assignments.length} pendientes` : 'Ninguna'}
            </strong>
          </div>
        </div>
      </div>

      {/* Estado del Empleado */}
      <div style={{ 
        background: statusBg, 
        color: statusColor, 
        borderRadius: '12px', 
        padding: '10px 14px', 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        fontWeight: 'bold', 
        fontSize: '13px',
        boxShadow: '0 4px 10px rgba(0,0,0,0.01)',
        border: `1px solid ${statusColor}18`
      }}>
        <span>Estado del empleado:</span>
        <span style={{ textTransform: 'uppercase', fontSize: '11px', background: `${statusColor}15`, padding: '3px 8px', borderRadius: '6px' }}>
          {statusText}
        </span>
      </div>

      {error && <div className="error" style={{ margin: '0', fontSize: '13px', borderRadius: '10px' }}>{error}</div>}
      {message && <div className="badge" style={{ margin: '0', background: '#ecfdf5', color: '#047857', border: '1px solid #a7f3d0', padding: '10px 14px', width: '100%', justifyContent: 'center', fontWeight: 'bold', fontSize: '13px', borderRadius: '10px' }}>{message}</div>}

      {/* PANEL 1: REGISTRO DE EVENTOS */}
      <div className="panel" style={{ borderRadius: '16px', padding: '16px', background: 'white', border: '1px solid #e2e8f0', boxShadow: '0 4px 12px rgba(0,0,0,0.02)' }}>
        <h3 style={{ fontSize: '14px', margin: '0 0 12px 0', color: '#334155', borderBottom: '1px solid #f1f5f9', paddingBottom: '8px', fontWeight: 'bold' }}>
          Opciones de marcación
        </h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '8px' }}>
          {events.map((item) => (
            <button 
              className="primary" 
              key={String(item.id)} 
              type="button" 
              onClick={() => register(Number(item.id))}
              style={{ 
                minHeight: '50px', 
                fontSize: '15px', 
                fontWeight: '800', 
                borderRadius: '10px', 
                background: item.opens_shift ? '#10b981' : item.closes_shift ? '#ef4444' : '#2f7dd1',
                boxShadow: item.opens_shift ? '0 4px 12px rgba(16,185,129,0.15)' : item.closes_shift ? '0 4px 12px rgba(239,68,68,0.15)' : '0 4px 12px rgba(47,125,209,0.15)',
                border: 'none',
                color: 'white',
                cursor: 'pointer'
              }}
            >
              {String(item.name)}
            </button>
          ))}
          {isFinalized && (
            <div style={{ textAlign: 'center', padding: '20px 12px', color: '#64748b', fontSize: '13px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <strong style={{ color: '#0f172a', fontSize: '14px' }}>Jornada finalizada por hoy.</strong>
              <span>¡Buen trabajo! No hay más acciones disponibles.</span>
            </div>
          )}
        </div>
      </div>

      {/* PANEL 2: ASIGNACIONES PENDIENTES (Solo visible en jornada activa) */}
      {inJornadaActiva && (
        <div className="panel" style={{ borderRadius: '16px', padding: '16px', background: 'white', border: '1px solid #e2e8f0', boxShadow: '0 4px 12px rgba(0,0,0,0.02)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', borderBottom: '1px solid #f1f5f9', paddingBottom: '8px' }}>
            <h3 style={{ fontSize: '14px', margin: '0', color: '#334155', fontWeight: 'bold' }}>Tareas / Asignaciones Pendientes</h3>
            <span className="badge" style={{ background: '#f1f5f9', color: '#1e293b', fontWeight: 'bold', borderRadius: '6px', fontSize: '11px', padding: '2px 6px' }}>{assignments.length}</span>
          </div>
          <div style={{ display: 'grid', gap: '8px' }}>
            {assignments.map((item) => (
              <div 
                key={String(item.id)} 
                style={{ 
                  padding: '12px', 
                  borderRadius: '10px', 
                  border: '1px solid #e2e8f0', 
                  background: '#f8fafc',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '13px', fontWeight: 'bold', color: '#334155' }}>Asignación #{String(item.id)}</span>
                  <span className="badge" style={{ textTransform: 'uppercase', fontSize: '10px', fontWeight: 'bold', background: '#ffe4e6', color: '#9f1239' }}>{String(item.state)}</span>
                </div>
                <button 
                  className="ghost" 
                  type="button" 
                  onClick={() => completeAssignment(item)}
                  style={{ 
                    width: '100%', 
                    minHeight: '36px', 
                    fontSize: '12px', 
                    fontWeight: 'bold',
                    background: '#cbd5e1', 
                    color: '#1e293b',
                    borderRadius: '6px',
                    border: 'none',
                    cursor: 'pointer'
                  }}
                >
                  Completar Tarea
                </button>
              </div>
            ))}
            {!assignments.length && (
              <div style={{ textAlign: 'center', padding: '16px', color: '#64748b', fontSize: '13px' }}>
                ¡Excelente! No tienes tareas pendientes.
              </div>
            )}
          </div>
        </div>
      )}
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

function FormGrid({ fields, payload, setPayload }: { fields: Field[]; payload: Record<string, unknown>; setPayload: (value: Record<string, unknown>) => void }) {
  return (
    <div className="grid">
      {fields.map((field) => (
        <label className="field" key={field.name} style={{ display: 'grid', gap: '6px' }}>
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
          
          {/* MÁS UTILIZADOS AL INICIO */}
          <button className={screen === 'employees' ? 'active' : ''} onClick={() => setScreen('employees')}><UsersRound /> Empleados</button>
          <button className={screen === 'attendance-shifts' ? 'active' : ''} onClick={() => setScreen('attendance-shifts')}><CalendarClock /> Jornadas</button>
          <button className={screen === 'attendance-events' ? 'active' : ''} onClick={() => setScreen('attendance-events')}><ClipboardList /> Registro de Eventos</button>
          <button className={screen === 'reports' ? 'active' : ''} onClick={() => setScreen('reports')}><ClipboardList /> Reportes</button>
          <button className={screen === 'employee-assignments' ? 'active' : ''} onClick={() => setScreen('employee-assignments')}><ClipboardList /> Tareas Asignadas</button>
          
          {/* CONFIGURACIÓN Y CATÁLOGOS ABAJO */}
          <div style={{ height: '1px', background: '#e2e8f0', margin: '12px 10px 8px 10px' }} />
          <span style={{ fontSize: '10px', fontWeight: 'bold', color: '#94a3b8', padding: '0 12px', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'block', marginBottom: '4px' }}>Configuración</span>
          
          <button className={screen === 'company' ? 'active' : ''} onClick={() => setScreen('company')}><Building2 /> Empresa</button>
          <button className={screen === 'branches' ? 'active' : ''} onClick={() => setScreen('branches')}><MapPin /> Sucursales</button>
          <button className={screen === 'departments' ? 'active' : ''} onClick={() => setScreen('departments')}><Building2 /> Departamentos</button>
          <button className={screen === 'devices' ? 'active' : ''} onClick={() => setScreen('devices')}><MonitorSmartphone /> Dispositivos Kiosko</button>
          <button className={screen === 'users' ? 'active' : ''} onClick={() => setScreen('users')}><UserRound /> Usuarios Admin</button>
          
          <button className={screen === 'assignment-templates' ? 'active' : ''} onClick={() => setScreen('assignment-templates')}><ClipboardList /> Plantillas Tareas</button>
          <button className={screen === 'assignment-questions' ? 'active' : ''} onClick={() => setScreen('assignment-questions')}><ListChecks /> Preguntas Plantilla</button>
          <button className={screen === 'auto-checkout-rules' ? 'active' : ''} onClick={() => setScreen('auto-checkout-rules')}><Settings /> Reglas Auto-Checkout</button>
          <button className={screen === 'attendance-event-types' ? 'active' : ''} onClick={() => setScreen('attendance-event-types')}><Settings /> Tipos de Marcación</button>
          <button className={screen === 'permissions' ? 'active' : ''} onClick={() => setScreen('permissions')}><CheckSquare /> Permisos de Roles</button>
          <button className={screen === 'no-attendance' ? 'active' : ''} onClick={() => setScreen('no-attendance')}><CalendarX /> No asistencia</button>
          <button className={screen === 'hr-attendance' ? 'active' : ''} onClick={() => setScreen('hr-attendance')}><ClipboardList /> hr_attendance</button>
          <button className={screen === 'audit-logs' ? 'active' : ''} onClick={() => setScreen('audit-logs')}><ClipboardList /> Auditoría de cambios</button>
          
          <div style={{ height: '1px', background: '#e2e8f0', margin: '12px 10px 8px 10px' }} />
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
        {screen === 'reports' && <ReportsScreen />}
        {resource && <ResourceScreen config={resource} />}
        {tableScreen && <TableScreen config={tableScreen} />}
        {screen === 'kiosk' && <KioskScreen />}
      </main>
    </div>
  );
}
