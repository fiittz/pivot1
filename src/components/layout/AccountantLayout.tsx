import { ReactNode } from "react";
import AccountantSidebar from "./AccountantSidebar";
import AccountantTopBar from "./AccountantTopBar";

interface AccountantLayoutProps {
  children: ReactNode;
}

const AccountantLayout = ({ children }: AccountantLayoutProps) => {
  return (
    <div className="min-h-screen bg-background flex">
      <AccountantSidebar />
      <div className="flex-1 ml-60 flex flex-col">
        <AccountantTopBar />
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  );
};

export default AccountantLayout;
