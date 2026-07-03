# Ciclo Funcional E2E

Este documento describe el ciclo completo que debe validar QA desde login hasta reportes.

## Flujo completo

### 1. Preparar entorno

```bash
cd ~/attendance-saas
docker compose up -d
docker compose ps
```

Verificar:

- Backend: http://localhost:8095/health
- Frontend: http://localhost:5175
- API docs: http://localhost:8095/docs

### 2. Login

Entrar al frontend con:

- Login: `admin`
- Password: `admin123`

Resultado esperado: Dashboard visible.

### 3. Verificar configuracion base

Revisar:

- Empresa actual.
- Dispositivo `KIOSK-DEMO`.
- Empleado `Admin Demo`.
- Tipos de evento activos.
- Plantilla de asignacion.
- Regla de asignacion.

Resultado esperado: la data demo permite ejecutar el ciclo sin crear registros nuevos.

### 4. Identificacion en Kiosko

Abrir Kiosko PIN:

- Device code: `KIOSK-DEMO`
- PIN: `1234`

Resultado esperado: identifica a `Admin Demo`.

### 5. Entrada

Registrar evento de entrada disponible.

Resultado esperado:

- Se crea `x_attendance_event`.
- Se crea `x_attendance_shift` en estado `open`.
- Se crea o actualiza `hr_attendance`.
- Se generan asignaciones si hay regla activa aplicable.

### 6. Asignacion obligatoria

Consultar asignaciones pendientes del empleado.

Resultado esperado:

- Si existe asignacion obligatoria bloqueante, aparece en Kiosko.
- El check-out final debe bloquearse hasta completarla o validarla.

### 7. Completar asignacion

Responder preguntas requeridas y completar la asignacion.

Resultado esperado:

- Si no requiere supervisor: estado `completed`.
- Si requiere supervisor: estado `validation_pending`.
- Si supervisor valida: estado `validated`.

### 8. Eventos intermedios

Opcionalmente registrar:

- Salida a break.
- Regreso de break.
- Salida a comida.
- Regreso de comida.

Resultado esperado:

- Los eventos se registran contra la misma jornada.
- La jornada recalcula minutos de break, comida y trabajo.

### 9. Salida final

Registrar evento de salida final.

Resultado esperado:

- La jornada cambia a `closed`.
- `check_out_at` tiene fecha/hora.
- `worked_time_minutes` queda calculado.
- `hr_attendance.check_out` queda sincronizado.

### 10. Face ID mock

Registrar rostro:

- Employee ID: `1`
- Image base64/mock: `demo-face-admin`

Identificar rostro con el mismo valor.

Resultado esperado:

- Plantilla activa creada.
- Identificacion exitosa.
- Log biometrico creado.
- Auditoria registra `register_face`.

### 11. Reportes

Consultar reportes:

- Horas.
- Asignaciones.
- Excepciones.
- Biometria.
- Auditoria.

Resultado esperado: cada reporte responde con resumen agrupado.

## Comandos API utiles

Login:

```bash
TOKEN=$(curl -s -X POST http://localhost:8095/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"login":"admin","password":"admin123"}' | python3 -c "import sys,json; print(json.load(sys.stdin)['access_token'])")
```

Health:

```bash
curl http://localhost:8095/health
```

Config de kiosk:

```bash
curl http://localhost:8095/api/kiosk/KIOSK-DEMO/config
```

Identificacion PIN:

```bash
curl -X POST http://localhost:8095/api/kiosk/identify-pin \
  -H 'Content-Type: application/json' \
  -d '{"device_code":"KIOSK-DEMO","pin":"1234"}'
```

Eventos disponibles:

```bash
curl 'http://localhost:8095/api/kiosk/employees/1/available-events?device_code=KIOSK-DEMO'
```

Registrar Face ID mock:

```bash
curl -X POST http://localhost:8095/api/employees/1/register-face \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"image_base64":"demo-face-admin","device_code":"KIOSK-DEMO"}'
```

Identificar Face ID mock:

```bash
curl -X POST http://localhost:8095/api/kiosk/identify-face \
  -H 'Content-Type: application/json' \
  -d '{"image_base64":"demo-face-admin","device_code":"KIOSK-DEMO"}'
```

Reportes:

```bash
curl -H "Authorization: Bearer $TOKEN" http://localhost:8095/api/reports/hours
curl -H "Authorization: Bearer $TOKEN" http://localhost:8095/api/reports/assignments
curl -H "Authorization: Bearer $TOKEN" http://localhost:8095/api/reports/attendance-exceptions
curl -H "Authorization: Bearer $TOKEN" http://localhost:8095/api/reports/biometric
curl -H "Authorization: Bearer $TOKEN" http://localhost:8095/api/reports/audit
```

## Datos que deben quedar al finalizar

- Jornada cerrada.
- Eventos de asistencia de entrada y salida.
- Registro en `hr_attendance`.
- Asignacion completada o validada.
- Log biometrico.
- Registro de auditoria.
- Reportes con datos agregados.
