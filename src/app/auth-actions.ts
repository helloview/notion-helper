"use server";

import { sendOtp, verifyOtp, logoutUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

export async function sendOtpAction(email: string) {
  try {
    const result = await sendOtp(email);
    return result;
  } catch (err: any) {
    return { success: false, error: err.message || "发送验证码时发生异常错误" };
  }
}

export async function verifyOtpAction(email: string, code: string) {
  try {
    const result = await verifyOtp(email, code);
    if (result.success) {
      revalidatePath("/");
    }
    return result;
  } catch (err: any) {
    return { success: false, error: err.message || "校验验证码时发生异常错误" };
  }
}

export async function logoutAction() {
  await logoutUser();
  return { success: true };
}
