"""
نسخة احتياطية تلقائية قبل أي تحديث — Pre-update backup
- يصدّر كل جداول قاعدة البيانات المحلية (MongoDB) إلى ملفات JSON
- ينسخ مجلد المستندات backend/storage وملفات الإعدادات .env
لا يحذف أي شيء أبداً. يعيد رمز خطأ 1 إذا فشل النسخ، حتى يتوقف التحديث.

Usage: python backup_data.py <APP_DIR> [BACKUP_ROOT]
"""
from __future__ import annotations

import shutil
import sys
from datetime import datetime
from pathlib import Path


def read_env(path: Path) -> dict:
    env: dict = {}
    if path.exists():
        for line in path.read_text(encoding="utf-8", errors="ignore").splitlines():
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                k, v = line.split("=", 1)
                env[k.strip()] = v.strip().strip('"').strip("'")
    return env


def main() -> int:
    app_dir = Path(sys.argv[1] if len(sys.argv) > 1 else Path(__file__).resolve().parent.parent).resolve()
    backup_root = Path(sys.argv[2]) if len(sys.argv) > 2 else app_dir.parent / "ElectronicArchive_Backups"
    target = backup_root / datetime.now().strftime("%Y%m%d_%H%M%S")
    target.mkdir(parents=True, exist_ok=True)
    print(f"[backup] المجلد: {target}")

    for rel in ("backend/.env", "frontend/.env"):
        src = app_dir / rel
        if src.exists():
            shutil.copy2(src, target / rel.replace("/", "_"))
    storage = app_dir / "backend" / "storage"
    if storage.exists():
        shutil.copytree(storage, target / "storage", ignore=shutil.ignore_patterns("tmp"))
        print("[backup] تم نسخ المستندات (storage)")

    env = read_env(app_dir / "backend" / ".env")
    mongo_url = env.get("MONGO_URL", "mongodb://localhost:27017")
    db_name = env.get("DB_NAME")
    if not db_name:
        print("[backup] لا يوجد DB_NAME في backend/.env — تخطي قاعدة البيانات (تثبيت جديد)")
        return 0
    try:
        from bson import json_util
        from pymongo import MongoClient
    except ImportError:
        print("[backup] ✗ مكتبة pymongo غير مثبتة: python -m pip install pymongo")
        return 1
    try:
        client = MongoClient(mongo_url, serverSelectionTimeoutMS=8000)
        db = client[db_name]
        names = db.list_collection_names()
    except Exception as exc:  # noqa: BLE001
        print(f"[backup] ✗ تعذّر الاتصال بقاعدة البيانات: {exc}")
        print("         شغّل خدمة MongoDB ثم أعد المحاولة. لم يتم تعديل أي شيء.")
        return 1
    db_dir = target / "database"
    db_dir.mkdir(exist_ok=True)
    total = 0
    for name in names:
        docs = list(db[name].find({}))
        (db_dir / f"{name}.json").write_text(json_util.dumps(docs, ensure_ascii=False), encoding="utf-8")
        total += len(docs)
        print(f"[backup]   {name}: {len(docs)}")
    print(f"[backup] ✓ تم حفظ {len(names)} جدول / {total} سجل في: {db_dir}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
