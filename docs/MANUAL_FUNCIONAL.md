# Manual Funcional - Attendance SaaS hasta Fase 4

Este manual documenta el uso real observado en el sistema existente hasta Fase 4. No incluye Fase 5, integracion Odoo ni desarrollos futuros.

## Accesos y entorno

- Frontend: http://localhost:5175
- Backend API: http://localhost:8095
- Swagger/OpenAPI: http://localhost:8095/docs
- Healthcheck: http://localhost:8095/health
- Usuario demo: `admin`
- Password demo: `admin123`
- PIN demo de kiosk: `1234`
- Dispositivo demo: `KIOSK-DEMO`
- Empleado demo: `Admin Demo`, ID `1`
- Imagen mock para Face ID: `demo-face-admin`

El proyecto debe ejecutarse dentro de Ubuntu WSL en `~/attendance-saas` y con Docker Compose del propio proyecto.

## Comandos operativos

```bash
cd ~/attendance-saas
cp .env.example .env
docker compose build
docker compose up -d
docker compose ps
docker compose logs -f backend
docker compose logs -f frontend
docker exec -it attendance_saas_backend bash
docker exec -it attendance_saas_backend alembic upgrade head
docker exec -it attendance_saas_backend python -m app.seed
```

No usar comandos globales de limpieza de Docker. Si se detiene algo, hacerlo solo desde `~/attendance-saas` con `docker compose down`, `docker compose restart` o `docker compose up -d`.

## Pantallas principales

### Login

El frontend abre una pantalla de login con valores precargados `admin` y `admin123`. Al iniciar sesion se guarda el token JWT en el cliente y se habilitan las pantallas administrativas.

### Dashboard

Muestra informacion basica de la empresa y estado general del sistema. Es una pantalla informativa.

### Empresa

Permite consultar y actualizar la empresa actual mediante `/api/companies/current`. Los campos principales son nombre, razon social, NIT/VAT, correo, telefono, direccion, zona horaria, plan y estado.

### Catalogos administrativos

El frontend incluye CRUD generico para:

- Sucursales
- Usuarios
- Empleados
- Estados laborales
- Departamentos
- Puestos
- Roles
- Dispositivos
- Tipos de evento de asistencia
- Eventos de asistencia
- No attendance
- Plantillas de asignacion
- Reglas
- Auto checkout

La mayoria de formularios trabajan con IDs numericos. Por ejemplo, para relacionar un empleado con sucursal, puesto o usuario se debe escribir el ID correspondiente.

### Permisos

Muestra el catalogo de permisos sembrados. Es una pantalla de consulta.

### Jornadas, hr_attendance, asignaciones y logs

Estas pantallas son tablas de consulta:

- Jornadas: lista registros de `x_attendance_shift`.
- hr_attendance: lista la tabla compatible con asistencia tipo Odoo.
- Asignaciones empleado: lista asignaciones generadas por reglas.
- Logs biometricos: lista intentos Face ID.
- Auditoria: lista eventos auditados.

## Flujo funcional de asistencia

1. El empleado se identifica en Kiosko PIN con dispositivo `KIOSK-DEMO` y PIN `1234`.
2. El sistema valida el dispositivo activo y busca un usuario activo con ese PIN.
3. Si el usuario tiene empleado vinculado, devuelve el empleado.
4. El kiosko consulta eventos disponibles para ese empleado.
5. Sin jornada abierta, solo debe mostrar eventos que abren jornada, como entrada.
6. Al registrar entrada, se crea una jornada abierta y un evento.
7. El sistema sincroniza la jornada con `hr_attendance`.
8. Si existen reglas de asignacion aplicables, se generan asignaciones para la jornada.
9. Con jornada abierta, el kiosko muestra eventos de salida o regreso segun el ultimo evento.
10. Si hay asignaciones obligatorias pendientes que bloquean salida, la salida final se rechaza.
11. Al completar asignaciones requeridas, se permite registrar salida final.
12. Al registrar salida final, la jornada queda cerrada y `hr_attendance` queda con check-in, check-out y horas trabajadas.

## Asignaciones

Las asignaciones se basan en:

- Plantillas de asignacion.
- Preguntas de plantilla.
- Reglas de tipo `assignment`.
- Jornada abierta del empleado.

Cuando una regla de asignacion aplica al check-in, se crea un registro para el empleado. Si las preguntas requeridas tienen respuestas, la asignacion puede completarse. Si alguna pregunta requiere validacion de supervisor, la asignacion queda en `validation_pending`; si no, queda `completed`.

Estados importantes:

- `pending`
- `in_progress`
- `validation_pending`
- `rejected`
- `completed`
- `validated`
- `cancelled`

Las asignaciones en estados pendientes pueden bloquear el check-out si la regla tiene `blocks_check_out=true`.

## Validacion de supervisor

La validacion por PIN usa el endpoint de asignaciones y requiere un PIN de usuario con permiso supervisor o usuario administrador de empresa. En la data demo, el usuario admin puede validar.

Tambien existe validacion de supervisor por Face ID en API, pero en el frontend actual no hay un flujo completo dedicado para esa operacion.

## Face ID

Face ID esta implementado como proveedor mock:

- Registrar rostro guarda un hash del texto enviado como `image_base64`.
- Identificar rostro compara el texto recibido contra plantillas activas.
- Si hay coincidencia exacta, devuelve confianza aproximada `0.99`.
- Si no hay coincidencia exacta, el mock puede devolver la primera plantilla activa con confianza aproximada `0.82`.

Esto valida el flujo de integracion, logs y endpoints, pero no representa reconocimiento facial real.

## Reportes

La pantalla de reportes consume endpoints de resumen:

- Horas por empleado.
- Asignaciones por estado.
- Excepciones de asistencia por motivo.
- Biometria por metodo y resultado.
- Auditoria por accion.

Los reportes son agregados simples. No hay exportacion, paginacion avanzada ni filtros detallados en la UI actual.

## Auto checkout

Las reglas de auto checkout se configuran por empleado, sucursal o rol. El proceso se ejecuta manualmente desde API o desde la pantalla Face ID con el boton correspondiente.

El comportamiento real observado es: al ejecutar el job, se recorren jornadas abiertas con regla activa aplicable y se cierran. La hora configurada se almacena en la regla, pero el job actual no valida que la hora ya haya llegado antes de cerrar.

## No attendance

Permite registrar excepciones de asistencia con empleado, fecha, motivo, nota, evidencia URL y estado. Se consulta tambien en reportes de excepciones.

## Seguridad y aislamiento

El backend usa JWT para endpoints administrativos. Las rutas de kiosk son publicas por diseno funcional, protegidas por dispositivo, PIN y rate limit en memoria.

El rate limit actual vive en memoria del proceso backend y se reinicia si el contenedor se reinicia.

## Alcance no implementado

- Integracion Odoo/Fase 5.
- Reconocimiento facial real.
- Exportacion formal de reportes.
- Subida real de archivos, fotos o firmas.
- Auditoria completa de todos los CRUD.
- UI avanzada para permisos granulares por accion.
- Workflow completo de validacion por supervisor Face ID en frontend.
