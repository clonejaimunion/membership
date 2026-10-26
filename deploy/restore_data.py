"""
Restore Data from Cloud — Standalone Tool
============================================
Downloads a full snapshot of your data from the cloud backend and
loads it into the LOCAL MongoDB. Use this once after migrating from
the cloud preview to a local install.

Usage:
    python restore_data.py
    OR double-click restore_data.bat
"""
from __future__ import annotations

import json
import sys
import urllib.request
import urllib.error
from pathlib import Path

CLOUD_BASE = "https://member-scan-test.preview.emergentagent.com"
USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) ElectronicArchiveRestore/1.0"


def banner(text: str) -> None:
    print()
    print("=" * 60)
    print(f"  {text}")
    print("=" * 60)


def load_env() -> dict:
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


def cloud_login(username: str, password: str) -> str:
    url = f"{CLOUD_BASE}/api/auth/login"
    print(f"  POST {url}")
    req = urllib.request.Request(
        url,
        data=json.dumps({"username": username, "password": password}).encode("utf-8"),
        headers={
            "Content-Type": "application/json",
            "Accept": "application/json",
            "User-Agent": USER_AGENT,
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=20) as resp:
            data = json.loads(resp.read().decode("utf-8"))
        return data["token"]
    except urllib.error.HTTPError as exc:
        body = exc.read().decode("utf-8", "ignore")[:300]
        raise RuntimeError(f"HTTP {exc.code} {exc.reason} — body: {body}") from exc


def fetch_snapshot(token: str) -> dict:
    url = f"{CLOUD_BASE}/api/admin/export-all-data"
    print(f"  GET  {url}")
    req = urllib.request.Request(
        url,
        headers={
            "Authorization": f"Bearer {token}",
            "Accept": "application/json",
            "User-Agent": USER_AGENT,
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=180) as resp:
            return json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        body = exc.read().decode("utf-8", "ignore")[:300]
        raise RuntimeError(f"HTTP {exc.code} {exc.reason} — body: {body}") from exc


def main() -> int:
    banner("Electronic Archive — Cloud → Local Data Restore")
    print(
        "This will download all your members, subscriptions, aids and admin\n"
        "data from the cloud backend and load them into your LOCAL MongoDB."
    )
    print()

    confirm = input("Continue? [Y/n]: ").strip().lower()
    if confirm not in ("", "y", "yes"):
        print("Cancelled.")
        return 0

    # --- Step 1: cloud login ---
    banner("Step 1: Login to the cloud backend")
    print("Enter your CLOUD admin credentials (the ones you have been using).")
    username = input("Cloud username [admin]: ").strip() or "admin"
    password = input("Cloud password [admin123]: ").strip() or "admin123"
    try:
        token = cloud_login(username, password)
        print("  [OK] Cloud login successful.")
    except Exception as exc:  # noqa: BLE001
        print(f"  [FAIL] {exc}")
        print()
        print("Diagnostic tips:")
        print("  - Double-check spelling of username and password.")
        print("  - HTTP 401 = wrong username/password.")
        print("  - HTTP 403 = the cloud admin account is suspended.")
        print("  - HTTP 502/503 = the cloud backend is temporarily down. Retry later.")
        return 1

    # --- Step 2: fetch snapshot ---
    banner("Step 2: Downloading the full data snapshot")
    try:
        snapshot = fetch_snapshot(token)
    except Exception as exc:  # noqa: BLE001
        print(f"  [FAIL] {exc}")
        return 2

    cols = snapshot.get("collections", {})
    print("  Snapshot received:")
    for name, docs in cols.items():
        if isinstance(docs, list):
            print(f"    - {name}: {len(docs)} record(s)")
        else:
            print(f"    - {name}: error -> {docs}")

    # Save a local backup file too (paranoia)
    here = Path(__file__).resolve().parent
    backup = here / "cloud_snapshot_backup.json"
    try:
        backup.write_text(json.dumps(snapshot, ensure_ascii=False, indent=2), encoding="utf-8")
        print(f"  [OK] Backup saved to: {backup}")
    except Exception as exc:  # noqa: BLE001
        print(f"  [WARN] Could not save backup file: {exc}")

    # --- Step 3: connect to local MongoDB ---
    banner("Step 3: Connecting to LOCAL MongoDB")
    env = load_env()
    mongo_url = env.get("MONGO_URL", "mongodb://localhost:27017")
    db_name = env.get("DB_NAME", "electronic_archive")
    print(f"  MONGO_URL = {mongo_url}")
    print(f"  DB_NAME   = {db_name}")

    try:
        from pymongo import MongoClient
    except ImportError:
        print("  [FAIL] pymongo not installed.")
        return 3

    client = MongoClient(mongo_url, serverSelectionTimeoutMS=5000)
    try:
        client.admin.command("ping")
    except Exception as exc:  # noqa: BLE001
        print(f"  [FAIL] Cannot reach MongoDB: {exc}")
        return 4
    print("  [OK] Local MongoDB reachable.")
    db = client[db_name]

    # --- Step 4: write data ---
    banner("Step 4: Writing data into LOCAL MongoDB")
    print()
    print("Choose how to handle existing local data in each collection:")
    print("  R = REPLACE  (delete local rows then insert from cloud) [default]")
    print("  M = MERGE    (insert cloud rows; keep existing locals)")
    print("  S = SKIP     (do not touch a collection that already has rows)")
    mode = (input("Mode [R/M/S, default R]: ").strip().upper() or "R")[:1]
    if mode not in ("R", "M", "S"):
        mode = "R"
    print(f"  Mode selected: {mode}")
    print()

    for name, docs in cols.items():
        if not isinstance(docs, list):
            print(f"  - {name}: skipped (export error)")
            continue
        local_count = db[name].count_documents({})
        if not docs:
            print(f"  - {name}: cloud has 0 rows, local={local_count} — skipped")
            continue
        if mode == "S" and local_count > 0:
            print(f"  - {name}: local has {local_count} rows — skipped (S mode)")
            continue
        if mode == "R" and local_count > 0:
            db[name].delete_many({})
        try:
            # Insert in batches of 500 for large collections.
            batch = 500
            inserted = 0
            for i in range(0, len(docs), batch):
                db[name].insert_many(docs[i:i + batch], ordered=False)
                inserted += min(batch, len(docs) - i)
            print(f"  - {name}: {inserted} row(s) imported (was {local_count})")
        except Exception as exc:  # noqa: BLE001
            print(f"  - {name}: insert error -> {exc}")

    banner("DONE")
    print("Your data has been restored to the LOCAL database.")
    print("Open http://localhost:5599 and log in with your usual credentials.")
    print()
    print("If something looks wrong, the full snapshot is saved at:")
    print(f"  {backup}")
    print("You can re-run this tool any time to re-import.")
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except KeyboardInterrupt:
        print("\nCancelled by user.")
        sys.exit(130)
