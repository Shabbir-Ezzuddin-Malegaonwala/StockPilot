"use client";

import { useEffect, useState, useCallback } from "react";
import { useAuthStore } from "@/store/auth.store";
import * as api from "@/lib/api";
import { cn, formatDate } from "@/lib/utils";

interface MemberInfo {
  id: string;
  name: string;
  email: string;
  role: string;
  image: string | null;
  joinedAt: string;
}

interface InvitationInfo {
  id: string;
  email: string;
  role: string;
  status: string;
  inviterName: string;
  expiresAt: string;
  createdAt: string;
}

const roleBadgeColors: Record<string, string> = {
  owner: "bg-purple-100 text-purple-700",
  admin: "bg-red-100 text-red-700",
  manager: "bg-blue-100 text-blue-700",
  member: "bg-gray-100 text-gray-700",
};

const availableRoles = ["admin", "manager", "member"];

export default function SettingsPage() {
  const { role, hasRole } = useAuthStore();

  const [members, setMembers] = useState<MemberInfo[]>([]);
  const [pendingInvitations, setPendingInvitations] = useState<InvitationInfo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Invite modal state
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("member");
  const [isInviting, setIsInviting] = useState(false);
  const [inviteResult, setInviteResult] = useState<{
    organizationName: string;
    inviterName: string;
    email: string;
    role: string;
  } | null>(null);
  const [copied, setCopied] = useState(false);
  const [inviteError, setInviteError] = useState("");

  // Role change state
  const [changingRoleId, setChangingRoleId] = useState<string | null>(null);

  // Remove member state
  const [removingId, setRemovingId] = useState<string | null>(null);

  // Cancel invitation state
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  const fetchMembers = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const data = await api.getOrgMembers();
      setMembers(data.members);
      setPendingInvitations(data.pendingInvitations);
    } catch {
      setError("Failed to load members. Make sure you have admin access.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMembers();
  }, [fetchMembers]);

  async function handleInvite() {
    if (!inviteEmail.trim()) {
      setInviteError("Please enter an email address.");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(inviteEmail.trim())) {
      setInviteError("Please enter a valid email address.");
      return;
    }
    setInviteError("");
    setIsInviting(true);
    try {
      const result = await api.inviteMember(inviteEmail.trim(), inviteRole);
      setInviteResult({
        organizationName: result.organizationName,
        inviterName: result.inviterName,
        email: result.email,
        role: result.role,
      });
      await fetchMembers();
    } catch {
      setError("Failed to send invitation.");
    } finally {
      setIsInviting(false);
    }
  }

  function getInviteMessage() {
    if (!inviteResult) return "";
    const baseUrl = typeof window !== "undefined" ? window.location.origin : "http://localhost:3000";
    return `You've been invited to join ${inviteResult.organizationName} as ${inviteResult.role} on StockPilot! Sign up at ${baseUrl}/signup with this email: ${inviteResult.email}`;
  }

  async function handleCopyMessage() {
    await navigator.clipboard.writeText(getInviteMessage());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function closeInviteModal() {
    setShowInviteModal(false);
    setInviteEmail("");
    setInviteRole("member");
    setInviteResult(null);
    setCopied(false);
  }

  async function handleRoleChange(memberId: string, newRole: string) {
    setChangingRoleId(memberId);
    try {
      await api.changeMemberRole(memberId, newRole);
      await fetchMembers();
    } catch {
      setError("Failed to change role.");
    } finally {
      setChangingRoleId(null);
    }
  }

  async function handleRemoveMember(memberId: string) {
    if (!confirm("Are you sure you want to remove this member?")) return;
    setRemovingId(memberId);
    try {
      await api.removeMember(memberId);
      await fetchMembers();
    } catch {
      setError("Failed to remove member.");
    } finally {
      setRemovingId(null);
    }
  }

  async function handleCancelInvitation(invitationId: string) {
    setCancellingId(invitationId);
    try {
      await api.cancelInvitation(invitationId);
      await fetchMembers();
    } catch {
      setError("Failed to cancel invitation.");
    } finally {
      setCancellingId(null);
    }
  }

  if (!hasRole("admin")) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="rounded-2xl bg-white p-8 shadow-sm text-center max-w-md">
          <h2 className="text-xl font-bold text-slate-900 mb-2">Access Denied</h2>
          <p className="text-slate-500">
            You need admin privileges or higher to access organization settings.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Page header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-6 sm:mb-8">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">Settings</h1>
          <p className="mt-1 text-sm sm:text-base text-slate-500">
            Manage your organization members and invitations
          </p>
        </div>
        <button
          onClick={() => setShowInviteModal(true)}
          className={cn(
            "inline-flex items-center justify-center gap-2 rounded-xl",
            "bg-gradient-to-br from-[#3525cd] to-[#4f46e5] px-4 sm:px-6 py-2.5 sm:py-3",
            "text-sm sm:text-[15px] font-medium text-white",
            "transition-all hover:shadow-lg hover:shadow-indigo-200",
            "w-full sm:w-auto"
          )}
        >
          <svg
            className="h-4 w-4 sm:h-5 sm:w-5"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={2}
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M18 7.5v3m0 0v3m0-3h3m-3 0h-3m-2.25-4.125a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0ZM3 19.235v-.11a6.375 6.375 0 0 1 12.75 0v.109A12.318 12.318 0 0 1 9.374 21c-2.331 0-4.512-.645-6.374-1.766Z"
            />
          </svg>
          Invite Member
        </button>
      </div>

      {/* Error banner */}
      {error && (
        <div className="mb-6 rounded-xl bg-red-50 border border-red-200 p-4 flex items-center justify-between">
          <p className="text-sm text-red-700">{error}</p>
          <button
            onClick={() => setError(null)}
            className="text-red-400 hover:text-red-600 text-sm font-medium"
          >
            Dismiss
          </button>
        </div>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-200 border-t-indigo-600" />
        </div>
      ) : (
        <>
          {/* Members table */}
          <div className="rounded-2xl bg-white p-8 shadow-sm mb-6">
            <h2 className="text-xs font-semibold uppercase tracking-widest text-slate-400 mb-4">
              Members
            </h2>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-100">
                    <th className="pb-3 text-left text-xs font-semibold uppercase tracking-widest text-slate-400">
                      Name
                    </th>
                    <th className="pb-3 text-left text-xs font-semibold uppercase tracking-widest text-slate-400">
                      Email
                    </th>
                    <th className="pb-3 text-left text-xs font-semibold uppercase tracking-widest text-slate-400">
                      Role
                    </th>
                    <th className="pb-3 text-left text-xs font-semibold uppercase tracking-widest text-slate-400">
                      Joined
                    </th>
                    <th className="pb-3 text-right text-xs font-semibold uppercase tracking-widest text-slate-400">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {members.map((member) => (
                    <tr key={member.id} className="border-b border-slate-50 last:border-0">
                      <td className="py-4">
                        <div className="flex items-center gap-3">
                          {member.image ? (
                            <img
                              src={member.image}
                              alt={member.name}
                              className="h-8 w-8 rounded-full object-cover"
                            />
                          ) : (
                            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-100 text-sm font-medium text-indigo-600">
                              {member.name.charAt(0).toUpperCase()}
                            </div>
                          )}
                          <span className="font-medium text-slate-900">{member.name}</span>
                        </div>
                      </td>
                      <td className="py-4 text-sm text-slate-500">{member.email}</td>
                      <td className="py-4">
                        {role === "owner" && member.role !== "owner" ? (
                          <select
                            value={member.role}
                            disabled={changingRoleId === member.id}
                            onChange={(e) => handleRoleChange(member.id, e.target.value)}
                            className={cn(
                              "rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-semibold",
                              "focus:outline-none focus:ring-2 focus:ring-indigo-300",
                              changingRoleId === member.id && "opacity-50 cursor-not-allowed"
                            )}
                          >
                            {availableRoles.map((r) => (
                              <option key={r} value={r}>
                                {r}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <span
                            className={cn(
                              "inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold",
                              roleBadgeColors[member.role] || roleBadgeColors.member
                            )}
                          >
                            {member.role}
                          </span>
                        )}
                      </td>
                      <td className="py-4 text-sm text-slate-500">{formatDate(member.joinedAt)}</td>
                      <td className="py-4 text-right">
                        {member.role !== "owner" && hasRole("admin") && (
                          <button
                            onClick={() => handleRemoveMember(member.id)}
                            disabled={removingId === member.id}
                            className={cn(
                              "rounded-xl px-3 py-1.5 text-xs font-semibold",
                              "text-red-600 hover:bg-red-50 transition-colors",
                              removingId === member.id && "opacity-50 cursor-not-allowed"
                            )}
                          >
                            {removingId === member.id ? "Removing..." : "Remove"}
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                  {members.length === 0 && (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-sm text-slate-400">
                        No members found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Pending Invitations */}
          <div className="rounded-2xl bg-white p-8 shadow-sm">
            <h2 className="text-xs font-semibold uppercase tracking-widest text-slate-400 mb-4">
              Pending Invitations
            </h2>
            {pendingInvitations.length === 0 ? (
              <p className="text-sm text-slate-400 py-4">No pending invitations.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-slate-100">
                      <th className="pb-3 text-left text-xs font-semibold uppercase tracking-widest text-slate-400">
                        Email
                      </th>
                      <th className="pb-3 text-left text-xs font-semibold uppercase tracking-widest text-slate-400">
                        Role
                      </th>
                      <th className="pb-3 text-left text-xs font-semibold uppercase tracking-widest text-slate-400">
                        Invited By
                      </th>
                      <th className="pb-3 text-left text-xs font-semibold uppercase tracking-widest text-slate-400">
                        Expires
                      </th>
                      <th className="pb-3 text-right text-xs font-semibold uppercase tracking-widest text-slate-400">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {pendingInvitations.map((inv) => (
                      <tr key={inv.id} className="border-b border-slate-50 last:border-0">
                        <td className="py-4 text-sm font-medium text-slate-900">{inv.email}</td>
                        <td className="py-4">
                          <span
                            className={cn(
                              "inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold",
                              roleBadgeColors[inv.role] || roleBadgeColors.member
                            )}
                          >
                            {inv.role}
                          </span>
                        </td>
                        <td className="py-4 text-sm text-slate-500">{inv.inviterName}</td>
                        <td className="py-4 text-sm text-slate-500">{formatDate(inv.expiresAt)}</td>
                        <td className="py-4 text-right">
                          <button
                            onClick={() => handleCancelInvitation(inv.id)}
                            disabled={cancellingId === inv.id}
                            className={cn(
                              "rounded-xl px-3 py-1.5 text-xs font-semibold",
                              "text-red-600 hover:bg-red-50 transition-colors",
                              cancellingId === inv.id && "opacity-50 cursor-not-allowed"
                            )}
                          >
                            {cancellingId === inv.id ? "Cancelling..." : "Cancel"}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {/* Invite Modal */}
      {showInviteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-xl">
            {inviteResult ? (
              <>
                <h3 className="text-lg font-bold text-slate-900 mb-2">Invitation Sent</h3>
                <p className="text-sm text-slate-500 mb-4">
                  Share this message with the invitee:
                </p>
                <div className="rounded-xl bg-slate-50 border border-slate-200 p-4 mb-4">
                  <p className="text-sm text-slate-700 leading-relaxed">{getInviteMessage()}</p>
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={handleCopyMessage}
                    className={cn(
                      "flex-1 rounded-xl px-4 py-2.5 text-sm font-medium transition-all",
                      copied
                        ? "bg-green-100 text-green-700"
                        : "bg-gradient-to-br from-[#3525cd] to-[#4f46e5] text-white hover:shadow-lg hover:shadow-indigo-200"
                    )}
                  >
                    {copied ? "Copied!" : "Copy Message"}
                  </button>
                  <button
                    onClick={closeInviteModal}
                    className="flex-1 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
                  >
                    Done
                  </button>
                </div>
              </>
            ) : (
              <>
                <h3 className="text-lg font-bold text-slate-900 mb-1">Invite Member</h3>
                <p className="text-sm text-slate-500 mb-6">
                  Send an invitation to join your organization.
                </p>

                <div className="mb-4">
                  <label className="text-xs font-semibold uppercase tracking-widest text-slate-400 mb-1.5 block">
                    Email Address
                  </label>
                  <input
                    type="email"
                    value={inviteEmail}
                    placeholder="colleague@example.com"
                    className={cn(
                      "w-full rounded-xl border px-4 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-300",
                      inviteError ? "border-red-300 ring-2 ring-red-100" : "border-slate-200"
                    )}
                    onChange={(e) => { setInviteEmail(e.target.value); setInviteError(""); }}
                  />
                  {inviteError && (
                    <p className="mt-1.5 text-xs text-red-600">{inviteError}</p>
                  )}
                </div>

                <div className="mb-6">
                  <label className="text-xs font-semibold uppercase tracking-widest text-slate-400 mb-1.5 block">
                    Role
                  </label>
                  <select
                    value={inviteRole}
                    onChange={(e) => setInviteRole(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-300"
                  >
                    {availableRoles.map((r) => (
                      <option key={r} value={r}>
                        {r.charAt(0).toUpperCase() + r.slice(1)}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={handleInvite}
                    disabled={isInviting}
                    className={cn(
                      "flex-1 rounded-xl px-4 py-2.5 text-sm font-medium text-white transition-all",
                      "bg-gradient-to-br from-[#3525cd] to-[#4f46e5] hover:shadow-lg hover:shadow-indigo-200",
                      isInviting && "opacity-50 cursor-not-allowed"
                    )}
                  >
                    {isInviting ? "Sending..." : "Send Invitation"}
                  </button>
                  <button
                    onClick={closeInviteModal}
                    className="flex-1 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
