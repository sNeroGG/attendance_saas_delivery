import json
import urllib.request
import urllib.error

BASE_URL = "http://localhost:8095/api"

def run_face_id_test():
    print("=== Iniciando prueba funcional automatizada de Face ID ===")
    
    # 1. Iniciar sesión para obtener el token JWT de administrador
    login_url = f"{BASE_URL}/auth/login"
    login_data = json.dumps({
        "login": "admin",
        "password": "admin123"
    }).encode("utf-8")
    
    req_login = urllib.request.Request(
        login_url,
        data=login_data,
        headers={"Content-Type": "application/json"},
        method="POST"
    )
    
    try:
        print("1. Autenticando con usuario 'admin'...")
        with urllib.request.urlopen(req_login) as response:
            res_body = json.loads(response.read().decode("utf-8"))
            admin_token = res_body.get("access_token")
            print("   [ÉXITO] Token JWT de administrador obtenido.")
    except Exception as e:
        print(f"   [FALLO] Error en login: {str(e)}")
        return

    # 2. Registrar Face ID para el empleado 1 ("demo-face-admin")
    register_url = f"{BASE_URL}/employees/1/register-face"
    register_data = json.dumps({
        "image_base64": "demo-face-admin",
        "device_code": "KIOSK-DEMO"
    }).encode("utf-8")
    
    req_register = urllib.request.Request(
        register_url,
        data=register_data,
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {admin_token}"
        },
        method="POST"
    )
    
    try:
        print("\n2. Registrando plantilla Face ID para empleado ID 1 ('demo-face-admin')...")
        with urllib.request.urlopen(req_register) as response:
            res_body = json.loads(response.read().decode("utf-8"))
            print(f"   [ÉXITO] Plantilla registrada. ID plantilla: {res_body.get('id')}")
    except Exception as e:
        print(f"   [FALLO] Error en registro de rostro: {str(e)}")
        return

    # 3. Identificar Face ID desde el Kiosko (POST /api/kiosk/identify-face)
    identify_url = f"{BASE_URL}/kiosk/identify-face"
    identify_data = json.dumps({
        "image_base64": "demo-face-admin",
        "device_code": "KIOSK-DEMO"
    }).encode("utf-8")
    
    req_identify = urllib.request.Request(
        identify_url,
        data=identify_data,
        headers={"Content-Type": "application/json"},
        method="POST"
    )
    
    employee_token = None
    try:
        print("\n3. Identificando rostro en el Kiosko (/api/kiosk/identify-face)...")
        with urllib.request.urlopen(req_identify) as response:
            res_body = json.loads(response.read().decode("utf-8"))
            success = res_body.get("success")
            employee_name = res_body.get("employee_name")
            confidence = res_body.get("confidence_score")
            employee_token = res_body.get("access_token")
            
            print(f"   [ÉXITO] Respuesta recibida.")
            print(f"     - Éxito: {success}")
            print(f"     - Empleado: {employee_name} (ID: {res_body.get('employee_id')})")
            print(f"     - Confianza: {confidence}")
            if employee_token:
                print(f"     - Token JWT de Empleado obtenido correctamente.")
            else:
                print(f"     - [FALLO] No se recibió token de acceso en la respuesta.")
                return
    except Exception as e:
        print(f"   [FALLO] Error en identificación de rostro: {str(e)}")
        return

    # 4. Obtener eventos disponibles para el empleado para registrar la marcación correcta
    events_url = f"{BASE_URL}/kiosk/employees/1/available-events?device_code=KIOSK-DEMO"
    req_events = urllib.request.Request(events_url, method="GET")
    event_type_id = None
    try:
        print("\n4. Consultando eventos disponibles para el empleado...")
        with urllib.request.urlopen(req_events) as response:
            available = json.loads(response.read().decode("utf-8"))
            if available:
                event_type_id = available[0].get("id")
                print(f"   [ÉXITO] Evento disponible encontrado: {available[0].get('name')} (ID: {event_type_id})")
            else:
                print("   [INFO] No hay eventos disponibles (jornada posiblemente ya abierta/cerrada).")
    except Exception as e:
        print(f"   [FALLO] Error al obtener eventos: {str(e)}")

    # Si no hay eventos disponibles, omitimos el paso de marcación
    if event_type_id:
        # 5. Registrar marcación de asistencia en el Kiosko usando el token y method="face_id"
        attendance_url = f"{BASE_URL}/kiosk/attendance-events"
        attendance_data = json.dumps({
            "employee_id": 1,
            "event_type_id": event_type_id,
            "device_code": "KIOSK-DEMO",
            "method": "face_id"
        }).encode("utf-8")
        
        req_attendance = urllib.request.Request(
            attendance_url,
            data=attendance_data,
            headers={
                "Content-Type": "application/json",
                "Authorization": f"Bearer {employee_token}"
            },
            method="POST"
        )
        
        try:
            print("\n5. Registrando marcación de asistencia con método 'face_id'...")
            with urllib.request.urlopen(req_attendance) as response:
                res_body = json.loads(response.read().decode("utf-8"))
                print(f"   [ÉXITO] Marcación registrada.")
                print(f"     - ID Evento: {res_body.get('id')}")
                print(f"     - Método de marcación: {res_body.get('method')}")
                assert res_body.get("method") == "face_id", "El método de la marcación debe ser 'face_id'"
                print("     - [OK] Campo 'method' es 'face_id'.")
        except Exception as e:
            print(f"   [FALLO] Error al registrar marcación: {str(e)}")
            if hasattr(e, "read"):
                print(f"     Detalle: {e.read().decode('utf-8')}")
            return

    # 6. Consultar Logs Biométricos en el admin dashboard para verificar el registro
    logs_url = f"{BASE_URL}/biometric-logs"
    req_logs = urllib.request.Request(
        logs_url,
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {admin_token}"
        },
        method="GET"
    )
    
    try:
        print("\n6. Consultando bitácora de logs biométricos (/api/biometric-logs)...")
        with urllib.request.urlopen(req_logs) as response:
            logs = json.loads(response.read().decode("utf-8"))
            print(f"   [ÉXITO] Logs cargados. Registros encontrados: {len(logs)}")
            if logs:
                latest = logs[0]
                print(f"     Último log biométrico:")
                print(f"       - ID: {latest.get('id')}")
                print(f"       - Empleado ID: {latest.get('employee_id')}")
                print(f"       - Tipo evento: {latest.get('event_type')}")
                print(f"       - Método: {latest.get('method')}")
                print(f"       - Éxito: {latest.get('success')}")
                print(f"       - Confianza: {latest.get('confidence_score')}")
    except Exception as e:
        print(f"   [FALLO] Error al obtener logs biométricos: {str(e)}")
        return

    print("\n=== Prueba completada con éxito ===")

if __name__ == "__main__":
    run_face_id_test()
