# Registro de Avances de Desarrollo

Historial de mejoras, implementaciones y calibraciones realizadas en el proyecto de control de asistencia SaaS.

## 📅 3 de Julio, 2026

### 1. Sistema Biométrico de Face ID Real (OpenCV & Deep Learning)
* **Reconocedor Nativo sin Compilación:** Se implementó una solución basada en OpenCV (`FaceDetectorYN` y `FaceRecognizerSF`) cargando modelos ONNX ligeros. Evita la necesidad de compilar la librería `dlib` o requerir compiladores C++ de Visual Studio en entornos Windows/Python 3.14.
* **Formatos de Visor 1080x1080:** La cámara web se configuró en alta definición y se recortó la vista central a un formato simétrico de 1:1, escalando las dimensiones de análisis en segundo plano para conservar fluidez a 30 FPS.
* **HUD Analítico y de Diagnóstico Facial (Consola/Web):** Se incorporó un sistema de telemetría facial holográfico que evalúa en tiempo real:
  * **Iluminación:** Brillo promedio en la cara (luxes virtuales).
  * **Distancia:** Proporción de cercanía/lejanía del rostro en pantalla.
  * **Alineación:** Inclinación de la cabeza por delta de ojos.
  * **Malla de Sensores:** Trazado de líneas de análisis y círculos de detección sobre los 5 puntos faciales clave.

### 2. Creación Unificada de Empleado y Usuario (Panel Admin)
* **Check de Creación Automática:** Se agregó un casillero reactivo en el formulario de creación de Empleados. Al marcarlo, se permite ingresar el nombre de usuario (Login) y el PIN de Kiosko en la misma pantalla.
* **Vinculación Atómica:** El backend procesa de forma conjunta la ficha del empleado y su credencial de usuario, aplicando algoritmos de hash criptográfico seguros al PIN y enlazando los IDs en la base de datos de manera inmediata.

### 3. Visualización y Eliminación de Fotos Face ID
* **Miniatura en Listados:** La columna `face_image` ahora muestra una foto miniatura circular real de perfil del empleado en la tabla administrativa.
* **Gestión de Ficha de Registro:** En el modal de edición, se añadió una vista previa grande del rostro base y un botón interactivo de **"Eliminar Foto"** (con confirmación). Al borrarla, se desactiva el registro biométrico y se le exige al empleado re-registrarse con su PIN en su próximo ingreso.

### 4. Motor de Comparación Biométrico en Servidor Docker
* **Inferencia real en FastAPI:** Se integraron las librerías `opencv-python-headless` y `numpy` en el contenedor del backend, sustituyendo el comparador estático simulado (`mock`) por un motor de comparación real que decodifica las imágenes base64 y calcula la **distancia de coseno** exacta en el procesador.
* **Manejador de Excepciones de Duplicados:** Se implementó un capturador personalizado en `main.py` para errores de integridad de base de datos (`IntegrityError`), informando de forma clara al usuario si el Login seleccionado ya existe en lugar de romper la llamada con un error genérico de CORS.

### 5. Asistente de Registro Facial Multi-Ángulo (3 Pasos)
* **Flujo Progresivo de Configuración:** Se desarrolló un asistente interactivo en el Kiosko que guía al empleado paso a paso en la captura de 3 perfiles:
  1. **Frente 😐**
  2. **Perfil Izquierdo 👈**
  3. **Perfil Derecho 👉**
* **Inferencia Multidireccional:** El backend almacena las 3 muestras biométricas como plantillas activas independientes. Al marcar asistencia, el motor busca la similitud de coseno contra cualquiera de las 3 posiciones registradas, incrementando drásticamente la tasa de aceptación.
