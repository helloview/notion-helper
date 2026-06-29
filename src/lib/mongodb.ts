import { MongoClient, type Db } from "mongodb";

let clientPromise: Promise<MongoClient> | null = null;

function getMongoUri() {
  const uri = process.env.MONGODB_URI;

  if (!uri) {
    throw new Error("MONGODB_URI is required. Add it to .env.local before running the app.");
  }

  return uri;
}

function getMongoClient() {
  if (!clientPromise) {
    clientPromise = new MongoClient(getMongoUri()).connect();
  }

  return clientPromise;
}

export async function getMongoDb(): Promise<Db> {
  const client = await getMongoClient();
  return client.db(process.env.MONGODB_DB ?? "notion_task_helper");
}
