"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  ArrowLeft,
  CheckCircle2,
  Copy,
  Crown,
  Loader2,
  LockKeyhole,
  Mail,
  Plus,
  RefreshCw,
  Save,
  ShieldCheck,
  Trash2,
  UserRound,
  UsersRound,
  type LucideIcon,
} from "lucide-react";

type AccessRole = "super_admin" | "admin" | "member";

type AccessUser = {
  id: string;
  email: string;
  name: string;
  role: AccessRole;
  notionUserId?: string;
  active: boolean;
  bootstrap?: boolean;
  createdAt: string;
  updatedAt: string;
};

type NotionUserOption = {
  id: string;
  name: string;
  email?: string;
  role: string;
  notionUserId?: string;
  origin?: string;
  avatarUrl?: string;
};

type AccessPayload = {
  users: AccessUser[];
  bootstrapEmails: string[];
  managedGuestIds: string[];
  notionUsers: NotionUserOption[];
};

type FormState = {
  email: string;
  name: string;
  role: AccessRole;
  notionUserId: string;
  active: boolean;
};

const emptyForm: FormState = {
  email: "",
  name: "",
  role: "member",
  notionUserId: "",
  active: true,
};

function roleLabel(role: AccessRole) {
  if (role === "super_admin") return "超级管理员";
  if (role === "admin") return "管理员";
  return "成员";
}

function roleStyle(role: AccessRole) {
  if (role === "super_admin") return "bg-amber-100 text-amber-800 border-amber-200";
  if (role === "admin") return "bg-blue-100 text-blue-700 border-blue-200";
  return "bg-slate-100 text-slate-600 border-slate-200";
}

async function readJson(response: Response) {
  try {
    return await response.json();
  } catch {
    return {};
  }
}

function responseError(data: unknown) {
  if (data && typeof data === "object") {
    const record = data as Record<string, unknown>;
    return String(record.detail || record.error || "请求失败");
  }

  return "请求失败";
}

export function AccessAdminClient({
  initialPayload,
  currentEmail,
}: {
  initialPayload: AccessPayload;
  currentEmail: string;
}) {
  const [payload, setPayload] = useState(initialPayload);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [deletingEmail, setDeletingEmail] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const stats = useMemo(() => {
    const activeUsers = payload.users.filter((user) => user.active);
    return {
      total: payload.users.length,
      active: activeUsers.length,
      admins: activeUsers.filter((user) => user.role === "admin" || user.role === "super_admin").length,
      linked: activeUsers.filter((user) => user.notionUserId).length,
    };
  }, [payload.users]);
  const statCards: Array<[string, number, LucideIcon]> = [
    ["授权账号", stats.total, UsersRound],
    ["已启用", stats.active, CheckCircle2],
    ["管理员", stats.admins, ShieldCheck],
    ["已关联 Notion", stats.linked, UserRound],
  ];

  const selectedUser = payload.users.find((user) => user.email === form.email.trim().toLowerCase());
  const isEditingBootstrap = Boolean(selectedUser?.bootstrap);

  const resetForm = () => {
    setForm(emptyForm);
    setMessage(null);
  };

  const editUser = (user: AccessUser) => {
    setForm({
      email: user.email,
      name: user.name,
      role: user.role,
      notionUserId: user.notionUserId ?? "",
      active: user.active,
    });
    setMessage(null);
  };

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setMessage(null);

    try {
      const response = await fetch("/api/admin/access", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await readJson(response);

      if (!response.ok) {
        throw new Error(responseError(data));
      }

      setPayload(data as AccessPayload);
      setMessage({ type: "success", text: "访问权限已保存。" });
      setForm(emptyForm);
    } catch (error) {
      setMessage({
        type: "error",
        text: error instanceof Error ? error.message : "保存失败。",
      });
    } finally {
      setSaving(false);
    }
  };

  const removeUser = async (email: string) => {
    setDeletingEmail(email);
    setMessage(null);

    try {
      const response = await fetch(`/api/admin/access?email=${encodeURIComponent(email)}`, {
        method: "DELETE",
      });
      const data = await readJson(response);

      if (!response.ok) {
        throw new Error(responseError(data));
      }

      setPayload(data as AccessPayload);
      setMessage({ type: "success", text: "授权账号已移除。" });
      if (form.email === email) resetForm();
    } catch (error) {
      setMessage({
        type: "error",
        text: error instanceof Error ? error.message : "删除失败。",
      });
    } finally {
      setDeletingEmail(null);
    }
  };

  const selectedNotionUser = payload.notionUsers.find((user) => user.notionUserId === form.notionUserId);

  return (
    <main className="min-h-screen bg-[#f6f8fb] text-slate-900">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-5 py-6 md:px-8 md:py-8">
        <header className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-[0_20px_70px_rgba(15,23,42,0.06)]">
          <div className="grid gap-6 p-6 md:grid-cols-[1.3fr_1fr] md:p-8">
            <div className="flex flex-col justify-between gap-8">
              <div>
                <Link
                  href="/"
                  className="mb-6 inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold text-slate-600 transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700"
                >
                  <ArrowLeft size={14} />
                  返回任务系统
                </Link>
                <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-blue-50 px-3 py-1.5 text-[11px] font-black tracking-[0.18em] text-blue-700">
                  <LockKeyhole size={13} />
                  访问权限中心
                </div>
                <h1 className="font-display text-3xl font-black tracking-tight text-slate-950 md:text-5xl">
                  管理可登录账号与 Notion 访客映射
                </h1>
                <p className="mt-4 max-w-2xl text-sm font-semibold leading-7 text-slate-500">
                  环境变量中的 ALLOWED_EMAILS 会作为最高权限管理员来源；这里新增的账号会写入 MongoDB，
                  并可绑定 Notion guest user id 后参与任务分配和登录验证。
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                {payload.bootstrapEmails.map((email) => (
                  <span
                    key={email}
                    className="inline-flex items-center gap-2 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs font-black text-amber-800"
                  >
                    <Crown size={16} />
                    {email}
                  </span>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {statCards.map(([label, value, Icon]) => (
                <div
                  key={String(label)}
                  className="rounded-3xl border border-slate-200 bg-slate-50/80 p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.9)]"
                >
                  <Icon className="mb-5 text-blue-600" size={20} />
                  <div className="font-display text-3xl font-black text-slate-950">{String(value)}</div>
                  <div className="mt-1 text-xs font-bold text-slate-500">{String(label)}</div>
                </div>
              ))}
            </div>
          </div>
        </header>

        {message && (
          <div
            className={`flex items-center gap-3 rounded-2xl border px-4 py-3 text-sm font-bold ${
              message.type === "success"
                ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                : "border-rose-200 bg-rose-50 text-rose-700"
            }`}
          >
            {message.type === "success" ? <CheckCircle2 size={18} /> : <ShieldCheck size={18} />}
            {message.text}
          </div>
        )}

        <section className="grid gap-6 xl:grid-cols-[420px_1fr]">
          <form
            onSubmit={submit}
            className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-[0_18px_60px_rgba(15,23,42,0.05)] md:p-6"
          >
            <div className="mb-6 flex items-start justify-between gap-4">
              <div>
                <h2 className="font-display text-xl font-black text-slate-950">授权账号</h2>
                <p className="mt-1 text-xs font-semibold leading-5 text-slate-500">
                  新增邮箱后，用户即可使用验证码登录。绑定 Notion 用户后，任务分配会同步到 Notion。
                </p>
              </div>
              <button
                type="button"
                onClick={resetForm}
                className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-100 text-slate-500 transition hover:bg-slate-200"
                title="新建"
              >
                <Plus size={17} />
              </button>
            </div>

            <div className="space-y-4">
              <label className="block">
                <span className="mb-1.5 block text-[11px] font-black text-slate-500">登录邮箱</span>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                  <input
                    type="email"
                    required
                    value={form.email}
                    onChange={(event) => setForm((prev) => ({ ...prev, email: event.target.value }))}
                    disabled={isEditingBootstrap}
                    placeholder="name@example.com"
                    className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 pl-10 pr-4 text-sm font-bold outline-none transition focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-500/10 disabled:cursor-not-allowed disabled:text-slate-400"
                  />
                </div>
              </label>

              <label className="block">
                <span className="mb-1.5 block text-[11px] font-black text-slate-500">显示名称</span>
                <input
                  type="text"
                  value={form.name}
                  onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
                  placeholder="用于页面显示"
                  className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm font-bold outline-none transition focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-500/10"
                />
              </label>

              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block">
                  <span className="mb-1.5 block text-[11px] font-black text-slate-500">系统角色</span>
                  <select
                    value={form.role}
                    onChange={(event) =>
                      setForm((prev) => ({ ...prev, role: event.target.value as AccessRole }))
                    }
                    disabled={isEditingBootstrap}
                    className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm font-bold outline-none transition focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-500/10 disabled:cursor-not-allowed disabled:text-slate-400"
                  >
                    {isEditingBootstrap && <option value="super_admin">超级管理员</option>}
                    <option value="admin">管理员</option>
                    <option value="member">成员</option>
                  </select>
                </label>

                <label className="block">
                  <span className="mb-1.5 block text-[11px] font-black text-slate-500">登录状态</span>
                  <button
                    type="button"
                    disabled={isEditingBootstrap}
                    onClick={() => setForm((prev) => ({ ...prev, active: !prev.active }))}
                    className={`flex h-12 w-full items-center justify-between rounded-2xl border px-4 text-sm font-black transition disabled:cursor-not-allowed ${
                      form.active
                        ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                        : "border-slate-200 bg-slate-50 text-slate-500"
                    }`}
                  >
                    {form.active ? "允许登录" : "暂停登录"}
                    <span className={`h-3 w-3 rounded-full ${form.active ? "bg-emerald-500" : "bg-slate-300"}`} />
                  </button>
                </label>
              </div>

              <label className="block">
                <span className="mb-1.5 block text-[11px] font-black text-slate-500">关联 Notion 用户</span>
                <select
                  value={form.notionUserId}
                  onChange={(event) => {
                    const nextId = event.target.value;
                    const notionUser = payload.notionUsers.find((user) => user.notionUserId === nextId);
                    setForm((prev) => ({
                      ...prev,
                      notionUserId: nextId,
                      name: prev.name || notionUser?.name || "",
                    }));
                  }}
                  className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm font-bold outline-none transition focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-500/10"
                >
                  <option value="">暂不关联</option>
                  {payload.notionUsers.map((user) => (
                    <option key={user.notionUserId} value={user.notionUserId}>
                      {user.name} · {user.notionUserId}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className="mb-1.5 block text-[11px] font-black text-slate-500">手动填写 Notion user id</span>
                <input
                  type="text"
                  value={form.notionUserId}
                  onChange={(event) => setForm((prev) => ({ ...prev, notionUserId: event.target.value }))}
                  placeholder="例如 2efd872b-594c-81ce-87c1-00025a447218"
                  className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 font-mono text-xs font-bold outline-none transition focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-500/10"
                />
                {selectedNotionUser && (
                  <p className="mt-2 text-xs font-semibold text-slate-500">
                    当前匹配：{selectedNotionUser.name}，来源 {selectedNotionUser.origin ?? "Notion"}。
                  </p>
                )}
              </label>
            </div>

            <button
              type="submit"
              disabled={saving}
              className="mt-6 inline-flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-blue-600 text-sm font-black text-white shadow-[0_14px_28px_rgba(37,99,235,0.22)] transition hover:bg-blue-700 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-70"
            >
              {saving ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
              {saving ? "正在保存" : "保存访问权限"}
            </button>
          </form>

          <div className="space-y-6">
            <section className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-[0_18px_60px_rgba(15,23,42,0.05)]">
              <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4 md:px-6">
                <div>
                  <h2 className="font-display text-xl font-black text-slate-950">已授权账号</h2>
                  <p className="mt-1 text-xs font-semibold text-slate-500">只有超级管理员可以修改这里的账号。</p>
                </div>
                <span className="rounded-full bg-slate-950 px-3 py-1.5 text-xs font-black text-white">
                  {currentEmail}
                </span>
              </div>

              <div className="divide-y divide-slate-100">
                {payload.users.map((user) => (
                  <div
                    key={user.email}
                    className="grid gap-4 px-5 py-4 transition hover:bg-slate-50/70 md:grid-cols-[1.2fr_0.7fr_1.1fr_auto] md:items-center md:px-6"
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="truncate text-sm font-black text-slate-950">{user.name}</p>
                        <span className={`rounded-full border px-2.5 py-1 text-[10px] font-black ${roleStyle(user.role)}`}>
                          {roleLabel(user.role)}
                        </span>
                        {user.bootstrap && (
                          <span className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[10px] font-black text-amber-700">
                            环境变量锁定
                          </span>
                        )}
                        {!user.active && (
                          <span className="rounded-full border border-slate-200 bg-slate-100 px-2.5 py-1 text-[10px] font-black text-slate-500">
                            已暂停
                          </span>
                        )}
                      </div>
                      <p className="mt-1 truncate font-mono text-xs font-semibold text-slate-500">{user.email}</p>
                    </div>

                    <div>
                      <p className="text-[10px] font-black text-slate-400">登录权限</p>
                      <p className="mt-1 text-sm font-black text-slate-800">{user.active ? "允许登录" : "暂停登录"}</p>
                    </div>

                    <div className="min-w-0">
                      <p className="text-[10px] font-black text-slate-400">Notion 用户</p>
                      <p className="mt-1 truncate font-mono text-xs font-bold text-slate-700">
                        {user.notionUserId ?? "未关联"}
                      </p>
                    </div>

                    <div className="flex items-center gap-2 md:justify-end">
                      <button
                        type="button"
                        onClick={() => editUser(user)}
                        className="rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-black text-slate-700 transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700"
                      >
                        编辑
                      </button>
                      <button
                        type="button"
                        disabled={user.bootstrap || deletingEmail === user.email}
                        onClick={() => removeUser(user.email)}
                        className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-rose-200 bg-white text-rose-500 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:border-slate-200 disabled:text-slate-300"
                        title={user.bootstrap ? "超级管理员不可删除" : "删除"}
                      >
                        {deletingEmail === user.email ? <Loader2 className="animate-spin" size={16} /> : <Trash2 size={16} />}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section className="grid gap-6 lg:grid-cols-2">
              <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-[0_18px_60px_rgba(15,23,42,0.05)] md:p-6">
                <div className="mb-4 flex items-center justify-between">
                  <div>
                    <h2 className="font-display text-lg font-black text-slate-950">可关联 Notion 用户</h2>
                    <p className="mt-1 text-xs font-semibold text-slate-500">来自 workspace、数据库 people 字段和已配置访客。</p>
                  </div>
                  <RefreshCw size={18} className="text-slate-400" />
                </div>

                <div className="max-h-[360px] space-y-2 overflow-y-auto pr-1">
                  {payload.notionUsers.map((user) => (
                    <button
                      type="button"
                      key={user.notionUserId}
                      onClick={() =>
                        setForm((prev) => ({
                          ...prev,
                          notionUserId: user.notionUserId ?? "",
                          name: prev.name || user.name,
                        }))
                      }
                      className="flex w-full items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-3.5 py-3 text-left transition hover:border-blue-200 hover:bg-blue-50"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-black text-slate-900">{user.name}</p>
                        <p className="mt-0.5 truncate font-mono text-[11px] font-semibold text-slate-500">
                          {user.notionUserId}
                        </p>
                      </div>
                      <span className="rounded-full bg-white px-2.5 py-1 text-[10px] font-black text-slate-500">
                        {user.origin === "manual_guest" ? "访客" : "成员"}
                      </span>
                    </button>
                  ))}

                  {payload.notionUsers.length === 0 && (
                    <p className="rounded-2xl bg-slate-50 px-4 py-5 text-sm font-semibold text-slate-500">
                      暂无可读取的 Notion 用户。你仍然可以手动填写 Notion user id。
                    </p>
                  )}
                </div>
              </div>

              <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-[0_18px_60px_rgba(15,23,42,0.05)] md:p-6">
                <div className="mb-4">
                  <h2 className="font-display text-lg font-black text-slate-950">当前 Notion 访客 ID</h2>
                  <p className="mt-1 text-xs font-semibold text-slate-500">
                    包含环境变量 NOTION_GUEST_USER_IDS 与后台绑定的 Notion user id。
                  </p>
                </div>

                <div className="space-y-2">
                  {payload.managedGuestIds.map((id) => (
                    <button
                      type="button"
                      key={id}
                      onClick={async () => {
                        await navigator.clipboard?.writeText(id);
                        setMessage({ type: "success", text: "Notion user id 已复制。" });
                      }}
                      className="flex w-full items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-3.5 py-3 text-left transition hover:border-blue-200 hover:bg-blue-50"
                    >
                      <span className="truncate font-mono text-xs font-bold text-slate-700">{id}</span>
                      <Copy size={15} className="shrink-0 text-slate-400" />
                    </button>
                  ))}

                  {payload.managedGuestIds.length === 0 && (
                    <p className="rounded-2xl bg-slate-50 px-4 py-5 text-sm font-semibold text-slate-500">
                      还没有配置 Notion guest user id。
                    </p>
                  )}
                </div>
              </div>
            </section>
          </div>
        </section>
      </div>
    </main>
  );
}
