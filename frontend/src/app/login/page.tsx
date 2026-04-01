"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import * as api from "@/lib/api";
import { cn } from "@/lib/utils";

export default function LoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (isLoading) return;

      setError(null);
      setIsLoading(true);

      try {
        await api.signIn(email, password);

        // Check for pending invitations first
        try {
          const invResult = await api.getMyPendingInvitations();
          if (invResult.invitations && invResult.invitations.length > 0) {
            const inv = invResult.invitations[0];
            const acceptResult = await api.acceptInvitation(inv.id);
            await api.setActiveOrganization(acceptResult.organizationId);
            router.push("/dashboard");
            return;
          }
        } catch {
          // Invitation check failed — continue to normal flow
        }

        // Check if user has organizations
        const orgs = await api.listOrganizations();

        if (orgs && orgs.length > 0) {
          // Set the first org as active
          await api.setActiveOrganization(orgs[0].id);
          router.push("/dashboard");
        } else {
          router.push("/onboarding");
        }
      } catch (err) {
        const message =
          err && typeof err === "object" && "error" in err
            ? String((err as { error: string }).error)
            : "Invalid email or password";
        setError(message);
      } finally {
        setIsLoading(false);
      }
    },
    [email, password, isLoading, router]
  );

  const inputClasses = cn(
    "w-full rounded-xl bg-slate-50 px-4 py-3.5 text-base text-slate-700",
    "outline-none transition-colors",
    "hover:bg-slate-100 focus:bg-white focus:ring-2 focus:ring-indigo-500/20"
  );

  return (
    <div className="flex min-h-screen">
      {/* Left panel — branding */}
      <div className="hidden lg:flex lg:w-[45%] flex-col justify-between bg-slate-900 p-12 xl:p-16">
        <div>
          <div className="flex items-center gap-3">
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
            <span className="text-xl font-bold text-white">StockPilot</span>
          </div>
          <p className="mt-2 text-sm font-medium uppercase tracking-widest text-indigo-400">
            Inventory Management
          </p>
        </div>

        <div>
          <h1 className="text-4xl font-bold leading-tight text-white xl:text-5xl">
            Precise architecture for
            <br />
            high-end portfolio
            <br />
            management.
          </h1>
          <p className="mt-5 max-w-md text-lg text-slate-400 leading-relaxed">
            Track, analyze, and scale with AI-driven insights.
            Built for architects of the modern market.
          </p>
        </div>

        <div className="flex items-center gap-6">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-wider text-slate-500">Version</p>
            <p className="text-sm font-medium text-slate-300">1.0.0-stable</p>
          </div>
          <div>
            <p className="text-[11px] font-medium uppercase tracking-wider text-slate-500">Status</p>
            <p className="flex items-center gap-1.5 text-sm font-medium text-emerald-400">
              <span className="h-2 w-2 rounded-full bg-emerald-400" />
              Systems Operational
            </p>
          </div>
        </div>
      </div>

      {/* Right panel — login form */}
      <div className="flex flex-1 flex-col items-center justify-center px-6 py-12 lg:px-16 xl:px-24">
        <div className="w-full max-w-md">
          {/* Mobile logo */}
          <div className="mb-10 flex items-center gap-3 lg:hidden">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-[#3525cd] to-[#4f46e5]">
              <svg
                className="h-5 w-5 text-white"
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
            <span className="text-xl font-bold text-slate-900">StockPilot</span>
          </div>

          <h2 className="text-3xl font-bold text-slate-900">Welcome back</h2>
          <p className="mt-2 text-base text-slate-500">
            Please enter your credentials to access the cockpit.
          </p>

          <form onSubmit={handleSubmit} className="mt-10 space-y-6">
            <div>
              <label
                htmlFor="email"
                className="block text-xs font-semibold uppercase tracking-widest text-slate-400 mb-2"
              >
                Email Address
              </label>
              <div className="relative">
                <svg className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 0 1-2.25 2.25h-15a2.25 2.25 0 0 1-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25m19.5 0v.243a2.25 2.25 0 0 1-1.07 1.916l-7.5 4.615a2.25 2.25 0 0 1-2.36 0L3.32 8.91a2.25 2.25 0 0 1-1.07-1.916V6.75" />
                </svg>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="architect@stockpilot.io"
                  required
                  className={cn(inputClasses, "pl-12")}
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label
                  htmlFor="password"
                  className="block text-xs font-semibold uppercase tracking-widest text-slate-400"
                >
                  Password
                </label>
              </div>
              <div className="relative">
                <svg className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z" />
                </svg>
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  required
                  className={cn(inputClasses, "pl-12 pr-12")}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                  tabIndex={-1}
                >
                  {showPassword ? (
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 0 0 1.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.451 10.451 0 0 1 12 4.5c4.756 0 8.773 3.162 10.065 7.498a10.522 10.522 0 0 1-4.293 5.774M6.228 6.228 3 3m3.228 3.228 3.65 3.65m7.894 7.894L21 21m-3.228-3.228-3.65-3.65m0 0a3 3 0 1 0-4.243-4.243m4.242 4.242L9.88 9.88" />
                    </svg>
                  ) : (
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            {error && (
              <div className="rounded-xl bg-red-50 p-4">
                <p className="text-base text-red-600">{error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className={cn(
                "w-full rounded-full bg-gradient-to-br from-[#3525cd] to-[#4f46e5] px-6 py-4",
                "text-base font-semibold text-white",
                "transition-all hover:shadow-lg hover:shadow-indigo-200",
                "disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:shadow-none"
              )}
            >
              {isLoading ? "Signing in..." : "Sign In"}
            </button>
          </form>

          <p className="mt-8 text-center text-base text-slate-500">
            Don&apos;t have an account?{" "}
            <Link
              href="/signup"
              className="font-semibold text-indigo-600 hover:text-indigo-700"
            >
              Sign up
            </Link>
          </p>

          {/* Enterprise badge */}
          <div className="mt-10 flex items-center justify-center gap-2 text-xs text-slate-400">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75m-3-7.036A11.959 11.959 0 0 1 3.598 6 11.99 11.99 0 0 0 3 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285Z" />
            </svg>
            <span className="uppercase tracking-widest font-medium">Enterprise Grade Infrastructure</span>
          </div>
        </div>
      </div>
    </div>
  );
}
