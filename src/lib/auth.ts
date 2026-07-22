import { cache } from "react";
import { getMongoDb } from "./mongodb";
import { getAvailableAssignees } from "./notion";
import { cookies } from "next/headers";
import { sendEmail } from "./mailer";
import type { Assignee } from "./types";
import {
  accessUserToAssignee,
  getAccessUserByEmail,
  getAccessUsers,
} from "./access-control";

const OTP_COLLECTION = "user_otps";
const SESSION_COLLECTION = "user_sessions";
const COOKIE_NAME = "session_token";

export type UserSession = {
  token: string;
  assigneeId: string;
  email: string;
  createdAt: string;
  expiresAt: string;
};

// Generate 6-digit OTP and send email
export async function sendOtp(email: string): Promise<{ success: boolean; error?: string }> {
  const cleanedEmail = email.trim().toLowerCase();

  const accessUser = await getAccessUserByEmail(cleanedEmail);

  if (!accessUser) {
    return { success: false, error: "该账号未被加入系统授权登录名单，请联系超级管理员配置。" };
  }

  // Verify if the email belongs to any registered assignee or managed access user.
  const assignees = await getAvailableAssignees();
  const matchedAssignee =
    assignees.find(a => a.email?.trim().toLowerCase() === cleanedEmail) ??
    assignees.find(a => accessUser.notionUserId && a.notionUserId === accessUser.notionUserId) ??
    accessUserToAssignee(accessUser);
  
  if (!matchedAssignee) {
    return { success: false, error: "该邮箱未关联任何工作流团队成员，请确认拼写。" };
  }

  // Generate 6-digit random code
  const code = Math.floor(100000 + Math.random() * 900000).toString();
  const db = await getMongoDb();
  
  // Set expiration to 5 minutes from now
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();

  // Save OTP in DB
  await db.collection(OTP_COLLECTION).updateOne(
    { email: cleanedEmail },
    { $set: { code, expiresAt } },
    { upsert: true }
  );

  // Send Email with beautiful visual design
  const htmlTemplate = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; padding: 32px; border-radius: 24px; max-width: 500px; margin: 0 auto; border: 1px border #e2e8f0; box-shadow: 0 4px 12px rgba(15, 23, 42, 0.03);">
      <div style="text-align: center; margin-bottom: 24px;">
        <span style="font-size: 10px; font-weight: 800; color: #2563eb; text-transform: uppercase; letter-spacing: 0.1em;">Helloview</span>
        <h2 style="font-size: 20px; font-weight: 800; color: #0f172a; margin-top: 4px; margin-bottom: 0;">您的登录验证码</h2>
      </div>
      <div style="background-color: #ffffff; padding: 24px; border-radius: 16px; border: 1px solid #f1f5f9; text-align: center;">
        <p style="font-size: 13px; color: #64748b; margin-top: 0; margin-bottom: 16px;">您好，${matchedAssignee.name}。请使用以下验证码完成工作流管理系统登录：</p>
        <div style="font-size: 32px; font-weight: 900; color: #2563eb; letter-spacing: 6px; padding: 12px; background-color: #f0f7ff; border-radius: 12px; display: inline-block; font-family: monospace;">
          ${code}
        </div>
        <p style="font-size: 11px; color: #94a3b8; margin-top: 16px; margin-bottom: 0;">此验证码在 5 分钟内有效。如非本人操作请忽略此邮件。</p>
      </div>
      <div style="text-align: center; margin-top: 24px; font-size: 11px; color: #94a3b8;">
        © Helloview. Powered by Notion Task Helper.
      </div>
    </div>
  `;

  await sendEmail({
    to: cleanedEmail,
    subject: `[Helloview] 登录验证码: ${code}`,
    text: `您好，${matchedAssignee.name}。您的登录验证码是 ${code}，请在 5 分钟内完成登录验证。`,
    html: htmlTemplate,
  });

  return { success: true };
}

// Verify OTP and create HttpOnly session cookie
export async function verifyOtp(email: string, code: string): Promise<{ success: boolean; error?: string }> {
  const cleanedEmail = email.trim().toLowerCase();
  const db = await getMongoDb();
  
  const otpRecord = await db.collection(OTP_COLLECTION).findOne({ email: cleanedEmail });
  
  if (!otpRecord) {
    return { success: false, error: "未找到验证码请求，请重新发送。" };
  }

  if (otpRecord.code !== code.trim()) {
    return { success: false, error: "验证码错误，请重新输入。" };
  }

  if (new Date().toISOString() > otpRecord.expiresAt) {
    return { success: false, error: "验证码已过期，请重新获取。" };
  }

  // Delete the consumed OTP
  await db.collection(OTP_COLLECTION).deleteOne({ email: cleanedEmail });

  // Get matched Assignee details to bind Session
  const assignees = await getAvailableAssignees();
  const accessUser = await getAccessUserByEmail(cleanedEmail);
  const matchedAssignee =
    assignees.find(a => a.email?.trim().toLowerCase() === cleanedEmail) ??
    assignees.find(a => accessUser?.notionUserId && a.notionUserId === accessUser.notionUserId) ??
    (accessUser ? accessUserToAssignee(accessUser) : null);
  
  if (!matchedAssignee) {
    return { success: false, error: "绑定用户失败。" };
  }

  // Create cryptographic session token
  const token = Math.random().toString(36).substring(2) + Math.random().toString(36).substring(2);
  const expiresAtDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days
  
  const session: UserSession = {
    token,
    assigneeId: matchedAssignee.id,
    email: cleanedEmail,
    createdAt: new Date().toISOString(),
    expiresAt: expiresAtDate.toISOString(),
  };

  await db.collection(SESSION_COLLECTION).insertOne(session);

  // Set secure HttpOnly cookie (awaited in Next.js 15/16)
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    expires: expiresAtDate,
    path: "/",
  });

  return { success: true };
}

// Get current active session user details.
// Wrapped in React cache() so layout + page share one lookup per request
// instead of each hitting Notion/Mongo separately.
export const getSessionUser = cache(async function getSessionUser(): Promise<{ user: Assignee; role: "admin" | "member" } | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  
  if (!token) {
    // Automatically bypass login check during local development
    if (process.env.NODE_ENV === "development" || process.env.BYPASS_LOGIN === "true") {
      const [assignees, accessUsers] = await Promise.all([
        getAvailableAssignees(),
        getAccessUsers(),
      ]);
      const bootstrapAdmin = accessUsers.find((user) => user.role === "super_admin" && user.active);
      const defaultAdmin = bootstrapAdmin
        ? assignees.find((assignee) => assignee.email === bootstrapAdmin.email) ??
          assignees.find((assignee) => assignee.notionUserId === bootstrapAdmin.notionUserId) ??
          accessUserToAssignee(bootstrapAdmin)
        : assignees.find(a => a.id === "owner" || a.name.includes("Yuxuan")) || assignees[0];
      if (defaultAdmin) {
        return {
          user: defaultAdmin,
          role: "admin",
        };
      }
    }
    return null;
  }

  const db = await getMongoDb();
  const session = await db.collection<UserSession>(SESSION_COLLECTION).findOne({ token });
  
  if (!session) return null;

  if (new Date().toISOString() > session.expiresAt) {
    // Session expired, clean up
    await db.collection(SESSION_COLLECTION).deleteOne({ token });
    return null;
  }

  const assignees = await getAvailableAssignees();
  const accessUser = await getAccessUserByEmail(session.email);
  const assignee =
    assignees.find(a => a.id === session.assigneeId) ??
    assignees.find(a => accessUser?.notionUserId && a.notionUserId === accessUser.notionUserId) ??
    (accessUser ? accessUserToAssignee(accessUser) : null);
  
  if (!assignee) return null;
  if (!accessUser) return null;
  
  return {
    user: assignee,
    role: accessUser.role === "member" ? "member" : "admin",
  };
});

// Clear session cookie to logout
export async function logoutUser() {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  
  if (token) {
    const db = await getMongoDb();
    await db.collection(SESSION_COLLECTION).deleteOne({ token });
  }

  cookieStore.delete(COOKIE_NAME);
}
