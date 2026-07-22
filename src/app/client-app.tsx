"use client";

import Image from 'next/image';
import React, { useState, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { 
  Plus, Layout, Search,
  CheckCircle2, Circle,
  Calendar, Tag, Trash2, X, AlertCircle,
  PlayCircle, User, RefreshCw,
  FileAudio, MessageSquare,
  AlignLeft, Clock, Edit3, UserCircle, ChevronDown, ChevronLeft,
  SlidersHorizontal, Link as LinkIcon
} from 'lucide-react';
import type { Task, Assignee, TaskStep, StepStatus, TaskStatus, Priority } from '@/lib/types';

const PLATFORMS = ['小红书', '抖音', 'B站', '视频号', 'YouTube'];

type ToastMessage = {
  id: number;
  message: string;
  type: string;
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

let toastCount = 0;
const ToastContainer = ({ toasts }: { toasts: ToastMessage[] }) => (
  <div className="fixed bottom-6 right-6 z-[999] flex flex-col gap-3 w-[90vw] md:w-[380px] pointer-events-none">
    {toasts.map(t => (
      <div key={t.id} className={`flex items-center gap-3.5 px-4.5 py-4 rounded-2xl shadow-xl border pointer-events-auto transition-all animate-in fade-in slide-in-from-bottom-5 duration-350 ease-out
        ${t.type === 'success' ? 'bg-emerald-50/95 border-emerald-200 text-emerald-955 shadow-emerald-100/30 backdrop-blur-md' : 
          t.type === 'loading' ? 'bg-slate-50/95 border-slate-200 text-slate-955 shadow-slate-100/30 backdrop-blur-md' : 
          t.type === 'warn' ? 'bg-amber-50/95 border-amber-200 text-amber-955 shadow-amber-100/30 backdrop-blur-md' :
          t.type === 'error' ? 'bg-rose-50/95 border-rose-200 text-rose-900 shadow-rose-100/30 backdrop-blur-md' :
          'bg-slate-900/95 border-slate-800 text-white shadow-slate-955/20 backdrop-blur-md'}`}>
        {t.type === 'success' && <CheckCircle2 size={20} className="text-emerald-600 shrink-0" />}
        {t.type === 'loading' && <RefreshCw size={20} className="text-slate-500 animate-spin shrink-0" />}
        {t.type === 'warn' && <AlertCircle size={20} className="text-amber-600 shrink-0" />}
        {t.type === 'error' && <AlertCircle size={20} className="text-rose-600 shrink-0" />}
        <span className="text-xs font-semibold tracking-wide leading-relaxed">{t.message}</span>
      </div>
    ))}
  </div>
);

export function ClientApp({ 
  initialTasks, 
  assignees,
  currentUser,
  currentRole
}: { 
  initialTasks: Task[], 
  assignees: Assignee[],
  currentUser: Assignee,
  currentRole: 'admin' | 'member'
}) {
  const [tasks, setTasks] = useState(initialTasks);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(initialTasks[0]?.id || null);
  const [mobileView, setMobileView] = useState<'list'|'detail'>('list');
  const [drawerConfig, setDrawerConfig] = useState<{ isOpen: boolean, taskToEdit: Task | null }>({ isOpen: false, taskToEdit: null });
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [deleteModal, setDeleteModal] = useState<{ isOpen: boolean, taskId: string | null }>({ isOpen: false, taskId: null });
  const [assigneeModal, setAssigneeModal] = useState<{ isOpen: boolean, step: TaskStep | null }>({ isOpen: false, step: null });
  const [expandedStep, setExpandedStep] = useState<string | null>(null);
  const [taskFormPending, setTaskFormPending] = useState(false);
  const [deletePending, setDeletePending] = useState(false);

  useEffect(() => {
    const showTaskList = () => setMobileView('list');
    window.addEventListener('workspace:show-task-list', showTaskList);
    return () => window.removeEventListener('workspace:show-task-list', showTaskList);
  }, []);



  // Search & Filter State
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [ownerFilter, setOwnerFilter] = useState<string>('all');
  const [sortOption, setSortOption] = useState<string>('updated');
  const [showFilters, setShowFilters] = useState(false);

  // Temporary State for assignee selection checklists inside the modal
  const [tempAssignees, setTempAssignees] = useState<Record<string, string[]>>({});

  const searchParams = useSearchParams();
  const router = useRouter();

  // Sync tasks when initialTasks change from server
  useEffect(() => {
    // A router refresh replaces the server snapshot; local optimistic updates continue from it.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTasks(initialTasks);
  }, [initialTasks]);

  // Read URL params for Toast Messages
  useEffect(() => {
    const created = searchParams.get('created');
    const error = searchParams.get('error');
    const del = searchParams.get('delete');
    const update = searchParams.get('update');
    const stepUpdate = searchParams.get('stepUpdate');

    if (created === 'notion') {
      showToast('任务已同步并发布至 Notion 协作空间。', 'success');
    } else if (created === 'local') {
      showToast('任务已保存至本地数据库，协作空间同步未响应。', 'warn');
    } else if (error) {
      showToast('操作失败，请填写必需的标题和说明。', 'error');
    } else if (del === 'deleted_remote_and_local') {
      showToast('任务已从数据库删除，Notion 页面已同步清理。', 'success');
    } else if (del === 'deleted_local_remote_failed') {
      showToast('本地任务已删除，但 Notion 页面清理操作异常。', 'warn');
    } else if (del === 'failed') {
      showToast('删除任务失败，请稍后重试。', 'error');
    } else if (update === 'updated_local_remote_failed') {
      showToast('任务已更新，但同步至 Notion 异常。', 'warn');
    } else if (update === 'updated') {
      showToast('任务属性已成功同步更新。', 'success');
    } else if (update === 'failed' || update === 'invalid') {
      showToast('任务更新失败。', 'error');
    } else if (stepUpdate === 'updated_local_remote_failed') {
      showToast('子任务属性已保存，但 Notion 同步异常。', 'warn');
    } else if (stepUpdate === 'updated') {
      showToast('子任务已成功同步更新。', 'success');
    } else if (stepUpdate === 'failed' || stepUpdate === 'invalid') {
      showToast('子任务更新失败。', 'error');
    }

    if (created || error || del || update || stepUpdate) {
      const newParams = new URLSearchParams(searchParams.toString());
      newParams.delete('created');
      newParams.delete('notion');
      newParams.delete('error');
      newParams.delete('delete');
      newParams.delete('update');
      newParams.delete('stepUpdate');
      const queryStr = newParams.toString();
      router.replace(queryStr ? `/?${queryStr}` : '/');
    }
  }, [router, searchParams]);

  function showToast(message: string, type = 'default', duration = 3000) {
    const id = ++toastCount;
    setToasts(prev => [...prev, { id, message, type }]);
    if (duration > 0) setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), duration);
    return id;
  }

  const removeToast = (id: number) => setToasts(prev => prev.filter(t => t.id !== id));

  const readJson = async (response: Response) => {
    try {
      return await response.json();
    } catch {
      return {};
    }
  };

  const errorMessageFromResponse = (data: unknown) => {
    if (data && typeof data === 'object') {
      const record = data as Record<string, unknown>;

      return String(record.detail || record.error || '未知服务端错误');
    }

    return '未知服务端错误';
  };

  const refreshTaskList = async (nextSelectedTaskId?: string | null) => {
    const response = await fetch('/api/tasks', { cache: 'no-store' });
    const data = await readJson(response);

    if (!response.ok) {
      throw new Error(errorMessageFromResponse(data));
    }

    if (Array.isArray(data.tasks)) {
      setTasks(data.tasks);

      if (nextSelectedTaskId && data.tasks.some((task: Task) => task.id === nextSelectedTaskId)) {
        setSelectedTaskId(nextSelectedTaskId);
      } else if (!nextSelectedTaskId && data.tasks.length > 0) {
        setSelectedTaskId((current) =>
          current && data.tasks.some((task: Task) => task.id === current)
            ? current
            : data.tasks[0].id,
        );
      } else if (data.tasks.length === 0) {
        setSelectedTaskId(null);
      }
    }
  };

  // Filtering & Sorting
  const filteredTasks = tasks
    .filter(task => {
      if (statusFilter !== 'all' && task.status !== statusFilter) return false;

      const ownerIds = task.assigneeIds || (task.assigneeId ? [task.assigneeId] : []);
      if (ownerFilter === 'unassigned' && ownerIds.length > 0) return false;
      if (ownerFilter !== 'all' && ownerFilter !== 'unassigned' && !ownerIds.includes(ownerFilter)) return false;

      if (!searchQuery.trim()) return true;
      const query = searchQuery.toLowerCase();
      return (
        task.title.toLowerCase().includes(query) ||
        (task.summary || '').toLowerCase().includes(query) ||
        (task.contentSeries || '').toLowerCase().includes(query) ||
        (task.weekLabel || '').toLowerCase().includes(query) ||
        (task.platforms || []).some(p => p.toLowerCase().includes(query))
      );
    })
    .sort((a, b) => {
      if (sortOption === 'progress') {
        const getProgress = (t: Task) => t.steps.length > 0 ? (t.steps.filter(s => s.status === 'done' || s.completed).length / t.steps.length) : 0;
        return getProgress(a) - getProgress(b);
      }
      if (sortOption === 'priority') {
        const weight = (p: Priority) => p === 'high' ? 0 : p === 'medium' ? 1 : 2;
        return weight(a.priority) - weight(b.priority);
      }
      if (sortOption === 'due') {
        const time = (t: Task) => t.targetPublishDate || t.dueDate ? Date.parse(t.targetPublishDate || t.dueDate || '') : Infinity;
        return time(a) - time(b);
      }
      return Date.parse(b.updatedAt) - Date.parse(a.updatedAt);
    });

  const selectedTask = filteredTasks.find(t => t.id === selectedTaskId) || filteredTasks[0];

  // Dynamic Notion Sync Action (Client-side instant updates)
  const simulateWebhook = async (pageId?: string) => {
    if (!pageId) {
      showToast('步骤尚未关联 Notion 页面，无法触发同步。', 'warn');
      return;
    }
    const toastId = showToast('正在同步 Notion 数据并生成分段...', 'loading', 0);
    try {
      const res = await fetch('/api/notion/webhook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pageId }),
      });
      const data = await res.json();
      removeToast(toastId);
      if (data.ok) {
        showToast('Notion 协作正文同步成功', 'success');
        
        // Fetch tasks client-side instantly for responsive live update!
        const resTasks = await fetch('/api/tasks');
        const dataTasks = await resTasks.json();
        if (dataTasks.tasks) {
          setTasks(dataTasks.tasks);
        }
        router.refresh();
      } else {
        showToast(`同步失败: ${data.reason || '未知错误'}`, 'error');
      }
    } catch {
      removeToast(toastId);
      showToast('网络连接失败，请稍后重试。', 'error');
    }
  };

  // Optimistic UI update for Step Completion toggle with RBAC checks
  const handleToggleStep = async (step: TaskStep) => {
    const currentAssignees = step.assigneeIds?.length 
      ? step.assigneeIds 
      : step.assigneeId 
        ? [step.assigneeId] 
        : [];
    
    // RBAC: Non-admin can only edit their assigned subtasks
    if (currentRole !== 'admin' && !currentAssignees.includes(currentUser.id)) {
      showToast("您未被指派为此步骤的负责人，无权更改状态。", "warn");
      return;
    }

    const nextCompleted = !(step.status === 'done' || step.completed);
    
    // 1. Instant optimistic update
    setTasks(prev => prev.map(t => {
      if (t.id !== selectedTask.id) return t;
      return {
        ...t,
        steps: t.steps.map(s => {
          if (s.id !== step.id) return s;
          return { ...s, status: nextCompleted ? 'done' as const : 'todo' as const, completed: nextCompleted };
        })
      };
    }));

    const toastId = showToast(
      nextCompleted ? '正在同步步骤完成状态...' : '正在撤回步骤完成状态...',
      'loading',
      0,
    );

    try {
      const response = await fetch('/api/tasks', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: selectedTask.id,
          stepId: step.id,
          status: nextCompleted ? 'done' : 'todo',
          title: step.title,
          phase: step.phase || '',
          description: step.description || '',
          assigneeId: currentAssignees[0] || '',
          assigneeIds: currentAssignees,
          dueDate: step.dueDate || '',
          audioSegments: step.audioSegments,
        }),
      });
      const data = await readJson(response);
      removeToast(toastId);

      if (!response.ok) {
        throw new Error(errorMessageFromResponse(data));
      }

      showToast(
        data.state === 'updated_local_remote_failed'
          ? '步骤已保存，但同步 Notion 异常。'
          : '步骤状态已同步更新。',
        data.state === 'updated_local_remote_failed' ? 'warn' : 'success',
      );
      await refreshTaskList(selectedTask.id);
      router.refresh();
    } catch (err) {
      removeToast(toastId);
      setTasks(prev => prev.map(t => {
        if (t.id !== selectedTask.id) return t;
        return {
          ...t,
          steps: t.steps.map(s => {
            if (s.id !== step.id) return s;
            return { ...s, status: step.status, completed: step.completed };
          })
        };
      }));
      showToast(`步骤状态同步失败: ${err instanceof Error ? err.message : '未知错误'}`, 'error');
    }
  };

  // Optimistic UI update for Task Status change
  const handleTaskStatusChange = async (status: TaskStatus) => {
    const previousStatus = selectedTask.status;

    setTasks(prev => prev.map(t => {
      if (t.id !== selectedTask.id) return t;
      return { ...t, status };
    }));

    const toastId = showToast('正在同步主任务状态...', 'loading', 0);

    try {
      const response = await fetch('/api/tasks', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: selectedTask.id,
          status,
        }),
      });
      const data = await readJson(response);
      removeToast(toastId);

      if (!response.ok) {
        throw new Error(errorMessageFromResponse(data));
      }

      showToast(
        data.state === 'updated_local_remote_failed'
          ? '主任务已保存，但同步 Notion 异常。'
          : '主任务状态已同步更新。',
        data.state === 'updated_local_remote_failed' ? 'warn' : 'success',
      );
      await refreshTaskList(selectedTask.id);
      router.refresh();
    } catch (err) {
      removeToast(toastId);
      setTasks(prev => prev.map(t => {
        if (t.id !== selectedTask.id) return t;
        return { ...t, status: previousStatus };
      }));
      showToast(`主任务状态同步失败: ${err instanceof Error ? err.message : '未知错误'}`, 'error');
    }
  };

  // Dynamic Save Step Assignees from Modal (No Page Reload)
  const handleSaveAssignees = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const step = assigneeModal.step;
    if (!step) return;

    const selectedIds = tempAssignees[step.id] || [];

    // 1. Optimistic Update
    setTasks(prev => prev.map(t => {
      if (t.id !== selectedTask.id) return t;
      return {
        ...t,
        steps: t.steps.map(s => {
          if (s.id !== step.id) return s;
          return { 
            ...s, 
            assigneeIds: selectedIds, 
            assigneeId: selectedIds[0] || "" 
          };
        })
      };
    }));

    // Close modal instantly
    setAssigneeModal({ isOpen: false, step: null });
    const toastId = showToast('正在保存负责人更改...', 'loading', 0);

    try {
      const response = await fetch('/api/tasks', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: selectedTask.id,
          stepId: step.id,
          status: step.status || 'todo',
          title: step.title,
          phase: step.phase || '',
          description: step.description || '',
          assigneeId: selectedIds[0] || '',
          assigneeIds: selectedIds,
          dueDate: step.dueDate || ''
        })
      });
      const resData = await response.json();
      removeToast(toastId);
      if (response.ok) {
        showToast('负责人已成功同步更新', 'success');
        await refreshTaskList(selectedTask.id);
        router.refresh();
      } else {
        showToast(`更新失败: ${errorMessageFromResponse(resData)}`, 'error');
      }
    } catch {
      removeToast(toastId);
      showToast('网络连接失败，请稍后重试。', 'error');
    }
  };

  // Dynamic Save Subtask Details Form (No Page Reload)
  const handleSaveStepDetails = async (e: React.FormEvent<HTMLFormElement>, stepId: string) => {
    e.preventDefault();
    const form = e.currentTarget;
    const formData = new FormData(form);
    
    const title = String(formData.get("title") ?? "").trim();
    const phase = String(formData.get("phase") ?? "").trim();
    const description = String(formData.get("description") ?? "").trim();
    const status = String(formData.get("status") ?? "todo");
    const dueDate = String(formData.get("dueDate") ?? "").trim();
    
    const step = selectedTask.steps.find(s => s.id === stepId);
    if (!step) return;

    const currentAssignees = step.assigneeIds?.length 
      ? step.assigneeIds 
      : step.assigneeId 
        ? [step.assigneeId] 
        : [];

    // 1. Optimistic Update
    setTasks(prev => prev.map(t => {
      if (t.id !== selectedTask.id) return t;
      return {
        ...t,
        steps: t.steps.map(s => {
          if (s.id !== stepId) return s;
          return {
            ...s,
            title,
            phase,
            description,
            status: status as StepStatus,
            dueDate
          };
        })
      };
    }));

    const toastId = showToast('正在保存子任务属性...', 'loading', 0);

    try {
      const response = await fetch('/api/tasks', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: selectedTask.id,
          stepId,
          status,
          title,
          phase,
          description,
          assigneeId: currentAssignees[0] || '',
          assigneeIds: currentAssignees,
          dueDate
        })
      });
      const resData = await response.json();
      removeToast(toastId);
      if (response.ok) {
        showToast('子任务属性已同步更新', 'success');
        await refreshTaskList(selectedTask.id);
        router.refresh();
      } else {
        showToast(`保存失败: ${errorMessageFromResponse(resData)}`, 'error');
      }
    } catch {
      removeToast(toastId);
      showToast('网络连接失败，请稍后重试。', 'error');
    }
  };

  const formString = (formData: FormData, key: string) =>
    String(formData.get(key) ?? '').trim();

  const formStringList = (formData: FormData, key: string) =>
    formData.getAll(key).map(String).map((value) => value.trim()).filter(Boolean);

  const handleSubmitTaskForm = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (taskFormPending) return;

    const formData = new FormData(e.currentTarget);
    const isEdit = Boolean(drawerConfig.taskToEdit);
    const taskId = drawerConfig.taskToEdit?.id;
    const assigneeIds = formStringList(formData, 'assigneeIds');
    const stepAssigneeIds = formStringList(formData, 'stepAssigneeIds');
    const rawSteps = formString(formData, 'steps')
      .split('\n')
      .map((step) => step.trim())
      .filter(Boolean);
    const payload = {
      ...(isEdit ? { action: 'updateTask', id: taskId } : {}),
      kind: formString(formData, 'kind') || 'video',
      title: formString(formData, 'title'),
      summary: formString(formData, 'summary'),
      status: formString(formData, 'status') || drawerConfig.taskToEdit?.status || 'active',
      priority: formString(formData, 'priority') || 'medium',
      assigneeId: assigneeIds[0] || assignees[0]?.id || '',
      assigneeIds,
      stepAssigneeId: stepAssigneeIds[0] || assigneeIds[0] || assignees[0]?.id || '',
      stepAssigneeIds,
      dueDate: formString(formData, 'dueDate'),
      contentSeries: formString(formData, 'contentSeries'),
      weekLabel: formString(formData, 'weekLabel'),
      platforms: formStringList(formData, 'platforms'),
      targetPublishDate: formString(formData, 'targetPublishDate'),
      steps: rawSteps,
    };

    if (!payload.title || !payload.summary) {
      showToast('请填写任务标题和任务摘要。', 'error');
      return;
    }

    setTaskFormPending(true);
    const toastId = showToast(
      isEdit ? '正在保存任务并同步 Notion...' : '正在创建任务并发布到 Notion...',
      'loading',
      0,
    );

    try {
      const response = await fetch('/api/tasks', {
        method: isEdit ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await readJson(response);
      removeToast(toastId);

      if (!response.ok) {
        throw new Error(errorMessageFromResponse(data));
      }

      const nextTaskId = isEdit ? taskId : data.task?.id;

      await refreshTaskList(nextTaskId);
      setSelectedTaskId(nextTaskId || selectedTaskId);
      setMobileView('detail');
      setDrawerConfig({ isOpen: false, taskToEdit: null });
      showToast(
        isEdit
          ? data.state === 'updated_local_remote_failed'
            ? '任务已保存，但同步 Notion 异常。'
            : '任务属性已同步更新。'
          : data.task?.notion?.state === 'published'
            ? '任务已创建并同步到 Notion。'
            : '任务已保存到数据库，但 Notion 同步异常。',
        isEdit
          ? data.state === 'updated_local_remote_failed' ? 'warn' : 'success'
          : data.task?.notion?.state === 'published' ? 'success' : 'warn',
      );
      router.refresh();
    } catch (err) {
      removeToast(toastId);
      showToast(`任务保存失败: ${err instanceof Error ? err.message : '未知错误'}`, 'error');
    } finally {
      setTaskFormPending(false);
    }
  };

  const handleDeleteTask = async () => {
    const taskId = deleteModal.taskId;

    if (!taskId || deletePending) return;

    setDeletePending(true);
    const toastId = showToast('正在删除任务并同步清理 Notion...', 'loading', 0);

    try {
      const response = await fetch(`/api/tasks?id=${encodeURIComponent(taskId)}`, {
        method: 'DELETE',
      });
      const data = await readJson(response);
      removeToast(toastId);

      if (!response.ok) {
        throw new Error(errorMessageFromResponse(data));
      }

      const remainingTasks = tasks.filter((task) => task.id !== taskId);
      const nextTaskId = remainingTasks[0]?.id ?? null;

      setTasks(remainingTasks);
      setSelectedTaskId(nextTaskId);
      setDeleteModal({ isOpen: false, taskId: null });
      showToast(
        data.state === 'deleted_local_remote_failed'
          ? '任务已从数据库删除，但 Notion 页面清理异常。'
          : '任务已删除，Notion 页面已同步清理。',
        data.state === 'deleted_local_remote_failed' ? 'warn' : 'success',
      );
      await refreshTaskList(nextTaskId);
      router.refresh();
    } catch (err) {
      removeToast(toastId);
      showToast(`删除任务失败: ${err instanceof Error ? err.message : '未知错误'}`, 'error');
    } finally {
      setDeletePending(false);
    }
  };



  // Toggle Temp Assignee Selection
  const handleToggleTempAssignee = (stepId: string, assigneeId: string) => {
    setTempAssignees(prev => {
      const current = prev[stepId] || [];
      const next = current.includes(assigneeId)
        ? current.filter(id => id !== assigneeId)
        : [...current, assigneeId];
      return {
        ...prev,
        [stepId]: next
      };
    });
  };

  // Badges & Labels Styling
  const getNotionBadge = (state?: string, error?: string, hideSuccess = false) => {
    switch (state) {
      case 'published':
        if (hideSuccess) return null;
        return <span className="px-2.5 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200/50 rounded-lg text-[10px] font-extrabold tracking-wider">Notion 已同步</span>;
      case 'pending':
        return <span className="px-2.5 py-1 bg-blue-50 text-blue-700 border border-blue-200/50 rounded-lg text-[10px] font-extrabold tracking-wider animate-pulse">正在同步 Notion</span>;
      case 'failed':
        return (
          <span 
            className="px-2.5 py-1 bg-rose-50 text-rose-700 border border-rose-200/50 rounded-lg text-[10px] font-extrabold tracking-wider cursor-help"
            title={error || '同步发生错误'}
          >
            同步 Notion 失败
          </span>
        );
      default:
        if (hideSuccess) return null;
        return <span className="px-2.5 py-1 bg-slate-50 text-slate-500 border border-slate-200/80 rounded-lg text-[10px] font-extrabold tracking-wider">未同步 Notion</span>;
    }
  };

  const getStatusSelectClass = (status: TaskStatus) => {
    const base = "h-[22px] rounded-lg text-[10px] font-extrabold tracking-wider uppercase border outline-none cursor-pointer disabled:cursor-not-allowed disabled:opacity-75 transition-all shadow-sm appearance-none bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%20%220%200%2020%2020%2522%20fill%3D%22none%22%3E%3Cpath%20d%3D%22M7%209l3%203%203-3%22%20stroke%3D%22currentColor%22%20stroke-width%3D%221.8%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%2F%3E%3C%2Fsvg%3E')] bg-[position:right_4px_center] bg-[size:12px] pl-2.5 pr-6";
    switch (status) {
      case 'active':
        return `${base} bg-blue-50 text-blue-700 border-blue-200/50 hover:bg-blue-100/30`;
      case 'blocked':
        return `${base} bg-rose-50 text-rose-700 border-rose-200/50 hover:bg-rose-100/30`;
      case 'done':
        return `${base} bg-emerald-50 text-emerald-700 border-emerald-200/50 hover:bg-emerald-100/30`;
      default:
        return `${base} bg-slate-50 text-slate-655 border-slate-200/80 hover:bg-slate-100/30`;
    }
  };

  const getPriorityLabel = (priority: string) => {
    switch (priority) {
      case 'high':
        return <span className="px-2.5 py-1 bg-rose-50 text-rose-750 border border-rose-200/50 rounded-lg text-[10px] font-extrabold tracking-wider">高优先级</span>;
      case 'medium':
        return <span className="px-2.5 py-1 bg-amber-50 text-amber-750 border border-amber-200/50 rounded-lg text-[10px] font-extrabold tracking-wider">中优先级</span>;
      default:
        return <span className="px-2.5 py-1 bg-slate-50 text-slate-655 border border-slate-200/80 rounded-lg text-[10px] font-extrabold tracking-wider">低优先级</span>;
    }
  };

  return (
    <div className="relative flex h-full overflow-hidden bg-[#f8fafc] font-sans text-slate-800 md:flex-row">
      {/* Task List Panel */}
      <div className={`${mobileView === 'detail' ? 'hidden md:flex' : 'flex'} w-full md:w-[380px] border-r border-slate-200/80 bg-slate-50/50 flex-col shrink-0 h-full`}>
        <div className="p-5 border-b border-slate-200/60 flex flex-col bg-white shrink-0 gap-3.5 shadow-[0_1px_3px_rgba(15,23,42,0.01)]">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-[9px] font-bold text-blue-600 uppercase tracking-widest font-display">Helloview</span>
              <h2 className="font-black text-xl text-slate-900 mt-0.5 tracking-tight font-display">生产任务列表</h2>
            </div>
            
            {/* RBAC: Only Admin can create tasks */}
            {currentRole === 'admin' && (
              <button 
                onClick={() => setDrawerConfig({ isOpen: true, taskToEdit: null })}
                className="p-2.5 bg-slate-900 text-white rounded-xl hover:bg-slate-850 transition-all duration-200 shadow-sm hover:shadow active:scale-95 cursor-pointer"
                title="新建流程"
              >
                <Plus size={16} />
              </button>
            )}
          </div>

          {/* Search bar & Filter Toggle */}
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
              <input 
                type="text" 
                placeholder="搜索标题、系列、平台..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full h-10 pl-10 pr-3.5 bg-slate-50/50 border border-slate-200 rounded-xl text-xs font-semibold outline-none transition duration-205 focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/10 placeholder-slate-400 shadow-inner"
              />
            </div>
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`h-10 px-3 border rounded-xl flex items-center justify-center transition-all duration-200 active:scale-95 cursor-pointer shadow-sm
                ${showFilters ? 'bg-blue-50 border-blue-200 text-blue-600' : 'bg-white border-slate-200/80 text-slate-500 hover:text-slate-700 hover:bg-slate-55'}`}
              title="过滤与筛选"
            >
              <SlidersHorizontal size={15} />
            </button>
          </div>

          {/* Collapsible Filters */}
          {showFilters && (
            <div className="p-4 bg-slate-50 border border-slate-200/80 rounded-2xl flex flex-col gap-4 animate-in slide-in-from-top-3 duration-250 shadow-[0_4px_16px_rgba(15,23,42,0.02)]">
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <span className="text-[9px] font-extrabold text-slate-400 uppercase tracking-wider font-display">状态过滤</span>
                  <select 
                    value={statusFilter} 
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="premium-input w-full cursor-pointer appearance-none bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2020%2020%2522%20fill%3D%22none%22%3E%3Cpath%20d%3D%22M7%209l3%203%203-3%22%20stroke%3D%22%234b5563%22%20stroke-width%3D%221.5%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%2F%3E%3C%2Fsvg%3E')] bg-[position:right_10px_center] bg-[size:16px] pr-9"
                  >
                    <option value="all">全部状态</option>
                    <option value="draft">草稿</option>
                    <option value="active">进行中</option>
                    <option value="blocked">已阻塞</option>
                    <option value="done">已完成</option>
                  </select>
                </div>

                <div className="flex flex-col gap-1.5">
                  <span className="text-[9px] font-extrabold text-slate-400 uppercase tracking-wider font-display">排序规则</span>
                  <select 
                    value={sortOption} 
                    onChange={(e) => setSortOption(e.target.value)}
                    className="premium-input w-full cursor-pointer appearance-none bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2020%2020%2522%20fill%3D%22none%22%3E%3Cpath%20d%3D%22M7%209l3%203%203-3%22%20stroke%3D%22%234b5563%22%20stroke-width%3D%221.5%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%2F%3E%3C%2Fsvg%3E')] bg-[position:right_10px_center] bg-[size:16px] pr-9"
                  >
                    <option value="updated">修改时间</option>
                    <option value="progress">进度低优先</option>
                    <option value="priority">优先级高</option>
                    <option value="due">截至时间前</option>
                  </select>
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <span className="text-[9px] font-extrabold text-slate-400 uppercase tracking-wider font-display">按主负责人</span>
                <select 
                  value={ownerFilter} 
                  onChange={(e) => setOwnerFilter(e.target.value)}
                  className="premium-input w-full cursor-pointer appearance-none bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2020%2020%2522%20fill%3D%22none%22%3E%3Cpath%20d%3D%22M7%209l3%203%203-3%22%20stroke%3D%22%234b5563%22%20stroke-width%3D%221.5%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%2F%3E%3C%2Fsvg%3E')] bg-[position:right_10px_center] bg-[size:16px] pr-9"
                >
                  <option value="all">全部主负责人</option>
                  <option value="unassigned">未指派人员</option>
                  {assignees.map(a => (
                    <option key={a.id} value={a.id}>{a.name}</option>
                  ))}
                </select>
              </div>

              {(statusFilter !== 'all' || ownerFilter !== 'all' || sortOption !== 'updated' || searchQuery) && (
                <button 
                  onClick={() => {
                    setStatusFilter('all');
                    setOwnerFilter('all');
                    setSortOption('updated');
                    setSearchQuery('');
                  }}
                  className="w-full py-2 text-xs font-bold text-blue-600 bg-blue-50/50 hover:bg-blue-100 rounded-xl transition-all cursor-pointer text-center"
                >
                  重置筛选条件
                </button>
              )}
            </div>
          )}
        </div>
        
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {filteredTasks.map(task => {
            const isSelected = selectedTaskId === task.id;
            const progress = task.steps.length > 0 ? Math.round((task.steps.filter(s => s.status === 'done' || s.completed).length / task.steps.length) * 100) : 0;
            const currentActiveStep = task.steps.find(s => s.status === 'in_progress' || s.status === 'processing') || task.steps.find(s => s.status === 'todo');
            const activeAssigneeIds = currentActiveStep?.assigneeIds || [];
            const activeAssignee = activeAssigneeIds.length > 0 ? assignees.find(a => a.id === activeAssigneeIds[0]) : null;
            
            return (
              <div 
                key={task.id}
                onClick={() => { 
                  setSelectedTaskId(task.id); 
                  setExpandedStep(task.steps[0]?.id || null); 
                  setMobileView('detail');
                }}
                className={`p-4.5 rounded-2xl cursor-pointer transition-all duration-300 border text-left premium-card-shadow hover:-translate-y-0.5
                  ${isSelected ? 'bg-white border-blue-500 shadow-[0_8px_30px_rgba(37,99,235,0.03)] ring-1 ring-blue-500/5 translate-x-1' : 'bg-white border-slate-200/80 hover:border-slate-350 hover:shadow-[0_6px_20px_rgba(15,23,42,0.02)]'}`}
              >
                <div className="flex items-start justify-between gap-2 mb-2.5">
                  <h3 className={`font-bold text-xs leading-snug line-clamp-2 transition-colors duration-205 ${isSelected ? 'text-blue-955 font-extrabold' : 'text-slate-800'}`}>
                    {task.title}
                  </h3>
                  {task.priority === 'high' && <div className="w-2.5 h-2.5 rounded-full bg-rose-500 shrink-0 mt-0.5 shadow-[0_0_8px_rgba(244,63,94,0.4)]" />}
                  {task.priority === 'medium' && <div className="w-2.5 h-2.5 rounded-full bg-amber-400 shrink-0 mt-0.5 shadow-[0_0_8px_rgba(251,191,36,0.4)]" />}
                </div>
                
                <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5 text-[9px] text-slate-505 font-bold mb-3.5">
                  <span className="flex items-center gap-1 bg-slate-100 px-2 py-0.5 rounded text-slate-650"><Tag size={9}/> {(task.platforms && task.platforms.length > 0) ? task.platforms[0] : '未选平台'}{(task.platforms && task.platforms.length > 1) ? '+' : ''}</span>
                  <span className="flex items-center gap-1 bg-slate-100 px-2 py-0.5 rounded text-slate-655"><Calendar size={9}/> {task.weekLabel || '未排期'}</span>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 flex-1 mr-4">
                    <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-full bg-blue-600 rounded-full transition-all duration-750 ease-out" style={{ width: `${progress}%` }} />
                    </div>
                    <span className="text-[9px] font-extrabold text-slate-400 w-6">{progress}%</span>
                  </div>
                  
                  {activeAssignee && progress < 100 && (
                     <div className="shrink-0" title={`当前执行人: ${activeAssignee.name}`}>
                       {renderAvatar(activeAssignee, "w-5.5 h-5.5")}
                     </div>
                  )}
                  {progress === 100 && (
                     <CheckCircle2 size={16} className="text-emerald-500" />
                  )}
                </div>
              </div>
            );
          })}
          {filteredTasks.length === 0 && (
             <div className="text-center py-16 text-slate-400 text-xs font-semibold">
               未查询到相关生产流程
             </div>
          )}
        </div>
      </div>

      {/* Task Details Panel */}
      <div className={`${mobileView === 'list' ? 'hidden md:flex' : 'flex'} flex-1 flex-col bg-white overflow-hidden relative min-w-0 h-full`}>
        {selectedTask ? (
          <div className="flex-1 flex flex-col overflow-hidden animate-in fade-in duration-300 h-full">
            
            {/* Detail Header Section */}
            <div className="px-5 sm:px-8 py-5.5 border-b border-slate-200/60 flex flex-col gap-4 shrink-0 bg-white sticky top-0 z-20">
              <div className="flex items-start justify-between flex-wrap gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-3.5">
                    <button 
                      onClick={() => setMobileView('list')}
                      className="md:hidden flex items-center justify-center p-2 rounded-xl bg-slate-100 text-slate-655 hover:bg-slate-200 transition-colors active:scale-95"
                    >
                      <ChevronLeft size={16} />
                    </button>
                    
                    {/* Content Series */}
                    {selectedTask.contentSeries && (
                      <span className="px-2.5 py-1 bg-blue-600 text-white text-[10px] font-extrabold rounded-lg shadow-sm">
                        {selectedTask.contentSeries}
                      </span>
                    )}
                    
                    {/* Platforms */}
                    <div className="flex items-center gap-1 bg-slate-100/80 border border-slate-200/50 p-0.5 rounded-lg">
                      {(selectedTask.platforms || []).map(p => (
                        <span key={p} className="px-2 py-0.5 text-slate-750 text-[9px] font-extrabold rounded bg-white shadow-sm uppercase tracking-wider">{p}</span>
                      ))}
                    </div>

                    {selectedTask.weekLabel && (
                      <span className="px-2.5 py-1 bg-slate-150 text-slate-750 text-[10px] font-extrabold rounded-lg font-mono">
                        {selectedTask.weekLabel}
                      </span>
                    )}
                  </div>
                  
                  <h1 className="text-xl sm:text-2xl font-black text-slate-900 mb-2.5 tracking-tight leading-tight font-display">{selectedTask.title}</h1>
                  <p className="text-slate-505 text-xs leading-relaxed max-w-4xl font-semibold">{selectedTask.summary}</p>
                </div>

                {/* Header Action Buttons (RBAC Controlled) */}
                <div className="flex items-center gap-2 shrink-0">
                   {currentRole === 'admin' ? (
                     <button 
                      onClick={() => setDrawerConfig({ isOpen: true, taskToEdit: selectedTask })}
                      className="h-9 px-4 text-slate-755 hover:text-blue-650 hover:bg-blue-50/50 border border-slate-200/80 rounded-xl transition-all duration-200 text-xs font-bold flex items-center gap-1.5 active:scale-95 bg-white shadow-sm cursor-pointer"
                     >
                       <Edit3 size={14} /> 属性编辑
                     </button>
                   ) : (
                     <div className="h-9 px-4 bg-slate-50 border border-slate-200/80 text-slate-400 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-not-allowed select-none opacity-60">
                       <Edit3 size={14} /> 属性只读
                     </div>
                   )}

                   {selectedTask.notion?.pageId && (
                     <a 
                       href={`https://www.notion.so/${selectedTask.notion.pageId.replaceAll('-', '')}`} 
                       target="_blank" 
                       rel="noreferrer" 
                       className="hidden sm:inline-flex h-9 px-4 text-slate-755 hover:text-blue-655 hover:bg-blue-50/50 border border-slate-200/80 rounded-xl transition-all duration-200 text-xs font-bold items-center gap-1.5 active:scale-95 bg-white shadow-sm"
                     >
                       <LinkIcon size={13} /> Notion 页面
                     </a>
                   )}

                   {currentRole === 'admin' && (
                     <button 
                      onClick={() => setDeleteModal({ isOpen: true, taskId: selectedTask.id })}
                      className="h-9 w-9 text-slate-500 hover:text-rose-600 hover:bg-rose-50/50 border border-slate-200/80 rounded-xl transition-all duration-200 active:scale-95 bg-white flex items-center justify-center shadow-sm cursor-pointer"
                      title="删除任务"
                     >
                      <Trash2 size={15} />
                    </button>
                   )}
                </div>
              </div>
              
              {/* Task Info Row (Unified Metadata Strip with Notion status badge) */}
              <div className="flex flex-wrap items-center gap-x-5 gap-y-3 text-xs text-slate-500 font-semibold border-t border-slate-100 pt-4.5 mt-2">
                <div className="flex items-center gap-1.5">
                  <UserCircle size={14} className="text-slate-400 shrink-0" />
                  <span className="text-slate-450">总负责人:</span>
                  <span className="text-slate-800 font-bold ml-0.5">
                    {selectedTask.assigneeIds && selectedTask.assigneeIds.length > 0 
                      ? selectedTask.assigneeIds.map(id => assignees.find(a => a.id === id)?.name).filter(Boolean).join(', ') 
                      : '未分配'}
                  </span>
                </div>
                
                <div className="h-3.5 w-px bg-slate-200 hidden sm:block" />

                <div className="flex items-center gap-1.5">
                  <Clock size={14} className="text-slate-400 shrink-0" />
                  <span className="text-slate-450">排期截止:</span>
                  <span className="text-slate-800 font-bold ml-0.5">
                    {selectedTask.dueDate || selectedTask.targetPublishDate || '未设置'}
                  </span>
                </div>

                <div className="h-3.5 w-px bg-slate-200 hidden sm:block" />

                <div className="flex items-center gap-2">
                  {getPriorityLabel(selectedTask.priority)}
                </div>

                <div className="h-3.5 w-px bg-slate-200 hidden sm:block" />

                <div className="flex items-center gap-2">
                  {getNotionBadge(selectedTask.notion?.state, selectedTask.notion?.error, false)}
                </div>

                <div className="h-3.5 w-px bg-slate-200 hidden sm:block" />

                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wide font-display">工作流状态:</span>
                  <select 
                    value={selectedTask.status} 
                    onChange={(e) => handleTaskStatusChange(e.target.value as TaskStatus)}
                    disabled={currentRole !== 'admin'}
                    className={getStatusSelectClass(selectedTask.status)}
                  >
                    <option value="draft" className="text-slate-800 bg-white">草稿</option>
                    <option value="active" className="text-slate-800 bg-white">进行中</option>
                    <option value="blocked" className="text-slate-800 bg-white">阻塞</option>
                    <option value="done" className="text-slate-800 bg-white">已完成</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Steps Timeline Workflow */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-8 pb-10 sm:pb-32">
              <div className="w-full">
                <h3 className="text-[10px] font-extrabold text-slate-455 uppercase tracking-widest mb-6 font-display">视频制作进度时间线</h3>
                
                <div className="relative">
                  {/* Timeline connecting line */}
                  <div className="absolute top-4 bottom-8 left-[13px] w-[2px] bg-slate-100" />
                  
                  <div className="space-y-4">
                    {selectedTask.steps.map((step, index) => {
                      const isExpanded = expandedStep === step.id;
                      const isScript = step.phase === '脚本' || step.title.includes('文案') || step.title.includes('脚本');
                      const isAudio = step.phase === '音频' || step.title.includes('音频') || step.title.includes('录音');
                      const isMaterial = step.phase === '素材' || step.title.includes('素材') || step.title.includes('画面');
                      
                      // Normalize single assignee to assigneeIds list for multi-select checklists
                      const currentAssignees = step.assigneeIds?.length 
                        ? step.assigneeIds 
                        : step.assigneeId 
                          ? [step.assigneeId] 
                          : [];
                      
                      const isAuthorizedForStep = currentRole === 'admin' || currentAssignees.includes(currentUser.id);
                      
                      return (
                        <div key={step.id} className="relative z-10 animate-rise" style={{ animationDelay: `${index * 50}ms` }}>
                          {/* Timeline Step Header Card */}
                          <div 
                            className={`flex flex-col sm:flex-row sm:items-center gap-4 p-4.5 rounded-2xl cursor-pointer border transition-all duration-300 premium-card-shadow
                              ${isExpanded ? 'border-blue-150 bg-slate-50/50 shadow-[0_4px_12px_rgba(37,99,235,0.01)]' : 'border-slate-200/80 bg-white hover:border-slate-350 hover:shadow-[0_8px_24px_rgba(15,23,42,0.015)]'}`}
                            onClick={() => setExpandedStep(isExpanded ? null : step.id)}
                          >
                            <div className="flex items-center gap-3 sm:gap-4 flex-1 w-full">
                              <button 
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleToggleStep(step);
                                }}
                                className="focus:outline-none bg-white rounded-full flex items-center justify-center w-6 h-6 hover:scale-110 active:scale-90 transition-all duration-200"
                              >
                                {(step.status === 'done' || step.completed) ? (
                                  <CheckCircle2 size={22} className="text-emerald-500 bg-white" />
                                ) : step.status === 'blocked' ? (
                                  <AlertCircle size={22} className="text-amber-500 bg-white animate-pulse" />
                                ) : (step.status === 'in_progress' || step.status === 'processing') ? (
                                  <PlayCircle size={22} className="text-blue-600 bg-white animate-pulse" />
                                ) : (
                                  <Circle size={22} className="text-slate-300 hover:text-slate-400 bg-white" />
                                )}
                              </button>
                              
                              <span className={`text-sm font-bold truncate transition-colors duration-250 ${(step.status === 'done' || step.completed) ? 'text-slate-400 line-through font-semibold' : step.status === 'blocked' ? 'text-amber-750 font-extrabold' : 'text-slate-850'}`}>
                                {index + 1}. {step.title}
                              </span>

                              {/* Only show sync status if failed or pending */}
                              {step.notion?.state && (
                                <div className="ml-1 shrink-0">
                                  {getNotionBadge(step.notion.state, step.notion.error, true)}
                                </div>
                              )}
                            </div>

                            {/* Assignee selector trigger (RBAC controlled) */}
                            <div className="flex items-center shrink-0" onClick={e => e.stopPropagation()}>
                              {currentRole === 'admin' ? (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setAssigneeModal({ isOpen: true, step });
                                    setTempAssignees(prev => ({
                                      ...prev,
                                      [step.id]: currentAssignees
                                    }));
                                  }}
                                  className="flex items-center gap-2 pl-2 pr-3 h-8 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl transition-all duration-200 text-xs font-bold text-slate-700 shadow-sm cursor-pointer active:scale-95"
                                >
                                  {/* Avatars group inside button */}
                                  <div className="flex items-center shrink-0 mr-0.5">
                                    {currentAssignees.length === 0 ? (
                                      <div className="w-5.5 h-5.5 rounded-full border border-dashed border-slate-300 bg-slate-50/50 flex items-center justify-center text-slate-400">
                                        <User size={10} />
                                      </div>
                                    ) : (
                                      currentAssignees.slice(0, 3).map((assigneeId, idx) => {
                                        const assignee = assignees.find(a => a.id === assigneeId);
                                        if (!assignee) return null;
                                        return (
                                          <div 
                                            key={assigneeId} 
                                            className={idx > 0 ? "-ml-1.5" : ""}
                                          >
                                            {renderAvatar(assignee, "w-5.5 h-5.5")}
                                          </div>
                                        );
                                      })
                                    )}
                                  </div>
                                  
                                  <span className="truncate max-w-[80px] sm:max-w-none">
                                    {currentAssignees.length === 0 ? '指派执行人' : 
                                     currentAssignees.length === 1 ? assignees.find(a => a.id === currentAssignees[0])?.name || '未知负责人' : 
                                     `${currentAssignees.length} 人协作`}
                                  </span>
                                  <ChevronDown size={12} className="text-slate-400 shrink-0 ml-0.5" />
                                </button>
                              ) : (
                                <div className="flex items-center gap-2 pl-2 pr-3 h-8 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-500 shadow-inner select-none">
                                  {/* Avatars group read-only */}
                                  <div className="flex items-center shrink-0 mr-0.5">
                                    {currentAssignees.length === 0 ? (
                                      <div className="w-5.5 h-5.5 rounded-full border border-slate-200 bg-slate-100 flex items-center justify-center text-slate-400">
                                        <User size={10} />
                                      </div>
                                    ) : (
                                      currentAssignees.slice(0, 3).map((assigneeId, idx) => {
                                        const assignee = assignees.find(a => a.id === assigneeId);
                                        if (!assignee) return null;
                                        return (
                                          <div 
                                            key={assigneeId} 
                                            className={idx > 0 ? "-ml-1.5" : ""}
                                          >
                                            {renderAvatar(assignee, "w-5.5 h-5.5")}
                                          </div>
                                        );
                                      })
                                    )}
                                  </div>
                                  <span>
                                    {currentAssignees.length === 0 ? '未指派执行人' : 
                                     currentAssignees.length === 1 ? assignees.find(a => a.id === currentAssignees[0])?.name || '未知负责人' : 
                                     `${currentAssignees.length} 人协作`}
                                  </span>
                                </div>
                              )}
                            </div>

                          </div>

                          {/* Expanded Step details form & inline tools */}
                          <div className={`grid transition-all duration-250 ease-in-out ${isExpanded ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}>
                            <div className="overflow-hidden">
                              <div className="ml-3 sm:ml-9 mt-4 mb-6 pr-1 pt-1 grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
                                
                                {/* Left Side Column: Step Properties Edit Card (7 cols) - RBAC Form Controls */}
                                <form 
                                  key={`step-form-${step.id}`}
                                  onSubmit={(e) => handleSaveStepDetails(e, step.id)}
                                  className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-sm grid gap-4 grid-cols-2 lg:col-span-7 animate-in fade-in duration-200"
                                >
                                  <input type="hidden" name="taskId" value={selectedTask.id} />
                                  <input type="hidden" name="stepId" value={step.id} />
                                  
                                  {/* Hidden inputs to preserve multiple assignees list in this form */}
                                  <input type="hidden" name="assigneeId" value={step.assigneeId || ""} />
                                  {(step.assigneeIds || []).map(id => (
                                    <input type="hidden" key={id} name="assigneeIds" value={id} />
                                  ))}

                                  <div className="flex flex-col gap-1.5 col-span-1">
                                    <span className="text-[9px] font-extrabold text-slate-400 uppercase tracking-widest font-display">阶段</span>
                                    <input 
                                      name="phase" 
                                      defaultValue={step.phase || ''} 
                                      disabled={!isAuthorizedForStep}
                                      className="premium-input disabled:cursor-not-allowed disabled:bg-slate-50/50 disabled:text-slate-500"
                                    />
                                  </div>

                                  <div className="flex flex-col gap-1.5 col-span-1">
                                    <span className="text-[9px] font-extrabold text-slate-400 uppercase tracking-widest font-display">状态</span>
                                    <select 
                                      name="status" 
                                      defaultValue={step.status || 'todo'}
                                      disabled={!isAuthorizedForStep}
                                      className="premium-input cursor-pointer appearance-none bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2020%2020%2522%20fill%3D%22none%22%3E%3Cpath%20d%3D%22M7%209l3%203%203-3%22%20stroke%3D%22%236b7280%22%20stroke-width%3D%221.5%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%2F%3E%3C%2Fsvg%3E')] bg-[position:right_10px_center] bg-[size:16px] pr-9 disabled:cursor-not-allowed disabled:bg-slate-50/50 disabled:text-slate-500"
                                    >
                                      <option value="todo">待开始</option>
                                      <option value="processing">处理中</option>
                                      <option value="in_progress">进行中</option>
                                      <option value="blocked">已阻塞</option>
                                      <option value="done">已完成</option>
                                    </select>
                                  </div>

                                  <div className="flex flex-col gap-1.5 col-span-2">
                                    <span className="text-[9px] font-extrabold text-slate-400 uppercase tracking-widest font-display">步骤标题 *</span>
                                    <input 
                                      name="title" 
                                      defaultValue={step.title} 
                                      required
                                      disabled={!isAuthorizedForStep}
                                      className="premium-input disabled:cursor-not-allowed disabled:bg-slate-50/50 disabled:text-slate-500"
                                    />
                                  </div>

                                  <div className="flex flex-col gap-1.5 col-span-2">
                                    <span className="text-[9px] font-extrabold text-slate-400 uppercase tracking-widest font-display">截止日期</span>
                                    <input 
                                      name="dueDate" 
                                      type="date"
                                      defaultValue={step.dueDate || ''} 
                                      disabled={!isAuthorizedForStep}
                                      className="premium-input disabled:cursor-not-allowed disabled:bg-slate-50/50 disabled:text-slate-500"
                                    />
                                  </div>

                                  <div className="flex flex-col gap-1.5 col-span-2">
                                    <span className="text-[9px] font-extrabold text-slate-400 uppercase tracking-widest font-display">子任务说明</span>
                                    <textarea 
                                      name="description" 
                                      defaultValue={step.description || ''} 
                                      rows={2}
                                      disabled={!isAuthorizedForStep}
                                      className="px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 outline-none resize-none transition-all focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 shadow-[inset_0_1px_2px_rgba(0,0,0,0.01)] leading-relaxed placeholder-slate-400 disabled:cursor-not-allowed disabled:bg-slate-50/50 disabled:text-slate-500"
                                      placeholder="描述具体的执行内容与产出规范..."
                                    />
                                  </div>

                                  {isAuthorizedForStep && (
                                    <div className="col-span-2 flex justify-end">
                                      <button 
                                        type="submit" 
                                        className="px-6 h-9.5 bg-slate-900 hover:bg-blue-600 text-white rounded-xl text-xs font-bold transition-all duration-200 active:scale-[0.98] flex items-center justify-center gap-1.5 shadow-md shadow-blue-100 cursor-pointer"
                                      >
                                        保存子任务属性
                                      </button>
                                    </div>
                                  )}
                                </form>

                                {/* Right Side Column: Notion content / Audio Segments (5 cols) */}
                                <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-sm lg:col-span-5 flex flex-col gap-3.5 min-h-[300px] h-full justify-between animate-in fade-in duration-200">
                                  <div className="flex flex-col gap-3">
                                    <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                                      <div className="text-xs font-black text-slate-800 flex items-center gap-2 font-display">
                                        {isScript ? (
                                          <AlignLeft size={14} className="text-slate-400" />
                                        ) : (
                                          <FileAudio size={14} className="text-slate-400" />
                                        )}
                                        <span>{isScript ? 'Notion 关联正文' : '音频分段列表'}</span>
                                      </div>
                                      {getNotionBadge(step.notion?.state, step.notion?.error, true)}
                                    </div>

                                    {/* Script Section */}
                                    {isScript && (
                                      <>
                                        {(step.status === 'done' || step.completed) ? (
                                          <div className="flex flex-col items-center justify-center py-10 text-slate-400 bg-slate-50/50 rounded-xl border border-dashed border-slate-250 text-center px-4">
                                            <CheckCircle2 size={24} className="text-emerald-500 mb-2 animate-in zoom-in" />
                                            <p className="text-xs font-extrabold text-slate-800">文案已锁定并生成音频分段</p>
                                          </div>
                                        ) : (
                                          <div className="bg-slate-50/30 border border-slate-150 rounded-xl p-3.5 max-h-48 overflow-y-auto font-mono text-[10.5px] text-slate-655 leading-relaxed shadow-inner">
                                            <pre className="font-sans whitespace-pre-wrap">{step.scriptText || '未拉取到 Notion 文案。请点击下方按钮重新拉取并同步。'}</pre>
                                          </div>
                                        )}
                                      </>
                                    )}

                                    {/* Audio/Segments Section */}
                                    {(isAudio || isMaterial) && (
                                      <div className="space-y-3 max-h-52 overflow-y-auto pr-1">
                                        {(!step.audioSegments || step.audioSegments.length === 0) ? (
                                          <div className="text-center py-10 text-slate-400 bg-slate-50/50 rounded-xl border border-dashed border-slate-200">
                                            <MessageSquare size={20} className="mx-auto text-slate-300 mb-1.5" />
                                            <p className="text-[10px] font-bold text-slate-655">暂无分段列表</p>
                                            <p className="text-[9px] text-slate-400 mt-0.5">请先同步并确认前序脚本步骤文案</p>
                                          </div>
                                        ) : (
                                          step.audioSegments.map((seg, idx) => (
                                            <div key={seg.id} className="bg-slate-50/30 border border-slate-150 rounded-xl p-3.5 flex flex-col gap-2.5 shadow-sm hover:bg-slate-55/50 transition-colors duration-200">
                                              <div className="flex items-center justify-between">
                                                <span className="text-[10px] font-extrabold text-slate-400 uppercase font-display">分段 {idx + 1}</span>
                                                {seg.status === 'uploaded' && (
                                                   <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-250/30 text-[9px] font-bold">● 录音已就绪 (Notion 已同步)</span>
                                                 )}
                                              </div>
                                              <p className="text-[11px] text-slate-705 leading-relaxed font-semibold">{seg.text}</p>
                                            </div>
                                          ))
                                        )}
                                      </div>
                                    )}
                                  </div>

                                  {/* Sync action button (Only allowed for admin or assigned users) */}
                                  {step.notion?.pageId && isAuthorizedForStep && (
                                    <button 
                                      onClick={(e) => { e.stopPropagation(); simulateWebhook(step.notion?.pageId); }}
                                      className="w-full flex items-center justify-center gap-2 border border-slate-200 bg-slate-55 hover:bg-slate-100 text-slate-700 px-3 h-9.5 rounded-xl text-xs font-bold transition-all duration-200 shadow-sm active:scale-95 cursor-pointer"
                                    >
                                      <RefreshCw size={13} className="text-slate-400" />
                                      <span>从 Notion 重新拉取同步正文</span>
                                    </button>
                                  )}
                                </div>

                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-slate-400 px-4 text-center animate-in fade-in duration-500 bg-white">
            <Layout size={48} className="mb-4 text-slate-200" strokeWidth={1} />
            <p className="text-sm font-bold text-slate-500">选择或创建一个任务流程</p>
            <p className="text-xs mt-1.5 text-slate-400">点击左侧的任务项以载入时间线工作台。</p>
          </div>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      <div className={`fixed inset-0 z-[110] flex items-center justify-center p-4 transition-all duration-300 ${deleteModal.isOpen ? 'opacity-100 visible' : 'opacity-0 invisible pointer-events-none'}`}>
        <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm transition-opacity duration-300" onClick={() => setDeleteModal({ isOpen: false, taskId: null })} />
        <div className="bg-white rounded-3xl shadow-2xl max-w-sm w-full p-6 relative transition-all duration-300 transform scale-100">
          <h3 className="text-base font-extrabold text-slate-955 mb-2">确认删除此任务</h3>
          <p className="text-slate-550 text-xs leading-relaxed mb-6 font-semibold">此操作将从数据库永久清理该任务，同时同步移除 Notion 协作空间中的关联页面，且无法恢复。</p>
          <div className="flex justify-end gap-3">
            <button onClick={() => setDeleteModal({ isOpen: false, taskId: null })} className="px-4 py-2.5 text-xs font-bold border border-slate-250 rounded-xl hover:bg-slate-55 transition-colors cursor-pointer">取消</button>
            <button
              type="button"
              onClick={handleDeleteTask}
              disabled={deletePending}
              className="px-4 py-2.5 text-xs font-bold bg-rose-600 text-white rounded-xl hover:bg-rose-700 transition-colors shadow-md shadow-rose-100 cursor-pointer disabled:pointer-events-none disabled:opacity-70 inline-flex items-center gap-2"
            >
              {deletePending && <RefreshCw size={13} className="animate-spin" />}
              {deletePending ? '正在删除' : '确认删除'}
            </button>
          </div>
        </div>
      </div>

      {/* Assignee Selection Modal */}
      <div className={`fixed inset-0 z-[110] flex items-center justify-center p-4 transition-all duration-300 ${assigneeModal.isOpen && assigneeModal.step ? 'opacity-100 visible' : 'opacity-0 invisible pointer-events-none'}`}>
        <div className="absolute inset-0 bg-slate-955/30 backdrop-blur-sm transition-opacity duration-300" onClick={() => setAssigneeModal({ isOpen: false, step: null })} />
        
        <div className={`bg-white rounded-3xl shadow-2xl max-w-sm w-full p-6 relative transition-all duration-355 transform ${assigneeModal.isOpen ? 'scale-100 opacity-100 translate-y-0' : 'scale-95 opacity-0 translate-y-4'} border border-slate-100`}>
          <button 
            onClick={() => setAssigneeModal({ isOpen: false, step: null })}
            className="absolute right-4 top-4 p-1.5 hover:bg-slate-100 rounded-xl text-slate-450 transition-colors cursor-pointer"
          >
            <X size={16} />
          </button>
          
          <h3 className="text-base font-extrabold text-slate-955 mb-1 font-display">
            指定步骤负责人
          </h3>
          <p className="text-[10px] font-extrabold text-slate-400 mb-4 uppercase tracking-widest font-display">
            当前步骤：{assigneeModal.step?.title}
          </p>
          
          {assigneeModal.step && (
            <form 
              key={`assignee-form-${assigneeModal.step.id}`}
              onSubmit={handleSaveAssignees}
              className="flex flex-col gap-4"
            >
              <div className="max-h-52 overflow-y-auto border border-slate-200/80 rounded-2xl bg-slate-50/50 p-2 flex flex-col gap-0.5 shadow-inner">
                {assignees.map(a => {
                  const isSelected = (tempAssignees[assigneeModal.step!.id] || []).includes(a.id);
                  return (
                    <label 
                      key={a.id} 
                      className={`flex items-center gap-2.5 px-3 py-2 rounded-xl cursor-pointer text-xs font-bold transition-colors ${isSelected ? 'bg-blue-50/50 text-blue-750 font-extrabold shadow-[0_1px_3px_rgba(37,99,235,0.02)] border border-blue-100/50' : 'text-slate-700 hover:bg-slate-55 border border-transparent'}`}
                    >
                      <input 
                        type="checkbox" 
                        checked={isSelected}
                        onChange={() => handleToggleTempAssignee(assigneeModal.step!.id, a.id)}
                        className="w-4 h-4 rounded border-slate-350 text-blue-600 focus:ring-blue-500 accent-blue-600 cursor-pointer" 
                      />
                      {/* Avatar preview inside checklist */}
                      <div className="shrink-0 ml-1">
                        {renderAvatar(a, "w-5 h-5")}
                      </div>
                      <span className="truncate">{a.name}</span>
                    </label>
                  );
                })}
              </div>

              <div className="flex gap-3 mt-2">
                <button 
                  type="button" 
                  onClick={() => setAssigneeModal({ isOpen: false, step: null })}
                  className="flex-1 py-2.5 text-xs font-bold border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors cursor-pointer text-center"
                >
                  取消
                </button>
                <button 
                  type="submit"
                  className="flex-1 py-2.5 bg-slate-900 hover:bg-blue-600 text-white text-xs font-bold rounded-xl transition-colors cursor-pointer text-center shadow-md shadow-blue-100"
                >
                  确定修改
                </button>
              </div>
            </form>
          )}
        </div>
      </div>

      {/* Task Creation & Editing Drawer (Sleek layout) */}
      <div className={`fixed inset-0 z-[110] flex justify-end transition-all duration-355 ${drawerConfig.isOpen ? 'opacity-100 visible' : 'opacity-0 invisible pointer-events-none'}`}>
        <div className="absolute inset-0 bg-slate-955/20 backdrop-blur-sm transition-opacity duration-355" onClick={() => setDrawerConfig(prev => ({ ...prev, isOpen: false }))} />
        
        <div className={`relative w-full sm:w-[500px] bg-white h-full shadow-2xl flex flex-col transition-transform duration-355 ease-in-out transform ${drawerConfig.isOpen ? 'translate-x-0' : 'translate-x-full'} border-l border-slate-100`}>
          <div className="p-5 border-b border-slate-200 flex justify-between items-center bg-slate-55 shrink-0">
            <h2 className="font-extrabold text-sm text-slate-955 flex items-center gap-2 font-display">
              {drawerConfig.taskToEdit ? '编辑任务属性' : '创建新生产流程'}
            </h2>
            <button onClick={() => setDrawerConfig(prev => ({ ...prev, isOpen: false }))} className="p-1.5 hover:bg-slate-200 rounded-lg text-slate-505 transition-colors cursor-pointer"><X size={16}/></button>
          </div>
          
          <div className="flex-1 overflow-auto p-6 pb-20">
            {!drawerConfig.taskToEdit && (
              <p className="text-xs text-slate-500 mb-6 font-semibold leading-relaxed">填入基本信息，系统将基于对应类别的默认模板，在 Notion 与本地数据库中同步初始化整套步骤。</p>
            )}
            
            {drawerConfig.isOpen && (
              <form 
                id="task-form" 
                key={drawerConfig.taskToEdit?.id || 'new-task'}
                onSubmit={handleSubmitTaskForm}
                className="space-y-5"
              >
                {drawerConfig.taskToEdit && (
                  <input type="hidden" name="taskId" value={drawerConfig.taskToEdit.id} />
                )}

                <div className="grid grid-cols-2 gap-4">
                   <div>
                     <label className="block text-[9px] font-extrabold text-slate-400 mb-1.5 uppercase tracking-widest font-display">生产类别 *</label>
                     <select 
                       name="kind" 
                       defaultValue={drawerConfig.taskToEdit?.kind || "video"}
                       className="premium-input w-full cursor-pointer appearance-none bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2020%2020%2522%20fill%3D%22none%22%3E%3Cpath%20d%3D%22M7%209l3%203%203-3%22%20stroke%3D%22%236b7280%22%20stroke-width%3D%221.5%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%2F%3E%3C%2Fsvg%3E')] bg-[position:right_10px_center] bg-[size:16px] pr-9"
                     >
                       <option value="video">视频生产流程 (Video)</option>
                       <option value="general">通用事务流程 (General)</option>
                     </select>
                   </div>
                   <div>
                     <label className="block text-[9px] font-extrabold text-slate-400 mb-1.5 uppercase tracking-widest font-display">紧急优先级</label>
                     <select name="priority" defaultValue={drawerConfig.taskToEdit?.priority || "medium"} className="premium-input w-full cursor-pointer appearance-none bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2020%2020%2522%20fill%3D%22none%22%3E%3Cpath%20d%3D%22M7%209l3%203%203-3%22%20stroke%3D%22%236b7280%22%20stroke-width%3D%221.5%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%2F%3E%3C%2Fsvg%3E')] bg-[position:right_10px_center] bg-[size:16px] pr-9"
                     >
                       <option value="high">紧急高优先级</option>
                       <option value="medium">普通中优先级</option>
                       <option value="low">低优先级</option>
                     </select>
                   </div>
                </div>

                {drawerConfig.taskToEdit && (
                  <div>
                    <label className="block text-[9px] font-extrabold text-slate-400 mb-1.5 uppercase tracking-widest font-display">主流程阶段状态</label>
                    <select 
                      name="status" 
                      defaultValue={drawerConfig.taskToEdit.status} 
                      className="premium-input w-full cursor-pointer appearance-none bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2020%2020%2522%20fill%3D%22none%22%3E%3Cpath%20d%3D%22M7%209l3%203%203-3%22%20stroke%3D%22%236b7280%22%20stroke-width%3D%221.5%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%2F%3E%3C%2Fsvg%3E')] bg-[position:right_10px_center] bg-[size:16px] pr-9"
                    >
                      <option value="draft">草稿 (Draft)</option>
                      <option value="active">进行中 (Active)</option>
                      <option value="blocked">阻塞 (Blocked)</option>
                      <option value="done">已完成 (Done)</option>
                    </select>
                  </div>
                )}

                <div>
                  <label className="block text-[9px] font-extrabold text-slate-400 mb-1.5 uppercase tracking-widest font-display">任务标题 *</label>
                  <input required name="title" defaultValue={drawerConfig.taskToEdit?.title || ''} className="premium-input w-full" placeholder="例如：每周塔罗牌挑战视频"/>
                </div>

                <div>
                  <label className="block text-[9px] font-extrabold text-slate-400 mb-1.5 uppercase tracking-widest font-display">任务摘要/执行说明 *</label>
                  <textarea required name="summary" defaultValue={drawerConfig.taskToEdit?.summary || ''} rows={3} className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-xs focus:ring-4 focus:ring-blue-55/10 outline-none resize-none font-semibold leading-relaxed placeholder-slate-400" placeholder="简述选题核心需求或目标产出..."/>
                </div>

                <div className="grid grid-cols-2 gap-4">
                   <div>
                     <label className="block text-[9px] font-extrabold text-slate-400 mb-1.5 uppercase tracking-widest font-display">所属系列 / 栏目</label>
                     <input name="contentSeries" defaultValue={drawerConfig.taskToEdit?.contentSeries || ""} className="premium-input w-full" placeholder="塔罗牌系列" />
                   </div>
                   <div>
                     <label className="block text-[9px] font-extrabold text-slate-400 mb-1.5 uppercase tracking-widest font-display">排期批次 (周期)</label>
                     <input name="weekLabel" defaultValue={drawerConfig.taskToEdit?.weekLabel || ""} className="premium-input w-full font-mono" placeholder="2026-W28" />
                   </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                   <div>
                     <label className="block text-[9px] font-extrabold text-slate-400 mb-1.5 uppercase tracking-widest font-display">截止限期</label>
                     <input name="dueDate" type="date" defaultValue={drawerConfig.taskToEdit?.dueDate || ""} className="premium-input w-full" />
                   </div>
                   <div>
                     <label className="block text-[9px] font-extrabold text-slate-400 mb-1.5 uppercase tracking-widest font-display">目标发布日期</label>
                     <input name="targetPublishDate" type="date" defaultValue={drawerConfig.taskToEdit?.targetPublishDate || ""} className="premium-input w-full" />
                   </div>
                </div>

                <div>
                  <label className="block text-[9px] font-extrabold text-slate-400 mb-2 uppercase tracking-widest font-display">发布目标渠道 (可多选)</label>
                  <div className="flex flex-wrap gap-2">
                    {PLATFORMS.map(p => {
                      const isChecked = drawerConfig.taskToEdit 
                        ? drawerConfig.taskToEdit.platforms?.includes(p)
                        : p === '小红书';
                      return (
                        <label key={p} className="flex items-center gap-1.5 px-3 py-2 border border-slate-200 rounded-xl text-xs cursor-pointer hover:bg-slate-50 has-[:checked]:bg-blue-50 has-[:checked]:border-blue-200 has-[:checked]:text-blue-700 transition-all font-bold select-none shadow-sm">
                          <input type="checkbox" name="platforms" value={p} defaultChecked={isChecked} className="w-3.5 h-3.5 accent-blue-600" />
                          {p}
                        </label>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <label className="block text-[9px] font-extrabold text-slate-400 mb-2 uppercase tracking-widest font-display">主负责人 (可多选)</label>
                  <div className="grid grid-cols-2 gap-y-3 p-3.5 border border-slate-200 rounded-xl bg-slate-50/50 max-h-40 overflow-y-auto shadow-inner">
                    {assignees.map(a => {
                      const isChecked = drawerConfig.taskToEdit 
                        ? drawerConfig.taskToEdit.assigneeIds?.includes(a.id)
                        : assignees.length > 0 && a.id === assignees[0].id;
                      return (
                        <label key={a.id} className="flex items-center gap-2.5 text-xs cursor-pointer text-slate-700 hover:text-blue-600 font-bold transition-colors group select-none">
                          <input type="checkbox" name="assigneeIds" value={a.id} defaultChecked={isChecked} className="w-4 h-4 rounded border-slate-350 text-blue-600 focus:ring-blue-500 accent-blue-600" />
                          <span className="truncate">{a.name}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>

                {!drawerConfig.taskToEdit && (
                  <>
                    <div>
                      <label className="block text-[9px] font-extrabold text-slate-400 mb-2 uppercase tracking-widest font-display">子任务默认负责人 (可多选)</label>
                      <div className="grid grid-cols-2 gap-y-3 p-3.5 border border-slate-200 rounded-xl bg-slate-55/50 max-h-40 overflow-y-auto shadow-inner">
                        {assignees.map(a => {
                          const isChecked = assignees.length > 0 && a.id === assignees[0].id;
                          return (
                            <label key={a.id} className="flex items-center gap-2.5 text-xs cursor-pointer text-slate-700 hover:text-blue-600 font-bold transition-colors group select-none">
                              <input type="checkbox" name="stepAssigneeIds" value={a.id} defaultChecked={isChecked} className="w-4 h-4 rounded border-slate-350 text-blue-600 focus:ring-blue-500 accent-blue-600" />
                              <span className="truncate">{a.name}</span>
                            </label>
                          );
                        })}
                      </div>
                    </div>

                    <div>
                      <label className="block text-[9px] font-extrabold text-slate-400 mb-1.5 uppercase tracking-widest font-display">自定义制作流程步骤 (按行分隔)</label>
                      <textarea 
                        name="steps" 
                        rows={3} 
                        className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-xs focus:ring-4 focus:ring-blue-50/10 outline-none resize-none font-semibold leading-relaxed placeholder-slate-400 shadow-inner" 
                        placeholder="不填则默认生成（脚本 -> 音频 -> 素材 -> 剪辑 -> 发布）。如需生成自定义节点，请每行输入一个步骤名称："
                      />
                    </div>
                  </>
                )}
              </form>
            )}
          </div>
          
          <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-slate-200 bg-slate-50 shrink-0">
            <button 
              form="task-form" 
              type="submit" 
              disabled={taskFormPending}
              className="w-full py-3 bg-slate-900 hover:bg-blue-600 text-white text-xs font-bold rounded-xl transition-all duration-200 shadow-md hover:shadow-lg active:scale-[0.98] flex items-center justify-center gap-2 cursor-pointer disabled:pointer-events-none disabled:opacity-75"
            >
              {taskFormPending && <RefreshCw size={14} className="animate-spin" />}
              {taskFormPending
                ? drawerConfig.taskToEdit ? '正在保存并同步...' : '正在创建并同步...'
                : drawerConfig.taskToEdit ? '保存属性并同步' : '生成工作流并同步 Notion'}
            </button>
          </div>
        </div>
      </div>



      <ToastContainer toasts={toasts} />
    </div>
  );
}
