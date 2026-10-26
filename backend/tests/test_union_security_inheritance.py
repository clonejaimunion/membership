# Regression tests: auth security (bcrypt, legacy upgrade, lockout, Arabic errors, CORS),
# user portal permissions, inheritance calculator (radd), case-form beneficiaries, departments CRUD smoke.
import os
import re
import uuid
import hashlib
import secrets
import pytest
import requests
from pymongo import MongoClient

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
API = f"{BASE_URL}/api"
MONGO_URL = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = os.environ.get("DB_NAME", "test_database")
AR = re.compile(r"[\u0600-\u06FF]")


@pytest.fixture(scope="module")
def db():
    c = MongoClient(MONGO_URL)
    yield c[DB_NAME]
    c[DB_NAME].login_attempts.delete_many({})
    c[DB_NAME].users.delete_many({"username": {"$regex": "^TEST_"}})


@pytest.fixture(scope="module")
def admin_headers():
    r = requests.post(f"{API}/auth/login", json={"username": "admin", "password": "admin123"})
    assert r.status_code == 200, r.text
    return {"Authorization": f"Bearer {r.json()['token']}"}


# ---- Auth ----
class TestAuth:
    def test_admin_login(self, db):
        r = requests.post(f"{API}/auth/login", json={"username": "admin", "password": "admin123"})
        assert r.status_code == 200
        d = r.json()
        assert isinstance(d["token"], str) and len(d["token"]) > 20
        assert d["user"]["role"] == "super_admin"
        u = db.users.find_one({"username": "admin"})
        assert u["password_hash"].startswith("$2b$")

    def test_validation_arabic(self):
        r = requests.post(f"{API}/auth/login", json={"username": 1})
        assert r.status_code == 422
        det = r.json()["detail"]
        assert isinstance(det, str) and AR.search(det), det

    def test_wrong_password_arabic(self, db):
        uname = f"TEST_wp_{uuid.uuid4().hex[:6]}"
        r = requests.post(f"{API}/auth/login", json={"username": uname, "password": "x"})
        assert r.status_code == 401
        assert AR.search(r.json()["detail"])

    def test_lockout_after_5(self, db, admin_headers):
        uname = f"TEST_lock_{uuid.uuid4().hex[:6]}"
        r = requests.post(f"{API}/admin/users", headers=admin_headers, json={
            "username": uname, "display_name": "TEST lock", "password": "goodpass1", "role": "employee", "active": True})
        assert r.status_code == 200, r.text
        codes = []
        for _ in range(5):
            codes.append(requests.post(f"{API}/auth/login", json={"username": uname, "password": "bad"}).status_code)
        assert codes[:4] == [401] * 4 and codes[4] == 429, codes
        r = requests.post(f"{API}/auth/login", json={"username": uname, "password": "goodpass1"})
        assert r.status_code == 429
        assert AR.search(r.json()["detail"])
        db.login_attempts.delete_many({})
        r = requests.post(f"{API}/auth/login", json={"username": uname, "password": "goodpass1"})
        assert r.status_code == 200

    def test_legacy_hash_upgrade(self, db):
        uname = f"TEST_legacy_{uuid.uuid4().hex[:6]}"
        salt = secrets.token_hex(16)
        pw = "legacyPass9"
        db.users.insert_one({"id": str(uuid.uuid4()), "username": uname, "display_name": "TEST legacy",
                             "role": "employee", "active": True, "portal_permissions": [],
                             "salt": salt, "password_hash": hashlib.sha256(f"{salt}:{pw}".encode()).hexdigest(),
                             "created_at": "2026-01-01T00:00:00+00:00"})
        r = requests.post(f"{API}/auth/login", json={"username": uname, "password": pw})
        assert r.status_code == 200, r.text
        assert db.users.find_one({"username": uname})["password_hash"].startswith("$2b$")
        r2 = requests.post(f"{API}/auth/login", json={"username": uname, "password": pw})
        assert r2.status_code == 200
        r3 = requests.post(f"{API}/auth/login", json={"username": uname, "password": "wrong"})
        assert r3.status_code == 401

    def test_cors_allowed_and_blocked(self):
        ok = requests.options(f"{API}/auth/login", headers={"Origin": BASE_URL, "Access-Control-Request-Method": "POST"})
        assert ok.headers.get("access-control-allow-origin") == BASE_URL
        bad = requests.options(f"{API}/auth/login", headers={"Origin": "https://evil.example.com", "Access-Control-Request-Method": "POST"})
        assert bad.headers.get("access-control-allow-origin") != "https://evil.example.com"


# ---- Users portal permissions ----
class TestUserPortals:
    def test_create_update_portal_perms(self, admin_headers):
        uname = f"TEST_emp_{uuid.uuid4().hex[:6]}"
        r = requests.post(f"{API}/admin/users", headers=admin_headers, json={
            "username": uname, "display_name": "TEST emp", "password": "abcd1234", "role": "employee",
            "active": True, "portal_permissions": ["membership", "financial.pension", "bogus"]})
        assert r.status_code == 200, r.text
        u = r.json()
        assert set(u["portal_permissions"]) == {"membership", "financial.pension"}
        r = requests.put(f"{API}/admin/users/{u['id']}", headers=admin_headers, json={"portal_permissions": ["financial"]})
        assert r.status_code == 200, r.text
        lst = requests.get(f"{API}/admin/users", headers=admin_headers).json()
        me = [x for x in lst if x["id"] == u["id"]][0]
        assert me["portal_permissions"] == ["financial"]


# ---- Aid / inheritance / case-form ----
@pytest.fixture(scope="module")
def aid_ctx(admin_headers):
    d = requests.post(f"{API}/departments", headers=admin_headers, json={
        "name": f"TEST_dep_{uuid.uuid4().hex[:5]}", "code": "TST", "description": "TEST dept"}).json()
    m = requests.post(f"{API}/members", headers=admin_headers, json={
        "department_id": d["id"], "name": f"TEST عضو {uuid.uuid4().hex[:4]}", "national_id": str(uuid.uuid4().int)[:14],
        "birth_date": "1970-01-01", "membership_number": "T1"})
    assert m.status_code == 200, m.text
    m = m.json()
    s = requests.patch(f"{API}/members/{m['id']}/status", headers=admin_headers, json={"status": "متوفي"})
    assert s.status_code == 200, s.text
    aids = requests.get(f"{API}/aids", headers=admin_headers, params={"department_id": d["id"]}).json()
    if isinstance(aids, dict):
        aids = aids.get("items") or aids.get("aids") or []
    aid = [a for a in aids if a["member_id"] == m["id"]]
    assert aid, aids
    yield {"dep": d, "member": m, "aid": aid[0]}
    requests.delete(f"{API}/aids/{aid[0]['id']}", headers=admin_headers)
    requests.delete(f"{API}/members/{m['id']}", headers=admin_headers)
    requests.delete(f"{API}/departments/{d['id']}", headers=admin_headers)


class TestInheritance:
    def test_radd_wife_daughter(self, admin_headers, aid_ctx):
        r = requests.post(f"{API}/aids/{aid_ctx['aid']['id']}/calculate-beneficiaries", headers=admin_headers, json={
            "total_amount": 24000, "beneficiaries": [{"name": "TEST زوجة", "relation": "زوجة"}, {"name": "TEST ابنة", "relation": "ابنة"}]})
        assert r.status_code == 200, r.text
        res = r.json()["results"]
        print(res)
        wife = [x for x in res if x["relation"] == "زوجة"][0]
        dau = [x for x in res if x["relation"] == "ابنة"][0]
        assert wife["base_share_fraction"] == "1/8"
        assert dau["base_share_fraction"] == "1/2"
        assert dau["share_type"] == "فرض + رد"
        assert dau["radd_fraction"] and dau["final_share_fraction"] == "7/8"
        assert abs(wife["amount"] + dau["amount"] - 24000) < 0.01
        assert abs(wife["amount"] - 3000) < 0.01
        TestInheritance.res = res

    def test_save_and_case_form(self, admin_headers, aid_ctx):
        res = getattr(TestInheritance, "res", None)
        assert res
        r = requests.post(f"{API}/aids/{aid_ctx['aid']['id']}/save-beneficiaries", headers=admin_headers, json={
            "aid_id": aid_ctx["aid"]["id"], "total_amount": 24000, "beneficiaries": res, "summary_explanation": "TEST"})
        assert r.status_code == 200, r.text
        g = requests.get(f"{API}/aids/{aid_ctx['aid']['id']}/beneficiaries", headers=admin_headers).json()
        assert g["found"] and g["beneficiaries"][0]["base_share_fraction"]
        h = requests.get(f"{API}/members/{aid_ctx['member']['id']}/case-form", headers=admin_headers, params={"mode": "view"})
        assert h.status_code == 200
        html = h.text
        for col in ["الفرض الأصلي", "الرد", "النسبة النهائية", "نوع الاستحقاق"]:
            assert col in html, col
        assert "TEST ابنة" in html and "7/8" in html and "فرض + رد" in html


# ---- Departments CRUD smoke ----
class TestDepartments:
    def test_crud(self, admin_headers):
        r = requests.post(f"{API}/departments", headers=admin_headers, json={"name": "TEST_crud", "code": "TC", "description": "d"})
        assert r.status_code == 200
        did = r.json()["id"]
        r = requests.put(f"{API}/departments/{did}", headers=admin_headers, json={"name": "TEST_crud2", "code": "TC", "description": "d"})
        assert r.status_code == 200 and r.json()["name"] == "TEST_crud2"
        lst = requests.get(f"{API}/departments", headers=admin_headers).json()
        assert any(x["id"] == did for x in lst)
        r = requests.delete(f"{API}/departments/{did}", headers=admin_headers)
        assert r.status_code in (200, 204)

    def test_members_list(self, admin_headers):
        r = requests.get(f"{API}/members", headers=admin_headers)
        assert r.status_code == 200
