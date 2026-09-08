from datetime import datetime
from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.models import (
    HrAttendance,
    HrEmployee,
    XAttendanceEvent,
    XAttendanceEventType,
    XAttendanceShift,
    XDevice,
    XEmployeeStatus,
)
from app.services.assignments import AssignmentService
from app.services.rule_engine import RuleEngineService
from app.services.schedules import describe_employee_work


class AttendanceLogicService:
    def __init__(self, db: Session, company_id: int, user_id: int | None = None):
        self.db = db
        self.company_id = company_id
        self.user_id = user_id

    def get_current_shift(self, employee_id: int) -> XAttendanceShift | None:
        return (
            self.db.query(XAttendanceShift)
            .filter(
                XAttendanceShift.company_id == self.company_id,
                XAttendanceShift.employee_id == employee_id,
                XAttendanceShift.state == "open",
            )
            .order_by(XAttendanceShift.check_in_at.desc())
            .first()
        )

    def get_last_event(self, employee_id: int) -> XAttendanceEvent | None:
        return (
            self.db.query(XAttendanceEvent)
            .filter(
                XAttendanceEvent.company_id == self.company_id,
                XAttendanceEvent.employee_id == employee_id,
                XAttendanceEvent.state != "cancelled",
            )
            .order_by(XAttendanceEvent.timestamp.desc(), XAttendanceEvent.id.desc())
            .first()
        )

    def get_available_event_types(self, employee_id: int, device_id: int | None = None) -> list[XAttendanceEventType]:
        employee = self._get_employee(employee_id)
        self._assert_employee_can_check_in(employee)
        current_shift = self.get_current_shift(employee_id)
        event_types = (
            self.db.query(XAttendanceEventType)
            .filter(XAttendanceEventType.company_id == self.company_id, XAttendanceEventType.active.is_(True))
            .order_by(XAttendanceEventType.sequence, XAttendanceEventType.id)
            .all()
        )
        
        # 1. Sin jornada iniciada
        if not current_shift:
            return [item for item in event_types if item.opens_shift]
            
        last_event = self.get_last_event(employee_id)
        if not last_event or last_event.shift_id != current_shift.id:
            # Caso fallback: tiene jornada pero no hay eventos registrados
            last_code = "shift_in"
        else:
            last_type = self.db.get(XAttendanceEventType, last_event.event_type_id)
            last_code = last_type.code if last_type else "shift_in"
            
        # 5. Jornada finalizada (si el último evento cerró la jornada)
        if last_event and last_event.shift_id == current_shift.id:
            last_type = self.db.get(XAttendanceEventType, last_event.event_type_id)
            if last_type and last_type.closes_shift:
                return []
                
        # 3. En break (el último evento fue salir a break)
        if last_code == "break_out":
            return [item for item in event_types if item.code == "break_in"]
            
        # 4. En comida (el último evento fue salir a comida)
        if last_code == "meal_out":
            return [item for item in event_types if item.code == "meal_in"]
            
        # 2. En jornada activa
        # Mostrar: Salir a break, Salir a comida, y Salir de trabajar (si no hay salida automática)
        allowed = []
        for item in event_types:
            if item.opens_shift:
                continue
            if item.code in ["break_in", "meal_in"]:
                continue
            allowed.append(item)
            
        return allowed

    def create_attendance_event(
        self,
        employee_id: int,
        event_type_id: int,
        method: str,
        device_id: int | None,
        timestamp: datetime | None = None,
        note: str | None = None,
        evidence_url: str | None = None,
        source: str = "kiosk",
        manager_override: bool = False,
    ) -> XAttendanceEvent:
        now = timestamp or datetime.utcnow()
        employee = self._get_employee(employee_id)
        event_type = self._get_event_type(event_type_id)
        auto_close = source == "auto_checkout"
        if not auto_close:
            self._assert_employee_can_check_in(employee)
        if event_type.requires_note and not note:
            raise HTTPException(status_code=422, detail="Este tipo de evento requiere nota")
        if event_type.requires_evidence and not evidence_url:
            raise HTTPException(status_code=422, detail="Este tipo de evento requiere evidencia")

        current_shift = self.get_current_shift(employee_id)
        if not current_shift and not event_type.opens_shift:
            raise HTTPException(status_code=422, detail="No hay jornada abierta para este evento")
        if current_shift and event_type.opens_shift:
            raise HTTPException(status_code=422, detail="Ya existe una jornada abierta")
        if (
            current_shift
            and event_type.closes_shift
            and not auto_close
            and RuleEngineService(self.db, self.company_id).should_block_check_out(employee_id, current_shift.id)
        ):
            raise HTTPException(status_code=422, detail="Hay asignaciones obligatorias pendientes antes del check-out")

        work = describe_employee_work(
            self.db, self.company_id, employee, now,
            opens_shift=event_type.opens_shift,
            closes_shift=event_type.closes_shift,
        )
        punch = work["punch"]
        bypass_schedule = manager_override or source in {"admin", "auto_checkout"}
        if not punch["allowed"] and not bypass_schedule:
            raise HTTPException(
                status_code=409,
                detail={
                    "code": punch["code"],
                    "message": f'{punch["label"]}. Pida PIN de gerente para autorizar.',
                    "requires_manager": True,
                    "schedule_label": work["label"],
                },
            )
        if punch.get("requires_manager") and punch["allowed"] and not bypass_schedule:
            raise HTTPException(
                status_code=409,
                detail={
                    "code": punch["code"],
                    "message": f'{punch["label"]}. Pida PIN de gerente para autorizar.',
                    "requires_manager": True,
                    "schedule_label": work["label"],
                },
            )

        device = self.db.get(XDevice, device_id) if device_id else None
        branch_id = device.branch_id if device else employee.branch_id
        shift = current_shift
        if event_type.opens_shift:
            shift = XAttendanceShift(
                company_id=self.company_id,
                employee_id=employee.id,
                branch_id=branch_id,
                check_in_at=now,
                state="open",
                create_uid=self.user_id,
                write_uid=self.user_id,
            )
            self.db.add(shift)
            self.db.flush()

        event = XAttendanceEvent(
            company_id=self.company_id,
            employee_id=employee.id,
            branch_id=branch_id,
            device_id=device_id,
            event_type_id=event_type.id,
            shift_id=shift.id if shift else None,
            timestamp=now,
            method=method,
            note=note,
            evidence_url=evidence_url,
            source=source,
            state="done",
            punctuality="missing_checkout" if auto_close else punch["code"],
            create_uid=self.user_id,
            write_uid=self.user_id,
        )
        self.db.add(event)
        self.db.flush()

        if event_type.closes_shift and shift:
            shift.check_out_at = now
            shift.state = "closed"
            shift.auto_closed = auto_close or shift.auto_closed
            if auto_close:
                shift.note = note or "No marcó salida"
            shift.write_uid = self.user_id
        if shift:
            self.recalculate_shift(shift.id)
            self.sync_shift_to_hr_attendance(shift.id)
            if event_type.opens_shift:
                AssignmentService(self.db, self.company_id, self.user_id).generate_assignments_for_shift(employee.id, shift.id, {"branch_id": branch_id, "event_type_id": event_type.id})
        self.db.commit()
        self.db.refresh(event)
        return event

    def recalculate_shift(self, shift_id: int) -> XAttendanceShift:
        shift = self._get_shift(shift_id)
        events = (
            self.db.query(XAttendanceEvent)
            .filter(XAttendanceEvent.company_id == self.company_id, XAttendanceEvent.shift_id == shift.id, XAttendanceEvent.state != "cancelled")
            .order_by(XAttendanceEvent.timestamp, XAttendanceEvent.id)
            .all()
        )
        break_minutes = meal_minutes = non_worked_minutes = 0
        pending_out: tuple[datetime, XAttendanceEventType] | None = None
        for event in events:
            event_type = self.db.get(XAttendanceEventType, event.event_type_id)
            if not event_type:
                continue
            if event_type.direction == "out" and not event_type.closes_shift:
                pending_out = (event.timestamp, event_type)
            elif event_type.direction == "in" and pending_out:
                start, out_type = pending_out
                minutes = max(0, int((event.timestamp - start).total_seconds() // 60))
                if out_type.counts_as_break:
                    break_minutes += minutes
                elif out_type.counts_as_meal:
                    meal_minutes += minutes
                elif out_type.counts_as_non_worked:
                    non_worked_minutes += minutes
                pending_out = None

        end = shift.check_out_at or datetime.utcnow()
        total_minutes = max(0, int((end - shift.check_in_at).total_seconds() // 60))
        worked_minutes = max(0, total_minutes - break_minutes - meal_minutes - non_worked_minutes)
        shift.total_time_minutes = total_minutes
        shift.worked_time_minutes = worked_minutes
        shift.break_time_minutes = break_minutes
        shift.meal_time_minutes = meal_minutes
        shift.non_worked_time_minutes = non_worked_minutes
        shift.write_uid = self.user_id
        self.db.flush()
        return shift

    def sync_shift_to_hr_attendance(self, shift_id: int) -> HrAttendance:
        shift = self._get_shift(shift_id)
        record = self.db.query(HrAttendance).filter_by(company_id=self.company_id, x_shift_id=shift.id).first()
        if not record:
            record = HrAttendance(
                company_id=self.company_id,
                employee_id=shift.employee_id,
                check_in=shift.check_in_at,
                x_shift_id=shift.id,
                x_source="attendance_saas",
                create_uid=self.user_id,
                write_uid=self.user_id,
            )
            self.db.add(record)
        record.check_in = shift.check_in_at
        record.check_out = shift.check_out_at
        record.worked_hours = round(shift.worked_time_minutes / 60, 4)
        record.write_uid = self.user_id
        self.db.flush()
        return record

    def manual_checkout(self, shift_id: int, timestamp: datetime | None = None, note: str | None = None) -> XAttendanceShift:
        shift = self._get_shift(shift_id)
        if shift.state != "open":
            raise HTTPException(status_code=422, detail="La jornada no esta abierta")
        event_type = (
            self.db.query(XAttendanceEventType)
            .filter_by(company_id=self.company_id, closes_shift=True, active=True)
            .order_by(XAttendanceEventType.sequence)
            .first()
        )
        if not event_type:
            raise HTTPException(status_code=422, detail="No hay tipo de evento de salida final configurado")
        self.create_attendance_event(
            employee_id=shift.employee_id,
            event_type_id=event_type.id,
            method="manual",
            device_id=None,
            timestamp=timestamp or datetime.utcnow(),
            note=note,
            source="admin",
        )
        return self._get_shift(shift_id)

    def cancel_event(self, event_id: int) -> XAttendanceEvent:
        event = self.db.get(XAttendanceEvent, event_id)
        if not event or event.company_id != self.company_id:
            raise HTTPException(status_code=404, detail="Evento no encontrado")
        event.state = "cancelled"
        event.write_uid = self.user_id
        self.db.flush()
        if event.shift_id:
            self.recalculate_shift(event.shift_id)
            self.sync_shift_to_hr_attendance(event.shift_id)
        self.db.commit()
        self.db.refresh(event)
        return event

    def _get_employee(self, employee_id: int) -> HrEmployee:
        employee = self.db.get(HrEmployee, employee_id)
        if not employee or employee.company_id != self.company_id or not employee.active:
            raise HTTPException(status_code=404, detail="Empleado no encontrado")
        return employee

    def _get_event_type(self, event_type_id: int) -> XAttendanceEventType:
        event_type = self.db.get(XAttendanceEventType, event_type_id)
        if not event_type or event_type.company_id != self.company_id or not event_type.active:
            raise HTTPException(status_code=404, detail="Tipo de evento no encontrado")
        return event_type

    def _get_shift(self, shift_id: int) -> XAttendanceShift:
        shift = self.db.get(XAttendanceShift, shift_id)
        if not shift or shift.company_id != self.company_id:
            raise HTTPException(status_code=404, detail="Jornada no encontrada")
        return shift

    def _assert_employee_can_check_in(self, employee: HrEmployee) -> None:
        if not employee.is_active_for_work:
            raise HTTPException(status_code=422, detail="Empleado no activo para trabajar")
        if employee.employment_status_id:
            status = self.db.get(XEmployeeStatus, employee.employment_status_id)
            if status and not status.allows_check_in:
                raise HTTPException(status_code=422, detail="Estado laboral no permite check-in")
