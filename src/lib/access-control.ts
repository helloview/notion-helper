import "server-only";

import { randomUUID } from "node:crypto";
import type { Collection, WithId } from "mongodb";
import { getMongoDb } from "./mongodb";
import type { Assignee } from "./types";

export type AccessRole = "super_admin" | "admin" | "member";

export type AccessUser = {
  id: string;
  email: string;
  name: string;
  role: AccessRole;
  notionUserId?: string;
  active: boolean;
  bootstrap?: boolean;
  createdAt: string;
  updatedAt: string;
  createdBy?: string;
  updatedBy?: string;
};

export type AccessUserInput = {
  email: string;
  name?: string;
  role?: AccessRole;
  notionUserId?: string;
  active?: boolean;
};

type AccessUserDocument = AccessUser & { _id?: unknown };

const accessUsersCollectionName = "access_users";

let indexesReady = false;

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function normalizeOptionalString(value?: string) {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

function displayNameFromEmail(email: string) {
  return email.split("@")[0] || email;
}

function parseEmailList(value?: string) {
  return [
    ...new Set(
      (value ?? "")
        .split(",")
        .map((email) => normalizeEmail(email))
        .filter(Boolean),
    ),
  ];
}

export function getBootstrapSuperAdminEmails() {
  return parseEmailList(process.env.ALLOWED_EMAILS);
}

export function isBootstrapSuperAdminEmail(email: string) {
  return getBootstrapSuperAdminEmails().includes(normalizeEmail(email));
}

async function getAccessUsersCollection(): Promise<Collection<AccessUserDocument>> {
  const db = await getMongoDb();
  const collection = db.collection<AccessUserDocument>(accessUsersCollectionName);

  if (!indexesReady) {
    await Promise.all([
      collection.createIndex({ email: 1 }, { unique: true }),
      collection.createIndex(
        { notionUserId: 1 },
        {
          unique: true,
          partialFilterExpression: { notionUserId: { $type: "string" } },
        },
      ),
      collection.createIndex({ updatedAt: -1 }),
    ]);
    indexesReady = true;
  }

  return collection;
}

function stripMongoId(document: WithId<AccessUserDocument> | AccessUserDocument): AccessUser {
  const { _id, ...user } = document;
  void _id;
  return user;
}

function mergeBootstrapUsers(users: AccessUser[]) {
  const byEmail = new Map(users.map((user) => [normalizeEmail(user.email), user]));
  const now = new Date().toISOString();

  for (const email of getBootstrapSuperAdminEmails()) {
    const existing = byEmail.get(email);

    byEmail.set(email, {
      id: existing?.id ?? `bootstrap:${email}`,
      email,
      name: existing?.name || "最高权限管理员",
      role: "super_admin",
      notionUserId: existing?.notionUserId,
      active: true,
      bootstrap: true,
      createdAt: existing?.createdAt ?? now,
      updatedAt: existing?.updatedAt ?? now,
      createdBy: existing?.createdBy,
      updatedBy: existing?.updatedBy,
    });
  }

  return [...byEmail.values()].sort((first, second) => {
    const rank = (role: AccessRole) => (role === "super_admin" ? 0 : role === "admin" ? 1 : 2);
    const roleDiff = rank(first.role) - rank(second.role);
    if (roleDiff !== 0) return roleDiff;
    return first.email.localeCompare(second.email);
  });
}

export async function getAccessUsers() {
  const collection = await getAccessUsersCollection();
  const users = await collection.find({}).sort({ updatedAt: -1 }).toArray();
  return mergeBootstrapUsers(users.map(stripMongoId));
}

export async function getAccessUserByEmail(email: string) {
  const normalizedEmail = normalizeEmail(email);
  const users = await getAccessUsers();
  return users.find((user) => user.email === normalizedEmail && user.active) ?? null;
}

export async function canEmailLogin(email: string) {
  return Boolean(await getAccessUserByEmail(email));
}

export async function getManagedNotionGuestIds() {
  const [accessUsers] = await Promise.all([getAccessUsers()]);
  const ids = [
    ...(process.env.NOTION_GUEST_USER_IDS ?? "")
      .split(",")
      .map((id) => id.trim())
      .filter(Boolean),
    ...accessUsers
      .filter((user) => user.active && user.notionUserId)
      .map((user) => user.notionUserId as string),
  ];

  return [...new Set(ids)];
}

export function accessRoleLabel(role: AccessRole) {
  if (role === "super_admin") return "超级管理员";
  if (role === "admin") return "管理员";
  return "成员";
}

export function accessUserToAssignee(user: AccessUser): Assignee {
  return {
    id: user.notionUserId ?? `access:${user.email}`,
    name: user.name || displayNameFromEmail(user.email),
    role: accessRoleLabel(user.role),
    email: user.email,
    notionUserId: user.notionUserId,
    source: user.notionUserId ? "notion" : "local",
    origin: user.notionUserId ? "manual_guest" : "managed_access",
  };
}

export async function getManagedAccessAssignees() {
  const users = await getAccessUsers();

  return users
    .filter((user) => user.active && !user.notionUserId)
    .map(accessUserToAssignee);
}

export function applyAccessMetadataToAssignees(assignees: Assignee[], accessUsers: AccessUser[]) {
  const byNotionId = new Map(
    accessUsers
      .filter((user) => user.active && user.notionUserId)
      .map((user) => [user.notionUserId as string, user]),
  );
  const byEmail = new Map(
    accessUsers
      .filter((user) => user.active)
      .map((user) => [normalizeEmail(user.email), user]),
  );

  return assignees.map((assignee) => {
    const accessUser =
      (assignee.notionUserId ? byNotionId.get(assignee.notionUserId) : undefined) ??
      (assignee.email ? byEmail.get(normalizeEmail(assignee.email)) : undefined);

    if (!accessUser) return assignee;

    return {
      ...assignee,
      name: accessUser.name || assignee.name,
      role: accessRoleLabel(accessUser.role),
      email: accessUser.email,
      notionUserId: accessUser.notionUserId ?? assignee.notionUserId,
    };
  });
}

export async function upsertAccessUser(input: AccessUserInput, actorEmail?: string) {
  const email = normalizeEmail(input.email);

  if (!email || !email.includes("@")) {
    throw new Error("请输入有效邮箱。");
  }

  const collection = await getAccessUsersCollection();
  const now = new Date().toISOString();
  const existing = await collection.findOne({ email });
  const isBootstrap = isBootstrapSuperAdminEmail(email);
  const role: AccessRole = isBootstrap ? "super_admin" : input.role === "admin" ? "admin" : "member";
  const notionUserId = normalizeOptionalString(input.notionUserId);

  if (notionUserId) {
    const duplicated = await collection.findOne({
      email: { $ne: email },
      notionUserId,
    });

    if (duplicated) {
      throw new Error(`Notion 用户 ID 已关联到 ${duplicated.email}。`);
    }
  }

  const update = {
    $set: {
      email,
      name: normalizeOptionalString(input.name) ?? existing?.name ?? displayNameFromEmail(email),
      role,
      notionUserId,
      active: isBootstrap ? true : input.active ?? existing?.active ?? true,
      updatedAt: now,
      updatedBy: actorEmail,
    },
    $setOnInsert: {
      id: randomUUID(),
      createdAt: now,
      createdBy: actorEmail,
    },
  };

  await collection.updateOne({ email }, update, { upsert: true });
  return getAccessUserByEmail(email);
}

export async function deleteAccessUser(email: string) {
  const normalizedEmail = normalizeEmail(email);

  if (isBootstrapSuperAdminEmail(normalizedEmail)) {
    throw new Error("环境变量中的超级管理员不可删除。");
  }

  const collection = await getAccessUsersCollection();
  await collection.deleteOne({ email: normalizedEmail });
}
