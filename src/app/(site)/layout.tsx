import { SiteFooter } from "@/components/site/footer";
import { SiteHeader } from "@/components/site/header";
import { RealtimeBridge } from "@/components/site/realtime-bridge";
import { getSessionUser } from "@/lib/auth/session";

export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser();
  return (
    <>
      <SiteHeader />
      {user && <RealtimeBridge />}
      <main>{children}</main>
      <SiteFooter />
    </>
  );
}
