# Attendance SaaS

Proyecto SaaS aislado para attendance. Fase 1 a Fase 4: core multiempresa, attendance por PIN, asignaciones operativas, Face ID mock, auditoria, reportes y auto-checkout con FastAPI, React + Vite + TypeScript, MySQL, SQLAlchemy, Alembic y JWT.

## Aislamiento obligatorio

Todo vive dentro de:

```bash
~/attendance-saas
```

Recursos Docker declarados para este proyecto:

- Contenedores: `attendance_saas_backend`, `attendance_saas_frontend`, `attendance_saas_mysql`
- Red: `attendance_saas_network`
- Volumen MySQL: `attendance_saas_mysql_data`
- Puertos: frontend `5175`, backend `8095`, MySQL `33075`

No uses comandos globales como `docker system prune`, `docker volume prune`, `docker network prune`, `docker rm -f $(docker ps -aq)`, `docker stop $(docker ps -aq)` ni `docker compose down --volumes`.

## Primera ejecucion en Ubuntu WSL

```bash
cd ~/attendance-saas
cp .env.example .env
docker compose build
docker compose up -d
docker compose logs -f backend
docker compose logs -f frontend
docker compose ps
```

## Migraciones y seeds

```bash
docker exec -it attendance_saas_backend alembic upgrade head
docker exec -it attendance_saas_backend python -m app.seed
```

Usuario inicial despues del seed:

```text
login: admin
password: admin123
pin: 1234
```

## Entrar al backend

```bash
docker exec -it attendance_saas_backend bash
```

## URLs locales

- Frontend: http://localhost:5175
- Backend health: http://localhost:8095/health
- Backend docs: http://localhost:8095/docs
- Kiosko demo: usar pantalla `Kiosko PIN`, dispositivo `KIOSK-DEMO`, PIN `1234`
- MySQL host local: `127.0.0.1:33075`
- MySQL interno Compose: `mysql:3306`

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

No borres volumenes si quieres conservar la base de datos. La base persiste solamente en `attendance_saas_mysql_data`.

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
