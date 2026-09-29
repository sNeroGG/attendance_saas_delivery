# Manual del Usuario y Administrador - Sistema de Asistencia (SaaS)

Este documento detalla las funciones del **Portal de Empleado (Kiosco)**, el **Panel de Administración**, el propósito de cada pestaña de administración y la hoja de ruta indicando qué funcionalidades están completadas y cuáles quedan pendientes.

---

## 1. Portal del Empleado (Kiosco Móvil)

El portal del empleado está diseñado como una aplicación web móvil (mobile-first) disponible en la ruta raíz (`/`). Su objetivo principal es facilitar el registro rápido y táctil de la asistencia diaria y el cumplimiento de tareas operativas.

### Funcionalidades Implementadas (Ya disponibles)
* **Ingreso simplificado con PIN:** El empleado ingresa utilizando únicamente su PIN personal (el código de dispositivo es persistente y configurable en segundo plano). El input está diseñado para forzar el teclado numérico nativo en celulares.
* **Control de Flujo Lógico de Asistencia:** Los botones se adaptan dinámicamente según el estado de la jornada del empleado:
  * **Entra a jornada:** Solo visible si el empleado no ha ingresado a trabajar.
  * **Sale a break / comida:** Disponibles mientras está trabajando.
  * **Entra de break / comida:** Solo se muestran si el empleado registró una salida previa, guiando al empleado a reingresar ordenadamente.
  * **Salida final:** Cierra el turno del día.
* **Historial y Sincronización Automática:** Toda marcación calcula las horas y se sincroniza en tiempo real con el panel del administrador.
* **Cumplimiento de Asignaciones (Tareas):** Listado dinámico de cuestionarios o checklists pendientes (por ejemplo: checklist de seguridad al hacer Check-in). El empleado puede responder y completar tareas directamente desde su celular.
* **Seguridad por Sesión Temporal:** Al ingresar el PIN, el sistema otorga un token JWT temporal para que el empleado realice sus operaciones de forma segura. El botón **"Salir"** limpia la sesión de inmediato.

### Pendiente por Implementar (Siguiente Fase)
* **Autenticación Facial (Face ID) en Móvil:** Flujo de captura de foto real y validación biométrica integrada en el kiosco (actualmente el motor biométrico está en modo *mock/simulado* en el backend).
* **Temporizador de Cierre de Sesión Automático:** Cerrar la sesión del empleado tras 30 segundos de inactividad para dejar el kiosco listo para el siguiente compañero si se le olvida dar clic en "Salir".

---

## 2. Panel de Administración (`/ctrl-ops-7931` o `/admindash`)

El Panel de Administración es la consola central del sistema donde los supervisores y administradores gestionan los catálogos, configuran las reglas operativas y auditan el comportamiento del sistema.

### ¿Para qué sirve cada pestaña?

| Pestaña | Descripción / Propósito |
| :--- | :--- |
| **Dashboard** | Pantalla principal que muestra el resumen del estado actual del sistema, la fase activa del SaaS y las métricas operativas clave. |
| **Empresa** | Permite cambiar y actualizar la configuración global de la compañía actual (nombre legal, identificación tributaria, huso horario, datos de contacto y tipo de plan SaaS). |
| **Sucursales** | CRUD de sucursales. Permite definir las locaciones físicas donde operan los dispositivos y empleados. |
| **Usuarios** | Gestión de accesos administrativos. Permite asociar usuarios de inicio de sesión con sus respectivos empleados, definir contraseñas y PINs, e indicar si son administradores de la empresa. |
| **Empleados** | Catálogo principal del personal. Almacena la información de contacto de cada empleado, su código identificador, su departamento, puesto, estado laboral actual y fecha de contratación. |
| **Estados laborales** | Permite crear y configurar comportamientos de estados de empleo (ej. *De alta*, *Suspendido*, *Despedido*), definiendo si ese estado permite al empleado marcar asistencia (`allows_check_in`) o si requiere el ingreso de notas. |
| **Departamentos** | Organiza la estructura organizativa de la empresa y permite asociar jefes o managers a cada departamento. |
| **Puestos** | Catálogo de cargos y descripciones de puestos de trabajo dentro de la empresa. |
| **Roles** | Permite agrupar y asignar colecciones de permisos de seguridad bajo un rol administrativo (ej. *Administrador de Sucursal*, *Recursos Humanos*). |
| **Permisos** | Catálogo maestro de permisos definidos en el sistema (ej: `employee.create`, `attendance.view_all`). Se precarga de forma automática mediante el script de semillado (seed). |
| **Dispositivos** | Registro y autorización de los kioscos o terminales físicas. Cada celular o tablet que funcione como kiosco debe tener un registro aquí con su `device_code`. |
| **Preguntas** | Banco de preguntas para las encuestas o checklists. Permite crear preguntas de tipo selección, booleanas o de texto, indicando si requieren evidencia o validación del supervisor. |
| **Reglas** | Motor de asignaciones automáticas. Permite crear reglas para que cuando un empleado haga Check-in o Check-out en determinada sucursal o puesto, se le asigne de forma obligatoria un cuestionario. |
| **Auto checkout** | Gestión de reglas automáticas de salida. Cierra jornadas que quedaron abiertas por olvido a una hora específica del día. |
| **Face ID** | Panel de registro y simulación de reconocimiento facial. Permite registrar plantillas faciales simuladas y probar la velocidad de identificación. |
| **Reportes** | Permite cargar resúmenes operativos organizados por pestañas: Horas trabajadas, Asignaciones, Excepciones, Biometría y Auditoría. |
| **Jornadas** | Historial detallado de jornadas generadas por las marcaciones de los empleados, con el desglose de minutos trabajados, minutos de break y comida. |
| **hr_attendance** | Tabla limpia de asistencias (formato estándar compatible con Odoo u otros ERPs) que muestra las marcas de Check-in, Check-out y el cálculo final de horas trabajadas. |
| **Asignaciones empleado** | Monitor en tiempo real del estado de los cuestionarios asignados a los empleados (pendientes, en progreso, completados, validados por supervisor). |
| **Logs biométricos** | Bitácora de todos los intentos de inicio de sesión o marcación por reconocimiento facial, registrando el porcentaje de confianza y si el intento fue exitoso. |
| **Auditoría** | Registro histórico inmutable de acciones críticas en el sistema (ej. creación de empleados, cambios de configuración, edición de jornadas). |

---

## 3. Estado de la Implementación (Alcance del Proyecto)

### Lo que YA está implementado
1. **Seguridad y Aislamiento:** Inicio de sesión seguro con tokens JWT y control de acceso multiempresa para proteger los datos de cada cliente.
2. **Ciclo de Jornada Completo:** Registro de eventos (Entrada, Breaks, Comida, Salidas) calculando de forma precisa los tiempos trabajados y de descanso.
3. **Flujo de Asignaciones Dinámicas:** Generación automática de tareas/preguntas en base al perfil del empleado y validación en tiempo real.
4. **Bloqueos Operativos:** El sistema impide que un empleado haga Check-out (salida final) si tiene asignaciones obligatorias sin responder.
5. **Auditoría y Trazabilidad:** Logs inmutables de auditoría operativa y de accesos biométricos.
6. **Diseño Mobile-First Responsivo:** Kiosco táctil e intuitivo para celulares que carga inmediatamente desde la raíz.

### Lo que HACE FALTA implementar
1. **Reportes PDF/Excel:** Exportación visual y descarga directa de los reportes operativos de horas y asistencias.
2. **API de Integración con Odoo:** Sincronización directa de la tabla `hr_attendance` hacia el ERP Odoo para el procesamiento de nóminas.
3. **Servicio de Reconocimiento Facial Real:** Sustituir el servicio mock/simulado de Face ID por una biblioteca de IA real (como face-api.js en frontend o DeepFace en backend) para verificar las fotos reales de los empleados.
