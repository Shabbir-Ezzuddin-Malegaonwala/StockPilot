"use client";

import { useSSEStream } from "@/hooks/useSSEStream";
import { getProcurementReportURL } from "@/lib/api";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/store/auth.store";
import ReactMarkdown from "react-markdown";

export default function ReportPage() {
  const { hasRole } = useAuthStore();
  const url = getProcurementReportURL();
  const { data, isStreaming, error, startStream, stopStream } =
    useSSEStream(url);

  // Only managers and above can generate reports
  if (!hasRole("manager")) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="rounded-2xl bg-white p-8 shadow-sm text-center max-w-md">
          <h2 className="text-xl font-bold text-slate-900 mb-2">Access Denied</h2>
          <p className="text-slate-500">
            You need manager privileges or higher to generate reports.
          </p>
        </div>
      </div>
    );
  }

  const hasReport = data.length > 0;

  return (
    <div>
      {/* Page header */}
      <div className="mb-6 sm:mb-8">
        <nav className="mb-3 flex items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-widest text-slate-400">Reports</span>
          <svg className="h-4 w-4 text-slate-300" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
          </svg>
          <span className="text-xs font-semibold uppercase tracking-widest text-indigo-600">Procurement</span>
        </nav>

        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">
              AI Procurement Report
            </h1>
            <p className="mt-1 sm:mt-2 text-sm sm:text-base text-slate-500">
              Generate intelligent purchasing insights based on real-time inventory velocity and market trends.
            </p>
          </div>

          <div className="flex items-center gap-3 flex-shrink-0">
          {isStreaming ? (
            <button
              onClick={stopStream}
              className={cn(
                "inline-flex items-center gap-2 rounded-xl px-4 sm:px-6 py-2.5 sm:py-3",
                "bg-red-600 text-sm sm:text-[15px] font-medium text-white",
                "transition-all hover:bg-red-700"
              )}
            >
              <svg
                className="h-5 w-5"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={2}
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M5.25 7.5A2.25 2.25 0 0 1 7.5 5.25h9a2.25 2.25 0 0 1 2.25 2.25v9a2.25 2.25 0 0 1-2.25 2.25h-9a2.25 2.25 0 0 1-2.25-2.25v-9Z"
                />
              </svg>
              Stop Generation
            </button>
          ) : (
            <button
              onClick={startStream}
              className={cn(
                "inline-flex items-center gap-2 rounded-xl px-4 sm:px-6 py-2.5 sm:py-3",
                "bg-gradient-to-br from-[#3525cd] to-[#4f46e5]",
                "text-sm sm:text-[15px] font-medium text-white",
                "transition-all hover:shadow-lg hover:shadow-indigo-200"
              )}
            >
              <svg
                className="h-5 w-5"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={2}
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 0 0-2.455 2.456ZM16.894 20.567 16.5 21.75l-.394-1.183a2.25 2.25 0 0 0-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 0 0 1.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 0 0 1.423 1.423l1.183.394-1.183.394a2.25 2.25 0 0 0-1.423 1.423Z"
                />
              </svg>
              Generate Report
            </button>
          )}
          </div>
        </div>
      </div>

      {/* Error state */}
      {error && (
        <div className="rounded-2xl bg-red-50 border border-red-100 p-6 mb-6">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-100 flex-shrink-0">
              <svg
                className="h-5 w-5 text-red-600"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1.5}
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z"
                />
              </svg>
            </div>
            <div>
              <p className="text-base font-semibold text-red-700">Failed to connect to AI Service</p>
              <p className="mt-1 text-[15px] text-red-600">{error}</p>
              <button
                onClick={startStream}
                className="mt-3 inline-flex items-center rounded-xl bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 transition-colors"
              >
                Retry Connection
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Report content */}
      {hasReport ? (
        <div className="rounded-2xl bg-white p-8 shadow-sm">
          <div className="flex items-center gap-3 mb-6">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-50">
              <svg className="h-5 w-5 text-indigo-600" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 0 1 3 19.875v-6.75ZM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V8.625ZM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V4.125Z" />
              </svg>
            </div>
            <span className="text-xs font-semibold uppercase tracking-widest text-slate-400">Live Analysis</span>
            {isStreaming && (
              <span className="flex items-center gap-2 rounded-lg bg-red-50 px-3 py-1 text-xs font-semibold text-red-600">
                <span className="h-2 w-2 animate-pulse rounded-full bg-red-500" />
                Stop Generation
              </span>
            )}
          </div>
          <div className="prose prose-slate max-w-none text-[15px] leading-relaxed text-slate-700 prose-headings:text-slate-900 prose-h2:text-xl prose-h2:mt-6 prose-h2:mb-3 prose-h3:text-lg prose-h3:mt-4 prose-h3:mb-2 prose-strong:text-slate-900 prose-ul:my-2 prose-li:my-0.5">
            <ReactMarkdown>{data}</ReactMarkdown>
          </div>
        </div>
      ) : !error ? (
        /* Empty state — before generation */
        <div className="rounded-2xl bg-white p-16 shadow-sm">
          <div className="flex flex-col items-center justify-center text-center">
            <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-2xl bg-indigo-50">
              <svg
                className="h-10 w-10 text-indigo-600"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1.5}
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 0 0-2.455 2.456ZM16.894 20.567 16.5 21.75l-.394-1.183a2.25 2.25 0 0 0-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 0 0 1.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 0 0 1.423 1.423l1.183.394-1.183.394a2.25 2.25 0 0 0-1.423 1.423Z"
                />
              </svg>
            </div>
            <h3 className="text-2xl font-semibold text-slate-900">
              AI Procurement Report
            </h3>
            <p className="mt-3 max-w-lg text-base text-slate-500 leading-relaxed">
              This report analyzes your entire inventory to identify low-stock
              items, forecast demand, and recommend optimal procurement
              quantities. Click &ldquo;Generate Report&rdquo; to get started.
            </p>
            <p className="mt-4 text-sm text-slate-400">
              Note: Only managers and admins can generate reports.
            </p>
          </div>
        </div>
      ) : null}
    </div>
  );
}
