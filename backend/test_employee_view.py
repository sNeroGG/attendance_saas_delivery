import json
import urllib.request
import urllib.error

BASE_URL = "http://localhost:8095/api"

def run_test():
    print("=== Iniciando prueba de la Vista de Empleados ===")
    
    # 1. Iniciar sesión para obtener el token JWT
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
        print("1. Intentando autenticación con el usuario 'admin'...")
        with urllib.request.urlopen(req_login) as response:
            res_body = json.loads(response.read().decode("utf-8"))
            token = res_body.get("access_token")
            print("   [ÉXITO] Autenticación correcta. Token JWT obtenido.")
    except urllib.error.HTTPError as e:
        print(f"   [FALLO] Error de autenticación: {e.code} - {e.read().decode('utf-8')}")
        return
    except Exception as e:
        print(f"   [FALLO] Error inesperado en login: {str(e)}")
        return

    # 2. Consultar la vista de empleados (GET /employees)
    employees_url = f"{BASE_URL}/employees"
    req_employees = urllib.request.Request(
        employees_url,
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {token}"
        },
        method="GET"
    )
    
    try:
        print("\n2. Consultando el endpoint de empleados (/api/employees)...")
        with urllib.request.urlopen(req_employees) as response:
            employees = json.loads(response.read().decode("utf-8"))
            print(f"   [ÉXITO] Empleados cargados. Registros encontrados: {len(employees)}")
            
            print("\n=== Lista de Empleados Obtenida ===")
            for idx, emp in enumerate(employees, start=1):
                print(f"Empleado #{idx}:")
                print(f"  - ID: {emp.get('id')}")
                print(f"  - Nombre completo: {emp.get('name')}")
                print(f"  - Código: {emp.get('employee_code')}")
                print(f"  - Email: {emp.get('work_email')}")
                print(f"  - Tipo: {emp.get('employee_type')}")
                print(f"  - Activo para trabajar: {emp.get('is_active_for_work')}")
                print(f"  - Empresa ID: {emp.get('company_id')}")
                print("-" * 30)
                
    except urllib.error.HTTPError as e:
        print(f"   [FALLO] Error al obtener empleados: {e.code} - {e.read().decode('utf-8')}")
    except Exception as e:
        print(f"   [FALLO] Error inesperado al obtener empleados: {str(e)}")

if __name__ == "__main__":
    run_test()
