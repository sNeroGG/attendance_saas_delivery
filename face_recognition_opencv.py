import os
import sys
import urllib.request
import cv2
import numpy as np

# URLs oficiales de los modelos ONNX en OpenCV Zoo
YUNET_URL = "https://github.com/opencv/opencv_zoo/raw/main/models/face_detection_yunet/face_detection_yunet_2023mar.onnx"
SFACE_URL = "https://github.com/opencv/opencv_zoo/raw/main/models/face_recognition_sface/face_recognition_sface_2021dec.onnx"

YUNET_MODEL = "face_detection_yunet_2023mar.onnx"
SFACE_MODEL = "face_recognition_sface_2021dec.onnx"

def download_models():
    """Descarga los modelos ONNX necesarios de forma automática si no existen."""
    for model_name, url in [(YUNET_MODEL, YUNET_URL), (SFACE_MODEL, SFACE_URL)]:
        if not os.path.exists(model_name):
            print(f"Descargando modelo {model_name} de OpenCV Zoo (esto solo ocurre una vez)...")
            try:
                urllib.request.urlretrieve(url, model_name)
                print(f"Modelo {model_name} descargado con éxito.")
            except Exception as e:
                print(f"[!] Error al descargar el modelo desde {url}: {e}")
                print("Por favor, descarga el archivo manualmente y colócalo en este directorio.")
                sys.exit(1)

def run_opencv_face_id(known_image_path="known_person.jpg"):
    # 1. Asegurar descarga de modelos
    download_models()

    # 2. Verificar foto de referencia
    if not os.path.exists(known_image_path):
        print(f"\n[!] ERROR: No se encontró la foto de referencia en '{known_image_path}'.")
        print("Toma una foto clara de tu rostro, guárdala como 'known_person.jpg' en esta carpeta y vuelve a iniciar.")
        return

    # Inicializar el Detector YuNet y el Reconocedor SFace
    # Inicializamos YuNet con un tamaño temporal
    detector = cv2.FaceDetectorYN.create(YUNET_MODEL, "", (320, 320))
    recognizer = cv2.FaceRecognizerSF.create(SFACE_MODEL, "")

    print("Cargando imagen de referencia autorizada...")
    ref_img = cv2.imread(known_image_path)
    if ref_img is None:
        print("[!] ERROR: No se pudo cargar la imagen de referencia.")
        return

    # Detectar rostro en la imagen de referencia
    h_ref, w_ref, _ = ref_img.shape
    detector.setInputSize((w_ref, h_ref))
    _, faces_ref = detector.detect(ref_img)

    if faces_ref is None or len(faces_ref) == 0:
        print("[!] ERROR: No se detectó rostro en tu imagen de referencia. Toma otra foto más clara de frente.")
        return

    # Alinear y extraer características del rostro autorizado
    ref_face_aligned = recognizer.alignCrop(ref_img, faces_ref[0])
    ref_feature = recognizer.feature(ref_face_aligned)
    print("Imagen de referencia procesada con éxito.")

    # 3. Iniciar Streaming de Cámara Web en Alta Calidad (1080p si se soporta)
    print("\nIniciando cámara web. Presiona la tecla 'q' para salir...")
    video_capture = cv2.VideoCapture(0)

    # Intentar forzar resolución alta
    video_capture.set(cv2.CAP_PROP_FRAME_WIDTH, 1280)
    video_capture.set(cv2.CAP_PROP_FRAME_HEIGHT, 720)

    if not video_capture.isOpened():
        print("[!] ERROR: No se pudo acceder a la cámara web.")
        return

    # Configuración de tamaños para procesamiento ligero
    process_size = 320
    detector.setInputSize((process_size, process_size))

    # Umbral de similitud de coseno para SFace (alto es más estricto)
    COSINE_THRESHOLD = 0.40
    scale = 1080.0 / float(process_size)

    while True:
        ret, frame = video_capture.read()
        if not ret:
            print("[!] Error al leer el cuadro de la cámara.")
            break

        # Recortar cuadrado central de la captura nativa para la vista 1080x1080
        h, w, _ = frame.shape
        crop_size = min(h, w)
        start_x = (w - crop_size) // 2
        start_y = (h - crop_size) // 2
        frame_square = frame[start_y:start_y+crop_size, start_x:start_x+crop_size]

        # Redimensionar la vista final del usuario a exactamente 1080x1080
        frame_display = cv2.resize(frame_square, (1080, 1080))

        # Redimensionar a 320x320 para que la red neuronal (YuNet/SFace) sea ultra veloz
        frame_small = cv2.resize(frame_display, (process_size, process_size))

        # Detectar rostros en el frame pequeño
        _, faces = detector.detect(frame_small)

        # (HUD de diagnóstico técnico deshabilitado para mantener la vista limpia)

        # Configuración por defecto de evaluación
        eval_ilum = "Baja (Cuidado)"
        eval_ilum_color = (0, 165, 255) # Naranja
        eval_dist = "Sin Rostro"
        eval_dist_color = (0, 0, 255) # Rojo
        eval_align = "Sin Rostro"
        eval_align_color = (0, 0, 255)
        eval_points = "0 Detectados"
        eval_points_color = (0, 0, 255)

        if faces is not None and len(faces) > 0:
            face = faces[0]
            # Extraer caja de detección
            box = face[0:4].astype(np.int32)
            x, y, w_box, h_box = box[0], box[1], box[2], box[3]

            # Escalar coordenadas a la vista 1080x1080
            x_disp = int(x * scale)
            y_disp = int(y * scale)
            w_disp = int(w_box * scale)
            h_disp = int(h_box * scale)

            # Extraer puntos de landmarks (5 puntos) y escalarlos
            landmarks = face[4:14].astype(np.int32).reshape((5, 2))
            landmarks_disp = (landmarks * scale).astype(np.int32)

            left_eye = landmarks_disp[0]
            right_eye = landmarks_disp[1]
            nose = landmarks_disp[2]
            left_mouth = landmarks_disp[3]
            right_mouth = landmarks_disp[4]

            # Alinear y extraer características del rostro en 320x320
            face_aligned = recognizer.alignCrop(frame_small, face)
            live_feature = recognizer.feature(face_aligned)

            # Comparar contra rostro autorizado
            cosine_score = recognizer.match(ref_feature, live_feature, cv2.FaceRecognizerSF_FR_COSINE)

            # --- EVALUACIÓN DE ROSTRO (TECNOLOGÍA DE ANÁLISIS) ---
            # 1. Distancia facial (Tamaño de la caja en la pantalla 1080p)
            if w_disp < 320:
                eval_dist = "Muy Lejos (Acercate)"
                eval_dist_color = (0, 165, 255)
            elif w_disp > 750:
                eval_dist = "Muy Cerca (Alejate)"
                eval_dist_color = (0, 165, 255)
            else:
                eval_dist = "Ideal"
                eval_dist_color = (0, 255, 0) # Verde

            # 2. Alineación facial (Inclinación de la cabeza por delta de ojos)
            eye_dy = abs(left_eye[1] - right_eye[1])
            if eye_dy > 45:
                eval_align = "Cabeza Inclinada"
                eval_align_color = (0, 0, 255)
            else:
                eval_align = "Correcta / Recta"
                eval_align_color = (0, 255, 0)

            # 3. Iluminación (Promedio de brillo en la región de la cara)
            face_crop = frame_small[max(0, y):min(process_size, y+h_box), max(0, x):min(process_size, x+w_box)]
            if face_crop.size > 0:
                gray_face = cv2.cvtColor(face_crop, cv2.COLOR_BGR2GRAY)
                avg_brightness = np.mean(gray_face)
                if avg_brightness < 60:
                    eval_ilum = f"Muy Oscuro ({avg_brightness:.0f} lx)"
                    eval_ilum_color = (0, 0, 255)
                elif avg_brightness > 220:
                    eval_ilum = f"Mucha Luz ({avg_brightness:.0f} lx)"
                    eval_ilum_color = (0, 165, 255)
                else:
                    eval_ilum = f"Suficiente ({avg_brightness:.0f} lx)"
                    eval_ilum_color = (0, 255, 0)

            # 4. Puntos de landmarks
            eval_points = "5/5 Puntos Detectados"
            eval_points_color = (0, 255, 0)

            # Determinar estatus de reconocimiento
            if cosine_score >= COSINE_THRESHOLD:
                percentage = max(0.0, min(100.0, cosine_score * 100))
                name = f"Persona Autorizada ({percentage:.1f}%)"
                color = (0, 255, 0)
            else:
                name = f"Desconocido (Sim: {cosine_score:.3f})"
                color = (0, 0, 255)

            # DIBUJAR GEOMETRÍA EN LA CÁMARA (FUTURISTA HUD)
            # Dibujar caja de rostro
            cv2.rectangle(frame_display, (x_disp, y_disp), (x_disp + w_disp, y_disp + h_disp), color, 3)
            
            # (Malla wireframe y círculos de landmarks deshabilitados para mantener la vista limpia)

            # Dibujar etiqueta de identidad
            cv2.rectangle(frame_display, (x_disp, y_disp + h_disp - 38), (x_disp + w_disp, y_disp + h_disp), color, cv2.FILLED)
            cv2.putText(frame_display, name, (x_disp + 10, y_disp + h_disp - 12), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255, 255, 255), 2)

        # (Texto de diagnóstico del HUD deshabilitado para mantener la vista limpia)

        # Mostrar ventana 1080x1080
        cv2.imshow("Face ID Premium - Evaluador Geometrico", frame_display)

        # Salir al presionar 'q'
        if cv2.waitKey(1) & 0xFF == ord('q'):
            break

    video_capture.release()
    cv2.destroyAllWindows()
    print("Cámara liberada. Programa terminado con éxito.")

if __name__ == "__main__":
    run_opencv_face_id()
