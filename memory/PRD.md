# PRD — member.union (أرشيف أعضاء النقابة)

## Original problem statement
استيراد https://github.com/Fraction2026/member.union — approved plan phase 1: import & run, fix portal-permission checkboxes and inheritance display, harden security (bcrypt with legacy auto-upgrade, login lockout, approved origins, Arabic errors), Windows local run on port 5599, update scripts never wipe data + automatic backup.

## Architecture
FastAPI (backend/server.py + services/) + MongoDB + React (CRA/craco, Arabic RTL). Locally on Windows the backend serves frontend/build on port 5599.

## Implemented (2026-06)
- Imported repo; installed deps + tesseract/poppler for PDF OCR.
- Users page: portal block scrollable dialog, independent portal list loading (/api/settings), hidden for admin/super_admin.
- Inheritance calculator + case research form: الفرض الأصلي، النسبة الشرعية، الرد، النسبة النهائية، نوع الاستحقاق; saved total amount restored on reopen.
- Security: bcrypt hashing, legacy SHA256 accepted & upgraded on login; per-username lockout 5 fails → 15 min; CORS from CORS_ORIGINS env; Arabic 422/500 messages; login page shows backend detail.
- Windows: all ports 8090→5599; UPDATE.ps1 safe updater (mandatory DB+storage+.env backup via deploy/backup_data.py, robocopy without delete, keeps .env/DB_NAME, builds frontend, starts on 5599). Other update/install .ps1 are wrappers to UPDATE.ps1. update.bat / quick_start.bat back up first. All .ps1 saved UTF-8 BOM (PowerShell 5 Arabic fix).

## Backlog
- P1 (Phase 2): recycle bin instead of hard delete; audit log of sensitive actions; mobile layout.
- One-line updater: release/update.ps1 (iex/irm) + prebuilt package release/member_union_update.zip (backend + deploy + frontend/build, no Node needed). Rebuild zip after code changes: `REACT_APP_BACKEND_URL= yarn build` then zip backend/server.py, services, requirements-local.txt, deploy/, frontend/build.

- P2 (Phase 3): scheduled automatic backup; reports dashboard/charts; bulk edit/delete.
- Tech: restore tool for backup_data.py JSON dumps; split server.py.
