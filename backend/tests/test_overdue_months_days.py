# Overdue reports: owed_months precision (4 decimals) & consistency with owed/(members*3)
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
DEPT = "cf96258b-cf60-4cba-8717-c4ce92fcd48a"
RATE = 3.0
FROM, TO = "2026-01-01", "2026-06-30"


def months_days(v):
    total = max(0, round(float(v or 0) * 30))
    return total // 30, total % 30


@pytest.fixture(scope="module")
def client():
    s = requests.Session()
    r = s.post(f"{BASE_URL}/api/auth/login", json={"username": "admin", "password": "admin123"})
    if r.status_code != 200:
        pytest.skip(f"login failed {r.status_code}")
    s.headers["Authorization"] = f"Bearer {r.json()['token']}"
    return s


@pytest.fixture(scope="module")
def all_govs(client):
    r = client.get(f"{BASE_URL}/api/reports/disclosure/all-governorates-overdue",
                   params={"department_id": DEPT, "from_date": FROM, "to_date": TO})
    assert r.status_code == 200, r.text
    return r.json()


def _check(row):
    om = row["owed_months"]
    assert isinstance(om, (int, float))
    if row["members"] > 0:
        expected = round(row["owed"] / (row["members"] * RATE), 4)
        assert abs(om - expected) < 1e-4, (row, expected)
    else:
        assert om == 0
    # precision is at most 4 decimals
    assert abs(round(om, 4) - om) < 1e-9


class TestAllGovsOverdue:
    def test_structure(self, all_govs):
        assert "governorates" in all_govs and "grand_total" in all_govs
        assert all_govs["monthly_rate"] == RATE
        assert all_govs["months"] == 6
        print("govs:", len(all_govs["governorates"]))

    def test_rows_months(self, all_govs):
        n = 0
        for g in all_govs["governorates"]:
            for c in g["committees"]:
                _check(c)
                assert c["owed"] > 0
                assert abs(c["expected"] - c["members"] * RATE * all_govs["months"]) < 0.01
                n += 1
            _check(g["subtotal"])
        _check(all_govs["grand_total"])
        print("committee rows checked:", n)

    def test_subtotals_sum(self, all_govs):
        for g in all_govs["governorates"]:
            s = g["subtotal"]
            assert s["members"] == sum(c["members"] for c in g["committees"])
            assert abs(s["owed"] - sum(c["owed"] for c in g["committees"])) < 0.02

    def test_some_fractional_days(self, all_govs):
        fr = [c for g in all_govs["governorates"] for c in g["committees"] if months_days(c["owed_months"])[1] > 0]
        print("rows with non-zero days:", len(fr))


class TestGovAndCommitteeOverdue:
    def test_gov_overdue_matches_all(self, client, all_govs):
        if not all_govs["governorates"]:
            pytest.skip("no data")
        g = all_govs["governorates"][0]
        r = client.get(f"{BASE_URL}/api/reports/disclosure/governorate-overdue",
                       params={"department_id": DEPT, "governorate": g["governorate"], "from_date": FROM, "to_date": TO})
        assert r.status_code == 200
        d = r.json()
        for row in d["rows"]:
            _check(row)
        _check(d["totals"])
        m = {c["union_committee"]: c["owed_months"] for c in g["committees"]}
        for row in d["rows"]:
            if row["union_committee"] in m:
                assert abs(row["owed_months"] - m[row["union_committee"]]) < 1e-4

    def test_committee_overdue(self, client, all_govs):
        if not all_govs["governorates"]:
            pytest.skip("no data")
        g = all_govs["governorates"][0]
        c = g["committees"][0]
        r = client.get(f"{BASE_URL}/api/reports/disclosure/committee-overdue",
                       params={"department_id": DEPT, "governorate": g["governorate"],
                               "union_committee": c["union_committee"], "from_date": FROM, "to_date": TO})
        assert r.status_code == 200
        d = r.json()
        _check(d)
        assert d["members"] == c["members"]
        assert abs(d["owed_months"] - c["owed_months"]) < 1e-4

    def test_missing_params_400(self, client):
        r = client.get(f"{BASE_URL}/api/reports/disclosure/all-governorates-overdue",
                       params={"department_id": DEPT, "from_date": "", "to_date": TO})
        assert r.status_code == 400

    def test_requires_auth(self):
        r = requests.get(f"{BASE_URL}/api/reports/disclosure/all-governorates-overdue",
                         params={"department_id": DEPT, "from_date": FROM, "to_date": TO})
        assert r.status_code in (401, 403)
