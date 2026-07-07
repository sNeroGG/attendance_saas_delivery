from sqlalchemy import text
from app.database import engine

def clean_database():
    print("Iniciando limpieza completa de la base de datos...")
    with engine.connect() as conn:
        conn.execute(text("SET FOREIGN_KEY_CHECKS = 0;"))
        res = conn.execute(text("SHOW TABLES;"))
        tables = [row[0] for row in res]
        
        for table in tables:
            conn.execute(text(f"DROP TABLE `{table}`;"))
            print(f"Tabla eliminada: {table}")
            
        conn.execute(text("SET FOREIGN_KEY_CHECKS = 1;"))
        conn.commit()
    print("Limpieza completada con éxito.")

if __name__ == "__main__":
    clean_database()
