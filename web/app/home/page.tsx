import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth/options";
import { AppSidebar } from "@/components/layout/AppSidebar";
import { CreativeInput } from "@/components/home/CreativeInput";
import { QuickActions } from "@/components/home/QuickActions";
import { RecentProjects } from "@/components/home/RecentProjects";

export const metadata = {
  title: "主页 - DRAMO",
  description: "你的AI创作伙伴",
};

export default async function HomePage() {
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect("/login?redirect=/home");
  }

  return (
    <div className="min-h-screen flex rice-paper-bg">
      <AppSidebar />

      <main className="flex-1 relative z-10 overflow-y-auto">
        {/* Hero creative section */}
        <div className="px-8 lg:px-20 pt-20 pb-12">
          <div className="max-w-5xl mx-auto">
            <CreativeInput userName={session.user?.name || session.user?.email} />
            <QuickActions />
          </div>
        </div>

        {/* Divider */}
        <div className="max-w-5xl mx-auto px-8 lg:px-20">
          <div className="ink-divider" />
        </div>

        {/* Recent projects */}
        <div className="px-8 lg:px-20 pb-20">
          <div className="max-w-5xl mx-auto">
            <RecentProjects />
          </div>
        </div>
      </main>
    </div>
  );
}
