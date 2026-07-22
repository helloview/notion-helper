"use client";

import React from "react";
import Image from "next/image";
import Link from "next/link";
import { 
  Layers, 
  MonitorPlay, 
  Sparkles, 
  ShieldCheck, 
  LogOut 
} from "lucide-react";
import type { Assignee } from "@/lib/types";
import { logoutAction } from "../auth-actions";

type SidebarProps = {
  currentUser: Assignee;
  currentRole: "admin" | "member";
  canManageAccess?: boolean;
  activeTab: "tasks" | "tarot-quiz" | "access";
  mobileView?: "list" | "detail";
  setMobileView?: (view: "list" | "detail") => void;
  showToast?: (message: string, type?: string) => void;
};

// Reusable avatar component with fallback to initials
const renderAvatar = (assignee: Assignee, sizeClass = "w-7 h-7") => {
  if (assignee.avatarUrl) {
    return (
      <Image
        src={assignee.avatarUrl}
        alt={assignee.name}
        width={32}
        height={32}
        unoptimized
        className={`${sizeClass} rounded-full object-cover ring-2 ring-white shadow-sm shrink-0`}
        referrerPolicy="no-referrer"
      />
    );
  }
  return (
    <div
      className={`${sizeClass} rounded-full bg-blue-50 text-blue-600 flex items-center justify-center text-[10px] font-extrabold ring-2 ring-white shadow-sm shrink-0`}
    >
      {assignee.name.charAt(0)}
    </div>
  );
};

export function Sidebar({
  currentUser,
  currentRole,
  canManageAccess = false,
  activeTab,
  mobileView = "list",
  setMobileView,
  showToast,
}: SidebarProps) {
  const showTaskList = () => {
    setMobileView?.("list");
    window.dispatchEvent(new Event("workspace:show-task-list"));
  };

  const handleLogout = async () => {
    if (showToast) {
      showToast("正在登出...", "loading");
    }
    await logoutAction();
    window.location.href = "/login";
  };

  return (
    <nav className="fixed bottom-0 left-0 right-0 h-[60px] bg-slate-900 border-t border-slate-800 flex flex-row items-center justify-around z-[100] md:relative md:h-screen md:w-16 md:border-t-0 md:border-r md:flex-col md:justify-start md:py-6 shrink-0 shadow-[0_-4px_24px_rgba(15,23,42,0.12)]">
      {/* Top Logo Container */}
      <div className="hidden md:flex w-10 h-10 bg-slate-850 text-white rounded-xl flex items-center justify-center shadow-md border border-slate-700 mb-6 shrink-0">
        <Layers size={18} />
      </div>

      {/* Desktop navigation tabs & Mobile Items (Top Grouped) */}
      <div className="flex flex-row md:flex-col w-full md:w-auto md:px-2 gap-0 md:gap-5 justify-around md:justify-start flex-1 md:flex-none animate-rise">
        {activeTab === "tasks" ? (
          <button
            onClick={showTaskList}
            className={`w-12 h-12 md:w-full md:aspect-square flex items-center justify-center rounded-xl transition-all duration-300 active:scale-90 ${
              mobileView === "list"
                ? "text-white bg-slate-800/80 shadow-inner"
                : "text-slate-400 hover:text-slate-200 bg-transparent border-transparent"
            }`}
            aria-label="生产任务列表"
            aria-current="page"
          >
            <MonitorPlay size={20} />
          </button>
        ) : (
          <Link
            href="/"
            prefetch
            className="w-12 h-12 md:w-full md:aspect-square flex items-center justify-center rounded-xl text-slate-400 transition-all duration-300 hover:bg-slate-800/80 hover:text-white active:scale-90"
            title="生产任务列表"
            aria-label="生产任务列表"
          >
            <MonitorPlay size={20} />
          </Link>
        )}

        <Link
          href="/tarot-quiz"
          prefetch
          className={`w-12 h-12 md:w-full md:aspect-square flex items-center justify-center rounded-xl transition-all duration-300 hover:bg-slate-800/80 hover:text-white active:scale-90 ${
            activeTab === "tarot-quiz" ? "text-white bg-slate-800/80 shadow-inner" : "text-slate-400"
          }`}
          title="塔罗五题栏目生成台"
          aria-label="塔罗五题栏目生成台"
          aria-current={activeTab === "tarot-quiz" ? "page" : undefined}
        >
          <Sparkles size={20} />
        </Link>

        {canManageAccess && (
          <Link
            href="/admin/access"
            prefetch
            className={`w-12 h-12 md:w-full md:aspect-square flex items-center justify-center rounded-xl transition-all duration-300 hover:bg-slate-800/80 hover:text-white active:scale-90 ${
              activeTab === "access" ? "text-white bg-slate-800/80 shadow-inner" : "text-slate-400"
            }`}
            title="访问权限中心"
            aria-label="访问权限中心"
            aria-current={activeTab === "access" ? "page" : undefined}
          >
            <ShieldCheck size={20} />
          </Link>
        )}

        {/* Mobile User Profile Avatar (Middle) */}
        <div
          className="md:hidden flex items-center justify-center w-12 h-12 relative"
          title={`${currentUser.name} (${currentUser.role})`}
        >
          {renderAvatar(currentUser, "w-6 h-6")}
        </div>

        {/* Mobile Logout Button (Right) */}
        <button
          onClick={handleLogout}
          className="md:hidden w-12 h-12 flex items-center justify-center text-slate-400 hover:text-rose-450 active:scale-90"
          title="退出登录"
        >
          <LogOut size={20} />
        </button>
      </div>

      {/* Desktop Bottom Section: User Profile & Logout (Pushed to bottom) */}
      <div className="hidden md:flex flex-col items-center gap-4 w-full mt-auto shrink-0">
        {/* Desktop divider line */}
        <div className="w-8 h-px bg-slate-800/80 my-1 self-center" />

        {/* Desktop User Avatar */}
        <div className="flex items-center justify-center w-full aspect-square relative group cursor-help shrink-0">
          {renderAvatar(currentUser, "w-8 h-8")}
          <div className="absolute left-14 bottom-1/2 translate-y-1/2 bg-slate-900 border border-slate-800 text-white text-[11px] font-semibold py-2.5 px-3.5 rounded-xl opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity duration-200 shadow-[0_12px_36px_rgba(0,0,0,0.4)] whitespace-nowrap z-50">
            <p className="font-extrabold text-white text-xs">{currentUser.name}</p>
            <p className="text-slate-400 text-[9px] font-mono mt-0.5 uppercase tracking-wider">
              {currentRole === "admin" ? "主编导" : "成员"}
            </p>
          </div>
        </div>

        {/* Desktop Logout Button */}
        <button
          onClick={handleLogout}
          className="w-10 h-10 flex items-center justify-center rounded-xl hover:bg-rose-950/40 text-slate-400 hover:text-rose-400 transition-all duration-200 active:scale-95 cursor-pointer shrink-0"
          title="退出登录"
        >
          <LogOut size={20} />
        </button>
      </div>
    </nav>
  );
}
