import json
import urllib.request
import urllib.error

BASE_URL = "http://localhost:8095/api"

def run_workflow_test():
    print("=== Iniciando prueba del flujo Face ID, Primer Ingreso y Override de Gerente ===")

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
        print("\n1. Autenticando con usuario 'admin'...")
        with urllib.request.urlopen(req_login) as response:
            res_body = json.loads(response.read().decode("utf-8"))
            admin_token = res_body.get("access_token")
            print("   [ÉXITO] Token JWT de administrador obtenido.")
    except Exception as e:
        print(f"   [FALLO] Error en login: {str(e)}")
        return

    # 2. Deshabilitar plantilla Face ID previa para empleado ID 1 para simular "primer ingreso"
    disable_url = f"{BASE_URL}/employees/1/disable-face"
    req_disable = urllib.request.Request(
        disable_url,
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {admin_token}"
        },
        method="POST"
    )
    try:
        print("\n2. Deshabilitando rostro del empleado ID 1 para simular primer ingreso...")
        with urllib.request.urlopen(req_disable) as response:
            res_body = json.loads(response.read().decode("utf-8"))
            print(f"   [ÉXITO] Rostro deshabilitado: {res_body.get('ok')}")
    except Exception as e:
        print(f"   [FALLO] Error al deshabilitar rostro: {str(e)}")
        return

    # 3. Intentar Login por PIN en el Kiosko (debería retornar has_face_template = False)
    identify_pin_url = f"{BASE_URL}/kiosk/identify-pin"
    pin_data = json.dumps({
        "device_code": "KIOSK-DEMO",
        "pin": "1234"
    }).encode("utf-8")
    req_identify_pin = urllib.request.Request(
        identify_pin_url,
        data=pin_data,
        headers={"Content-Type": "application/json"},
        method="POST"
    )
    
    employee_token = None
    try:
        print("\n3. Identificando empleado ID 1 por PIN (Primer Ingreso)...")
        with urllib.request.urlopen(req_identify_pin) as response:
            res_body = json.loads(response.read().decode("utf-8"))
            employee_token = res_body.get("access_token")
            has_face = res_body.get("employee", {}).get("has_face_template")
            print(f"   [ÉXITO] Empleado identificado.")
            print(f"     - has_face_template: {has_face}")
            assert has_face is False, "has_face_template debería ser False para primer ingreso"
            print("     - [OK] Campo 'has_face_template' es False.")
    except Exception as e:
        print(f"   [FALLO] Error en login PIN: {str(e)}")
        return

    # 4. Registrar rostro desde el Kiosko (usando el token del empleado)
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
            "Authorization": f"Bearer {employee_token}"
        },
        method="POST"
    )
    try:
        print("\n4. Registrando rostro (Face ID obligatorio) para el empleado ID 1...")
        with urllib.request.urlopen(req_register) as response:
            res_body = json.loads(response.read().decode("utf-8"))
            print(f"   [ÉXITO] Rostro registrado. ID plantilla: {res_body.get('id')}")
    except Exception as e:
        print(f"   [FALLO] Error al registrar rostro: {str(e)}")
        return

    # 5. Intentar Login por PIN nuevamente (debería retornar has_face_template = True)
    # (El frontend usará esto para denegar el login por PIN y exigir Face ID)
    try:
        print("\n5. Validando que el login por PIN ahora reporte has_face_template = True...")
        with urllib.request.urlopen(req_identify_pin) as response:
            res_body = json.loads(response.read().decode("utf-8"))
            has_face = res_body.get("employee", {}).get("has_face_template")
            print(f"     - has_face_template: {has_face}")
            assert has_face is True, "has_face_template debería ser True después del registro"
            print("     - [OK] Campo 'has_face_template' es True (El frontend bloqueará este acceso).")
    except Exception as e:
        print(f"   [FALLO] Error al verificar PIN posterior: {str(e)}")
        return

    # 6. Intentar Login por Face ID (debería permitir el logueo directo)
    identify_face_url = f"{BASE_URL}/kiosk/identify-face"
    face_data = json.dumps({
        "image_base64": "demo-face-admin",
        "device_code": "KIOSK-DEMO"
    }).encode("utf-8")
    req_identify_face = urllib.request.Request(
        identify_face_url,
        data=face_data,
        headers={"Content-Type": "application/json"},
        method="POST"
    )
    try:
        print("\n6. Identificando empleado ID 1 usando Face ID...")
        with urllib.request.urlopen(req_identify_face) as response:
            res_body = json.loads(response.read().decode("utf-8"))
            success = res_body.get("success")
            employee_name = res_body.get("employee_name")
            print(f"   [ÉXITO] Reconocimiento facial exitoso.")
            print(f"     - Éxito: {success}")
            print(f"     - Nombre empleado: {employee_name}")
            assert success is True, "Inicio Face ID debió ser exitoso"
    except Exception as e:
        print(f"   [FALLO] Error al iniciar sesión por Face ID: {str(e)}")
        return

    # 7. Intentar Login por Override de Gerente (Caso extremo/falla Face ID)
    override_url = f"{BASE_URL}/kiosk/identify-manager-override"
    override_data = json.dumps({
        "device_code": "KIOSK-DEMO",
        "employee_pin": "1234",
        "manager_pin": "1234"
    }).encode("utf-8")
    req_override = urllib.request.Request(
        override_url,
        data=override_data,
        headers={"Content-Type": "application/json"},
        method="POST"
    )
    try:
        print("\n7. Solicitando Override de Gerente (PIN Empleado + PIN Gerente)...")
        with urllib.request.urlopen(req_override) as response:
            res_body = json.loads(response.read().decode("utf-8"))
            override_token = res_body.get("access_token")
            employee_name = res_body.get("employee", {}).get("name")
            print(f"   [ÉXITO] Override autorizado por Gerente.")
            print(f"     - Token JWT obtenido: {override_token is not None}")
            print(f"     - Sesión iniciada para el empleado: {employee_name}")
            assert override_token is not None, "Debería retornar un token válido"
    except Exception as e:
        print(f"   [FALLO] Error en override de gerente: {str(e)}")
        if hasattr(e, "read"):
            print(f"     Detalle: {e.read().decode('utf-8')}")
        return

    print("\n=== Todos los flujos del caso de uso pasaron exitosamente ===")

if __name__ == "__main__":
    run_workflow_test()
