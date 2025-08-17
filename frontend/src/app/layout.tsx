import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";
import { AppProvider } from "@/contexts/AppContext";
import { ChatProvider } from "@/contexts/ChatContext";
import { Navbar } from "@/components/ui/navbar";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Code Chatter - AI-Powered Code Analysis",
  description: "Chat with your codebase using AI. Upload files or connect repositories for intelligent code analysis.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className={inter.className}>
        <AppProvider>
          <ChatProvider>
            <Navbar />
            {children}
            <Toaster richColors />
          </ChatProvider>
        </AppProvider>
      </body>
    </html>
  );
}
