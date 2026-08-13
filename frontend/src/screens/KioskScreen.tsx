import { FormEvent, useEffect, useState } from 'react';
import {
  KeyRound,
  Lock,
  ScanFace,
  Settings,
  ShieldCheck,
} from 'lucide-react';
import { api } from '../api/client';

export function KioskScreen() {
  const [deviceCode, setDeviceCode] = useState(localStorage.getItem('kiosk_device_code') ?? 'KIOSK-DEMO');
  const [pin, setPin] = useState('');
  const [employee, setEmployee] = useState<Record<string, unknown> | null>(null);
  const [events, setEvents] = useState<Record<string, unknown>[]>([]);
  const [assignments, setAssignments] = useState<Record<string, unknown>[]>([]);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [showConfig, setShowConfig] = useState(false);
  const [tempDeviceCode, setTempDeviceCode] = useState(deviceCode);
  const [sessionTimeout, setSessionTimeout] = useState<number>(() => {
    const saved = localStorage.getItem('kiosk_session_timeout');
    return saved ? parseInt(saved, 10) : 30;
  });

  const [loginMethod, setLoginMethod] = useState<'face' | 'pin' | 'manager_override'>('face');
  const [authMethodUsed, setAuthMethodUsed] = useState<'pin' | 'face_id'>('pin');
  const [cameraActive, setCameraActive] = useState(true);
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

  // Sincronizar el estado de dispositivo vinculado si se apaga globalmente
  useEffect(() => {
    if (!isLockEnabled) {
      setLockedEmployeeId(null);
      setLockedEmployeeName(null);
    }
  }, [isLockEnabled]);

  // Manejo de la cámara en vivo
  useEffect(() => {
    const shouldBeActive = (loginMethod === 'face' && !employee && cameraActive) || (employee && employeeNeedsFaceRegistration && cameraActive);
    if (shouldBeActive) {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        console.error("Cámara no disponible. Asegúrate de estar en una conexión segura (HTTPS o localhost).");
        setError("El navegador bloqueó la cámara. Se requiere conexión segura (HTTPS o localhost) para usar Face ID.");
        setCameraActive(false);
        return;
      }
      navigator.mediaDevices.getUserMedia({ video: { width: 320, height: 320 } })
        .then((s) => {
          setStream(s);
          const videoId = employee ? 'kiosk-register-webcam' : 'kiosk-webcam';
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
  }, [loginMethod, employee, employeeNeedsFaceRegistration, cameraActive]);

  // Reloj en vivo — actualiza cada segundo en zona horaria El Salvador
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Cierre de sesión automático por inactividad del empleado
  useEffect(() => {
    if (!employee || sessionTimeout <= 0) return;

    let timeoutId: NodeJS.Timeout;

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
  }, [employee, sessionTimeout]);

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
      
      if (isLockEnabled && !lockedEmployeeId) {
        setLockedEmployeeId(String(emp.id));
        setLockedEmployeeName(String(emp.name));
      }

      if (data.access_token) {
        api.setToken(data.access_token);
      }

      setAuthMethodUsed('pin');
      setEmployee(emp);
      setPin('');

      if (!emp.has_face_template) {
        setEmployeeNeedsFaceRegistration(true);
        setCameraActive(true);
        setMessage("Primera vez detectada. Por favor, registra tu rostro para futuros accesos.");
      } else {
        setEmployeeNeedsFaceRegistration(false);
        setCameraActive(false);
        await loadEvents(Number(emp.id));
        await loadAssignments(Number(emp.id));
      }
    } catch (err) {
      setEmployee(null);
      setEvents([]);
      setAssignments([]);
      setError(err instanceof Error ? err.message : 'No se pudo identificar');
    }
  }

  async function identifyFace() {
    setError('');
    setMessage('');
    let base64Image = '';
    
    if (cameraActive && stream) {
      const videoElement = document.getElementById('kiosk-webcam') as HTMLVideoElement;
      if (videoElement) {
        const canvas = document.createElement('canvas');
        canvas.width = videoElement.videoWidth || 320;
        canvas.height = videoElement.videoHeight || 320;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(videoElement, 0, 0, canvas.width, canvas.height);
          base64Image = canvas.toDataURL('image/jpeg', 0.8);
        }
      }
    }
    
    if (!base64Image) {
      setError("No se pudo capturar la imagen de la cámara. Inténtalo de nuevo.");
      return;
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
        throw new Error(`Identificación fallida. Rostro no coincide con ningún colaborador.`);
      }
      
      if (data.access_token && data.employee) {
        const emp = data.employee;
        if (isLockEnabled && !lockedEmployeeId) {
          setLockedEmployeeId(String(emp.id));
          setLockedEmployeeName(String(emp.name));
        }

        api.setToken(data.access_token);
        setEmployee(emp);
        setAuthMethodUsed('face_id');
        setEmployeeNeedsFaceRegistration(false);
        await loadEvents(Number(emp.id));
        await loadAssignments(Number(emp.id));
        setMessage(`Identificado como ${emp.name} con éxito (Confianza: ${data.confidence_score?.toFixed(2) ?? 0})`);
        setCameraActive(false);
      } else {
        throw new Error("No se recibió el token de acceso.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo identificar por rostro');
    }
  }

  async function registerEmployeeFace() {
    if (!employee) return;
    setError('');
    setMessage('');
    
    let base64Image = '';
    if (cameraActive && stream) {
      const videoElement = document.getElementById('kiosk-register-webcam') as HTMLVideoElement;
      if (videoElement) {
        const canvas = document.createElement('canvas');
        canvas.width = 320;
        canvas.height = 320;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(videoElement, 0, 0, canvas.width, canvas.height);
          base64Image = canvas.toDataURL('image/jpeg', 0.8);
        }
      }
    }

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
        await api.request(`/employees/${employee.id}/register-face`, {
          method: 'POST',
          body: JSON.stringify({ images: allImages, device_code: deviceCode }),
        });
        
        await loadEvents(Number(employee.id));
        await loadAssignments(Number(employee.id));
        setEmployeeNeedsFaceRegistration(false);
        setMessage('Registro multi-ángulo completado. Sesión iniciada.');
        setCameraActive(false);
        setRegStep(0);
        setRegImages([]);
      } catch (err: any) {
        setError(err.message || 'No se pudo completar el registro facial');
      }
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

  // Auto-escanear rostro cada 2.5 segundos cuando la cámara está activa en login de rostro
  useEffect(() => {
    if (loginMethod !== 'face' || employee || !cameraActive || !stream) return;
    const interval = setInterval(() => {
      identifyFace();
    }, 2500);
    return () => clearInterval(interval);
  }, [loginMethod, employee, cameraActive, stream]);

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
              <span style={{ fontSize: '12px', color: '#657487', display: 'block' }}>Marcación de Asistencia</span>
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

          {loginMethod === 'face' && (
            <div style={{ display: 'grid', gap: '16px', textAlign: 'center' }}>
              {isLockEnabled && lockedEmployeeId && (
                <div style={{ background: '#fef2f2', border: '1px solid #fee2e2', padding: '10px', borderRadius: '12px' }}>
                  <span style={{ fontSize: '11px', fontWeight: 'bold', color: '#b91c1c', display: 'flex', alignItems: 'center', gap: '4px', justifyContent: 'center', textTransform: 'uppercase', letterSpacing: '0.5px' }}><Lock size={11} /> Dispositivo Vinculado</span>
                  <strong style={{ display: 'block', fontSize: '13px', color: '#991b1b', marginTop: '2px' }}>Solo {lockedEmployeeName}</strong>
                </div>
              )}

              <span style={{ fontSize: '14px', color: '#475569', fontWeight: 'bold' }}>Reconocimiento Facial Activo</span>
              
              <div style={{ display: 'flex', justifyContent: 'center', position: 'relative' }}>
                <div style={{ width: '220px', height: '220px', borderRadius: '50%', overflow: 'hidden', border: '4px solid #3b82f6', background: '#000', position: 'relative' }}>
                  {cameraActive ? (
                    <video 
                      id="kiosk-webcam" 
                      autoPlay 
                      playsInline 
                      muted 
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
                    />
                  ) : (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#94a3b8' }}>
                      Cámara desactivada
                    </div>
                  )}
                  {/* Escáner de luz de Face ID */}
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

              <button 
                className="primary" 
                type="button" 
                onClick={identifyFace} 
                style={{ minHeight: '48px', fontSize: '16px', borderRadius: '12px', fontWeight: 'bold' }}
              >
                <ScanFace size={20} /> Escanear mi Rostro
              </button>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                <button 
                  type="button" 
                  className="ghost" 
                  onClick={() => {
                    setLoginMethod('pin');
                    setCameraActive(false);
                  }}
                  style={{ minHeight: '44px', borderRadius: '12px', fontWeight: 'bold', fontSize: '13px' }}
                >
                  Primera vez / PIN
                </button>
                <button 
                  type="button" 
                  className="ghost" 
                  onClick={() => {
                    setLoginMethod('manager_override');
                    setCameraActive(false);
                  }}
                  style={{ minHeight: '44px', borderRadius: '12px', fontWeight: 'bold', fontSize: '13px' }}
                >
                  PIN Gerente
                </button>
              </div>
            </div>
          )}

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

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                <button 
                  type="button" 
                  className="ghost" 
                  onClick={() => {
                    setLoginMethod('face');
                    setCameraActive(true);
                  }}
                  style={{ minHeight: '44px', borderRadius: '12px', fontWeight: 'bold', fontSize: '13px' }}
                >
                  <ScanFace size={16} /> Usar Face ID
                </button>
                <button 
                  type="button" 
                  className="ghost" 
                  onClick={() => setLoginMethod('manager_override')}
                  style={{ minHeight: '44px', borderRadius: '12px', fontWeight: 'bold', fontSize: '13px' }}
                >
                  PIN Gerente
                </button>
              </div>
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
                Volver a Reconocimiento Facial
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
          <span style={{ fontSize: '13px', color: '#64748b', display: 'block', marginTop: '4px' }}>{employee.name}</span>

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

  const currentDateStr = kioskDateStr;
  const currentTimeStr = kioskTimeStr;

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
            <strong style={{ color: '#f8fafc' }}>11:00 – 03:00</strong>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: '#94a3b8' }}>Salida automática:</span>
            <strong style={{ color: '#d5dee6' }}>
              {events.some(e => e.closes_shift) ? 'Deshabilitada (Manual)' : 'Habilitada (03:00)'}
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

      {error && <div className="error" style={{ margin: '0', fontSize: '13px', borderRadius: '10px', textAlign: 'center' }}>{error}</div>}
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
              <span>No hay más acciones disponibles.</span>
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
                No tienes tareas pendientes.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
