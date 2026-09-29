# Guia Tester QA - Validacion End-to-End

Esta guia permite a un tester validar el sistema existente hasta Fase 4 sin modificar arquitectura ni ejecutar limpiezas globales.

## Reglas de seguridad

Ejecutar todo desde Ubuntu WSL:

```bash
cd ~/attendance-saas
```

Permitido:

```bash
docker compose ps
docker compose up -d
docker compose restart
docker compose logs -f backend
docker compose logs -f frontend
docker exec -it attendance_saas_backend alembic upgrade head
docker exec -it attendance_saas_backend python -m app.seed
```

No permitido:

```bash
docker system prune
docker volume prune
docker network prune
docker rm -f $(docker ps -aq)
docker stop $(docker ps -aq)
docker compose down --volumes
```

## Checklist previo

1. Confirmar contenedores:

```bash
cd ~/attendance-saas
docker compose ps
```

Esperado:

- `attendance_saas_backend` en puerto `8095:8000`
- `attendance_saas_frontend` en puerto `5175:5173`
- `attendance_saas_mysql` en puerto `33075:3306`

2. Confirmar backend:

```bash
curl http://localhost:8095/health
```

Esperado:

```json
{"status":"ok","service":"attendance_saas_backend"}
```

3. Confirmar migracion:

```bash
docker exec -it attendance_saas_backend alembic current
```

Esperado: revision head de Fase 4.

## Datos demo

- Frontend: http://localhost:5175
- API docs: http://localhost:8095/docs
- Login: `admin`
- Password: `[contraseña definida en .env]`
- PIN: `7931`
- Panel: http://localhost:5175/ctrl-ops-7931
- Device code: `KIOSK-DEMO`
- Empleado demo: `Admin Demo`, ID `1`
- Imagen mock Face ID: `demo-face-admin`

## Prueba 1 - Login administrativo

1. Abrir http://localhost:5175/ctrl-ops-7931.
2. Ingresar `admin` y `[contraseña definida en .env]`.
3. Presionar Entrar.
4. Confirmar que se muestra Dashboard.

Resultado esperado: acceso exitoso y navegacion lateral visible.

## Prueba 2 - Catalogos base

Validar que cargan estas pantallas:

- Empresa
- Sucursales
- Usuarios
- Empleados
- Estados laborales
- Departamentos
- Puestos
- Roles
- Permisos
- Dispositivos

Resultado esperado: cada pantalla lista registros o muestra formulario sin error rojo.

## Prueba 3 - Tipos de evento

1. Abrir Tipos de evento.
2. Confirmar eventos activos de entrada, salida, break y comida.
3. Verificar columnas `code`, `direction`, `opens_shift`, `closes_shift`, `allows_pin`.

Resultado esperado: existen eventos suficientes para abrir y cerrar jornada.

## Prueba 4 - Kiosko PIN

1. Abrir Kiosko PIN.
2. Usar dispositivo `KIOSK-DEMO`.
3. Usar PIN `1234`.
4. Presionar identificar.
5. Confirmar empleado `Admin Demo`.
6. Presionar evento disponible para entrada si no hay jornada abierta.

Resultado esperado: se registra evento y la lista de eventos cambia segun el estado de la jornada.

## Prueba 5 - Asignaciones

1. Despues de una entrada, abrir o refrescar asignaciones del Kiosko.
2. Si hay asignacion pendiente, completarla desde la UI rapida del Kiosko.
3. Revisar pantalla Asignaciones empleado.

Resultado esperado: la asignacion cambia a estado completado o validacion pendiente segun la configuracion de preguntas.

## Prueba 6 - Bloqueo de check-out

1. Generar una entrada que cree asignacion obligatoria.
2. Intentar salida final antes de completar la asignacion.

Resultado esperado: el backend rechaza la salida con mensaje equivalente a asignaciones obligatorias pendientes.

## Prueba 7 - Salida final y hr_attendance

1. Completar o validar asignaciones pendientes.
2. Registrar salida final desde Kiosko PIN.
3. Abrir Jornadas.
4. Abrir hr_attendance.

Resultado esperado:

- La jornada queda `closed`.
- `check_out_at` tiene valor.
- `hr_attendance.check_out` tiene valor.
- `worked_hours` se calcula.

## Prueba 8 - Face ID mock

1. Abrir Face ID.
2. Usar empleado `1`.
3. Registrar rostro con `demo-face-admin`.
4. Identificar rostro con `demo-face-admin`.
5. Revisar Logs biometricos.
6. Revisar Auditoria.

Resultado esperado:

- Registro de plantilla creado.
- Identificacion exitosa con confianza alta.
- Log biometrico creado.
- Auditoria contiene accion de registro de rostro.

## Prueba 9 - Reportes

Abrir Reportes y cargar:

- Horas
- Asignaciones
- Excepciones
- Biometria
- Auditoria

Resultado esperado: cada reporte devuelve una tabla de resumen. Puede estar vacia si no hay data de ese tipo.

## Prueba 10 - Auto checkout

1. Crear o confirmar una regla activa de auto checkout.
2. Dejar una jornada abierta.
3. Ejecutar proceso de auto checkout desde UI o API.
4. Revisar Jornadas y Auditoria.

Resultado esperado: la jornada abierta se cierra si tiene regla aplicable y no esta bloqueada por asignaciones pendientes.

Nota: el job actual cierra al ejecutarse; no valida que la hora configurada ya haya llegado.

## Evidencia sugerida

Para cada prueba capturar:

- URL usada.
- Usuario usado.
- Hora aproximada.
- Captura de pantalla o respuesta JSON.
- Resultado esperado.
- Resultado obtenido.
- Defecto si aplica.

## Criterio de aprobacion E2E

El ciclo se considera aprobado si:

- Login funciona.
- Kiosko identifica por PIN.
- Se puede abrir jornada.
- Se generan o listan asignaciones.
- El check-out se bloquea cuando hay asignacion obligatoria pendiente.
- Se puede completar la asignacion.
- Se puede cerrar jornada.
- hr_attendance refleja la jornada.
- Face ID mock registra e identifica.
- Reportes cargan.
- Logs biometricos y auditoria registran eventos de Fase 4.
