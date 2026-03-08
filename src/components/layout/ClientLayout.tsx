import { ReactNode } from "react";
import ClientSidebar from "./ClientSidebar";
import ClientTopBar from "./ClientTopBar";
import JobProgressIndicator from "./JobProgressIndicator";
import ChatWidget from "@/components/chat/ChatWidget";

interface ClientLayoutProps {
  children: ReactNode;
}

const ClientLayout = ({ children }: ClientLayoutProps) => {
  return (
    <div className="min-h-screen bg-background flex">
      <ClientSidebar />
      <div className="flex-1 ml-60 flex flex-col">
        <ClientTopBar />
        <main className="flex-1 p-6 overflow-auto">{children}</main>
      </div>
      <JobProgressIndicator />
      <ChatWidget />
    </div>
  );
};

export default ClientLayout;
