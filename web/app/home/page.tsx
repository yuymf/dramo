import { AppSidebar } from "@/components/layout/AppSidebar";
import { CreativeInput } from "@/components/home/CreativeInput";
import { RecentProjects } from "@/components/home/RecentProjects";

export const metadata = {
  title: "主页 - DRAMO",
  description: "写下今天的故事",
};

export default function HomePage() {
  return (
    <div className="min-h-screen flex rice-paper-bg">
      <AppSidebar />

      <main className="flex-1 relative z-10 overflow-y-auto">
        <div className="px-8 lg:px-20 pt-20 pb-12">
          <div className="max-w-5xl mx-auto">
            <CreativeInput />
          </div>
        </div>

        <div className="max-w-5xl mx-auto px-8 lg:px-20">
          <div className="ink-divider" />
        </div>

        <div className="px-8 lg:px-20 pb-20">
          <div className="max-w-5xl mx-auto">
            <RecentProjects />
          </div>
        </div>
      </main>
    </div>
  );
}
