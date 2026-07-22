type WorkspaceRouteSkeletonProps = {
  variant: "tasks" | "tarot" | "access";
};

const pulse = "animate-pulse motion-reduce:animate-none bg-slate-200";

export function WorkspaceRouteSkeleton({ variant }: WorkspaceRouteSkeletonProps) {
  const isAccess = variant === "access";
  const isTasks = variant === "tasks";

  return (
    <div
      className="flex h-full overflow-hidden bg-slate-50 text-slate-950"
      role="status"
      aria-live="polite"
      aria-label={
        isAccess
          ? "正在加载访问权限"
          : isTasks
            ? "正在加载生产任务列表"
            : "正在加载塔罗五题工作台"
      }
    >
      <main className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <header className="flex shrink-0 items-center justify-between gap-4 border-b border-slate-200 bg-white px-4 py-3 md:px-6">
          <div className={`${pulse} h-6 w-40 rounded-lg`} />
          <div className="flex items-center gap-2">
            <div className={`${pulse} hidden h-9 w-52 rounded-lg sm:block`} />
            <div className={`${pulse} h-9 w-24 rounded-lg`} />
          </div>
        </header>

        <div className="min-h-0 flex-1 overflow-hidden">
          {isAccess ? <AccessSkeleton /> : isTasks ? <TasksSkeleton /> : <TarotSkeleton />}
        </div>
      </main>

      <span className="sr-only">页面内容正在加载，请稍候。</span>
    </div>
  );
}

function TasksSkeleton() {
  return (
    <div className="grid h-full gap-5 p-4 md:grid-cols-[380px_minmax(0,1fr)] md:p-7">
      <aside className="rounded-[24px] border border-slate-200 bg-white p-4">
        <div className={`${pulse} h-11 w-full rounded-xl`} />
        <div className="mt-5 space-y-3">
          {[0, 1, 2].map((item) => (
            <div key={item} className="rounded-2xl border border-slate-100 p-4">
              <div className={`${pulse} h-4 w-2/3 rounded-full`} />
              <div className={`${pulse} mt-3 h-3 w-full rounded-full`} />
              <div className={`${pulse} mt-5 h-2 w-full rounded-full`} />
            </div>
          ))}
        </div>
      </aside>
      <section className="hidden rounded-[24px] border border-slate-200 bg-white p-6 md:block">
        <div className={`${pulse} h-8 w-2/5 rounded-xl`} />
        <div className={`${pulse} mt-4 h-4 w-3/5 rounded-full`} />
        <div className="mt-8 space-y-4">
          {[0, 1, 2, 3].map((item) => (
            <div key={item} className={`${pulse} h-24 w-full rounded-2xl`} />
          ))}
        </div>
      </section>
    </div>
  );
}

function AccessSkeleton() {
  return (
    <div className="mx-auto h-full max-w-6xl space-y-5 overflow-hidden px-4 py-5 md:px-6">
      <div className="flex gap-8">
        {[0, 1, 2, 3].map((item) => (
          <div key={item} className={`${pulse} h-4 w-20 rounded-full`} />
        ))}
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <div className="border-b border-slate-200 px-4 py-3">
          <div className={`${pulse} h-3 w-full max-w-md rounded-full`} />
        </div>
        <div className="divide-y divide-slate-100">
          {[0, 1, 2, 3, 4].map((item) => (
            <div key={item} className="flex items-center gap-3 px-4 py-3.5">
              <div className={`${pulse} size-9 shrink-0 rounded-full`} />
              <div className="min-w-0 flex-1">
                <div className={`${pulse} h-4 w-36 max-w-full rounded-full`} />
                <div className={`${pulse} mt-2 h-3 w-52 max-w-full rounded-full`} />
              </div>
              <div className={`${pulse} hidden h-5 w-16 rounded-md sm:block`} />
              <div className={`${pulse} hidden h-5 w-20 rounded-full md:block`} />
              <div className={`${pulse} h-8 w-16 rounded-lg`} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function TarotSkeleton() {
  return (
    <div className="grid h-full grid-cols-1 overflow-hidden lg:grid-cols-[360px_minmax(0,1fr)]">
      <aside className="border-r border-slate-200 bg-white px-4 py-4 md:px-5">
        <div className={`${pulse} h-4 w-24 rounded-full`} />
        <div className={`${pulse} mt-2 h-3 w-full max-w-xs rounded-full`} />
        <div className="mt-5 space-y-4">
          {[0, 1, 2, 3, 4].map((item) => (
            <div key={item}>
              <div className={`${pulse} h-3 w-16 rounded-full`} />
              <div className={`${pulse} mt-2 ${item === 3 ? "h-20" : "h-9"} w-full rounded-lg`} />
            </div>
          ))}
        </div>
      </aside>

      <section className="hidden flex-col lg:flex">
        <div className="flex items-center justify-between border-b border-slate-200 bg-white px-6 py-2.5">
          <div className={`${pulse} h-8 w-44 rounded-lg`} />
          <div className={`${pulse} h-8 w-28 rounded-lg`} />
        </div>
        <div className="flex-1 bg-white px-6 py-4">
          <div className="space-y-3">
            {[0, 1, 2, 3, 4, 5, 6].map((item) => (
              <div
                key={item}
                className={`${pulse} h-3.5 rounded-full`}
                style={{ width: `${[92, 78, 85, 60, 88, 72, 40][item]}%` }}
              />
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
