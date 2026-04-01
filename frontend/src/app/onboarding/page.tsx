"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import * as api from "@/lib/api";
import { cn, slugify } from "@/lib/utils";

export default function OnboardingPage() {
  const router = useRouter();

  const [name, setName] = useState("");
  const [location, setLocation] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const slug = slugify(name);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (isLoading || !name.trim()) return;

      setError(null);
      setIsLoading(true);

      try {
        const org = await api.createOrganization(name.trim(), slug);
        await api.setActiveOrganization(org.id);
        router.push("/dashboard");
      } catch (err) {
        const message =
          err && typeof err === "object" && "error" in err
            ? String((err as { error: string }).error)
            : "Failed to create organization";
        setError(message);
      } finally {
        setIsLoading(false);
      }
    },
    [name, slug, isLoading, router]
  );

  const inputClasses = cn(
    "w-full rounded-xl bg-slate-50 px-4 py-3.5 text-base text-slate-700",
    "outline-none transition-colors",
    "hover:bg-slate-100 focus:bg-white focus:ring-2 focus:ring-indigo-500/20"
  );

  return (
    <div className="flex min-h-screen items-center justify-center px-6 py-12 bg-slate-50">
      <div className="w-full max-w-lg">
        {/* Logo */}
        <div className="mb-10 flex items-center justify-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-[#3525cd] to-[#4f46e5]">
            <svg
              className="h-6 w-6 text-white"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={2}
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="m20.25 7.5-.625 10.632a2.25 2.25 0 0 1-2.247 2.118H6.622a2.25 2.25 0 0 1-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125Z"
              />
            </svg>
          </div>
          <span className="text-2xl font-bold text-slate-900">StockPilot</span>
        </div>

        <div className="rounded-2xl bg-white p-10 shadow-sm">
          <h1 className="text-3xl font-bold text-slate-900 text-center">
            Create Your Organization
          </h1>
          <p className="mt-3 text-base text-slate-500 text-center">
            Every StockPilot workspace needs an organization. This is where your
            team and inventory data lives.
          </p>

          <form onSubmit={handleSubmit} className="mt-10 space-y-6">
            <div>
              <label
                htmlFor="orgName"
                className="block text-xs font-semibold uppercase tracking-widest text-slate-400 mb-2"
              >
                Organization Name
              </label>
              <input
                id="orgName"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Acme Corp"
                required
                className={inputClasses}
              />
              {slug && (
                <p className="mt-2 text-sm text-slate-400">
                  Slug:{" "}
                  <span className="font-mono text-slate-600">{slug}</span>
                </p>
              )}
            </div>

            <div>
              <label
                htmlFor="location"
                className="block text-xs font-semibold uppercase tracking-widest text-slate-400 mb-2"
              >
                Location / City{" "}
                <span className="font-normal normal-case tracking-normal text-slate-300">(optional)</span>
              </label>
              <input
                id="location"
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="e.g., Mumbai, India"
                className={inputClasses}
              />
            </div>

            {error && (
              <div className="rounded-xl bg-red-50 p-4">
                <p className="text-base text-red-600">{error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading || !name.trim()}
              className={cn(
                "w-full rounded-full bg-gradient-to-br from-[#3525cd] to-[#4f46e5] px-6 py-4",
                "text-base font-semibold text-white",
                "transition-all hover:shadow-lg hover:shadow-indigo-200",
                "disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:shadow-none"
              )}
            >
              {isLoading ? "Creating..." : "Create Organization"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
