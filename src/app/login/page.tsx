"use client";

import React, { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Mail, ShieldCheck, ArrowRight, RefreshCw, KeyRound, Layers, AlertCircle } from "lucide-react";
import { sendOtpAction, verifyOtpAction } from "../auth-actions";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [step, setStep] = useState<"email" | "code">("email");
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const handleSendCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);

    if (!email.trim()) {
      setError("请输入您的邮箱。");
      return;
    }

    startTransition(async () => {
      const res = await sendOtpAction(email);
      if (res.success) {
        setStep("code");
      } else {
        setError(res.error || "发送失败，请确认邮箱是否正确。");
      }
    });
  };

  const handleVerifyCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);

    if (code.trim().length !== 6) {
      setError("请输入 6 位数字验证码。");
      return;
    }

    startTransition(async () => {
      const res = await verifyOtpAction(email, code);
      if (res.success) {
        setSuccessMsg("登录成功，正在跳转...");
        router.push("/");
        router.refresh();
      } else {
        setError(res.error || "验证码错误。");
      }
    });
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] flex flex-col justify-center items-center p-4 relative overflow-hidden font-sans select-none">
      
      {/* Soft Elegant Blur Background Blob */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[550px] h-[550px] bg-blue-500/5 rounded-full blur-[100px] pointer-events-none" />
      
      {/* Decorative clean line grids in light gray */}
      <div className="absolute inset-0 bg-[linear-gradient(rgba(15,23,42,0.015)_1px,transparent_1px),linear-gradient(90deg,rgba(15,23,42,0.015)_1px,transparent_1px)] bg-[size:40px_40px] pointer-events-none" />

      {/* Premium Minimalist Light Theme Card */}
      <div className="w-full max-w-[390px] bg-white border border-slate-200/80 rounded-3xl p-8 shadow-[0_16px_48px_rgba(15,23,42,0.05)] relative z-10 animate-in fade-in duration-300">
        
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex w-10 h-10 bg-slate-50 border border-slate-200/80 text-slate-700 rounded-xl items-center justify-center mb-3.5 shadow-sm">
            <Layers size={18} />
          </div>
          <span className="block text-[9px] font-extrabold text-slate-400 uppercase tracking-[0.2em] font-display">Helloview</span>
          <h2 className="text-lg font-bold text-slate-900 mt-1.5 tracking-tight font-display">
            {step === "email" ? "登录您的账号" : "输入验证密钥"}
          </h2>
        </div>

        {/* Dynamic Forms */}
        {step === "email" ? (
          <form onSubmit={handleSendCode} className="space-y-4.5 animate-in fade-in duration-200">
            <div className="space-y-1.5">
              <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider font-display">
                工作邮箱
              </label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400">
                  <Mail size={14} />
                </span>
                <input
                  type="email"
                  placeholder="name@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={isPending}
                  className="w-full h-10.5 pl-9.5 pr-3.5 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 outline-none transition duration-150 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 placeholder-slate-400 disabled:opacity-50"
                  required
                />
              </div>
            </div>

            {error && (
              <div className="p-3 bg-rose-50 border border-rose-150 rounded-xl flex items-start gap-2 text-[11px] text-rose-700 font-semibold animate-in shake duration-300">
                <AlertCircle size={14} className="shrink-0 mt-0.5 text-rose-600" />
                <p className="leading-relaxed">{error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={isPending}
              className="w-full h-10.5 bg-slate-900 hover:bg-slate-850 text-white rounded-xl text-xs font-bold transition-all duration-200 active:scale-[0.98] flex items-center justify-center gap-1.5 disabled:opacity-50 cursor-pointer shadow-md shadow-slate-950/5"
            >
              {isPending ? (
                <RefreshCw size={14} className="animate-spin" />
              ) : (
                <>
                  <span>获取验证码</span>
                  <ArrowRight size={14} />
                </>
              )}
            </button>
          </form>
        ) : (
          <form onSubmit={handleVerifyCode} className="space-y-4.5 animate-in fade-in duration-200">
            <div className="space-y-1.5">
              <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider font-display">
                验证码
              </label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400">
                  <KeyRound size={14} />
                </span>
                <input
                  type="text"
                  maxLength={6}
                  placeholder="输入 6 位数字"
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                  disabled={isPending}
                  className="w-full h-10.5 pl-9.5 pr-3.5 bg-white border border-slate-200 rounded-xl text-xs font-bold tracking-[0.2em] text-slate-800 outline-none transition duration-150 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 placeholder-slate-400 disabled:opacity-50"
                  required
                />
              </div>
            </div>

            {successMsg && (
              <div className="p-3 bg-emerald-55/60 border border-emerald-150 rounded-xl flex items-start gap-2 text-[11px] text-emerald-700 font-semibold animate-in fade-in">
                <ShieldCheck size={14} className="shrink-0 mt-0.5 text-emerald-600" />
                <p className="leading-relaxed">{successMsg}</p>
              </div>
            )}

            {error && (
              <div className="p-3 bg-rose-50 border border-rose-150 rounded-xl flex items-start gap-2 text-[11px] text-rose-700 font-semibold animate-in shake duration-300">
                <AlertCircle size={14} className="shrink-0 mt-0.5 text-rose-600" />
                <p className="leading-relaxed">{error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={isPending}
              className="w-full h-10.5 bg-slate-900 hover:bg-slate-850 text-white rounded-xl text-xs font-bold transition-all duration-200 active:scale-[0.98] flex items-center justify-center gap-1.5 disabled:opacity-50 cursor-pointer shadow-md shadow-slate-950/5"
            >
              {isPending ? (
                <RefreshCw size={14} className="animate-spin" />
              ) : (
                <>
                  <span>验证并登录</span>
                  <ArrowRight size={14} />
                </>
              )}
            </button>

            <button
              type="button"
              disabled={isPending}
              onClick={() => {
                setStep("email");
                setError(null);
                setCode("");
                setSuccessMsg(null);
              }}
              className="w-full text-center text-[10px] font-bold text-slate-400 hover:text-slate-600 transition-colors py-1 cursor-pointer"
            >
              返回修改邮箱
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
