"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Copy,
  Crown,
  Loader2,
  Plus,
  RefreshCw,
  Search,
} from "lucide-react";
import { ToastContainer, type ToastMessage } from "@/app/_components/toast";
import { Badge, Button, Modal, ui } from "@/app/_components/ui";

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

type ResolvedAccessUser = AccessUser & {
  displayName: string;
  resolvedNotionUserId?: string;
  notionDisplayName?: string;
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

let toastCount = 0;

function roleLabel(role: AccessRole) {
  if (role === "super_admin") return "超级管理员";
  if (role === "admin") return "管理员";
  return "成员";
}

function roleTone(role: AccessRole): "amber" | "blue" | "slate" {
  if (role === "super_admin") return "amber";
  if (role === "admin") return "blue";
  return "slate";
}

function readError(data: unknown) {
  if (data && typeof data === "object") {
    const record = data as Record<string, unknown>;
    return String(record.detail || record.error || "请求失败");
  }

  return "请求失败";
}

function mergePayload(current: AccessPayload, next: AccessPayload): AccessPayload {
  return {
    ...next,
    notionUsers: next.notionUsers.length > 0 ? next.notionUsers : current.notionUsers,
  };
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("zh-CN", { year: "numeric", month: "2-digit", day: "2-digit" });
}

function Avatar({ user }: { user: ResolvedAccessUser }) {
  if (user.avatarUrl) {
    return (
      <Image
        src={user.avatarUrl}
        alt={user.displayName}
        width={32}
        height={32}
        unoptimized
        referrerPolicy="no-referrer"
        className="h-8 w-8 shrink-0 rounded-full object-cover"
      />
    );
  }

  return (
    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-50 text-[11px] font-semibold text-blue-600">
      {initials(user.displayName || user.email)}
    </span>
  );
}

export function AccessAdminClient({
  initialPayload,
  currentEmail,
  currentIdentity,
}: {
  initialPayload: AccessPayload;
  currentEmail: string;
  currentIdentity?: NotionUserOption;
}) {
  const [payload, setPayload] = useState(initialPayload);
  const [query, setQuery] = useState("");
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [loadingNotionUsers, setLoadingNotionUsers] = useState(false);

  // Editor dialog state; null = closed, "" = creating, email = editing.
  const [editorTarget, setEditorTarget] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [saving, setSaving] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<ResolvedAccessUser | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [togglingEmail, setTogglingEmail] = useState<string | null>(null);

  const showToast = (message: string, type = "default", duration = 3000) => {
    const id = ++toastCount;
    setToasts((prev) => [...prev, { id, message, type }]);

    if (duration > 0) {
      window.setTimeout(() => {
        setToasts((prev) => prev.filter((toast) => toast.id !== id));
      }, duration);
    }

    return id;
  };

  const resolvedUsers = useMemo<ResolvedAccessUser[]>(() => {
    const notionIdentities = currentIdentity
      ? [...payload.notionUsers, currentIdentity]
      : payload.notionUsers;

    return payload.users.map((user) => {
      const identity =
        notionIdentities.find(
          (candidate) =>
            Boolean(user.notionUserId) && candidate.notionUserId === user.notionUserId,
        ) ??
        notionIdentities.find(
          (candidate) =>
            Boolean(candidate.email) &&
            candidate.email?.trim().toLowerCase() === user.email.trim().toLowerCase(),
        );

      return {
        ...user,
        displayName: identity?.name?.trim() || user.name,
        resolvedNotionUserId: identity?.notionUserId ?? user.notionUserId,
        notionDisplayName: identity?.name?.trim(),
        avatarUrl: identity?.avatarUrl,
      };
    });
  }, [currentIdentity, payload.notionUsers, payload.users]);

  const stats = useMemo(() => {
    const activeUsers = resolvedUsers.filter((user) => user.active);
    return {
      total: resolvedUsers.length,
      active: activeUsers.length,
      admins: activeUsers.filter((user) => user.role === "admin" || user.role === "super_admin")
        .length,
      linked: activeUsers.filter((user) => user.resolvedNotionUserId).length,
    };
  }, [resolvedUsers]);

  const filteredUsers = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return resolvedUsers;

    return resolvedUsers.filter((user) => {
      return (
        user.displayName.toLowerCase().includes(normalized) ||
        user.email.toLowerCase().includes(normalized) ||
        (user.resolvedNotionUserId ?? "").toLowerCase().includes(normalized)
      );
    });
  }, [query, resolvedUsers]);

  const editingUser = editorTarget
    ? resolvedUsers.find((user) => user.email === editorTarget)
    : undefined;
  const isEditingBootstrap = Boolean(editingUser?.bootstrap);
  const matchedNotionUser = payload.notionUsers.find(
    (user) => user.notionUserId === form.notionUserId.trim(),
  );

  const refreshNotionUsers = async ({ silent = false } = {}) => {
    if (loadingNotionUsers) return;

    setLoadingNotionUsers(true);

    try {
      const response = await fetch("/api/admin/access?includeNotion=1", { cache: "no-store" });
      const data = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(readError(data));
      }

      setPayload((current) => mergePayload(current, data as AccessPayload));
      if (!silent) showToast("Notion 用户列表已刷新。", "success");
    } catch (error) {
      if (!silent) {
        showToast(error instanceof Error ? error.message : "刷新失败。", "error");
      }
    } finally {
      setLoadingNotionUsers(false);
    }
  };

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void refreshNotionUsers({ silent: true });
    }, 350);

    return () => window.clearTimeout(timer);
    // 首屏先渲染本地权限数据，Notion 用户列表延后加载。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const openCreate = () => {
    setForm(emptyForm);
    setEditorTarget("");
  };

  const openEdit = (user: ResolvedAccessUser) => {
    setForm({
      email: user.email,
      name: user.displayName,
      role: user.role,
      notionUserId: user.resolvedNotionUserId ?? "",
      active: user.active,
    });
    setEditorTarget(user.email);
  };

  const closeEditor = () => {
    if (!saving) setEditorTarget(null);
  };

  const saveUser = async (body: FormState, options?: { onDone?: () => void }) => {
    const response = await fetch("/api/admin/access", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await response.json().catch(() => null);

    if (!response.ok) {
      throw new Error(readError(data));
    }

    setPayload((current) => mergePayload(current, data as AccessPayload));
    options?.onDone?.();
  };

  const submitEditor = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (saving) return;
    setSaving(true);

    try {
      await saveUser(form, {
        onDone: () => {
          setEditorTarget(null);
          showToast(editingUser ? "账号已更新。" : "账号已添加。", "success");
        },
      });
    } catch (error) {
      showToast(error instanceof Error ? error.message : "保存失败。", "error");
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (user: ResolvedAccessUser) => {
    if (user.bootstrap || togglingEmail) return;
    setTogglingEmail(user.email);

    try {
      await saveUser(
        {
          email: user.email,
          name: user.displayName,
          role: user.role,
          notionUserId: user.resolvedNotionUserId ?? "",
          active: !user.active,
        },
        {
          onDone: () =>
            showToast(user.active ? "已暂停该账号登录。" : "已恢复该账号登录。", "success"),
        },
      );
    } catch (error) {
      showToast(error instanceof Error ? error.message : "操作失败。", "error");
    } finally {
      setTogglingEmail(null);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget || deleting) return;
    setDeleting(true);

    try {
      const response = await fetch(
        `/api/admin/access?email=${encodeURIComponent(deleteTarget.email)}`,
        { method: "DELETE" },
      );
      const data = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(readError(data));
      }

      setPayload((current) => mergePayload(current, data as AccessPayload));
      setDeleteTarget(null);
      showToast("账号已移除。", "success");
    } catch (error) {
      showToast(error instanceof Error ? error.message : "删除失败。", "error");
    } finally {
      setDeleting(false);
    }
  };

  const copyGuestId = async (id: string) => {
    try {
      await navigator.clipboard.writeText(id);
      showToast("Notion 用户 ID 已复制。", "success");
    } catch {
      showToast("复制失败，请手动选择复制。", "error");
    }
  };

  return (
    <>
      <main className="flex h-full min-w-0 flex-1 flex-col overflow-hidden bg-slate-50 text-slate-900">
        <header className="flex h-12 shrink-0 items-center justify-between gap-3 border-b border-slate-200 bg-white px-4">
          <div className="flex min-w-0 items-center gap-2.5">
            <h1 className="text-[15px] font-semibold tracking-tight">访问权限</h1>
            <span className="hidden text-xs text-slate-400 md:inline">
              账号、角色与 Notion 映射 · 操作人 {currentEmail}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <div className="relative">
              <Search
                className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400"
                size={14}
              />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="搜索邮箱、名称、Notion ID"
                className={`${ui.input} h-8 w-[200px] pl-8 md:w-[260px]`}
              />
            </div>
            <Button variant="primary" onClick={openCreate}>
              <Plus size={14} />
              新增账号
            </Button>
          </div>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-x-6 gap-y-1 text-[13px] text-slate-500">
              {[
                ["授权账号", stats.total],
                ["已启用", stats.active],
                ["管理员", stats.admins],
                ["已关联 Notion", stats.linked],
              ].map(([label, value]) => (
                <p key={String(label)}>
                  <span className="font-semibold text-slate-900">{String(value)}</span>{" "}
                  {String(label)}
                </p>
              ))}
            </div>

            <div className={`overflow-hidden ${ui.card}`}>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[760px] text-left text-[13px]">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50 text-xs text-slate-500">
                      <th className="px-3 py-2 font-medium">账号</th>
                      <th className="px-3 py-2 font-medium">角色</th>
                      <th className="px-3 py-2 font-medium">登录状态</th>
                      <th className="px-3 py-2 font-medium">Notion 关联</th>
                      <th className="hidden px-3 py-2 font-medium xl:table-cell">更新时间</th>
                      <th className="px-3 py-2 text-right font-medium">操作</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredUsers.map((user) => (
                      <tr key={user.email} className="transition hover:bg-slate-50">
                        <td className="px-3 py-2">
                          <div className="flex min-w-0 items-center gap-2.5">
                            <Avatar user={user} />
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5">
                                <p className="truncate font-medium text-slate-900">
                                  {user.displayName}
                                </p>
                                {user.bootstrap && (
                                  <span title="来自环境变量，不可停用或删除">
                                    <Crown size={12} className="shrink-0 text-amber-500" />
                                  </span>
                                )}
                              </div>
                              <p className="truncate text-xs text-slate-500">{user.email}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-3 py-2">
                          <Badge tone={roleTone(user.role)}>{roleLabel(user.role)}</Badge>
                        </td>
                        <td className="px-3 py-2">
                          <button
                            type="button"
                            role="switch"
                            aria-checked={user.active}
                            disabled={user.bootstrap || togglingEmail === user.email}
                            onClick={() => toggleActive(user)}
                            title={user.bootstrap ? "最高权限管理员始终允许登录" : undefined}
                            className="group inline-flex items-center gap-1.5 disabled:cursor-not-allowed"
                          >
                            <span
                              className={`relative h-4.5 w-8 shrink-0 rounded-full transition ${
                                user.active ? "bg-blue-600" : "bg-slate-300"
                              } ${user.bootstrap ? "opacity-50" : ""}`}
                            >
                              <span
                                className={`absolute top-0.5 h-3.5 w-3.5 rounded-full bg-white shadow transition-all ${
                                  user.active ? "left-4" : "left-0.5"
                                }`}
                              />
                            </span>
                            <span className="text-xs text-slate-500">
                              {togglingEmail === user.email ? (
                                <Loader2 className="animate-spin" size={12} />
                              ) : user.active ? (
                                "允许登录"
                              ) : (
                                "已暂停"
                              )}
                            </span>
                          </button>
                        </td>
                        <td className="max-w-[220px] px-3 py-2">
                          {user.resolvedNotionUserId ? (
                            <div className="min-w-0">
                              <p className="truncate text-slate-700">
                                {user.notionDisplayName ?? user.displayName}
                              </p>
                              <p className="truncate font-mono text-[11px] text-slate-400">
                                {user.resolvedNotionUserId}
                              </p>
                            </div>
                          ) : (
                            <span className="text-xs text-slate-400">未关联</span>
                          )}
                        </td>
                        <td className="hidden px-3 py-2 text-xs text-slate-500 xl:table-cell">
                          {formatDate(user.updatedAt)}
                        </td>
                        <td className="px-3 py-2">
                          <div className="flex items-center justify-end gap-1">
                            <Button variant="ghost" className="h-7 px-2.5 text-xs" onClick={() => openEdit(user)}>
                              编辑
                            </Button>
                            <Button
                              variant="ghost"
                              className="h-7 px-2.5 text-xs text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                              disabled={user.bootstrap}
                              onClick={() => setDeleteTarget(user)}
                              title={user.bootstrap ? "最高权限管理员不可删除" : "删除"}
                            >
                              删除
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {filteredUsers.length === 0 && (
                <div className="p-8 text-center text-sm text-slate-500">
                  {query ? "没有匹配的账号。" : "还没有授权账号，点击右上角「新增账号」添加。"}
                </div>
              )}
            </div>

            <div className="grid gap-3 lg:grid-cols-2">
              <section className={`${ui.card} p-3.5`}>
                <h2 className="text-[13px] font-semibold text-slate-900">最高权限来源</h2>
                <p className={ui.hint}>
                  以下邮箱来自环境变量 ALLOWED_EMAILS，始终是超级管理员，不可在此页面修改。
                </p>
                <div className="mt-2.5 space-y-1.5">
                  {payload.bootstrapEmails.map((email) => (
                    <div
                      key={email}
                      className="flex items-center gap-2 rounded-lg bg-amber-50 px-2.5 py-1.5 text-xs font-medium text-amber-800"
                    >
                      <Crown size={12} className="shrink-0" />
                      <span className="truncate">{email}</span>
                    </div>
                  ))}
                </div>
              </section>

              <section className={`${ui.card} p-3.5`}>
                <div className="flex items-center justify-between">
                  <h2 className="text-[13px] font-semibold text-slate-900">Notion 访客 ID 映射</h2>
                  <span className="text-xs text-slate-400">{payload.managedGuestIds.length} 个</span>
                </div>
                <p className={ui.hint}>当前生效的 Notion 访客用户 ID，点击可复制。</p>
                <div className="mt-2.5 max-h-[150px] space-y-1.5 overflow-y-auto pr-1">
                  {payload.managedGuestIds.map((id) => (
                    <button
                      type="button"
                      key={id}
                      onClick={() => copyGuestId(id)}
                      className="flex w-full items-center justify-between gap-2 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-left transition hover:border-blue-200 hover:bg-blue-50"
                    >
                      <span className="truncate font-mono text-[11px] text-slate-600">{id}</span>
                      <Copy size={12} className="shrink-0 text-slate-400" />
                    </button>
                  ))}
                  {payload.managedGuestIds.length === 0 && (
                    <p className="py-2 text-xs text-slate-400">还没有配置 Notion 访客 ID。</p>
                  )}
                </div>
              </section>
            </div>
          </div>
        </div>
      </main>

      <Modal
        open={editorTarget !== null}
        onClose={closeEditor}
        title={editingUser ? "编辑账号" : "新增账号"}
        subtitle={
          editingUser
            ? `正在编辑 ${editingUser.email}`
            : "添加后该邮箱即可通过验证码登录系统。"
        }
      >
        <form onSubmit={submitEditor}>
          <div className="space-y-3">
            <label className="block">
              <span className={ui.label}>登录邮箱</span>
              <input
                type="email"
                required
                value={form.email}
                onChange={(event) => setForm((prev) => ({ ...prev, email: event.target.value }))}
                disabled={Boolean(editingUser)}
                placeholder="name@example.com"
                className={`${ui.input} h-8`}
              />
            </label>

            <label className="block">
              <span className={ui.label}>显示名称</span>
              <input
                value={form.name}
                onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
                placeholder="用于页面显示"
                className={`${ui.input} h-8`}
              />
            </label>

            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className={ui.label}>系统角色</span>
                <select
                  value={form.role}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, role: event.target.value as AccessRole }))
                  }
                  disabled={isEditingBootstrap}
                  className={`${ui.input} h-8`}
                >
                  {isEditingBootstrap && <option value="super_admin">超级管理员</option>}
                  <option value="admin">管理员</option>
                  <option value="member">成员</option>
                </select>
              </label>

              <label className="block">
                <span className={ui.label}>登录状态</span>
                <button
                  type="button"
                  disabled={isEditingBootstrap}
                  onClick={() => setForm((prev) => ({ ...prev, active: !prev.active }))}
                  className={`flex h-8 w-full items-center justify-between rounded-lg border px-2.5 text-[13px] font-medium transition disabled:cursor-not-allowed disabled:opacity-60 ${
                    form.active
                      ? "border-blue-200 bg-blue-50 text-blue-700"
                      : "border-slate-300 bg-white text-slate-500"
                  }`}
                >
                  {form.active ? "允许登录" : "暂停登录"}
                  <span
                    className={`h-2 w-2 rounded-full ${form.active ? "bg-blue-600" : "bg-slate-300"}`}
                  />
                </button>
              </label>
            </div>

            <label className="block">
              <div className="mb-1 flex items-center justify-between">
                <span className="text-xs font-medium text-slate-600">Notion 用户 ID（选填）</span>
                <button
                  type="button"
                  onClick={() => refreshNotionUsers()}
                  disabled={loadingNotionUsers}
                  className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 transition hover:text-blue-500 disabled:opacity-60"
                >
                  {loadingNotionUsers ? (
                    <Loader2 className="animate-spin" size={11} />
                  ) : (
                    <RefreshCw size={11} />
                  )}
                  刷新候选
                </button>
              </div>
              <input
                list="notion-user-options"
                value={form.notionUserId}
                onChange={(event) => {
                  const nextId = event.target.value;
                  const notionUser = payload.notionUsers.find(
                    (user) => user.notionUserId === nextId.trim(),
                  );
                  setForm((prev) => ({
                    ...prev,
                    notionUserId: nextId,
                    name: prev.name || notionUser?.name || "",
                  }));
                }}
                placeholder="从列表选择，或直接粘贴用户 ID"
                className={`${ui.input} h-8 font-mono text-xs`}
              />
              <datalist id="notion-user-options">
                {payload.notionUsers.map((user) => (
                  <option key={user.notionUserId} value={user.notionUserId}>
                    {user.name}
                    {user.email ? ` · ${user.email}` : ""}
                  </option>
                ))}
              </datalist>
              <span className={ui.hint}>
                {matchedNotionUser
                  ? `已匹配：${matchedNotionUser.name}`
                  : payload.notionUsers.length === 0
                    ? "候选列表加载中，也可以直接粘贴 ID。"
                    : "关联后任务指派会同步到对应的 Notion 用户。"}
              </span>
            </label>
          </div>

          <div className="mt-4 flex justify-end gap-2">
            <Button onClick={closeEditor}>取消</Button>
            <Button variant="primary" type="submit" disabled={saving}>
              {saving && <Loader2 className="animate-spin" size={13} />}
              {saving ? "保存中" : "保存"}
            </Button>
          </div>
        </form>
      </Modal>

      <Modal
        open={deleteTarget !== null}
        onClose={() => {
          if (!deleting) setDeleteTarget(null);
        }}
        title="移除账号"
        maxWidth="max-w-sm"
      >
        {deleteTarget && (
          <>
            <div className="flex items-start gap-2.5">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-rose-50 text-rose-600">
                <AlertTriangle size={15} />
              </span>
              <p className="text-[13px] leading-6 text-slate-500">
                确定移除 <span className="font-medium text-slate-900">{deleteTarget.email}</span>{" "}
                吗？移除后该邮箱将无法登录系统。
              </p>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <Button disabled={deleting} onClick={() => setDeleteTarget(null)}>
                取消
              </Button>
              <Button variant="danger" disabled={deleting} onClick={confirmDelete}>
                {deleting && <Loader2 className="animate-spin" size={13} />}
                {deleting ? "移除中" : "确认移除"}
              </Button>
            </div>
          </>
        )}
      </Modal>

      <ToastContainer toasts={toasts} />
    </>
  );
}
