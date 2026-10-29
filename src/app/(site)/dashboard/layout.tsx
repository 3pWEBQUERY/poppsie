import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { DashboardSidebar } from "@/components/dashboard/sidebar";
import { requirePageUser } from "@/lib/auth/guards";
import { navFor } from "@/lib/dashboard/nav";
import { recomputeProfile } from "@/lib/profile/recompute";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const user = await requirePageUser({ next: "/dashboard" });
  const status = await recomputeProfile(user.id);
  const complete = status?.complete ?? user.profileComplete;
  return (
    <div className="mx-auto grid max-w-6xl gap-6 px-4 py-6 lg:grid-cols-[230px_1fr]">
      <aside>
        <DashboardSidebar items={navFor(user.accountType)} complete={complete} />
      </aside>
      <div className="min-w-0">
        <DashboardShell accountType={user.accountType} complete={complete} percent={status?.percent ?? 0} nextStep={status?.nextStep ?? null} kycStatus={user.kycStatus}>
          {children}
        </DashboardShell>
      </div>
    </div>
  );
}
