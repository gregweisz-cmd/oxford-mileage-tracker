# Senior Staff Approval – Design Decisions

This document records the design decisions for the Senior Staff → Supervisor → Finance approval flow. Use it as the source of truth when changing workflow, validations, or UI.

---

## 1. Org structure in data

| Question | Decision |
|----------|----------|
| For a **Staff** person (reports to Senior Staff): what should `supervisorId` be? | Staff have **both** `seniorStaffId` and `supervisorId`. `supervisorId` = org Supervisor (the person above the Senior Staff). |
| For **Senior Staff**: should `supervisorId` always be the org Supervisor they report to? | **Yes.** |
| Any employees who have only a Supervisor (no Senior Staff)? Current behavior: report goes straight to Supervisor → Finance. | **Yes, keep.** |

---

## 2. Who is in “Supervisor’s team”?

| Question | Decision |
|----------|----------|
| Supervisor’s team list should include: (A) Only direct reports, or (B) Everyone under them? | **(B)** Everyone under them (Senior Staff + all Staff under those Senior Staff). Current code does (B) recursively. |
| Senior Staff’s team = everyone with `seniorStaffId` = that person. | **Keep as-is.** |

---

## 3. Visibility vs approval

| Question | Decision |
|----------|----------|
| Should Supervisors see reports that are still at Senior Staff (e.g. “Pending at Senior Staff”) for their team? | **Yes.** |
| If Yes: separate section or mixed? | **Mixed with notation** (e.g. “Waiting on Senior Staff” in the same list). |
| “View and control their team” – what does “control” include? | Supervisors can **assign who is Senior Staff** for someone (e.g. task delegation even if title doesn’t change). They approve/request revision when it’s their turn. |

---

## 4. Revisions

| Question | Decision |
|----------|----------|
| When **Supervisor** requests a revision (report had already passed Senior Staff): send back to (A) Senior Staff, or (B) Employee? | **(A) Senior Staff.** Senior Staff can then send back to Staff if needed. |
| When **Senior Staff** requests a revision: always send back to Employee? | **Yes.** |
| When **Finance** requests a revision: keep current behavior? | **Yes:** back to Supervisor; Supervisor can resubmit to Finance or send to Employee. When Supervisor requests revision, it goes back to **Senior Staff**, then Senior Staff can send to **Staff**. |

---

## 5. Edge cases

| Question | Decision |
|----------|----------|
| Employee has **no** `seniorStaffId`: report goes Supervisor → Finance. | **Keep.** |
| Employee has **no** `supervisorId` but has `seniorStaffId`? | **Everyone except CEO (e.g. Kathleen Gibson) must have a supervisor.** If missing, we need to assign one. |
| Same person as both Senior Staff and Supervisor for an employee? | **No.** Prevent it; if attempted, show validation error. |

---

## 6. Docs and UI

| Question | Decision |
|----------|----------|
| Update `APPROVAL_WORKFLOW_FIXES.md` to describe Senior Staff → Supervisor → Finance? | **Yes.** |
| UI naming for portals? | **Supervisor Portal** and **Senior Staff Portal.** |
| Other places that should mention Senior Staff role? | **No** (beyond admin guides). |

---

## 7. Summary

- **Approval order:** Staff → [Senior Staff] → Supervisor → Finance. **Confirmed.**
- **Senior Staff’s team:** Employees where `seniorStaffId` = that Senior Staff. **Confirmed.**
- **Supervisor’s team:** Everyone below them (recursive), including Senior Staff and Staff under those Senior Staff.
- **Supervisor sees reports at Senior Staff:** Yes; **mixed list with notation** (e.g. “Waiting on Senior Staff”).
- **Revision from Supervisor:** Send back to **Senior Staff**; Senior Staff can send back to **Staff**.

---

## Implementation checklist (from this design)

- [x] Design doc (this file) and update `APPROVAL_WORKFLOW_FIXES.md`.
- [x] Supervisor portal: show `pending_senior_staff` reports for their team in the same list with “Waiting on Senior Staff” notation.
- [x] Senior Staff field: Admin employee edit has `seniorStaffId`; supervisors who can edit their team in Admin can set it. Optional later: "Assign Senior Staff" in Supervisor portal Team tab.
- [x] Validation: require `supervisorId` for all employees except CEO (role or position contains "ceo").
- [x] Validation: reject save when `supervisorId === seniorStaffId` (same person cannot be both).
- [x] Portal switcher: use “Supervisor Portal” and “Senior Staff Portal” naming; description copy as agreed.
