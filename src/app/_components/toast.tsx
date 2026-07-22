"use client";

import React from "react";
import { CheckCircle2, RefreshCw, AlertCircle } from "lucide-react";

export type ToastMessage = {
  id: number;
  message: string;
  type: string;
};

type ToastContainerProps = {
  toasts: ToastMessage[];
};

export const ToastContainer = ({ toasts }: ToastContainerProps) => (
  <div className="fixed bottom-6 right-6 z-[999] flex flex-col gap-3 w-[90vw] md:w-[380px] pointer-events-none">
    {toasts.map((t) => (
      <div
        key={t.id}
        className={`flex items-center gap-3.5 px-4.5 py-4 rounded-2xl shadow-xl border pointer-events-auto transition-all animate-in fade-in slide-in-from-bottom-5 duration-350 ease-out
        ${
          t.type === "success"
            ? "bg-emerald-50/95 border-emerald-200 text-emerald-955 shadow-emerald-100/30 backdrop-blur-md"
            : t.type === "loading"
              ? "bg-slate-50/95 border-slate-200 text-slate-955 shadow-slate-100/30 backdrop-blur-md"
              : t.type === "warn"
                ? "bg-amber-50/95 border-amber-200 text-amber-955 shadow-amber-100/30 backdrop-blur-md"
                : t.type === "error"
                  ? "bg-rose-50/95 border-rose-200 text-rose-900 shadow-rose-100/30 backdrop-blur-md"
                  : "bg-slate-900/95 border-slate-800 text-white shadow-slate-955/20 backdrop-blur-md"
        }`}
      >
        {t.type === "success" && <CheckCircle2 size={20} className="text-emerald-600 shrink-0" />}
        {t.type === "loading" && <RefreshCw size={20} className="text-slate-500 animate-spin shrink-0" />}
        {t.type === "warn" && <AlertCircle size={20} className="text-amber-600 shrink-0" />}
        {t.type === "error" && <AlertCircle size={20} className="text-rose-600 shrink-0" />}
        <span className="text-xs font-semibold tracking-wide leading-relaxed">{t.message}</span>
      </div>
    ))}
  </div>
);
