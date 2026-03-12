import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import Sidebar from "@/components/layout/Sidebar";
import Providers from "@/components/Providers";
import DashboardAlertsBell from "@/components/layout/DashboardAlertsBell";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  return (
    <Providers>
      <div className="flex h-screen overflow-hidden bg-dashboard">
        <Sidebar />
        <main className="flex-1 overflow-y-auto pt-14 lg:pt-0">
          <div className="px-4 lg:px-8 py-4 lg:py-6 mx-auto">
            <div className="mb-3 flex justify-end">
              <DashboardAlertsBell />
            </div>
            {children}
          </div>
        </main>
      </div>
    </Providers>
  );
}
