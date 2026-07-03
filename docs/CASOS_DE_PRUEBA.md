# Casos de Prueba

## CP-001 Login exitoso

- Precondicion: backend y frontend activos.
- Pasos: abrir frontend, ingresar `admin` / `admin123`, presionar Entrar.
- Esperado: Dashboard visible.
- Prioridad: Alta.

## CP-002 Login invalido

- Precondicion: backend y frontend activos.
- Pasos: ingresar password incorrecto.
- Esperado: mensaje de error y sin acceso al dashboard.
- Prioridad: Alta.

## CP-003 Health backend

- Pasos: ejecutar `curl http://localhost:8095/health`.
- Esperado: `status=ok` y `service=attendance_saas_backend`.
- Prioridad: Alta.

## CP-004 Carga de empresa actual

- Pasos: login, abrir Empresa.
- Esperado: datos de empresa actual visibles.
- Prioridad: Media.

## CP-005 Listado de empleados

- Pasos: login, abrir Empleados.
- Esperado: aparece `Admin Demo` o registros demo.
- Prioridad: Alta.

## CP-006 Listado de dispositivos

- Pasos: abrir Dispositivos.
- Esperado: existe `KIOSK-DEMO` activo.
- Prioridad: Alta.

## CP-007 Identificacion por PIN correcta

- Pasos: abrir Kiosko PIN, device `KIOSK-DEMO`, PIN `1234`, identificar.
- Esperado: empleado `Admin Demo`.
- Prioridad: Alta.

## CP-008 Identificacion por PIN incorrecta

- Pasos: usar device `KIOSK-DEMO`, PIN invalido.
- Esperado: error `PIN invalido` o equivalente.
- Prioridad: Alta.

## CP-009 Device inexistente

- Pasos: usar device code inexistente en Kiosko.
- Esperado: error `Dispositivo no encontrado`.
- Prioridad: Media.

## CP-010 Eventos disponibles sin jornada

- Precondicion: empleado sin jornada abierta.
- Pasos: identificar empleado y consultar eventos disponibles.
- Esperado: solo eventos que abren jornada.
- Prioridad: Alta.

## CP-011 Crear entrada

- Precondicion: empleado sin jornada abierta.
- Pasos: registrar evento de entrada desde Kiosko.
- Esperado: evento creado, jornada abierta, hr_attendance creado.
- Prioridad: Alta.

## CP-012 Evitar doble entrada

- Precondicion: empleado con jornada abierta.
- Pasos: intentar registrar otro evento que abre jornada.
- Esperado: error `Ya existe una jornada abierta`.
- Prioridad: Alta.

## CP-013 Eventos disponibles con jornada abierta

- Precondicion: jornada abierta con ultimo evento de entrada.
- Pasos: consultar eventos disponibles.
- Esperado: eventos de direccion `out`.
- Prioridad: Alta.

## CP-014 Break completo

- Precondicion: jornada abierta.
- Pasos: registrar salida a break y regreso de break.
- Esperado: ambos eventos en la jornada y minutos de break recalculados.
- Prioridad: Media.

## CP-015 Comida completa

- Precondicion: jornada abierta.
- Pasos: registrar salida a comida y regreso de comida.
- Esperado: minutos de comida recalculados.
- Prioridad: Media.

## CP-016 Generacion de asignacion al check-in

- Precondicion: regla activa de asignacion.
- Pasos: registrar entrada y consultar asignaciones del empleado.
- Esperado: asignacion generada para la jornada.
- Prioridad: Alta.

## CP-017 Check-out bloqueado por asignacion pendiente

- Precondicion: jornada abierta con asignacion requerida bloqueante en estado pendiente.
- Pasos: intentar salida final.
- Esperado: error por asignaciones obligatorias pendientes.
- Prioridad: Alta.

## CP-018 Guardar respuestas de asignacion

- Precondicion: asignacion pendiente con preguntas.
- Pasos: responder preguntas requeridas.
- Esperado: respuestas guardadas.
- Prioridad: Alta.

## CP-019 Completar asignacion sin supervisor

- Precondicion: preguntas requeridas respondidas y sin validacion supervisor.
- Pasos: completar asignacion.
- Esperado: estado `completed`.
- Prioridad: Alta.

## CP-020 Completar asignacion con supervisor

- Precondicion: pregunta activa requiere supervisor.
- Pasos: completar asignacion.
- Esperado: estado `validation_pending`.
- Prioridad: Media.

## CP-021 Validar asignacion por supervisor PIN

- Precondicion: asignacion en `validation_pending`.
- Pasos: validar con PIN supervisor/admin.
- Esperado: estado `validated`.
- Prioridad: Media.

## CP-022 Rechazar asignacion por supervisor PIN

- Precondicion: asignacion en `validation_pending`.
- Pasos: rechazar con PIN supervisor/admin.
- Esperado: estado `rejected`.
- Prioridad: Media.

## CP-023 Cerrar jornada

- Precondicion: jornada abierta sin bloqueos.
- Pasos: registrar salida final.
- Esperado: jornada `closed` y hr_attendance sincronizado.
- Prioridad: Alta.

## CP-024 Registro manual de no attendance

- Pasos: abrir No attendance, crear registro con empleado, fecha y motivo.
- Esperado: registro creado y visible.
- Prioridad: Media.

## CP-025 Reporte de excepciones

- Precondicion: existe no attendance.
- Pasos: abrir reporte de excepciones.
- Esperado: resumen por motivo.
- Prioridad: Media.

## CP-026 Registrar Face ID mock

- Pasos: abrir Face ID, employee ID `1`, imagen `demo-face-admin`, registrar.
- Esperado: plantilla creada.
- Prioridad: Alta.

## CP-027 Identificar Face ID mock correcto

- Precondicion: plantilla Face ID activa.
- Pasos: identificar con `demo-face-admin`.
- Esperado: empleado identificado, confianza alta, log biometrico.
- Prioridad: Alta.

## CP-028 Identificar Face ID sin plantilla

- Precondicion: empleado sin plantilla activa o plantillas deshabilitadas.
- Pasos: identificar rostro.
- Esperado: respuesta sin empleado y log fallido.
- Prioridad: Media.

## CP-029 Deshabilitar Face ID

- Precondicion: plantilla activa.
- Pasos: deshabilitar rostro del empleado.
- Esperado: plantillas activas pasan a inactivas y auditoria registra accion.
- Prioridad: Media.

## CP-030 Logs biometricos

- Precondicion: al menos una identificacion Face ID.
- Pasos: abrir Logs biometricos.
- Esperado: registros con metodo, exito, confianza y timestamp.
- Prioridad: Alta.

## CP-031 Auditoria

- Precondicion: registrar o deshabilitar Face ID, o ejecutar auto checkout.
- Pasos: abrir Auditoria.
- Esperado: acciones auditadas visibles.
- Prioridad: Alta.

## CP-032 Reporte de horas

- Precondicion: jornada cerrada.
- Pasos: abrir reporte de horas.
- Esperado: horas agrupadas por empleado.
- Prioridad: Alta.

## CP-033 Reporte de asignaciones

- Precondicion: asignaciones generadas.
- Pasos: abrir reporte de asignaciones.
- Esperado: conteo por estado.
- Prioridad: Alta.

## CP-034 Reporte biometrico

- Precondicion: logs biometricos existentes.
- Pasos: abrir reporte biometrico.
- Esperado: conteo por metodo y exito.
- Prioridad: Media.

## CP-035 Auto checkout con regla aplicable

- Precondicion: jornada abierta y regla activa aplicable.
- Pasos: ejecutar job de auto checkout.
- Esperado: jornada cerrada y auditoria registrada.
- Prioridad: Media.

## CP-036 Auto checkout sin regla aplicable

- Precondicion: jornada abierta sin regla activa aplicable.
- Pasos: ejecutar job.
- Esperado: no se cierra la jornada.
- Prioridad: Media.

## CP-037 Evento que requiere nota

- Precondicion: tipo de evento con `requires_note=true`.
- Pasos: intentar crearlo sin nota.
- Esperado: error de validacion.
- Prioridad: Media.

## CP-038 Evento que requiere evidencia

- Precondicion: tipo de evento con `requires_evidence=true`.
- Pasos: intentar crearlo sin evidencia.
- Esperado: error de validacion.
- Prioridad: Media.

## CP-039 Rate limit PIN

- Pasos: enviar multiples PIN incorrectos al mismo device.
- Esperado: despues del limite, respuesta bloqueada temporalmente.
- Prioridad: Baja.

## CP-040 Aislamiento Docker

- Pasos: ejecutar `docker compose ps` desde `~/attendance-saas`.
- Esperado: solo recursos del proyecto con prefijo `attendance_saas`.
- Prioridad: Alta.
