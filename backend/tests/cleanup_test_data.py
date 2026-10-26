import os, requests
from pymongo import MongoClient
API = os.environ["REACT_APP_BACKEND_URL"].rstrip("/") + "/api"
db = MongoClient("mongodb://localhost:27017")["test_database"]
deps = [d["id"] for d in db.departments.find({"name": {"$regex": "^TEST_"}})]
mids = [m["id"] for m in db.members.find({"department_id": {"$in": deps}})]
print("aid_benef", db.aid_beneficiaries.delete_many({"member_id": {"$in": mids}}).deleted_count)
print("aids", db.aids.delete_many({"department_id": {"$in": deps}}).deleted_count)
print("members", db.members.delete_many({"department_id": {"$in": deps}}).deleted_count)
print("deps", db.departments.delete_many({"id": {"$in": deps}}).deleted_count)
uids = [u["id"] for u in db.users.find({"username": {"$regex": "^TEST_"}})]
db.sessions.delete_many({"user_id": {"$in": uids}})
print("users", db.users.delete_many({"id": {"$in": uids}}).deleted_count)
print("lockouts", db.login_attempts.delete_many({}).deleted_count)
