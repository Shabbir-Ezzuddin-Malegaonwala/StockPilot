"use client";

import { useAuthStore } from "@/store/auth.store";
import { cn } from "@/lib/utils";

const roleBadgeStyles: Record<string, string> = {
  owner: "bg-purple-100 text-purple-700",
  admin: "bg-red-100 text-red-700",
  manager: "bg-blue-100 text-blue-700",
  member: "bg-gray-100 text-gray-700",
};

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export default function ProfilePage() {
  const { user, role, organization } = useAuthStore();

  if (!user) {
    return (
      <div className="flex items-center justify-center py-20 text-slate-400">
        Loading profile...
      </div>
    );
  }

  const badgeStyle = roleBadgeStyles[role ?? "member"] ?? roleBadgeStyles.member;

  return (
    <div className="mx-auto max-w-2xl space-y-6 py-10">
      {/* ---------- User Info Card ---------- */}
      <div className="rounded-2xl bg-white p-8 shadow-sm">
        <div className="flex items-center gap-6">
          {/* Avatar */}
          <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-indigo-600 to-indigo-700 text-xl font-bold text-white">
            {getInitials(user.name)}
          </div>

          <div className="min-w-0 flex-1">
            <h1 className="text-2xl font-semibold text-slate-900">
              {user.name}
            </h1>
            <p className="mt-1 text-sm text-slate-500">{user.email}</p>
          </div>

          {/* Role Badge */}
          {role && (
            <span
              className={cn(
                "rounded-full px-3 py-1 text-xs font-semibold capitalize",
                badgeStyle,
              )}
            >
              {role}
            </span>
          )}
        </div>

        {/* Detail rows */}
        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">
              Full Name
            </p>
            <p className="mt-1 text-sm text-slate-700">{user.name}</p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">
              Email
            </p>
            <p className="mt-1 text-sm text-slate-700">{user.email}</p>
          </div>
        </div>
      </div>

      {/* ---------- Organization Info Card ---------- */}
      {organization && (
        <div className="rounded-2xl bg-white p-8 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">Organization</h2>

          <div className="mt-6 grid gap-4 sm:grid-cols-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">
                Name
              </p>
              <p className="mt-1 text-sm text-slate-700">
                {organization.name}
              </p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">
                Slug
              </p>
              <p className="mt-1 text-sm text-slate-700">
                {organization.slug}
              </p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">
                Your Role
              </p>
              <span
                className={cn(
                  "mt-1 inline-block rounded-full px-3 py-1 text-xs font-semibold capitalize",
                  badgeStyle,
                )}
              >
                {role}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
