"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import Link from "next/link";
import * as api from "@/lib/api";
import { useAuthStore } from "@/store/auth.store";
import { useInventoryStore } from "@/store/inventory.store";
import { cn } from "@/lib/utils";

export function Header() {
  const router = useRouter();
  const [showMenu, setShowMenu] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [showSearch, setShowSearch] = useState(false);
  const { user, role, organization } = useAuthStore();

  const userName = user?.name || "User";
  const orgName = organization?.name || "Organization";

  async function handleSignOut() {
    try {
      await api.signOut();
    } catch {
      // Even if sign-out API fails, redirect to login
    }
    useAuthStore.getState().clear();
    router.push("/login");
  }

  // Get initials for avatar
  const initials = userName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  // Role badge colors
  const roleBadgeClass =
    role === "owner" ? "bg-purple-100 text-purple-700" :
    role === "admin" ? "bg-red-100 text-red-700" :
    role === "manager" ? "bg-blue-100 text-blue-700" :
    "bg-gray-100 text-gray-700";

  return (
    <header className="sticky top-0 z-30 flex h-14 sm:h-16 items-center justify-between border-b border-slate-200/60 bg-white/80 px-3 sm:px-6 lg:px-8 backdrop-blur-sm">
      {/* Search bar */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (searchQuery.trim()) {
            useInventoryStore.getState().setFilter("search", searchQuery.trim());
            setSearchQuery("");
            router.push("/products");
          }
        }}
        className="hidden sm:flex items-center gap-2.5 rounded-xl bg-slate-50 px-4 py-2 text-sm sm:text-[15px] transition-colors hover:bg-slate-100 min-w-0 sm:min-w-[200px] lg:min-w-[240px]"
      >
        <button type="submit" className="flex-shrink-0 text-slate-400 hover:text-slate-600 transition-colors" tabIndex={-1}>
          <svg className="h-4 w-4 sm:h-5 sm:w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
          </svg>
        </button>
        <input
          type="text"
          placeholder="Search inventory..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="bg-transparent outline-none text-slate-700 placeholder:text-slate-400 w-full"
        />
      </form>

      {/* Mobile: search icon */}
      <button
        className="sm:hidden rounded-xl p-2 text-slate-400 hover:bg-slate-50"
        title="Search"
        onClick={() => router.push("/products")}
      >
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
        </svg>
      </button>

      {/* Right side */}
      <div className="flex items-center gap-2 sm:gap-4">
        {/* Notification bell */}
        <div className="relative">
          <button
            onClick={() => { setShowNotifications(!showNotifications); setShowMenu(false); }}
            className="relative rounded-xl p-2 text-slate-400 transition-colors hover:bg-slate-50 hover:text-slate-600"
            title="Notifications"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 0 0 5.454-1.31A8.967 8.967 0 0 1 18 9.75V9A6 6 0 0 0 6 9v.75a8.967 8.967 0 0 1-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 0 1-5.714 0m5.714 0a3 3 0 1 1-5.714 0" />
            </svg>
          </button>
          {showNotifications && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setShowNotifications(false)} />
              <div className="absolute right-0 top-full z-50 mt-2 w-72 rounded-xl bg-white p-4 shadow-lg shadow-slate-200/50 ring-1 ring-slate-100">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-slate-900">Notifications</h3>
                </div>
                <div className="flex flex-col items-center py-6 text-center">
                  <svg className="h-10 w-10 text-slate-300 mb-2" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 0 0 5.454-1.31A8.967 8.967 0 0 1 18 9.75V9A6 6 0 0 0 6 9v.75a8.967 8.967 0 0 1-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 0 1-5.714 0m5.714 0a3 3 0 1 1-5.714 0" />
                  </svg>
                  <p className="text-sm font-medium text-slate-500">No notifications</p>
                  <p className="text-xs text-slate-400 mt-1">You&apos;re all caught up!</p>
                </div>
              </div>
            </>
          )}
        </div>

        {/* User avatar + dropdown */}
        <div className="relative">
          <button
            onClick={() => { setShowMenu(!showMenu); setShowNotifications(false); }}
            className="flex items-center gap-2 sm:gap-3 rounded-xl px-2 py-1.5 transition-colors hover:bg-slate-50"
          >
            <div className="text-right hidden md:block">
              <div className="text-sm font-semibold text-slate-900 leading-tight">{orgName}</div>
              <div className="text-xs text-slate-500">{userName}</div>
            </div>
            <div className="flex h-9 w-9 sm:h-10 sm:w-10 items-center justify-center rounded-full bg-gradient-to-br from-indigo-600 to-indigo-700 text-xs sm:text-sm font-bold text-white flex-shrink-0">
              {initials}
            </div>
          </button>

          {/* Dropdown menu */}
          {showMenu && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setShowMenu(false)} />
              <div className="absolute right-0 top-full z-50 mt-2 w-56 rounded-xl bg-white p-1.5 shadow-lg shadow-slate-200/50 ring-1 ring-slate-100">
                {/* User info section */}
                <div className="px-4 py-3 border-b border-slate-100">
                  <div className="text-sm font-semibold text-slate-900">{userName}</div>
                  <div className="text-xs text-slate-500">{user?.email}</div>
                  <div className="mt-1.5 flex items-center gap-2">
                    <span className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider", roleBadgeClass)}>
                      {role}
                    </span>
                    <span className="text-xs text-slate-400">{orgName}</span>
                  </div>
                </div>

                {/* Menu items */}
                <div className="py-1">
                  <Link
                    href="/profile"
                    onClick={() => setShowMenu(false)}
                    className="flex w-full items-center gap-2.5 rounded-lg px-4 py-2.5 text-sm text-slate-700 transition-colors hover:bg-slate-50"
                  >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" />
                    </svg>
                    Profile
                  </Link>

                  {(role === "owner" || role === "admin") && (
                    <Link
                      href="/settings"
                      onClick={() => setShowMenu(false)}
                      className="flex w-full items-center gap-2.5 rounded-lg px-4 py-2.5 text-sm text-slate-700 transition-colors hover:bg-slate-50"
                    >
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 0 1 1.37.49l1.296 2.247a1.125 1.125 0 0 1-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 0 1 0 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 0 1-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 0 1-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 0 1-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 0 1-1.369-.49l-1.297-2.247a1.125 1.125 0 0 1 .26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 0 1 0-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 0 1-.26-1.43l1.297-2.247a1.125 1.125 0 0 1 1.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28Z" />
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
                      </svg>
                      Settings
                    </Link>
                  )}
                </div>

                {/* Sign out */}
                <div className="border-t border-slate-100 pt-1">
                  <button
                    onClick={handleSignOut}
                    className="flex w-full items-center gap-2.5 rounded-lg px-4 py-2.5 text-sm text-red-600 transition-colors hover:bg-red-50"
                  >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0 0 13.5 3h-6a2.25 2.25 0 0 0-2.25 2.25v13.5A2.25 2.25 0 0 0 7.5 21h6a2.25 2.25 0 0 0 2.25-2.25V15m3 0 3-3m0 0-3-3m3 3H9" />
                    </svg>
                    Sign Out
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
