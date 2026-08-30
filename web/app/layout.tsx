import type { Metadata } from "next";
import { Noto_Sans_SC } from "next/font/google";
import "./globals.css";
import { GenerationJobsProviderWrapper } from "./generation-jobs-provider";
import { AppProviders } from "./providers";

const notoSansSC = Noto_Sans_SC({
  variable: "--font-noto-sans-sc",
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "DRAMO",
  description: "和你的猫猫，写下第一个故事。剧本、分镜、角色，放在同一张书桌上。",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body
        className={`${notoSansSC.variable} antialiased`}
        suppressHydrationWarning
      >
        {/*
          THESIS: Night writing desk, not a SaaS feature wall. One sentence, one action, one still companion.
          OWN-WORLD: Off-black #141210, lamp paper #f4efe6, ember #c2410c. 8px corners. No grain, no Courier costume, no section numbers.
          STORY: Visitor understands they can write a script at this desk, then clicks 开始写作 and types.
          FIRST VIEWPORT: Split hero. Left headline + lede + CTA. Right still cat with a short scene excerpt.
          FORM: Asymmetric split, editorial sheet, 1+2 tile. Code-led refinement of the incumbent cinema world.
          FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
        */}
        <AppProviders>
          <GenerationJobsProviderWrapper>
            {children}
          </GenerationJobsProviderWrapper>
        </AppProviders>
      </body>
    </html>
  );
}
