import os
from pymongo import MongoClient
from dotenv import load_dotenv
import json
from bson.json_util import dumps

load_dotenv()

MONGO_URI = os.getenv("MONGODB_URI")

if not MONGO_URI:
    raise Exception("Missing MONGO_URI in .env")

client = MongoClient(MONGO_URI)

# Get all databases
SYSTEM_DBS = ["admin", "local", "config"]

for db_name in client.list_database_names():
    if db_name in SYSTEM_DBS:
        continue

    db = client[db_name]
    print(f"\n📦 DATABASE: {db_name}")

    collections = db.list_collection_names()

    if not collections:
        print("  No collections found.")
        continue

    print("\n📦 Collections:")
    for col in collections:
        print(f" - {col}")

    print("\n📄 Sample Documents:")
    for col in collections:
        collection = db[col]
        doc = collection.find_one()

        print(f"\n🔹 {col}:")

        if doc:
            # Convert ObjectId to string for clean JSON
            doc["_id"] = str(doc["_id"])
            print(dumps(doc, indent=2))
        else:
            print("  (empty collection)")