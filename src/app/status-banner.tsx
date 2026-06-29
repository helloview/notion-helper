"use client";

import { useEffect } from "react";

type StatusBannerProps = {
  className: string;
  text: string;
};

const transientParams = [
  "created",
  "delete",
  "error",
  "notion",
  "stepUpdate",
  "update",
];

export function StatusBanner({ className, text }: StatusBannerProps) {
  useEffect(() => {
    const url = new URL(window.location.href);
    let changed = false;

    for (const param of transientParams) {
      if (url.searchParams.has(param)) {
        url.searchParams.delete(param);
        changed = true;
      }
    }

    if (changed) {
      const nextUrl = `${url.pathname}${url.search}${url.hash}`;
      window.history.replaceState(null, "", nextUrl);
    }
  }, []);

  return (
    <div className={`animate-pop rounded-lg border px-4 py-3 text-sm font-medium shadow-sm ${className}`}>
      {text}
    </div>
  );
}
