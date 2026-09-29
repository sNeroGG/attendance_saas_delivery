from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.models import HrEmployee, XEmployeeRole, XRule


class RuleEngineService:
    def __init__(self, db: Session, company_id: int):
        self.db = db
        self.company_id = company_id

    def get_applicable_rules(self, employee_id: int, context: dict) -> list[XRule]:
        employee = self.db.get(HrEmployee, employee_id)
        if not employee or employee.company_id != self.company_id:
            return []
        role_ids = [row.role_id for row in self.db.query(XEmployeeRole).filter_by(employee_id=employee_id).all()]
        rules = (
            self.db.query(XRule)
            .filter(XRule.company_id == self.company_id, XRule.active.is_(True))
            .order_by(XRule.priority, XRule.id)
            .all()
        )
        applicable = []
        for rule in rules:
            if rule.employee_id and rule.employee_id != employee_id:
                continue
            if rule.role_id and rule.role_id not in role_ids:
                continue
            if rule.branch_id and rule.branch_id != (context.get("branch_id") or employee.branch_id):
                continue
            if rule.event_type_id and rule.event_type_id != context.get("event_type_id"):
                continue
            applicable.append(rule)
        return applicable

    def get_best_rule(self, employee_id: int, rule_type: str, context: dict) -> XRule | None:
        rules = [rule for rule in self.get_applicable_rules(employee_id, context) if rule.rule_type == rule_type]
        if not rules:
            return None
        def scope_rank(rule: XRule) -> int:
            if rule.employee_id:
                return 0
            if rule.role_id:
                return 1
            if rule.branch_id:
                return 2
            return 3
        return sorted(rules, key=lambda rule: (scope_rank(rule), rule.priority, rule.id))[0]

    def assignment_rules(self, employee_id: int, context: dict) -> list[XRule]:
        return [rule for rule in self.get_applicable_rules(employee_id, context) if rule.rule_type == "assignment" and rule.assignment_template_id]

    def should_block_check_in(self, employee_id: int) -> bool:
        rule = self.get_best_rule(employee_id, "attendance", {})
        return bool(rule and rule.blocks_check_in)

    def should_block_check_out(self, employee_id: int, shift_id: int) -> bool:
        from app.models import XEmployeeAssignment
        pending = (
            self.db.query(XEmployeeAssignment)
            .filter(
                XEmployeeAssignment.company_id == self.company_id,
                XEmployeeAssignment.employee_id == employee_id,
                XEmployeeAssignment.blocks_check_out.is_(True),
                XEmployeeAssignment.state.in_(["pending", "in_progress", "validation_pending", "rejected"]),
                or_(
                    XEmployeeAssignment.shift_id == shift_id,
                    XEmployeeAssignment.shift_id.is_(None),
                ),
            )
            .first()
        )
        return pending is not None
