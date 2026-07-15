import cv2
import sys

def capture_photo(output_path="known_person.jpg"):
    print("Iniciando cámara web para captura de foto de referencia...")
    video_capture = cv2.VideoCapture(0)

    if not video_capture.isOpened():
        print("[!] ERROR: No se pudo acceder a la cámara web.")
        return

    print("\n-------------------------------------------------------------")
    print("INSTRUCCIONES DE CAPTURA:")
    print("1. Colócate centrado frente a la cámara con buena iluminación.")
    print("2. Presiona la barra espaciadora [ESPACIO] para capturar y guardar tu foto.")
    print("3. Presiona la tecla [ESC] para cancelar y salir.")
    print("-------------------------------------------------------------\n")

    while True:
        ret, frame = video_capture.read()
        if not ret:
            print("[!] Error al leer el cuadro de la cámara.")
            break

        display_frame = frame.copy()
        
        h, w, _ = display_frame.shape
        cv2.rectangle(display_frame, (0, h - 40), (w, h), (0, 0, 0), cv2.FILLED)
        cv2.putText(
            display_frame, 
            "Presiona [ESPACIO] para Tomar Foto | [ESC] para Cancelar", 
            (10, h - 15), 
            cv2.FONT_HERSHEY_SIMPLEX, 
            0.5, 
            (255, 255, 255), 
            1, 
            cv2.LINE_AA
        )

        cv2.imshow("Captura de Referencia Face ID", display_frame)

        key = cv2.waitKey(1) & 0xFF
        
        if key == 27:
            print("Captura cancelada por el usuario.")
            break
        elif key == 32:
            cv2.imwrite(output_path, frame)
            print(f"\n[+] ¡ÉXITO! Foto de referencia guardada como '{output_path}'")
            break

    video_capture.release()
    cv2.destroyAllWindows()

if __name__ == "__main__":
    filename = sys.argv[1] if len(sys.argv) > 1 else "known_person.jpg"
    capture_photo(filename)
