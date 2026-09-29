# Attendance SaaS

> La guía de despliegue, secretos, proxy HTTPS, migraciones y recuperación está en [docs/PRODUCCION.md](docs/PRODUCCION.md).

Sistema SaaS de asistencia con core multiempresa, marcación por PIN y Face ID, asignaciones operativas, auditoría, reportes y cierre automático. Usa FastAPI, React + Vite + TypeScript, MySQL, SQLAlchemy, Alembic y JWT.

## Aislamiento obligatorio

Todo vive dentro de:

```bash
~/attendance-saas
```

Recursos Docker declarados para este proyecto:

- Contenedores: `attendance_saas_backend`, `attendance_saas_frontend`, `attendance_saas_mysql`, `attendance_saas_redis`
- Red: `attendance_saas_network`
- Volumen MySQL: `attendance_saas_mysql_data`
- Puerto local publicado: frontend `127.0.0.1:5175` (API y base de datos permanecen internos)

No uses comandos globales como `docker system prune`, `docker volume prune`, `docker network prune`, `docker rm -f $(docker ps -aq)`, `docker stop $(docker ps -aq)` ni `docker compose down --volumes`.

## Arranque local de desarrollo

Para producción sigue primero [la guía de despliegue](docs/PRODUCCION.md). `.env.example` es una plantilla, no contiene secretos válidos.

```bash
cd ~/attendance-saas
cp .env.example .env
# Edita .env: usa contraseñas de desarrollo, ENVIRONMENT=development y CORS_ORIGINS=http://localhost:5175
docker compose build
docker compose up -d mysql redis
docker compose run --rm --no-deps backend alembic upgrade head
docker compose up -d --build
docker compose logs -f backend
docker compose logs -f frontend
docker compose ps
```

En desarrollo, configura `BOOTSTRAP_ADMIN_LOGIN`, `BOOTSTRAP_ADMIN_NAME` y `BOOTSTRAP_ADMIN_PASSWORD` en `.env`. El seed inicializa un solo administrador y la estructura básica de la empresa. En producción, usa el proceso de aprovisionamiento seguro de [docs/PRODUCCION.md](docs/PRODUCCION.md).

## Migraciones y seeds

```bash
docker compose exec backend python -m app.seed_if_empty
```

El kiosko no incluye empleados precargados. Crea las cuentas de empleados desde el panel administrativo.

En una empresa sin empleados, el panel muestra **Iniciar introducción**. El asistente registra la sucursal, el kiosko y uno o varios empleados. Al finalizar presenta una sola vez el usuario y el PIN de cuatro dígitos de cada empleado; el PIN no se puede volver a consultar, así que guárdalo antes de continuar al panel.

## Entrar al backend

```bash
docker exec -it attendance_saas_backend bash
```

## URLs locales

- Frontend: http://localhost:5175
- Health: http://localhost:5175/health
- Backend docs en desarrollo: http://localhost:5175/docs
- Kiosko: registra el dispositivo y los empleados desde el panel administrativo antes de iniciar marcaciones.
- Panel admin: `http://localhost:5175/ctrl-ops-7931` (también `/admindash` o `?view=ops`)
- MySQL interno Compose: `mysql:3306` (sin puerto de host publicado)

## Comandos seguros de operacion

Estos comandos solo deben ejecutarse desde la carpeta del proyecto:

```bash
cd ~/attendance-saas
docker compose up -d
docker compose down
docker compose restart
```

Antes de cualquier limpieza, valida que solo afecte recursos con prefijo `attendance_saas`:

```bash
docker ps --filter "name=attendance_saas" --format "table {{.Names}}\t{{.Status}}"
docker volume ls --filter "name=attendance_saas" --format "table {{.Name}}"
docker network ls --filter "name=attendance_saas" --format "table {{.Name}}"
```

No borres volumenes si quieres conservar los datos. MySQL persiste en `attendance_saas_mysql_data` y Redis en `attendance_saas_redis_data`.

## Estructura

```text
~/attendance-saas
??? backend
?   ??? app
?   ??? alembic
?   ??? Dockerfile
?   ??? requirements.txt
??? frontend
?   ??? src
?   ??? Dockerfile
?   ??? package.json
??? mysql
?   ??? init
??? docker-compose.yml
??? .env.example
??? .env
```

## Alcance implementado

Incluido Fase 1:

- Login JWT
- Multiempresa basico con `company_id`
- `res_company`, `res_users`, `hr_employee`, `hr_department`, `hr_job`
- Tablas custom `x_branch`, `x_employee_status`, `x_employee_status_history`, `x_role`, `x_permission`, `x_role_permission`, `x_employee_role`
- CRUD administrativo inicial
- Migracion Alembic inicial
- Seeds de estados laborales, permisos y rol admin

Incluido Fase 2:

- `x_device`
- `x_attendance_event_type`
- `x_attendance_shift`
- `x_attendance_event`
- `hr_attendance` compatible como resumen
- `x_no_attendance_note`
- Kiosko PIN con `/api/kiosk/*`
- Calculo de horas, break y comida
- Sincronizacion de jornada a `hr_attendance`
- Pantallas de dispositivos, tipos de evento, eventos, jornadas, hr_attendance, no attendance y kiosko

Incluido Fase 3:

- `x_assignment_template`
- `x_assignment_question`
- `x_employee_assignment`
- `x_assignment_answer`
- `x_assignment_validation`
- `x_rule`
- RuleEngineService
- AssignmentService
- SupervisorValidationService
- Generacion de asignaciones despues del check-in
- Bloqueo de check-out si hay asignaciones obligatorias pendientes
- Validacion supervisor por PIN
- Pantallas de plantillas, preguntas, reglas y asignaciones por empleado
- Kiosko con asignaciones pendientes y respuesta rapida

Incluido Fase 4:

- `x_face_template` con provider `mock`
- `x_biometric_log`
- `x_audit_log`
- `x_auto_checkout_rule`
- FaceRecognitionService mock
- BiometricLogService
- AuditLogService
- ReportService
- AutoCheckoutService
- Rate limit basico en PIN y Face ID
- Endpoints Face ID, logs, reportes y job de auto-checkout
- Pantallas Face ID, logs, reportes y reglas de auto-checkout

No incluido todavia:

- Reportes
- API Odoo
