import type { Metadata } from "next";
import { DM_Sans } from "next/font/google";
import "./globals.css";
import { GenerationJobsProviderWrapper } from "./generation-jobs-provider";
import { AppProviders } from "./providers";

const dmSans = DM_Sans({
  variable: "--font-dm-sans",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Dramo.ai",
  description: "Dramo.ai is a platform for creating and managing drama scripts.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${dmSans.variable} antialiased`}
        suppressHydrationWarning
      >
        <AppProviders>
          <GenerationJobsProviderWrapper>
            {children}
          </GenerationJobsProviderWrapper>
        </AppProviders>
      </body>
    </html>
  );
}
