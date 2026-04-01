"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import * as api from "@/lib/api";
import { cn } from "@/lib/utils";
import type { PendingInvitation } from "@/lib/api";

type Step = "email" | "invitation" | "details";

export default function SignUpPage() {
  const router = useRouter();

  // Step management
  const [step, setStep] = useState<Step>("email");

  // Form fields
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  // Invitation state
  const [invitation, setInvitation] = useState<PendingInvitation | null>(null);

  // UI state
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Step 1: Check email for pending invitations
  const handleEmailNext = useCallback(async () => {
    if (!email.trim() || !email.includes("@")) {
      setError("Please enter a valid email address");
      return;
    }

    setError(null);
    setIsLoading(true);

    try {
      const result = await api.checkInvitation(email.trim());

      if (result.invitations && result.invitations.length > 0) {
        // Found a pending invitation — show it
        setInvitation(result.invitations[0]);
        setStep("invitation");
      } else {
        // No invitation — proceed to normal signup
        setStep("details");
      }
    } catch {
      // If the check fails, just proceed to normal signup
      setStep("details");
    } finally {
      setIsLoading(false);
    }
  }, [email]);

  // Step 2: Accept invitation and proceed to details
  const handleAcceptInvitation = useCallback(() => {
    setStep("details");
  }, []);

  const handleDeclineInvitation = useCallback(() => {
    setInvitation(null);
    setStep("details");
  }, []);

  // Step 3: Create account
  const handleCreateAccount = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLoading) return;

    // Validation
    if (!name.trim()) { setError("Full name is required"); return; }
    if (password.length < 8) { setError("Password must be at least 8 characters"); return; }
    if (password !== confirmPassword) { setError("Passwords do not match"); return; }

    setError(null);
    setIsLoading(true);

    try {
      // Create account
      await api.signUp(name.trim(), email.trim(), password);

      // If user accepted an invitation, accept it after signup
      if (invitation) {
        try {
          const acceptResult = await api.acceptInvitation(invitation.id);
          // Set the active organization to the one they just joined
          await api.setActiveOrganization(acceptResult.organizationId);
          // Go directly to dashboard — they're already in an org
          router.push("/dashboard");
          return;
        } catch {
          // If invitation acceptance fails, fall through to onboarding
        }
      }

      // No invitation or acceptance failed — go to onboarding to create org
      router.push("/onboarding");
    } catch (err) {
      const message =
        err && typeof err === "object" && "error" in err
          ? String((err as { error: string }).error)
          : "Failed to create account";
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, [name, email, password, confirmPassword, isLoading, invitation, router]);

  const inputClasses = cn(
    "w-full rounded-xl bg-slate-50 px-4 py-3.5 text-base text-slate-700",
    "outline-none transition-colors",
    "hover:bg-slate-100 focus:bg-white focus:ring-2 focus:ring-indigo-500/20"
  );

  const labelClasses = "block text-xs font-semibold uppercase tracking-widest text-slate-400 mb-2";

  return (
    <div className="flex min-h-screen">
      {/* Left panel — branding */}
      <div className="hidden lg:flex lg:w-[45%] flex-col justify-between bg-slate-900 p-12 xl:p-16">
        <div>
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-[#3525cd] to-[#4f46e5]">
              <svg className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="m20.25 7.5-.625 10.632a2.25 2.25 0 0 1-2.247 2.118H6.622a2.25 2.25 0 0 1-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125Z" />
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
            Join the<br />architecture of<br />precision.
          </h1>
          <p className="mt-5 max-w-md text-lg text-slate-400 leading-relaxed">
            Start managing your enterprise inventory with StockPilot today.
          </p>
        </div>

        <div className="flex items-center gap-3 rounded-xl bg-slate-800/60 px-5 py-4">
          <svg className="h-5 w-5 text-indigo-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75m-3-7.036A11.959 11.959 0 0 1 3.598 6 11.99 11.99 0 0 0 3 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285Z" />
          </svg>
          <div>
            <p className="text-sm font-semibold text-white">Enterprise Grade Security</p>
            <p className="text-xs text-slate-400">Multi-tenant data isolation</p>
          </div>
        </div>
      </div>

      {/* Right panel — signup form */}
      <div className="flex flex-1 flex-col items-center justify-center px-6 py-12 lg:px-16 xl:px-24">
        <div className="w-full max-w-md">
          {/* Mobile logo */}
          <div className="mb-10 flex items-center gap-3 lg:hidden">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-[#3525cd] to-[#4f46e5]">
              <svg className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="m20.25 7.5-.625 10.632a2.25 2.25 0 0 1-2.247 2.118H6.622a2.25 2.25 0 0 1-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125Z" />
              </svg>
            </div>
            <span className="text-xl font-bold text-slate-900">StockPilot</span>
          </div>

          {/* Step indicator */}
          <div className="mb-8 flex items-center gap-2">
            {["email", "invitation", "details"].map((s, i) => (
              <div
                key={s}
                className={cn(
                  "h-1.5 flex-1 rounded-full transition-colors",
                  step === s || (s === "invitation" && step === "details" && invitation)
                    ? "bg-indigo-500"
                    : i <= ["email", "invitation", "details"].indexOf(step)
                    ? "bg-indigo-500"
                    : "bg-slate-200"
                )}
              />
            ))}
          </div>

          {/* ── STEP 1: Email ── */}
          {step === "email" && (
            <>
              <h2 className="text-3xl font-bold text-slate-900">Get started</h2>
              <p className="mt-2 text-base text-slate-500">
                Enter your email to check if you have a pending invitation.
              </p>

              <div className="mt-10 space-y-6">
                <div>
                  <label htmlFor="email" className={labelClasses}>Email Address</label>
                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleEmailNext()}
                    placeholder="name@company.com"
                    required
                    autoFocus
                    className={inputClasses}
                  />
                </div>

                {error && (
                  <div className="rounded-xl bg-red-50 p-4">
                    <p className="text-base text-red-600">{error}</p>
                  </div>
                )}

                <button
                  onClick={handleEmailNext}
                  disabled={isLoading}
                  className={cn(
                    "w-full rounded-full bg-gradient-to-br from-[#3525cd] to-[#4f46e5] px-6 py-4",
                    "text-base font-semibold text-white",
                    "transition-all hover:shadow-lg hover:shadow-indigo-200",
                    "disabled:cursor-not-allowed disabled:opacity-50"
                  )}
                >
                  {isLoading ? "Checking..." : "Next"}
                </button>
              </div>
            </>
          )}

          {/* ── STEP 2: Invitation Found ── */}
          {step === "invitation" && invitation && (
            <>
              <h2 className="text-3xl font-bold text-slate-900">You&apos;re invited!</h2>
              <p className="mt-2 text-base text-slate-500">
                You have a pending invitation to join an organization.
              </p>

              <div className="mt-8 rounded-2xl border-2 border-indigo-100 bg-indigo-50/50 p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-100">
                    <svg className="h-6 w-6 text-indigo-600" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 21h19.5m-18-18v18m10.5-18v18m6-13.5V21M6.75 6.75h.75m-.75 3h.75m-.75 3h.75m3-6h.75m-.75 3h.75m-.75 3h.75M6.75 21v-3.375c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21M3 3h12m-.75 4.5H21m-3.75 7.5h.008v.008h-.008v-.008Zm0 3h.008v.008h-.008v-.008Zm0 3h.008v.008h-.008v-.008Z" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-lg font-bold text-slate-900">{invitation.organizationName}</p>
                    <p className="text-sm text-slate-500">Invited by {invitation.inviterName}</p>
                  </div>
                </div>

                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm font-medium text-slate-600">Your role:</span>
                  <span className={cn(
                    "inline-flex items-center rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wide",
                    invitation.role === "admin" ? "bg-red-100 text-red-700" :
                    invitation.role === "manager" ? "bg-blue-100 text-blue-700" :
                    "bg-gray-100 text-gray-700"
                  )}>
                    {invitation.role}
                  </span>
                </div>
              </div>

              <div className="mt-6 flex gap-3">
                <button
                  onClick={handleDeclineInvitation}
                  className="flex-1 rounded-full border-2 border-slate-200 px-6 py-3.5 text-base font-medium text-slate-600 hover:bg-slate-50 transition-colors"
                >
                  Decline
                </button>
                <button
                  onClick={handleAcceptInvitation}
                  className={cn(
                    "flex-1 rounded-full bg-gradient-to-br from-[#3525cd] to-[#4f46e5] px-6 py-3.5",
                    "text-base font-semibold text-white",
                    "transition-all hover:shadow-lg hover:shadow-indigo-200"
                  )}
                >
                  Accept & Continue
                </button>
              </div>
            </>
          )}

          {/* ── STEP 3: Account Details ── */}
          {step === "details" && (
            <>
              <h2 className="text-3xl font-bold text-slate-900">Create your account</h2>
              <p className="mt-2 text-base text-slate-500">
                {invitation
                  ? `Set up your account to join ${invitation.organizationName}`
                  : "Enter your details to get started with StockPilot."
                }
              </p>

              <form onSubmit={handleCreateAccount} className="mt-8 space-y-5">
                {/* Email (read-only — already entered in step 1) */}
                <div>
                  <label htmlFor="email-display" className={labelClasses}>Email</label>
                  <input
                    id="email-display"
                    type="email"
                    value={email}
                    disabled
                    className={cn(inputClasses, "cursor-not-allowed opacity-60")}
                  />
                </div>

                <div>
                  <label htmlFor="name" className={labelClasses}>Full Name</label>
                  <input
                    id="name"
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="John Doe"
                    required
                    autoFocus
                    className={inputClasses}
                  />
                </div>

                <div>
                  <label htmlFor="password" className={labelClasses}>Password</label>
                  <div className="relative">
                    <input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Create a strong password"
                      required
                      minLength={8}
                      className={cn(inputClasses, "pr-12")}
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
                  <p className="mt-2 text-sm text-slate-400">Must be at least 8 characters.</p>
                </div>

                <div>
                  <label htmlFor="confirmPassword" className={labelClasses}>Confirm Password</label>
                  <input
                    id="confirmPassword"
                    type={showPassword ? "text" : "password"}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Re-enter your password"
                    required
                    minLength={8}
                    className={cn(
                      inputClasses,
                      confirmPassword && password !== confirmPassword && "ring-2 ring-red-300"
                    )}
                  />
                  {confirmPassword && password !== confirmPassword && (
                    <p className="mt-2 text-sm text-red-500">Passwords do not match</p>
                  )}
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
                    "disabled:cursor-not-allowed disabled:opacity-50"
                  )}
                >
                  {isLoading ? "Creating account..." : "Create Account"}
                </button>
              </form>
            </>
          )}

          {/* Back button for steps 2 & 3 */}
          {step !== "email" && (
            <button
              onClick={() => { setStep("email"); setError(null); }}
              className="mt-4 w-full text-center text-sm font-medium text-slate-500 hover:text-slate-700 transition-colors"
            >
              &larr; Back to email
            </button>
          )}

          <p className="mt-8 text-center text-base text-slate-500">
            Already have an account?{" "}
            <Link href="/login" className="font-semibold text-indigo-600 hover:text-indigo-700">
              Sign in
            </Link>
          </p>

          <div className="mt-10 flex items-center justify-center gap-6 text-xs text-slate-400 uppercase tracking-widest font-medium">
            <span>Terms of Service</span>
            <span>Privacy Policy</span>
            <span>Help Center</span>
          </div>
        </div>
      </div>
    </div>
  );
}
