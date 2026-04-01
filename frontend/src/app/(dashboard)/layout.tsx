"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import * as api from "@/lib/api";
import { Sidebar } from "@/components/Sidebar";
import { Header } from "@/components/Header";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { useSidebarStore } from "@/store/sidebar.store";
import { useAuthStore } from "@/store/auth.store";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [isReady, setIsReady] = useState(false);
  const { isCollapsed, setCollapsed } = useSidebarStore();
  const { setUser, fetchRoleAndOrg } = useAuthStore();

  // Auto-collapse sidebar on mobile screens
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 1024) {
        setCollapsed(true);
      }
    };
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [setCollapsed]);

  useEffect(() => {
    let cancelled = false;

    async function checkAuth() {
      try {
        const session = await api.getSession();
        if (cancelled) return;

        // No session — redirect to login
        if (!session || !session.user) {
          router.push("/login");
          return;
        }

        // Store user info in auth store
        setUser({
          id: session.user.id,
          name: session.user.name,
          email: session.user.email,
          image: session.user.image,
        });

        // If no active organization, check for pending invitations first
        if (!session.session.activeOrganizationId) {
          // Check if user has pending invitations
          try {
            const invResult = await api.getMyPendingInvitations();
            if (cancelled) return;

            if (invResult.invitations && invResult.invitations.length > 0) {
              // Auto-accept the first pending invitation
              const inv = invResult.invitations[0];
              const acceptResult = await api.acceptInvitation(inv.id);
              await api.setActiveOrganization(acceptResult.organizationId);
              if (cancelled) return;
              // Fetch role info and continue
              await fetchRoleAndOrg();
              setIsReady(true);
              return;
            }
          } catch {
            // Invitation check failed — continue to org check
          }

          // No invitations — check existing orgs
          const orgs = await api.listOrganizations();
          if (cancelled) return;

          if (!orgs || orgs.length === 0) {
            router.push("/onboarding");
            return;
          }

          await api.setActiveOrganization(orgs[0].id);
          if (cancelled) return;
        }

        // Fetch user's role and org info
        await fetchRoleAndOrg();
        if (cancelled) return;

        setIsReady(true);
      } catch {
        if (!cancelled) {
          router.push("/login");
        }
      }
    }

    checkAuth();
    return () => { cancelled = true; };
  }, [router, setUser, fetchRoleAndOrg]);

  if (!isReady) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <LoadingSpinner size="lg" message="Loading StockPilot..." />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <Sidebar />
      <div
        className={`transition-all duration-300 ${
          isCollapsed ? "ml-[68px]" : "ml-60"
        }`}
      >
        <Header />
        <main className="p-4 sm:p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
