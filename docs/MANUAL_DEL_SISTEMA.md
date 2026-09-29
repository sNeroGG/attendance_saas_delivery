# 📘 Manual Integral del Sistema - Attendance SaaS

**Control de Asistencia Multiempresa, Biometría Facial (Face ID), Checklists Operativos y Gestión Administrativa**

---

## 📑 Tabla de Contenidos
1. [Visión General y Arquitectura](#1-visión-general-y-arquitectura)
2. [Guía de Comandos y Puesta en Marcha](#2-guía-de-comandos-y-puesta-en-marcha)
3. [Conexión en Red Local (LAN / Wi-Fi) y Acceso Remoto](#3-conexión-en-red-local-lan--wi-fi-y-acceso-remoto)
4. [Manual del Kiosko de Marcación (Portal del Colaborador)](#4-manual-del-kiosko-de-marcación-portal-del-colaborador)
5. [Manual del Panel Administrativo](#5-manual-del-panel-administrativo)
6. [Protocolo de Pruebas (QA / E2E) y Validaciones](#6-protocolo-de-pruebas-qa--e2e-y-validaciones)
7. [Mantenimiento, Diagnóstico y Solución de Problemas](#7-mantenimiento-diagnóstico-y-solución-de-problemas)

---

## 1. Visión General y Arquitectura

**Attendance SaaS** es una plataforma integral diseñada para registrar y auditar la jornada laboral de colaboradores a través de terminales físicas (Kioskos en tablets, computadoras o celulares) y una consola web centralizada de administración.

### Stack Tecnológico:
* **Frontend:** React 18 + TypeScript + Vite + Lucide Icons + CSS nativo optimizado para móviles y escritorio.
* **Backend:** FastAPI (Python 3.12), SQLAlchemy 2.0 ORM, Pydantic v2 y autenticación segura JWT.
* **Motor Biométrico (Face ID Real):** OpenCV (`FaceDetectorYN` y `FaceRecognizerSF`) ejecutando redes neuronales ONNX ligeras para inferencia facial local y comparación por distancia de coseno.
* **Base de Datos:** MySQL 8.0 gestionada mediante migraciones automáticas con **Alembic**.
* **Contenedores:** Docker Compose aislado en la red interna `attendance_saas_network`.

### Aislamiento de Recursos y Puertos:
| Recurso | Nombre en Docker | Puerto en la Máquina Host |
| :--- | :--- | :--- |
| **Frontend Web** | `attendance_saas_frontend` | `5175` |
| **Backend API** | `attendance_saas_backend` | `8095` |
| **Base de Datos** | `attendance_saas_mysql` | `33075` (interno `3306`) |
| **Volumen de Datos** | `attendance_saas_mysql_data` | Persistente (no se borra al reiniciar) |

---

## 2. Guía de Comandos y Puesta en Marcha

### 🖱️ Ejecución en 1 Clic (Recomendado para Windows)

Puedes hacer **doble clic** directamente sobre los siguientes archivos ejecutables creados en la raíz del proyecto:

* 🟢 **`iniciar_sistema.bat`**: Comprueba Docker, prepara el entorno, levanta los 3 contenedores, aplica migraciones de base de datos, crea el usuario demo y abre automáticamente el Kiosko en tu navegador.
* 🔴 **`detener_sistema.bat`**: Detiene todos los contenedores de forma segura conservando toda la base de datos intacta.

---

### ⚡ Resumen Rápido de Comandos Manuales
Si prefieres ejecutar los comandos manualmente en **PowerShell** o **CMD**:

```powershell
# Iniciar todo el sistema en segundo plano
docker compose up -d

# Ver estado de los contenedores
docker compose ps

# Ver logs en vivo del backend o frontend
docker compose logs -f backend
docker compose logs -f frontend

# Reiniciar todos los servicios
docker compose restart

# Detener el sistema de forma segura (conserva la base de datos)
docker compose down

# Aplicar migraciones pendientes a la base de datos
docker exec attendance_saas_backend alembic upgrade head

# Cargar datos semilla del sistema (Empresa, Admin y Estados)
docker exec attendance_saas_backend python -m app.seed

# Crear empleado y usuario de prueba para el Kiosko (Juan Pérez / PIN: 4321)
docker exec attendance_saas_backend python -m app.create_test_employee

# Ejecutar suite de pruebas automáticas (20 tests)
docker exec attendance_saas_backend pytest
```

---

### 🚀 Puesta en Marcha Inicial (Instalación desde Cero)

Si vas a levantar el sistema por primera vez en una computadora:

1. **Abre Docker Desktop** y verifica que esté en ejecución (ícono verde).
2. **Posiciónate en la carpeta raíz del proyecto:**
   ```powershell
   cd "n:\Archivos\Proyectos DEV\attendance_saas_delivery"
   ```
3. **Verifica el archivo de configuración `.env`:**
   Si no existe, créalo a partir del ejemplo:
   ```powershell
   if (!(Test-Path .env)) { Copy-Item .env.example .env }
   ```
4. **Construye y arranca los contenedores:**
   ```powershell
   docker compose build
   docker compose up -d
   ```
5. **Ejecuta las migraciones de base de datos:**  
   *(Paso crítico para evitar errores 500 o 'Failed to fetch' al cargar)*
   ```powershell
   docker exec attendance_saas_backend alembic upgrade head
   ```
6. **Carga los datos iniciales y el empleado de prueba:**
   ```powershell
   docker exec attendance_saas_backend python -m app.seed
   docker exec attendance_saas_backend python -m app.create_test_employee
   ```

---

### 🔑 URLs y Credenciales de Acceso

| Módulo | URL en la PC Local | Credenciales por Defecto |
| :--- | :--- | :--- |
| **Kiosko de Marcación** | [http://localhost:5175](http://localhost:5175) | Dispositivo: `KIOSK-01` o `KIOSK-DEMO`<br>• **Empleado Demo (Juan Pérez):** login `juan_perez`, PIN `5824`<br>• **PIN Supervisor / Anulación:** `7931` |
| **Panel Administrativo (Superadmin)** | [http://localhost:5175/ctrl-ops-7931](http://localhost:5175/ctrl-ops-7931) | **Usuario:** `admin`<br>**Contraseña:** `[contraseña definida en .env]` |
| **Panel Administrativo (Supervisor)** | [http://localhost:5175/ctrl-ops-7931](http://localhost:5175/ctrl-ops-7931) | **Usuario:** `supervisor`<br>**Contraseña:** `[cuenta retirada]` |
| **API Docs (Swagger)** | [http://localhost:8095/docs](http://localhost:8095/docs) | N/A (Explorador interactivo de endpoints) |
| **Healthcheck Backend** | [http://localhost:8095/health](http://localhost:8095/health) | Retorna `{"status":"ok"}` |

---

## 3. Conexión en Red Local (LAN / Wi-Fi) y Acceso Remoto

Si el sistema está montado en una computadora principal y otras computadoras, tablets o celulares de la sucursal se conectarán mediante la red local:

### 1. Obtener la IP local de la computadora servidora
Ejecuta en PowerShell:
```powershell
ipconfig
```
Anota la **Dirección IPv4** (ejemplo: `192.168.1.50`).

### 2. Abrir los puertos en el Firewall de Windows
Abre PowerShell como **Administrador** y ejecuta:
```powershell
New-NetFirewallRule -DisplayName "Attendance SaaS Frontend" -Direction Inbound -LocalPort 5175 -Protocol TCP -Action Allow
New-NetFirewallRule -DisplayName "Attendance SaaS Backend" -Direction Inbound -LocalPort 8095 -Protocol TCP -Action Allow
```

### 3. Conexión desde los dispositivos clientes:
* **Kiosko en Tablet/Celular:** `http://192.168.1.50:5175`
* **Panel de Administración:** `http://192.168.1.50:5175/ctrl-ops-7931`

> [!IMPORTANT]
> **Habilitar Cámara Web (Face ID) en Red Local:**  
> Por motivos de seguridad, los navegadores (Google Chrome y Microsoft Edge) restringen el uso de la cámara web (`getUserMedia`) si la dirección no es `localhost` o `HTTPS`.  
> Para permitir la cámara en una tablet o computadora cliente conectada por `http://192.168.1.50:5175`:
> 1. En el navegador del dispositivo cliente, abre la URL: `chrome://flags/#unsafely-treat-insecure-origin-as-secure`
> 2. Pega la URL de tu servidor: `http://192.168.1.50:5175`
> 3. Cambia la opción a **Enabled** y presiona **Relaunch** (Reiniciar navegador).

---

## 4. Manual del Kiosko de Marcación (Portal del Colaborador)

El Kiosko carga directamente en la ruta raíz (`/`) y está optimizado con diseño táctil *mobile-first*.

```
┌─────────────────────────────────────────────────────────────┐
│                    KIOSKO DE ASISTENCIA                     │
│               [ 12:45:30 PM - San Salvador ]                │
│                                                             │
│   [ 📷 Face ID (Cámara en Vivo) ]   [ 🔢 PIN Numérico ]     │
│   ┌───────────────────────────┐                             │
│   │    [ HUD Telemetría ]     │                             │
│   │    Iluminación: Óptima    │                             │
│   │    Distancia: Correcta    │                             │
│   │    Alineación: Centrada   │                             │
│   └───────────────────────────┘                             │
│   ┌─────────────────────────────────────────────────────┐   │
│   │  [ Entrada ]  [ Salida Break ]  [ Salida Final ]    │   │
│   └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

### Flujo de Uso del Kiosko:

#### A. Identificación del Empleado
1. **Por Reconocimiento Facial (Face ID):**
   * El empleado se posiciona frente a la cámara. El visor muestra indicadores en tiempo real de **Iluminación**, **Distancia** y **Alineación**.
   * Al reconocer el rostro, el sistema carga de inmediato el perfil del colaborador.
2. **Por PIN Numérico:**
   * El empleado selecciona la pestaña **PIN**, digita sus 4 dígitos (ejemplo: `5824`) y presiona **Identificar**.
3. **Asistente de Registro Facial (Si es nuevo o se le borró la foto):**
   * Si el empleado aún no tiene biometría, el Kiosko le pedirá su PIN y activará el asistente guiado de 3 pasos:
     1. Rostro de Frente 😐
     2. Perfil Izquierdo 👈
     3. Perfil Derecho 👉
   * Las 3 muestras se guardan como vectores biométricos independientes para maximizar la velocidad y precisión en futuras marcas.

#### B. Registro de Eventos de la Jornada
Los botones se adaptan dinámicamente según el estado actual del empleado:
* **Entra a jornada:** Abre el turno del día (solo visible si no tiene jornada abierta).
* **Sale a break / Comida:** Pausa el cómputo de horas trabajadas.
* **Entra de break / Comida:** Reanuda el cómputo de horas trabajadas.
* **Salida final:** Cierra definitivamente la jornada laboral del día.

#### C. Checklists y Tareas Operativas Obligatorias
* Al marcar la entrada, el sistema genera automáticamente las tareas asignadas para ese turno (ejemplo: "Verificación de apertura", "Limpieza de estación").
* **Bloqueo de Check-out:** Si el empleado intenta marcar **Salida final** teniendo tareas obligatorias pendientes, el sistema bloqueará la salida y le solicitará completarlas en pantalla antes de cerrar su turno.

#### D. Funciones de Supervisión y Seguridad en el Kiosko
* **PIN de Supervisor / Anulación Gerencial:** Permite a un gerente autorizar entradas/salidas fuera de horario o en días libres (PIN: `7931` o `6842`).
* **Bloqueo de Dispositivo (Device Lock):** Permite configurar una tablet para que quede enlazada exclusivamente a un solo empleado o dejarla abierta para uso compartido de toda la sucursal.
* **Temporizador de Inactividad:** Tras 30 segundos sin interacción, la sesión del empleado se cierra automáticamente para dejar el kiosko listo para el siguiente usuario.

---

## 5. Manual del Panel Administrativo

Disponible accediendo a la URL [http://localhost:5175/ctrl-ops-7931](http://localhost:5175/ctrl-ops-7931) (también `/admindash` o `?view=ops`) con credenciales:
* **Superadmin:** `admin` / `[contraseña definida en .env]`
* **Supervisor:** `supervisor` / `[cuenta retirada]`

| Módulo / Pestaña | Funcionalidad Principal |
| :--- | :--- |
| **Dashboard** | Métricas en tiempo real de asistencias activas, personal trabajando y resúmenes de la jornada. |
| **Empresa** | Configuración general de la compañía (Razón Social, NIT, país, zona horaria y opciones de bloqueo). |
| **Sucursales** | Creación y administración de ubicaciones físicas y asignación de zonas. |
| **Empleados** | **Alta Unificada:** Creación conjunta de la ficha de empleado, usuario del sistema y PIN de kiosko en un solo formulario.<br>**Gestión Face ID:** Visualización de foto de perfil y botón de borrado de foto para forzar re-registro biométrico. |
| **Estados Laborales** | Configuración de estados (*De alta*, *Suspendido*, *Incapacitado*, *Despedido*) y control de permisos de marcación (`allows_check_in`). |
| **Horarios y Turnos** | Definición de horarios laborales semanales, ventanas de tolerancia (llegadas tardías, salidas anticipadas) y soporte para turnos nocturnos. |
| **Dispositivos** | Gestión de tablets y terminales autorizadas (`device_code`), tiempo de expiración de sesión y activación de candado de dispositivo. |
| **Jornadas y Eventos** | Historial de todas las marcas con cálculo auditado de minutos trabajados, minutos de comida y descansos. |
| **hr_attendance** | Tabla limpia y sincronizada en formato compatible con ERPs externos (como Odoo) para liquidación de nóminas. |
| **Preguntas y Asignaciones** | Creación de cuestionarios operativos, preguntas con respuestas de texto, número, sí/no o validación de supervisor. |
| **Reglas Operativas** | Motor de reglas para disparar checklists automáticos al momento de hacer check-in según el puesto o sucursal. |
| **PINs Temporales** | Generación de códigos PIN de un solo uso o expiración temporal para supervisores en ruta o reemplazos. |
| **Auto Checkout** | Regla programada para cerrar automáticamente a una hora determinada (ej. 03:00 AM) jornadas que hayan quedado abiertas por olvido. |
| **Logs Biométricos** | Historial inmutable de todas las identificaciones faciales con su porcentaje de coincidencia y nivel de confianza. |
| **Auditoría y Reportes** | Bitácora de cambios en el sistema y reportes agrupados por horas trabajadas, excepciones y cumplimiento de tareas. |

---

## 6. Protocolo de Pruebas (QA / E2E) y Validaciones

Para certificar el correcto funcionamiento del sistema, se recomienda ejecutar el siguiente ciclo de prueba de extremo a extremo:

### Ciclo Funcional Completo:
1. **Verificar Servicios:** Comprobar que `http://localhost:8095/health` responda `{"status":"ok"}`.
2. **Identificación en Kiosko:** Abrir `http://localhost:5175`, seleccionar PIN, ingresar dispositivo `KIOSK-01` y PIN `5824`. Debe identificar al empleado **Juan Pérez**.
3. **Registro de Entrada:** Presionar **Entra a jornada**. Se abre la jornada y se generan las tareas del día.
4. **Comprobación de Bloqueo de Salida:** Intentar presionar **Salida final**. El sistema debe emitir un mensaje de bloqueo indicando que hay tareas pendientes.
5. **Completar Tarea:** Responder el checklist en la pantalla del Kiosko y guardarlo.
6. **Registro de Salida:** Volver a presionar **Salida final**. La jornada debe cerrarse correctamente.
7. **Auditoría en Admin:** Ingresar a `http://localhost:5175/ctrl-ops-7931`, ir a **Calendario** y reportes para verificar que las horas netas y marcas queden registradas.

### Validaciones Negativas Controladas:
* **PIN Inválido:** El sistema responde `401 Unauthorized` ("PIN inválido").
* **Empleado Suspendido o Inactivo:** El sistema bloquea la entrada con `422 Unprocessable Entity` ("Estado laboral no permite check-in").
* **Doble Entrada:** Si ya existe jornada abierta, el sistema impide crear una segunda entrada paralela.
* **Dispositivo no Registrado:** Si se ingresa un código de kiosko inexistente, se responde `404 Not Found`.

---

## 7. Mantenimiento, Diagnóstico y Solución de Problemas

### Error: `Failed to fetch` o fallo de conexión en el Kiosko
* **Causa 1:** El contenedor del backend no está corriendo o aún está iniciando.  
  *Solución:* Ejecuta `docker compose ps` y valida que `attendance_saas_backend` esté en estado `Up`.
* **Causa 2:** Migraciones de base de datos desactualizadas (faltan columnas en MySQL).  
  *Solución:* Ejecuta en terminal:
  ```powershell
  docker exec attendance_saas_backend alembic upgrade head
  ```
* **Causa 3 (en red local):** El Firewall de Windows está bloqueando el puerto `8095`.  
  *Solución:* Aplica las reglas del Firewall indicadas en la [Sección 3](#3-conexión-en-red-local-lan--wi-fi-y-acceso-remoto).

### Error: Puerto ya en uso (`Port already allocated`)
Si el puerto `5175` (frontend), `8095` (backend) o `33075` (MySQL) está ocupado por otro programa en Windows:
1. Abre el archivo `.env`.
2. Modifica los puertos asignados (por ejemplo: `FRONTEND_PORT=5176`, `BACKEND_PORT=8096`).
3. Aplica los cambios reiniciando Docker: `docker compose up -d`.

### Respaldo de Seguridad de la Base de Datos (Backup Manual)
Para generar una copia de seguridad en un archivo SQL:
```powershell
docker exec attendance_saas_mysql mysqldump -u root -psafe_root_pass_2026 attendance_saas > "backup_$(Get-Date -Format 'yyyyMMdd_HHmm').sql"
```

### Restaurar un Respaldo de Base de Datos
```powershell
Get-Content "ruta_de_tu_backup.sql" | docker exec -i attendance_saas_mysql mysql -u root -psafe_root_pass_2026 attendance_saas
```

### Ejecutar Pruebas Automatizadas
Para verificar que toda la lógica de negocio, cálculos de jornada y seguridad funcionen al 100%:
```powershell
docker exec attendance_saas_backend pytest
```
