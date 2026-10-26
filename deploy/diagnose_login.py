"""
Diagnose Login Issues — Standalone Tool
========================================
Runs a full health-check of the local install and tells you exactly
where the login problem is.

Checks:
  1. Can we reach the local MongoDB?
  2. Does the 'admin' user exist?
  3. Does admin/admin123 actually verify against the stored hash?
  4. Is the local FastAPI server up on port 5599?
  5. Does POST /api/auth/login with admin/admin123 succeed?
  6. What is this PC's LAN IP? (for other devices to reach it)
"""
from __future__ import annotations

import hashlib
import json
import socket
import sys
import urllib.request
import urllib.error
from pathlib import Path


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


def hash_password(password: str, salt: str) -> str:
    return hashlib.sha256(f"{salt}:{password}".encode("utf-8")).hexdigest()


def get_lan_ips() -> list[str]:
    """Return all non-loopback IPv4 addresses of this machine."""
    ips: list[str] = []
    try:
        for info in socket.getaddrinfo(socket.gethostname(), None, family=socket.AF_INET):
            ip = info[4][0]
            if ip and not ip.startswith("127.") and ip not in ips:
                ips.append(ip)
    except Exception:
        pass
    # Fallback method
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
        s.close()
        if ip not in ips:
            ips.append(ip)
    except Exception:
        pass
    return ips


def main() -> int:
    env = load_env()
    mongo_url = env.get("MONGO_URL", "mongodb://localhost:27017")
    db_name = env.get("DB_NAME", "electronic_archive")

    # --- Check 1: MongoDB ---
    banner("1) Checking MongoDB ...")
    print(f"   MONGO_URL = {mongo_url}")
    print(f"   DB_NAME   = {db_name}")
    try:
        from pymongo import MongoClient
        client = MongoClient(mongo_url, serverSelectionTimeoutMS=4000)
        client.admin.command("ping")
        db = client[db_name]
        print("   [OK] MongoDB is reachable.")
    except ImportError:
        print("   [FAIL] pymongo not installed. Run: pip install pymongo")
        return 1
    except Exception as exc:
        print(f"   [FAIL] Cannot reach MongoDB: {exc}")
        print("          Fix: Open CMD as Administrator and run:")
        print("               net start MongoDB")
        return 2

    # --- Check 2: admin user exists? ---
    banner("2) Checking 'admin' user in database ...")
    admin = db.users.find_one({"username": "admin"})
    if not admin:
        print("   [FAIL] User 'admin' does NOT exist in the database.")
        print("          Fix: Run reset_admin_password.bat to create it.")
        return 3
    print("   [OK] User 'admin' exists.")
    print(f"        role   = {admin.get('role')}")
    print(f"        active = {admin.get('active')}")
    print(f"        has password_hash = {bool(admin.get('password_hash'))}")
    print(f"        has salt          = {bool(admin.get('salt'))}")

    # --- Check 3: does admin123 verify? ---
    banner("3) Checking if admin/admin123 verifies against stored hash ...")
    salt = admin.get("salt", "")
    stored_hash = admin.get("password_hash", "")
    if not stored_hash:
        print("   [FAIL] User record is missing password_hash.")
        print("          Fix: Run reset_admin_password.bat")
        return 4
    if stored_hash.startswith("$2"):
        import bcrypt
        matches = bcrypt.checkpw(b"admin123", stored_hash.encode("utf-8"))
    else:
        matches = hash_password("admin123", salt) == stored_hash
    if matches:
        print("   [OK] admin / admin123 matches.")
    else:
        print("   [FAIL] admin/admin123 does NOT match the stored password.")
        print("          Someone changed the password.")
        print("          Fix: Run reset_admin_password.bat to reset it back.")
        return 5

    # --- Check 4: FastAPI server up on port 5599? ---
    banner("4) Checking FastAPI server on http://localhost:5599 ...")
    try:
        with urllib.request.urlopen("http://localhost:5599/api/health", timeout=3) as resp:
            body = resp.read().decode("utf-8", "ignore")
            print(f"   [OK] Server responded ({resp.status}): {body[:100]}")
    except urllib.error.URLError as exc:
        print(f"   [FAIL] Cannot reach http://localhost:5599 — {exc.reason}")
        print("          Fix: Run start_server.bat")
        return 6
    except Exception as exc:
        print(f"   [FAIL] {exc}")
        print("          Fix: Run start_server.bat")
        return 6

    # --- Check 5: Real login attempt over HTTP ---
    banner("5) Trying actual login via HTTP (admin / admin123) ...")
    req = urllib.request.Request(
        "http://localhost:5599/api/auth/login",
        data=json.dumps({"username": "admin", "password": "admin123"}).encode("utf-8"),
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=5) as resp:
            data = json.loads(resp.read().decode("utf-8", "ignore"))
            print(f"   [OK] HTTP login SUCCESS! Token issued.")
            print(f"        user: {data.get('user', {}).get('username')} ({data.get('user', {}).get('role')})")
    except urllib.error.HTTPError as exc:
        body = exc.read().decode("utf-8", "ignore")
        print(f"   [FAIL] HTTP {exc.code}: {body[:200]}")
        return 7
    except Exception as exc:
        print(f"   [FAIL] {exc}")
        return 7

    # --- Check 6: LAN IPs ---
    banner("6) Your LAN IP addresses (use these on OTHER devices)")
    ips = get_lan_ips()
    if not ips:
        print("   [WARN] Could not detect any non-loopback IP address.")
    else:
        for ip in ips:
            print(f"   http://{ip}:5599")

    banner("DIAGNOSIS COMPLETE — Everything looks healthy on this PC.")
    print()
    print("If OTHER devices on the LAN still cannot log in:")
    print("  a) Make sure the Firewall is open:")
    print("     Right-click deploy/enable_lan_access.bat -> Run as administrator")
    print()
    print("  b) On the OTHER device, HARD-REFRESH the browser:")
    print("     Press Ctrl + Shift + R   (or Ctrl + F5)")
    print("     This clears the cached old JavaScript.")
    print()
    print("  c) On the OTHER device, open Developer Tools (F12) -> Network tab.")
    print("     Try to log in. Check the 'login' request URL.")
    print("     It MUST point to http://<this-PC-IP>:5599/api/auth/login")
    print("     If it points anywhere else, the browser is still using cached old JS.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
