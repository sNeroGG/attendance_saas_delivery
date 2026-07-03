# Errores Conocidos y Validaciones

Este documento lista comportamientos reales observados hasta Fase 4 que QA debe conocer antes de reportarlos como defectos nuevos.

## Funciona actualmente

- Login con JWT.
- CRUD administrativo basico para catalogos principales.
- Kiosko PIN con dispositivo y empleado demo.
- Creacion de eventos de asistencia.
- Apertura y cierre de jornadas.
- Sincronizacion con `hr_attendance`.
- Generacion de asignaciones por reglas.
- Bloqueo de check-out por asignaciones pendientes.
- Respuestas y completado de asignaciones.
- Validacion/rechazo de asignaciones por PIN supervisor/admin.
- Registro e identificacion Face ID mock.
- Logs biometricos.
- Auditoria parcial de acciones Fase 4.
- Reportes resumidos.
- Reglas y job de auto checkout.

## Mock o simulacion

### Face ID

Face ID no usa reconocimiento facial real. Usa hash de texto enviado en `image_base64`.

Limitacion importante: si no hay coincidencia exacta, el mock puede tomar la primera plantilla activa con confianza aproximada `0.82`. Esto permite validar el flujo tecnico, pero no debe aceptarse como prueba biometrica real.

### Evidencias

Los campos de evidencia son texto o URL. No existe subida real de archivos, imagenes o firma.

### Rate limit

El rate limit es en memoria. Se pierde al reiniciar el contenedor backend.

## Limitaciones funcionales conocidas

### Auto checkout

El job cierra jornadas abiertas con regla aplicable cuando se ejecuta. La hora configurada en `checkout_time` no se compara contra la hora actual antes de cerrar.

Impacto QA: no probarlo como scheduler real por hora; probarlo como cierre automatico manualmente disparado.

### Auditoria

La auditoria existe para acciones como registrar/deshabilitar Face ID y auto checkout. No todos los CRUD administrativos generan auditoria.

Impacto QA: no esperar auditoria completa para cada alta, cambio o cancelacion.

### Frontend generico

Muchas pantallas son formularios genericos y piden IDs manuales. No hay selectores avanzados para todas las relaciones.

Impacto QA: validar funcionalidad, no experiencia final de usuario.

### Validacion supervisor Face ID

El endpoint existe, pero el frontend actual no expone un workflow completo dedicado para validar asignaciones por Face ID de supervisor.

### Permisos granulares

Hay autenticacion y catalogo de permisos, pero no toda pantalla administrativa aplica bloqueo granular visible por permiso.

### Reportes

Los reportes son resumenes agrupados. No hay exportacion, filtros avanzados o detalle transaccional desde la pantalla actual.

### Odoo/Fase 5

No esta implementado. No probar sincronizacion Odoo ni API externa Odoo en esta fase.

### README

El README puede contener una nota antigua indicando que reportes no estan incluidos. En el codigo de Fase 4 si existen endpoints y pantalla de reportes resumidos.

## Validaciones negativas esperadas

### PIN invalido

Endpoint: `POST /api/kiosk/identify-pin`

Esperado: error 401 con detalle `PIN invalido`.

### Dispositivo inexistente

Endpoint: rutas de kiosk con device code inexistente.

Esperado: error 404 con detalle `Dispositivo no encontrado`.

### Empleado no activo

Si `is_active_for_work=false`, el sistema debe impedir check-in.

Esperado: error 422 con detalle `Empleado no activo para trabajar`.

### Estado laboral no permite check-in

Si el estado laboral del empleado tiene `allows_check_in=false`, el sistema debe impedir eventos de asistencia.

Esperado: error 422 con detalle `Estado laboral no permite check-in`.

### Evento sin jornada abierta

Intentar registrar evento que no abre jornada cuando no existe jornada abierta.

Esperado: error 422 con detalle `No hay jornada abierta para este evento`.

### Doble entrada

Intentar registrar evento que abre jornada cuando ya existe jornada abierta.

Esperado: error 422 con detalle `Ya existe una jornada abierta`.

### Salida con asignaciones pendientes

Intentar salida final con asignacion obligatoria bloqueante en estado pendiente.

Esperado: error 422 con detalle `Hay asignaciones obligatorias pendientes antes del check-out`.

### Evento requiere nota

Si el tipo de evento tiene `requires_note=true`, se debe enviar nota.

Esperado: error 422 con detalle `Este tipo de evento requiere nota`.

### Evento requiere evidencia

Si el tipo de evento tiene `requires_evidence=true`, se debe enviar evidencia.

Esperado: error 422 con detalle `Este tipo de evento requiere evidencia`.

### Metodo PIN no permitido

Si el tipo de evento tiene `allows_pin=false`, el kiosk no debe poder registrarlo por PIN.

Esperado: error 422 con detalle `Este tipo de evento no permite PIN`.

## Recomendaciones para reportar defectos

Cada defecto debe incluir:

- Ambiente: WSL + Docker Compose.
- URL o endpoint.
- Usuario usado.
- Datos exactos enviados.
- Resultado esperado.
- Resultado obtenido.
- Captura o JSON.
- Logs relevantes si existen.

Comandos de logs permitidos:

```bash
cd ~/attendance-saas
docker compose logs -f backend
docker compose logs -f frontend
```

No adjuntar comandos de limpieza global ni modificar volumenes para reproducir defectos.
