"""
Reset Admin Password — Standalone Tool
========================================
Resets the local MongoDB 'admin' user password to a known value.
Usage:
    python reset_admin_password.py
    OR double-click reset_admin_password.bat (Windows)

Reads MONGO_URL and DB_NAME from backend/.env in the same install.
"""
from __future__ import annotations

import hashlib
import os
import sys
import uuid
from pathlib import Path

DEFAULT_NEW_PASSWORD = "admin123"


def hash_password(password: str, salt: str | None = None) -> dict:
    password_salt = salt or uuid.uuid4().hex
    digest = hashlib.sha256(f"{password_salt}:{password}".encode("utf-8")).hexdigest()
    return {"salt": password_salt, "password_hash": digest}


def load_env() -> dict:
    """Read MONGO_URL / DB_NAME from backend/.env next to this script."""
    here = Path(__file__).resolve().parent
    candidates = [here / "backend" / ".env", here.parent / "backend" / ".env", here / ".env"]
    env: dict = {}
    for path in candidates:
        if path.exists():
            for line in path.read_text(encoding="utf-8").splitlines():
                line = line.strip()
                if not line or line.startswith("#") or "=" not in line:
                    continue
                k, v = line.split("=", 1)
                env[k.strip()] = v.strip().strip('"').strip("'")
            break
    return env


def main() -> int:
    env = load_env()
    mongo_url = env.get("MONGO_URL", "mongodb://localhost:27017")
    db_name = env.get("DB_NAME", "electronic_archive")

    print(f"Connecting to: {mongo_url}")
    print(f"Database     : {db_name}")
    print()

    try:
        from pymongo import MongoClient
    except ImportError:
        print("[ERROR] pymongo not installed. Run: pip install pymongo")
        return 1

    client = MongoClient(mongo_url, serverSelectionTimeoutMS=5000)
    try:
        client.admin.command("ping")
    except Exception as exc:  # noqa: BLE001
        print(f"[ERROR] Cannot reach MongoDB: {exc}")
        print("        Make sure MongoDB service is running: net start MongoDB")
        return 2

    db = client[db_name]

    # Ask which username to reset (default = admin)
    username = input("Username to reset [admin]: ").strip() or "admin"

    new_password = input(f"New password [{DEFAULT_NEW_PASSWORD}]: ").strip() or DEFAULT_NEW_PASSWORD
    if len(new_password) < 4:
        print("[ERROR] Password must be at least 4 characters.")
        return 3

    user = db.users.find_one({"username": username})
    if not user:
        print(f"\n[INFO] User '{username}' not found. Creating a new super_admin account...")
        pwd = hash_password(new_password)
        db.users.insert_one({
            "id": uuid.uuid4().hex,
            "username": username,
            "display_name": "Administrator",
            "role": "super_admin",
            "active": True,
            "portal_permissions": [],
            "salt": pwd["salt"],
            "password_hash": pwd["password_hash"],
            "created_at": "",
        })
        print(f"[OK] Created '{username}' with role super_admin and the password you entered.")
    else:
        pwd = hash_password(new_password)
        result = db.users.update_one(
            {"username": username},
            {"$set": {
                "salt": pwd["salt"],
                "password_hash": pwd["password_hash"],
                "active": True,
            }},
        )
        if result.modified_count:
            print(f"\n[OK] Password for '{username}' has been reset.")
        else:
            print(f"\n[WARN] No change applied (user found but update returned 0).")

    print()
    print("=" * 60)
    print(f"  Username : {username}")
    print(f"  Password : {new_password}")
    print("=" * 60)
    print()
    print("You can now log in with these credentials.")
    print("Please change the password again from the Admin → Users page after login.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
