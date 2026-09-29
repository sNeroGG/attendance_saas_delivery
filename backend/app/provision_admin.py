"""Create the first production superadmin from injected one-time environment variables."""
import os

from app.config import get_settings
from app.database import SessionLocal
from app.models import ResCompany, ResUser
from app.security.auth import hash_secret


def main() -> None:
    if get_settings().environment.lower() != "production":
        raise RuntimeError("This command is only for production bootstrap")

    required = ("BOOTSTRAP_ADMIN_LOGIN", "BOOTSTRAP_ADMIN_NAME", "BOOTSTRAP_ADMIN_PASSWORD")
    missing = [name for name in required if not os.getenv(name)]
    if missing:
        raise RuntimeError(f"Missing required bootstrap settings: {', '.join(missing)}")
    password = os.environ["BOOTSTRAP_ADMIN_PASSWORD"]
    if len(password) < 14:
        raise RuntimeError("BOOTSTRAP_ADMIN_PASSWORD must be at least 14 characters")

    db = SessionLocal()
    try:
        company_id = os.getenv("BOOTSTRAP_COMPANY_ID")
        if company_id:
            company = db.get(ResCompany, int(company_id))
            if not company:
                raise RuntimeError("The bootstrap company does not exist")
        else:
            company_name = os.getenv("BOOTSTRAP_COMPANY_NAME", "").strip()
            if not company_name:
                raise RuntimeError("Provide BOOTSTRAP_COMPANY_ID or BOOTSTRAP_COMPANY_NAME")
            company = ResCompany(
                name=company_name,
                legal_name=os.getenv("BOOTSTRAP_COMPANY_LEGAL_NAME") or company_name,
                country=os.getenv("BOOTSTRAP_COMPANY_COUNTRY"),
            )
            db.add(company)
            db.flush()
            company_id = str(company.id)
        if db.query(ResUser.id).filter(ResUser.is_superadmin.is_(True), ResUser.active.is_(True)).first():
            raise RuntimeError("An active superadmin already exists; refusing bootstrap")
        login = os.environ["BOOTSTRAP_ADMIN_LOGIN"].strip()
        admin_name = os.environ["BOOTSTRAP_ADMIN_NAME"].strip()
        if not login or not admin_name:
            raise RuntimeError("Bootstrap login and administrator name cannot be blank")
        if db.query(ResUser.id).filter_by(login=login).first():
            raise RuntimeError("The requested login is already in use")

        admin = ResUser(
            company_id=int(company_id),
            name=admin_name,
            login=login,
            email=os.getenv("BOOTSTRAP_ADMIN_EMAIL") or None,
            password_hash=hash_secret(password),
            is_superadmin=True,
            is_company_admin=True,
            active=True,
        )
        db.add(admin)
        db.commit()
        print("Initial administrator provisioned. Remove bootstrap variables from the environment now.")
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    main()
