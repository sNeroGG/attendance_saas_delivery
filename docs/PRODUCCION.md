# Puesta en producción

Compose ahora monta una versión compilada del frontend detrás de Nginx. Solo publica el puerto del frontend en `127.0.0.1`; MySQL, Redis y la API quedan dentro de la red Docker. Coloca delante un proxy inverso con HTTPS y apunta su upstream a `127.0.0.1:5175` (o el valor de `FRONTEND_PORT`). No expongas el puerto del servicio directamente a Internet.

## Configuración requerida

1. Copia `.env.example` a `.env` en el servidor y establece:
   - `MYSQL_PASSWORD`, `MYSQL_ROOT_PASSWORD`, `REDIS_PASSWORD`: valores aleatorios distintos. Usa caracteres URL-safe para contraseñas de servicios porque Compose construye sus URL.
   - `SECRET_KEY`: valor aleatorio único de 32 caracteres o más. No reutilices el ejemplo.
   - `ENVIRONMENT=production`.
   - `ENABLE_BIOMETRICS=true` para exigir PIN seguido de Face ID en el kiosko. La misma opción habilita las rutas de enrolamiento y verificación y compila el frontend con Face ID.
   - `CORS_ORIGINS`: origen HTTPS exacto del sitio, sin rutas.
   - `ACCESS_TOKEN_EXPIRE_MINUTES`: máximo 120; se recomienda 60.
2. Mantén `.env` fuera de Git, imágenes, respaldos sin cifrar y registros. Restringe sus permisos en el servidor.
3. Configura TLS, redirección HTTP a HTTPS, renovación automática de certificados y límites de solicitudes en el proxy inverso. El proxy público debe sobrescribir `X-Forwarded-For` con la IP real de la conexión y `X-Forwarded-Proto` con `https`; no aceptes esos valores del cliente tal cual. Añade HSTS en ese proxy.

La aplicación rechaza arrancar en producción si faltan Redis, una clave JWT válida o un origen CORS no local. Las contraseñas de base de datos/Redis deben ser URL-safe o percent-encoded cuando se usen en URL.

## Primer despliegue

1. Revisa y prueba una copia de seguridad antes de migrar datos existentes.
2. Construye el backend y arranca únicamente las dependencias: `docker compose build backend` y `docker compose up -d mysql redis`.
3. Aplica migraciones antes de servir tráfico: `docker compose run --rm --no-deps backend alembic upgrade head`.
4. Construye y arranca la aplicación: `docker compose up -d --build`. `/health` espera MySQL, Redis y que la base esté en la revisión Alembic actual.
5. **No ejecutes `app.seed` en producción**; solo contiene datos de demostración y se bloquea por configuración.
6. Provisiona el primer administrador con variables temporales cargadas desde el gestor de secretos en el entorno del operador (no las escribas como valores literales en el comando), y ejecuta `docker compose exec -e BOOTSTRAP_ADMIN_LOGIN -e BOOTSTRAP_ADMIN_NAME -e BOOTSTRAP_ADMIN_PASSWORD -e BOOTSTRAP_COMPANY_ID -e BOOTSTRAP_COMPANY_NAME -e BOOTSTRAP_ADMIN_EMAIL -e BOOTSTRAP_COMPANY_LEGAL_NAME -e BOOTSTRAP_COMPANY_COUNTRY backend python -m app.provision_admin`. Requiere `BOOTSTRAP_ADMIN_LOGIN`, `BOOTSTRAP_ADMIN_NAME`, `BOOTSTRAP_ADMIN_PASSWORD` (14+ caracteres), y `BOOTSTRAP_COMPANY_ID` de una empresa existente o `BOOTSTRAP_COMPANY_NAME` para crearla. Los demás valores son opcionales. El comando se niega a crear un segundo superadmin activo. Revoca las variables temporales inmediatamente después.
7. Verifica `https://tu-dominio/health`, login y marcación por PIN.

Con Face ID habilitado, el kiosko solicita primero el PIN. En el primer acceso solicita enrolar el rostro con tres capturas; en accesos posteriores verifica el rostro asociado al PIN. El panel de marcación se muestra únicamente después de completar el enrolamiento o una verificación correcta. El backend conserva vectores faciales y registros de auditoría, no las capturas originales. La migración `0013` elimina PIN guardados en texto plano y `0014` elimina plantillas faciales preexistentes; por tanto, tras actualizar, cada empleado deberá enrolarse de nuevo desde el kiosko. Antes de producción, define y comunica el consentimiento, la finalidad, el plazo de retención, el proceso de eliminación, quién puede administrar plantillas y la política de respaldos cifrados según la legislación aplicable.

## Operación y recuperación

- En el primer ingreso del administrador, la introducción inicial permite registrar sucursal, kiosko y empleados. Los códigos PIN se muestran una sola vez; entrégalos directamente a sus titulares y acuerda un proceso de cambio o renovación si se pierden.

- Programa respaldos cifrados de MySQL, guarda una copia fuera del servidor y ensaya la restauración en un entorno separado. Conserva también una política de recuperación para los datos persistentes de Redis.
- Despliega primero en staging con copia representativa, revisa migraciones y regresiones funcionales, y conserva una imagen anterior para rollback.
- Supervisa `/health`, disponibilidad de MySQL/Redis, errores 5xx, fallos de login, espacio en disco, copias y resultados del cierre automático. Envía logs a un destino central con acceso restringido y retención definida.
- El limitador de intentos usa Redis compartido y bloquea temporalmente intentos por IP y dispositivo. El cierre automático usa un lock asesor de MySQL para evitar ejecución duplicada entre workers.
- Para inspeccionar servicios: `docker compose ps` y `docker compose logs --tail=200 backend frontend mysql redis`. No uses comandos `down --volumes` durante mantenimiento.

## Pendientes para una operación SaaS completa

- Completar autorización por permisos para cada endpoint y cada rol. Las rutas administrativas principales de usuarios, empleados, roles, empresa, plantillas biométricas y cierre manual ya requieren admin; todavía hay rutas administrativas en otros módulos que deben pasar una revisión endpoint por endpoint antes de admitir usuarios no confiables.
- Definir rotación/revocación de JWT, flujo de recuperación y cambio de contraseña, SSO/MFA para administración y alertas de seguridad.
- Rotar en el alta inicial las contraseñas y PIN existentes; usar contraseñas de 14+ caracteres y PIN numéricos de 6+ dígitos para nuevos perfiles.
- Fijar y versionar dependencias del frontend con `package-lock.json`. No se generó durante esta revisión porque el entorno no tiene acceso al registro npm.
- Acordar disponibilidad, RPO/RTO, almacenamiento externo de evidencias si se habilita, retención/auditoría completa y soporte de zona horaria.
