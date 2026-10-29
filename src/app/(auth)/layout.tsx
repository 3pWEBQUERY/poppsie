import { SiteFooter } from "@/components/site/footer";
import { Logo } from "@/components/site/logo";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <header className="border-t-2 border-t-primary bg-card">
        <div className="mx-auto flex h-14 max-w-6xl items-center px-4">
          <Logo />
        </div>
      </header>
      <main className="mx-auto flex w-full max-w-md flex-col px-4 py-10">{children}</main>
      <SiteFooter />
    </>
  );
}
