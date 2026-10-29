import type { Metadata } from "next";
import { AdminSidebar } from "@/components/admin/admin-sidebar";
import { requireStaffPage } from "@/lib/admin/guard";
import { openCounts } from "@/lib/admin/queries";

export const metadata: Metadata = { title: { default: "Moderation", template: "%s · Moderation · Poppsie" }, robots: { index: false, follow: false } };

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requireStaffPage();
  const counts = await openCounts();
  return (
    <div className="mx-auto grid max-w-7xl gap-6 px-4 py-6 lg:grid-cols-[220px_1fr]">
      <aside>
        <AdminSidebar counts={counts} role={user.role === "admin" ? "admin" : "moderator"} />
      </aside>
      <div className="min-w-0">{children}</div>
    </div>
  );
}
