"""
Diagnose LAN Access — Standalone Tool
=======================================
Checks why other devices on the LAN cannot reach the server.

Checks:
  1. What IP addresses does this machine have?
  2. Is uvicorn bound to 0.0.0.0 (LAN-accessible) or 127.0.0.1 (localhost only)?
  3. Does the API respond on every LAN IP (not just localhost)?
  4. Is the Windows Firewall rule for port 5599 active?
  5. Suggest the exact URL to use on the other device.
"""
from __future__ import annotations

import json
import socket
import subprocess
import sys
import urllib.request
import urllib.error


def banner(text: str) -> None:
    print()
    print("=" * 60)
    print(f"  {text}")
    print("=" * 60)


def get_lan_ips() -> list[str]:
    ips: list[str] = []
    try:
        for info in socket.getaddrinfo(socket.gethostname(), None, family=socket.AF_INET):
            ip = info[4][0]
            if ip and not ip.startswith("127.") and ip not in ips:
                ips.append(ip)
    except Exception:
        pass
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


def http_get(url: str, timeout: float = 3.0) -> tuple[int | None, str]:
    try:
        with urllib.request.urlopen(url, timeout=timeout) as resp:
            return resp.status, resp.read(200).decode("utf-8", "ignore")
    except urllib.error.HTTPError as exc:
        return exc.code, exc.reason
    except urllib.error.URLError as exc:
        return None, str(exc.reason)
    except Exception as exc:  # noqa: BLE001
        return None, str(exc)


def check_port_listening(port: int) -> tuple[list[str], list[str]]:
    """Run netstat and return (bound_addresses, error_lines)."""
    bound: list[str] = []
    errors: list[str] = []
    try:
        result = subprocess.run(
            ["netstat", "-ano", "-p", "TCP"],
            capture_output=True,
            text=True,
            timeout=5,
        )
        for line in result.stdout.splitlines():
            line = line.strip()
            if f":{port}" in line and "LISTENING" in line.upper():
                parts = line.split()
                if len(parts) >= 2:
                    bound.append(parts[1])
    except Exception as exc:  # noqa: BLE001
        errors.append(str(exc))
    return bound, errors


def check_firewall_rule(port: int) -> bool:
    """Returns True if an inbound 'allow' rule for the port exists."""
    try:
        result = subprocess.run(
            ["netsh", "advfirewall", "firewall", "show", "rule", "name=all", "verbose"],
            capture_output=True,
            text=True,
            timeout=15,
        )
        text = result.stdout
        # Crude but effective: look for our rule name OR any allow-rule mentioning 5599.
        if "Electronic Archive" in text:
            return True
        # Otherwise scan for any inbound allow rule on this port.
        lines = text.splitlines()
        found = False
        block = []
        for line in lines + [""]:
            if not line.strip():
                joined = "\n".join(block)
                if (
                    f"LocalPort:" in joined
                    and str(port) in joined
                    and "Direction:" in joined
                    and "In" in joined
                    and "Action:" in joined
                    and "Allow" in joined
                ):
                    found = True
                    break
                block = []
            else:
                block.append(line)
        return found
    except Exception:
        return False


def main() -> int:
    port = 5599

    banner("1) Your machine's IP addresses")
    ips = get_lan_ips()
    if not ips:
        print("   [WARN] Could not detect any LAN IP.")
        print("   Make sure you are connected to Wi-Fi or Ethernet.")
    else:
        for ip in ips:
            print(f"   IP: {ip}")

    banner("2) Is the server listening on every interface (0.0.0.0)?")
    bound, err = check_port_listening(port)
    if err:
        for e in err:
            print(f"   [WARN] netstat error: {e}")
    if not bound:
        print(f"   [FAIL] No process is listening on TCP {port}.")
        print(f"          Fix: Run start_server.bat first.")
        return 1
    print("   Bound addresses:")
    has_zero = False
    has_loopback_only = True
    for b in bound:
        print(f"     - {b}")
        if b.startswith("0.0.0.0:") or b.startswith("[::]:"):
            has_zero = True
            has_loopback_only = False
        elif not b.startswith("127.") and not b.startswith("[::1]"):
            has_loopback_only = False
    if has_zero:
        print("   [OK] Listening on 0.0.0.0 — LAN-accessible.")
    elif has_loopback_only:
        print("   [FAIL] Listening ONLY on localhost (127.0.0.1).")
        print("          Other devices cannot reach it.")
        print("          Fix: edit health_loop.bat and set HOST=0.0.0.0")
        return 2
    else:
        print("   [OK] Listening on a specific LAN IP — LAN-accessible.")

    banner("3) Does the API respond on each of your LAN IPs?")
    any_ok = False
    for ip in ips:
        url = f"http://{ip}:{port}/api/health"
        status, body = http_get(url)
        if status == 200:
            print(f"   [OK] {url}  ->  {body[:80]}")
            any_ok = True
        else:
            print(f"   [FAIL] {url}  ->  {body}")
    if not any_ok:
        print()
        print("   The server is up locally but not reachable on your own LAN IP.")
        print("   This is almost always the Windows Firewall.")
        print("   Fix: Right-click deploy/enable_lan_access.bat -> Run as administrator")

    banner("4) Windows Firewall — is port 5599 allowed inbound?")
    if check_firewall_rule(port):
        print(f"   [OK] An inbound allow-rule for port {port} appears to exist.")
    else:
        print(f"   [FAIL] No inbound allow-rule for port {port} was found.")
        print("          Fix: Right-click deploy/enable_lan_access.bat -> Run as administrator")

    banner("5) URLs to use on OTHER devices on the same Wi-Fi / LAN")
    if not ips:
        print("   (No LAN IP detected — see step 1.)")
    else:
        for ip in ips:
            print(f"   http://{ip}:{port}")
        print()
        print("   Important on the OTHER device:")
        print("     - Make sure it is on the SAME Wi-Fi network / router.")
        print("     - Press Ctrl + Shift + R to force-reload the browser cache.")
        print("     - Or open Private/Incognito window the first time.")

    banner("Quick sanity check from another machine (Windows)")
    if ips:
        print(f"   On the OTHER PC, open CMD and run:")
        print(f"       ping {ips[0]}")
        print(f"       telnet {ips[0]} {port}")
        print()
        print("   - ping must succeed -> both PCs share the same network.")
        print("   - telnet must connect (blank screen) -> port 5599 is reachable.")
        print("     If telnet fails: Firewall is still blocking. Re-run enable_lan_access.bat.")

    print()
    return 0


if __name__ == "__main__":
    sys.exit(main())
