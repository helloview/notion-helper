"use client";

import { LoaderCircle } from "lucide-react";
import { useFormStatus } from "react-dom";

type PendingSubmitButtonProps = {
  children: React.ReactNode;
  className: string;
  pendingText: string;
} & Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "type" | "disabled">;

export function PendingSubmitButton({
  children,
  className,
  pendingText,
  ...buttonProps
}: PendingSubmitButtonProps) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      aria-busy={pending}
      className={`${className} disabled:pointer-events-none disabled:translate-y-0 disabled:opacity-80`}
      {...buttonProps}
    >
      {pending ? (
        <>
          <LoaderCircle className="size-4 animate-spin" aria-hidden />
          {pendingText}
        </>
      ) : (
        children
      )}
    </button>
  );
}

export function PendingFormStatus({
  text,
  className = "",
}: {
  text: string;
  className?: string;
}) {
  const { pending } = useFormStatus();

  if (!pending) return null;

  return (
    <div
      className={`relative overflow-hidden rounded-full border border-[#3b82f6]/35 bg-[#3b82f6]/12 px-3 py-2 text-xs font-semibold text-[#2563eb] ${className}`}
      role="status"
      aria-live="polite"
    >
      <span className="relative z-10 inline-flex items-center gap-2">
        <LoaderCircle className="size-3.5 animate-spin" aria-hidden />
        {text}
      </span>
      <span className="absolute inset-y-0 left-0 w-1/2 animate-[loadingSweep_1.2s_ease-in-out_infinite] bg-[#3b82f6]/35" />
    </div>
  );
}
