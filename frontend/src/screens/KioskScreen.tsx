import { FormEvent, useEffect, useRef, useState } from 'react';
import {
  Check,
  KeyRound,
  ListChecks,
  Lock,
  ScanFace,
  Settings,
  ShieldCheck,
  Zap,
} from 'lucide-react';
import { api } from '../api/client';
import { SV_LOCALE, SV_TZ } from '../lib/time';

type KioskTask = {
  id: number;
  name: string;
  description?: string | null;
  sequence?: number;
  completed: boolean;
};

type KioskAssignment = {
  id: number;
  template_id: number;
  template_name?: string | null;
  state: string;
  tasks?: KioskTask[];
};

type WorkScheduleInfo = {
  name?: string;
  label?: string;
  is_off?: boolean;
  source?: string;
  auto_checkout_label?: string | null;
  punch?: { code?: string; label?: string; requires_manager?: boolean };
};

export function KioskScreen() {
  const [deviceCode, setDeviceCode] = useState(localStorage.getItem('kiosk_device_code') ?? 'KIOSK-DEMO');
  const [pin, setPin] = useState('');
  const [employee, setEmployee] = useState<Record<string, unknown> | null>(null);
  const [events, setEvents] = useState<Record<string, unknown>[]>([]);
  const [assignments, setAssignments] = useState<KioskAssignment[]>([]);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [showConfig, setShowConfig] = useState(false);
  const [tempDeviceCode, setTempDeviceCode] = useState(deviceCode);
  const [sessionTimeout, setSessionTimeout] = useState<number>(() => {
    const saved = localStorage.getItem('kiosk_session_timeout');
    return saved ? parseInt(saved, 10) : 30;
  });

  const [loginMethod, setLoginMethod] = useState<'pin' | 'manager_override'>('pin');
  const [authMethodUsed, setAuthMethodUsed] = useState<'pin' | 'face_id'>('pin');
  const [cameraActive, setCameraActive] = useState(false);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [regStep, setRegStep] = useState(0);
  const [regImages, setRegImages] = useState<string[]>([]);
  const [employeeNeedsFaceRegistration, setEmployeeNeedsFaceRegistration] = useState(false);

  const [managerPin, setManagerPin] = useState('');
  const [employeePin, setEmployeePin] = useState('');

  // Estados de dispositivo vinculado a un solo empleado
  const [lockedEmployeeId, setLockedEmployeeId] = useState<string | null>(null);
  const [lockedEmployeeName, setLockedEmployeeName] = useState<string | null>(null);

  const [isLockEnabled, setIsLockEnabled] = useState<boolean>(true);
  const [pinCooldown, setPinCooldown] = useState(false);
  const [kioskTab, setKioskTab] = useState<'actions' | 'tasks'>('actions');
  const [busyTaskKey, setBusyTaskKey] = useState('');
  const [workSchedule, setWorkSchedule] = useState<WorkScheduleInfo | null>(null);
  const [pendingFaceVerify, setPendingFaceVerify] = useState(false);
  const identifyingRef = useRef(false);
  const faceFailCount = useRef(0);
  const sessionSeq = useRef(0);
  const employeeRef = useRef<Record<string, unknown> | null>(null);

  useEffect(() => {
    employeeRef.current = employee;
  }, [employee]);

  function startPinCooldown() {
    setPinCooldown(true);
    window.setTimeout(() => setPinCooldown(false), 3000);
  }

  function isRetryMessage(message: string) {
    return /demasiados|intenta de nuevo|too many|429/i.test(message);
  }

  // Sincronizar el estado de dispositivo vinculado si se apaga globalmente
  useEffect(() => {
    if (!isLockEnabled) {
      setLockedEmployeeId(null);
      setLockedEmployeeName(null);
    }
  }, [isLockEnabled]);

  // Manejo de la cámara en vivo
  useEffect(() => {
    const needsCamera = Boolean(employee && cameraActive && (employeeNeedsFaceRegistration || pendingFaceVerify));
    if (needsCamera) {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        console.error("Cámara no disponible. Asegúrate de estar en una conexión segura (HTTPS o localhost).");
        setError("El navegador bloqueó la cámara. Se requiere conexión segura (HTTPS o localhost) para usar Face ID.");
        setCameraActive(false);
        return;
      }
      navigator.mediaDevices.getUserMedia({ video: { width: 320, height: 320 } })
        .then((s) => {
          setStream(s);
          const videoId = employeeNeedsFaceRegistration ? 'kiosk-register-webcam' : 'kiosk-verify-webcam';
          setTimeout(() => {
            const videoElement = document.getElementById(videoId) as HTMLVideoElement;
            if (videoElement) {
              videoElement.srcObject = s;
            }
          }, 100);
        })
        .catch((err) => {
          console.error("No se pudo iniciar la camara:", err);
          setError("No se pudo acceder a la cámara.");
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
  }, [employee, employeeNeedsFaceRegistration, pendingFaceVerify, cameraActive]);

  useEffect(() => {
    if (!stream) return;
    const videoId = employeeNeedsFaceRegistration ? 'kiosk-register-webcam' : 'kiosk-verify-webcam';
    const videoElement = document.getElementById(videoId) as HTMLVideoElement | null;
    if (videoElement) {
      videoElement.srcObject = stream;
    }
  }, [stream, employeeNeedsFaceRegistration, pendingFaceVerify]);

  // Reloj en vivo — actualiza cada segundo en zona horaria El Salvador
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Cierre de sesión automático por inactividad del empleado
  useEffect(() => {
    if (!employee || pendingFaceVerify || employeeNeedsFaceRegistration || sessionTimeout <= 0) return;

    let timeoutId: ReturnType<typeof setTimeout>;

    const resetTimer = () => {
      if (timeoutId) clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        console.log("Cerrando sesión de empleado por inactividad.");
        logoutEmployee();
      }, sessionTimeout * 1000);
    };

    // Iniciar temporizador
    resetTimer();

    // Escuchar interacciones del usuario
    const eventsList = ['mousemove', 'mousedown', 'keypress', 'touchstart', 'scroll', 'click'];
    eventsList.forEach(event => window.addEventListener(event, resetTimer));

    return () => {
      if (timeoutId) clearTimeout(timeoutId);
      eventsList.forEach(event => window.removeEventListener(event, resetTimer));
    };
  }, [employee, pendingFaceVerify, employeeNeedsFaceRegistration, sessionTimeout]);

  // Cargar configuración del dispositivo al montar o cambiar el código
  useEffect(() => {
    async function fetchConfig() {
      try {
        const data = await api.request<any>(`/kiosk/${encodeURIComponent(deviceCode)}/config`);
        if (data && data.device) {
          const timeout = data.device.session_timeout ?? 30;
          setSessionTimeout(timeout);
          localStorage.setItem('kiosk_session_timeout', String(timeout));
          setLockedEmployeeId(data.device.locked_employee_id ? String(data.device.locked_employee_id) : null);
          setLockedEmployeeName(data.device.locked_employee_name ?? null);
          setIsLockEnabled(data.device.device_lock_enabled !== false);
        }
      } catch (err) {
        console.error("Error cargando configuración del dispositivo:", err);
      }
    }
    fetchConfig();
  }, [deviceCode]);

  const kioskDateStr = now.toLocaleDateString(SV_LOCALE, { timeZone: SV_TZ, weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  const kioskTimeStr = now.toLocaleTimeString(SV_LOCALE, { timeZone: SV_TZ, hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });

  function bumpSession() {
    sessionSeq.current += 1;
    return sessionSeq.current;
  }

  function assertSessionOwner(emp: Record<string, unknown>) {
    if (isLockEnabled && lockedEmployeeId && String(emp.id) !== String(lockedEmployeeId)) {
      throw new Error(`Este dispositivo está registrado a ${lockedEmployeeName || 'otro colaborador'}. Solo esa persona puede entrar aquí.`);
    }
  }

  async function enterEmployeeSession(emp: Record<string, unknown>, token?: string) {
    assertSessionOwner(emp);
    const seq = bumpSession();
    if (token) api.setToken(token);
    setEvents([]);
    setAssignments([]);
    setKioskTab('actions');
    setBusyTaskKey('');
    const schedule = (emp as { work_schedule?: WorkScheduleInfo }).work_schedule;
    setWorkSchedule(schedule ?? null);
    setEmployee(emp);
    employeeRef.current = emp;
    if (isLockEnabled && !lockedEmployeeId) {
      setLockedEmployeeId(String(emp.id));
      setLockedEmployeeName(String(emp.name));
    }
    return seq;
  }

  async function loadEvents(employeeId: number, seq = sessionSeq.current) {
    const data = await api.request<Record<string, unknown>[]>(`/kiosk/employees/${employeeId}/available-events?device_code=${encodeURIComponent(deviceCode)}`);
    if (seq !== sessionSeq.current) return;
    if (employeeRef.current && Number(employeeRef.current.id) !== employeeId) return;
    setEvents(data);
  }

  async function loadAssignments(employeeId: number, seq = sessionSeq.current) {
    const data = await api.request<KioskAssignment[]>(`/kiosk/employees/${employeeId}/assignments`);
    if (seq !== sessionSeq.current) return;
    if (employeeRef.current && Number(employeeRef.current.id) !== employeeId) return;
    setAssignments(data);
  }

  async function loadWorkStatus(employeeId: number, seq = sessionSeq.current) {
    const data = await api.request<{
      schedule_name?: string;
      name?: string;
      label?: string;
      is_off?: boolean;
      source?: string;
      auto_checkout_label?: string | null;
      punch?: WorkScheduleInfo['punch'];
    }>(`/kiosk/employees/${employeeId}/work-status`);
    if (seq !== sessionSeq.current) return;
    if (employeeRef.current && Number(employeeRef.current.id) !== employeeId) return;
    setWorkSchedule({
      name: data.schedule_name || data.name,
      label: data.label,
      is_off: data.is_off,
      source: data.source,
      auto_checkout_label: data.auto_checkout_label,
      punch: data.punch,
    });
  }

  function captureFrame(videoId: string) {
    const videoElement = document.getElementById(videoId) as HTMLVideoElement | null;
    if (!cameraActive || !stream || !videoElement) return '';
    const canvas = document.createElement('canvas');
    canvas.width = videoElement.videoWidth || 320;
    canvas.height = videoElement.videoHeight || 320;
    const ctx = canvas.getContext('2d');
    if (!ctx) return '';
    ctx.drawImage(videoElement, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/jpeg', 0.8);
  }

  async function openKioskPanel(employeeId: number, seq = sessionSeq.current) {
    setPendingFaceVerify(false);
    setEmployeeNeedsFaceRegistration(false);
    setCameraActive(false);
    faceFailCount.current = 0;
    await loadEvents(employeeId, seq);
    await loadAssignments(employeeId, seq);
    await loadWorkStatus(employeeId, seq);
  }

  async function afterPinLogin(emp: Record<string, unknown> & { has_face_template?: boolean }, token?: string, authMethod: 'pin' | 'face_id' = 'pin') {
    const seq = await enterEmployeeSession(emp, token);
    setAuthMethodUsed(authMethod);
    faceFailCount.current = 0;
    if (!emp.has_face_template) {
      setPendingFaceVerify(false);
      setEmployeeNeedsFaceRegistration(true);
      setCameraActive(true);
      setMessage('PIN correcto. Primera vez: registra tu rostro para completar el acceso.');
      return seq;
    }
    setEmployeeNeedsFaceRegistration(false);
    setPendingFaceVerify(true);
    setCameraActive(true);
    setMessage('PIN correcto. Ahora confirma con tu rostro.');
    return seq;
  }

  async function identify(event: FormEvent) {
    event.preventDefault();
    if (pinCooldown) return;
    startPinCooldown();
    setError('');
    setMessage('');
    try {
      await api.request(`/kiosk/${encodeURIComponent(deviceCode)}/config`);
      const data = await api.request<{ employee: Record<string, unknown> & { has_face_template?: boolean }; access_token?: string }>('/kiosk/identify-pin', {
        method: 'POST',
        body: JSON.stringify({ device_code: deviceCode, pin }),
      });
      
      const emp = data.employee;
      setPin('');
      await afterPinLogin(emp, data.access_token, 'pin');
    } catch (err) {
      setEmployee(null);
      setEvents([]);
      setAssignments([]);
      const message = err instanceof Error ? err.message : 'No se pudo identificar';
      if (!isRetryMessage(message)) setError(message);
    }
  }

  async function verifyOwnFace(silent = false) {
    if (!pendingFaceVerify || !employee || identifyingRef.current) return;
    identifyingRef.current = true;
    if (!silent) {
      setError('');
      setMessage('');
    }
    const base64Image = captureFrame('kiosk-verify-webcam');
    if (!base64Image) {
      if (!silent) setError('No se pudo capturar la imagen de la cámara.');
      identifyingRef.current = false;
      return;
    }
    try {
      const data = await api.request<{ success: boolean; confidence_score?: number; employee_id?: number }>('/kiosk/verify-face', {
        method: 'POST',
        body: JSON.stringify({ image_base64: base64Image, device_code: deviceCode }),
      });
      if (Number(employeeRef.current?.id) !== Number(employee.id)) return;
      if (!data.success) {
        if (!silent) {
          faceFailCount.current += 1;
          if (faceFailCount.current >= 5) {
            setError('El rostro no coincide con este PIN. Vuelve a ingresar tu PIN.');
            logoutEmployee();
            return;
          }
          setError('El rostro no coincide con el PIN ingresado. Inténtalo de nuevo.');
        }
        return;
      }
      setAuthMethodUsed('face_id');
      setMessage('Rostro confirmado. Acceso correcto.');
      await openKioskPanel(Number(employee.id));
    } catch (err) {
      if (silent) return;
      const message = err instanceof Error ? err.message : 'No se pudo verificar el rostro';
      if (!isRetryMessage(message)) setError(message);
    } finally {
      identifyingRef.current = false;
    }
  }

  async function registerEmployeeFace() {
    if (!employee) return;
    const ownerId = Number(employee.id);
    setError('');
    setMessage('');
    
    const base64Image = captureFrame('kiosk-register-webcam');

    if (!base64Image) {
      setError("No se pudo capturar la imagen. Enciende la cámara.");
      return;
    }

    if (regStep < 2) {
      setRegImages([...regImages, base64Image]);
      setRegStep(regStep + 1);
      setMessage(`Paso ${regStep === 0 ? "Frente" : "Izquierda"} capturado con éxito.`);
    } else {
      const allImages = [...regImages, base64Image];
      try {
        if (Number(employeeRef.current?.id) !== ownerId) return;
        await api.request(`/employees/${ownerId}/register-face`, {
          method: 'POST',
          body: JSON.stringify({ images: allImages, device_code: deviceCode }),
        });
        if (Number(employeeRef.current?.id) !== ownerId) return;
        setRegStep(0);
        setRegImages([]);
        setMessage('Registro de rostro completado. Acceso correcto.');
        await openKioskPanel(ownerId);
      } catch (err: any) {
        setError(err.message || 'No se pudo completar el registro facial');
      }
    }
  }

  async function identifyManagerOverride(event: FormEvent) {
    event.preventDefault();
    if (pinCooldown) return;
    startPinCooldown();
    setError('');
    setMessage('');
    try {
      await api.request(`/kiosk/${encodeURIComponent(deviceCode)}/config`);
      const data = await api.request<{ employee: Record<string, unknown>; access_token?: string }>('/kiosk/identify-manager-override', {
        method: 'POST',
        body: JSON.stringify({ device_code: deviceCode, employee_pin: employeePin, manager_pin: managerPin }),
      });

      const emp = data.employee as Record<string, unknown> & { has_face_template?: boolean };
      setManagerPin('');
      setEmployeePin('');
      await afterPinLogin(emp, data.access_token, 'pin');
    } catch (err) {
      setEmployee(null);
      setEvents([]);
      setAssignments([]);
      const message = err instanceof Error ? err.message : 'No se pudo autorizar';
      if (!isRetryMessage(message)) setError(message);
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
    bumpSession();
    employeeRef.current = null;
    api.clearToken();
    setEmployee(null);
    setEvents([]);
    setAssignments([]);
    setWorkSchedule(null);
    setKioskTab('actions');
    setBusyTaskKey('');
    setMessage('');
    setError('');
    setPin('');
    setManagerPin('');
    setEmployeePin('');
    setAuthMethodUsed('pin');
    setEmployeeNeedsFaceRegistration(false);
    setPendingFaceVerify(false);
    faceFailCount.current = 0;
    setLoginMethod('pin');
    setCameraActive(false);
    setRegStep(0);
    setRegImages([]);
  }

  async function register(eventTypeId: number, managerPin?: string) {
    if (!employee) return;
    const ownerId = Number(employee.id);
    setError('');
    setMessage('');
    try {
      if (Number(employeeRef.current?.id) !== ownerId) return;
      await api.request('/kiosk/attendance-events', {
        method: 'POST',
        body: JSON.stringify({
          employee_id: ownerId,
          event_type_id: eventTypeId,
          device_code: deviceCode,
          method: authMethodUsed,
          manager_pin: managerPin || undefined,
        }),
      });
      if (Number(employeeRef.current?.id) !== ownerId) return;
      setMessage('Evento registrado con éxito');
      await loadEvents(ownerId);
      await loadAssignments(ownerId);
      await loadWorkStatus(ownerId);
    } catch (err) {
      const status = (err as Error & { status?: number }).status;
      if (status === 409 && !managerPin) {
        const pin = window.prompt(err instanceof Error ? err.message : 'Se requiere PIN de gerente');
        if (pin) {
          await register(eventTypeId, pin);
          return;
        }
      }
      setError(err instanceof Error ? err.message : 'No se pudo registrar el evento');
    }
  }

  async function toggleTask(assignment: KioskAssignment, task: KioskTask) {
    const key = `${assignment.id}:${task.id}`;
    if (busyTaskKey) return;
    setError('');
    setMessage('');
    setBusyTaskKey(key);
    try {
      const updated = await api.request<KioskAssignment>(`/kiosk/employee-assignments/${assignment.id}/tasks/${task.id}`, {
        method: 'POST',
        body: JSON.stringify({ completed: !task.completed }),
      });
      if (updated.state === 'completed' || updated.state === 'validated') {
        setMessage(`Sección ${updated.template_name || 'de tareas'} completada`);
      }
      const ownerId = Number(employeeRef.current?.id);
      if (ownerId) {
        await loadAssignments(ownerId);
        await loadEvents(ownerId);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo actualizar la tarea');
    } finally {
      setBusyTaskKey('');
    }
  }

  useEffect(() => {
    if (!pendingFaceVerify || !employee || !cameraActive || !stream) return;
    const interval = setInterval(() => {
      void verifyOwnFace(true);
    }, 2500);
    return () => clearInterval(interval);
  }, [pendingFaceVerify, employee, cameraActive, stream]);

  if (!employee) {
    return (
      <div className="login-page" style={{ minHeight: '80vh', background: 'transparent', padding: '0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div className="login-box" style={{ width: '100%', position: 'relative', border: '1px solid #dce3ea', borderRadius: '16px', padding: '32px 24px', background: 'white' }}>
          <button 
            className="ghost" 
            type="button" 
            onClick={async () => {
              if (showConfig) {
                setShowConfig(false);
              } else {
                const mgrPin = prompt("Ingrese el PIN de Gerente para configurar el dispositivo:");
                if (!mgrPin) return;
                try {
                  await api.request('/kiosk/verify-manager-pin', {
                    method: 'POST',
                    body: JSON.stringify({ device_code: deviceCode, pin: mgrPin })
                  });
                  setTempDeviceCode(deviceCode);
                  setShowConfig(true);
                } catch (err) {
                  alert(err instanceof Error ? err.message : 'PIN de Gerente inválido o sin permisos');
                }
              }
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
              background: 'transparent',
              opacity: 0,
              cursor: 'default'
            }}
          >
            <Settings size={18} />
          </button>

          <div className="brand" style={{ color: '#17202a', border: 0, padding: 0, justifyContent: 'center', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div className="brand-mark" style={{ background: '#2f7dd1', color: 'white', fontWeight: 'bold' }}>K</div>
            <div>
              <strong>Kiosko Operativo</strong>
              <span style={{ fontSize: '12px', color: '#657487', display: 'block' }}>PIN y luego rostro</span>
            </div>
          </div>

          {/* Reloj en vivo — pantalla de login */}
          <div style={{ textAlign: 'center', marginBottom: '20px', padding: '12px 16px', background: '#f8fafc', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
            <div style={{ fontSize: '28px', fontWeight: '900', color: '#0f172a', letterSpacing: '-0.5px', fontFamily: 'monospace' }}>{kioskTimeStr}</div>
            <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px', textTransform: 'capitalize' }}>{kioskDateStr}</div>
          </div>

          {showConfig && (
            <div className="panel" style={{ padding: '16px', marginBottom: '20px', background: '#f8fafc', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
              <strong style={{ fontSize: '14px', display: 'block', marginBottom: '8px', color: '#1e293b' }}>Configurar Dispositivo</strong>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 'bold', color: '#475569', display: 'block', marginBottom: '4px' }}>
                    Código de Dispositivo
                  </label>
                  <input 
                    value={tempDeviceCode} 
                    onChange={(e) => setTempDeviceCode(e.target.value)} 
                    placeholder="Código de Dispositivo"
                    style={{ minHeight: '38px', height: '38px', padding: '8px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', width: '100%', boxSizing: 'border-box' }}
                  />
                </div>

                <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
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
                  <button 
                    className="ghost" 
                    type="button" 
                    onClick={() => setShowConfig(false)}
                    style={{ minHeight: '38px', height: '38px', padding: '0 16px', borderRadius: '8px' }}
                  >
                    Cancelar
                  </button>
                </div>
              </div>
              <small style={{ color: '#64748b', marginTop: '10px', display: 'block' }}>Dispositivo actual: <code>{deviceCode}</code> | Cooldown de inactividad: <code>{sessionTimeout === 0 ? 'Desactivado' : `${sessionTimeout}s`}</code></small>
            </div>
          )}

          {error && <div className="error" style={{ fontSize: '13px', margin: '0 0 16px 0', textAlign: 'center' }}>{error}</div>}
          {message && <div className="badge" style={{ margin: '0 0 16px 0', display: 'flex', justifyContent: 'center', padding: '6px' }}>{message}</div>}

          {loginMethod === 'pin' && (
            <form className="login-form" onSubmit={identify} style={{ marginTop: '0', display: 'grid', gap: '16px' }}>
              {isLockEnabled && lockedEmployeeId && (
                <div style={{ background: '#fef2f2', border: '1px solid #fee2e2', padding: '12px', borderRadius: '12px', textAlign: 'center' }}>
                  <span style={{ fontSize: '11px', fontWeight: 'bold', color: '#b91c1c', display: 'flex', alignItems: 'center', gap: '4px', justifyContent: 'center', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '2px' }}><Lock size={11} /> Dispositivo Vinculado</span>
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

              <label className="field" style={{ textAlign: 'center', gap: '8px', display: 'grid' }}>
                <span style={{ fontSize: '14px', color: '#475569', fontWeight: 'bold' }}>Ingresa tu PIN</span>
                <input 
                  type="password" 
                  inputMode="numeric" 
                  pattern="[0-9]*" 
                  maxLength={12}
                  value={pin} 
                  onChange={(event) => setPin(event.target.value)} 
                  disabled={pinCooldown} 
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

              <button className="primary" type="submit" disabled={pinCooldown} style={{ minHeight: '48px', fontSize: '16px', borderRadius: '12px', marginTop: '8px', fontWeight: 'bold' }}>
                <KeyRound size={20} /> Autenticar PIN
              </button>

              <button
                type="button"
                className="ghost"
                onClick={() => setLoginMethod('manager_override')}
                style={{ minHeight: '44px', borderRadius: '12px', fontWeight: 'bold', fontSize: '13px' }}
              >
                PIN Gerente
              </button>
            </form>
          )}

          {loginMethod === 'manager_override' && (
            <form className="login-form" onSubmit={identifyManagerOverride} style={{ marginTop: '0', display: 'grid', gap: '16px' }}>
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

              <button className="primary" type="submit" disabled={pinCooldown} style={{ minHeight: '48px', fontSize: '16px', borderRadius: '12px', marginTop: '8px', fontWeight: 'bold' }}>
                <ShieldCheck size={20} /> Autorizar y Entrar
              </button>

              <button 
                type="button" 
                className="ghost" 
                onClick={() => {
                  setLoginMethod('pin');
                  setCameraActive(false);
                }}
                style={{ width: '100%', minHeight: '44px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', fontWeight: 'bold' }}
              >
                Volver al PIN
              </button>
            </form>
          )}
        </div>
      </div>
    );
  }

  // Registro biométrico multi-ángulo en pantalla de Kiosko
  if (employee && employeeNeedsFaceRegistration) {
    const stepInstructions = [
      "Mira fijamente a la cámara de Frente.",
      "Gira levemente la cabeza hacia la Izquierda (Perfil).",
      "Gira levemente la cabeza hacia la Derecha (Perfil)."
    ];
    return (
      <div className="login-page" style={{ minHeight: '80vh', background: 'transparent', padding: '0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div className="login-box" style={{ width: '100%', maxWidth: '420px', border: '1px solid #dce3ea', borderRadius: '16px', padding: '24px', background: 'white', textAlign: 'center' }}>
          <strong style={{ fontSize: '16px', display: 'block', color: '#0f172a' }}>Registro de Rostro para Face ID</strong>
          <span style={{ fontSize: '13px', color: '#64748b', display: 'block', marginTop: '4px' }}>{String(employee.name)}</span>
          <p style={{ fontSize: '13px', color: '#475569', marginTop: '8px' }}>Primera vez: registra tu rostro en 3 ángulos para poder entrar después.</p>

          <div style={{ display: 'flex', justifyContent: 'center', margin: '20px 0' }}>
            <div style={{ width: '200px', height: '200px', borderRadius: '50%', overflow: 'hidden', border: '4px solid #10b981', background: '#000', position: 'relative' }}>
              {cameraActive ? (
                <video 
                  id="kiosk-register-webcam" 
                  autoPlay 
                  playsInline 
                  muted 
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
                />
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#94a3b8' }}>
                  Cargando cámara...
                </div>
              )}
            </div>
          </div>

          <div style={{ marginBottom: '20px' }}>
            <span style={{ 
              display: 'inline-block', 
              padding: '4px 10px', 
              background: '#ecfdf5', 
              color: '#059669', 
              borderRadius: '20px', 
              fontSize: '12px', 
              fontWeight: 'bold' 
            }}>
              Paso {regStep + 1} de 3
            </span>
            <p style={{ fontSize: '14px', color: '#1e293b', fontWeight: '600', marginTop: '8px', minHeight: '40px' }}>
              {stepInstructions[regStep]}
            </p>
          </div>

          {error && <div className="error" style={{ fontSize: '13px', marginBottom: '12px' }}>{error}</div>}
          {message && <div className="badge" style={{ marginBottom: '12px', display: 'block' }}>{message}</div>}

          <div style={{ display: 'grid', gap: '8px' }}>
            <button 
              className="primary" 
              type="button" 
              onClick={registerEmployeeFace} 
              style={{ minHeight: '46px', borderRadius: '12px', fontWeight: 'bold' }}
            >
              Capturar Foto {regStep + 1}
            </button>
            <button 
              className="ghost" 
              type="button" 
              onClick={logoutEmployee} 
              style={{ minHeight: '44px', borderRadius: '12px' }}
            >
              Cancelar Registro
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (employee && pendingFaceVerify) {
    return (
      <div className="login-page" style={{ minHeight: '80vh', background: 'transparent', padding: '0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div className="login-box" style={{ width: '100%', maxWidth: '420px', border: '1px solid #dce3ea', borderRadius: '16px', padding: '24px', background: 'white', textAlign: 'center' }}>
          <strong style={{ fontSize: '16px', display: 'block', color: '#0f172a' }}>Confirma tu rostro</strong>
          <span style={{ fontSize: '13px', color: '#64748b', display: 'block', marginTop: '4px' }}>{String(employee.name)}</span>
          <p style={{ fontSize: '13px', color: '#475569', marginTop: '8px' }}>El PIN ya es correcto. Mira a la cámara para entrar a tu panel.</p>

          <div style={{ display: 'flex', justifyContent: 'center', margin: '20px 0', position: 'relative' }}>
            <div style={{ width: '200px', height: '200px', borderRadius: '50%', overflow: 'hidden', border: '4px solid #3b82f6', background: '#000', position: 'relative' }}>
              {cameraActive ? (
                <video
                  id="kiosk-verify-webcam"
                  autoPlay
                  playsInline
                  muted
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#94a3b8' }}>
                  Cargando cámara...
                </div>
              )}
              <div style={{
                position: 'absolute',
                top: '0',
                left: '0',
                width: '100%',
                height: '4px',
                background: 'rgba(59, 130, 246, 0.7)',
                boxShadow: '0 0 8px #3b82f6',
                animation: 'scan 2s infinite ease-in-out'
              }} />
            </div>
          </div>
          <style>{`
            @keyframes scan {
              0% { top: 0%; }
              50% { top: 100%; }
              100% { top: 0%; }
            }
          `}</style>

          {error && <div className="error" style={{ fontSize: '13px', marginBottom: '12px' }}>{error}</div>}
          {message && <div className="badge" style={{ marginBottom: '12px', display: 'block' }}>{message}</div>}

          <div style={{ display: 'grid', gap: '8px' }}>
            <button
              className="primary"
              type="button"
              onClick={() => void verifyOwnFace(false)}
              style={{ minHeight: '46px', borderRadius: '12px', fontWeight: 'bold' }}
            >
              <ScanFace size={20} /> Confirmar rostro
            </button>
            <button
              className="ghost"
              type="button"
              onClick={logoutEmployee}
              style={{ minHeight: '44px', borderRadius: '12px' }}
            >
              Cancelar
            </button>
          </div>
        </div>
      </div>
    );
  }

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

  const currentDateStr = kioskDateStr;
  const currentTimeStr = kioskTimeStr;
  const taskSections = assignments.map((assignment) => {
    const tasks = [...(assignment.tasks || [])].sort((a, b) => (a.sequence || 0) - (b.sequence || 0));
    const pending = tasks.filter((task) => !task.completed).length;
    return {
      id: assignment.id,
      name: assignment.template_name || 'Tareas',
      tasks,
      pending,
      total: tasks.length,
    };
  });
  const pendingTaskCount = taskSections.reduce((sum, section) => sum + section.pending, 0);

  return (
    <div style={{ display: 'grid', gap: '14px', width: '100%', padding: '0 4px', maxWidth: '480px', margin: '0 auto' }}>
      
      {/* Título de la Vista */}
      <div style={{ textAlign: 'center', margin: '10px 0 2px 0' }}>
        <h1 style={{ fontSize: '28px', fontWeight: '900', color: '#0f172a', margin: '0 0 2px 0', letterSpacing: '-0.8px' }}>Check in</h1>
        <span style={{ fontSize: '13px', color: '#64748b', fontWeight: '600' }}>Control de Asistencia Kiosko</span>
      </div>

      {/* Cabecera del Empleado & Parámetros del Día */}
      <div className="panel" style={{ background: '#1a2330', color: 'white', border: '0', borderRadius: '10px', padding: '18px' }}>
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
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ color: '#94a3b8' }}>Fecha:</span>
            <strong style={{ color: '#f8fafc', textTransform: 'capitalize', fontSize: '12px' }}>{currentDateStr}</strong>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ color: '#94a3b8' }}>Hora actual:</span>
            <strong style={{ color: '#d5dee6', fontFamily: 'monospace', fontSize: '13px', letterSpacing: '0.5px' }}>{currentTimeStr}</strong>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: '#94a3b8' }}>Horario:</span>
            <strong style={{ color: workSchedule?.is_off ? '#fbbf24' : '#f8fafc' }}>
              {workSchedule?.is_off ? 'Día libre' : (workSchedule?.label || '11:00 – 03:00')}
            </strong>
          </div>
          {workSchedule?.name && (
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: '#94a3b8' }}>Plantilla:</span>
              <strong style={{ color: '#d5dee6' }}>{workSchedule.name}</strong>
            </div>
          )}
          {workSchedule?.punch?.label && (
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: '#94a3b8' }}>Marcación:</span>
              <strong style={{ color: workSchedule.punch.code === 'on_time' ? '#34d399' : '#fbbf24' }}>
                {workSchedule.punch.label}
              </strong>
            </div>
          )}
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: '#94a3b8' }}>Salida automática:</span>
            <strong style={{ color: '#d5dee6' }}>
              {events.some(e => e.closes_shift) ? 'Deshabilitada (Manual)' : `Habilitada (${workSchedule?.auto_checkout_label || '03:00'})`}
            </strong>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: '#94a3b8' }}>Tareas pendientes:</span>
            <strong style={{ color: pendingTaskCount > 0 ? '#fbcfe8' : '#34d399' }}>
              {pendingTaskCount > 0 ? `${pendingTaskCount} por hacer` : 'Ninguna'}
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

      {error && <div className="error" style={{ margin: '0', fontSize: '13px', borderRadius: '10px', textAlign: 'center' }}>{error}</div>}
      {message && <div className="badge" style={{ margin: '0', background: '#ecfdf5', color: '#047857', border: '1px solid #a7f3d0', padding: '10px 14px', width: '100%', justifyContent: 'center', fontWeight: 'bold', fontSize: '13px', borderRadius: '10px' }}>{message}</div>}

      <div className="kiosk-tabs">
        <button className={kioskTab === 'actions' ? 'active' : ''} type="button" onClick={() => setKioskTab('actions')}>
          <Zap size={16} /> Acciones rápidas
        </button>
        <button className={kioskTab === 'tasks' ? 'active' : ''} type="button" onClick={() => setKioskTab('tasks')}>
          <ListChecks size={16} /> Tareas asignadas
          {pendingTaskCount > 0 && <span className="kiosk-tab-count">{pendingTaskCount}</span>}
        </button>
      </div>

      {kioskTab === 'actions' && (
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
                <span>No hay más acciones disponibles.</span>
              </div>
            )}
          </div>
        </div>
      )}

      {kioskTab === 'tasks' && (
        <div className="panel" style={{ borderRadius: '16px', padding: '16px', background: 'white', border: '1px solid #e2e8f0', boxShadow: '0 4px 12px rgba(0,0,0,0.02)' }}>
          <div style={{ display: 'grid', gap: '12px' }}>
            {taskSections.map((section) => (
              <section className="kiosk-section" key={section.id}>
                <div className="kiosk-section-head">
                  <h3>Sección {section.name}</h3>
                  <span>{section.pending} de {section.total} por hacer</span>
                </div>
                {section.tasks.map((task) => (
                  <button
                    key={task.id}
                    className={`kiosk-check-item${task.completed ? ' done' : ''}`}
                    type="button"
                    disabled={Boolean(busyTaskKey)}
                    onClick={() => {
                      const assignment = assignments.find((item) => item.id === section.id);
                      if (assignment) toggleTask(assignment, task);
                    }}
                  >
                    <span className="kiosk-check-box">{task.completed ? <Check size={14} /> : null}</span>
                    <div>
                      <strong>{task.name}</strong>
                      {task.description ? <p>{task.description}</p> : null}
                    </div>
                  </button>
                ))}
                {!section.tasks.length && (
                  <div className="empty">Esta sección no tiene tareas.</div>
                )}
              </section>
            ))}
            {!taskSections.length && (
              <div className="empty">No tienes tareas asignadas.</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
