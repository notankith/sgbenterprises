import os

from dotenv import load_dotenv
from pymongo import MongoClient

load_dotenv()

MONGO_URI = os.getenv("MONGODB_URI") or os.getenv("MONGO_URI")

if not MONGO_URI:
    raise Exception("Missing MONGODB_URI (or MONGO_URI) in .env")

client = MongoClient(MONGO_URI)

db_names = client.list_database_names()

if not db_names:
    print("No databases found. Nothing to reset.")
else:
    print("Dropping all MongoDB databases...")
    for db_name in db_names:
        print(f" - Dropping database: {db_name}")
        client.drop_database(db_name)

    print("MongoDB full reset completed.")
    remaining = client.list_database_names()
    if remaining:
        print(f"Remaining databases: {remaining}")
    else:
        print("No databases remain.")