import type { ReactNode } from "react";
import RoleGuard from "@/components/RoleGuard";

export default function OpsLayout({ children }: { children: ReactNode }) {
  return (
    <RoleGuard allow={["OPERATOR", "SUPERVISOR"]} allowAnonymous>
      {children}
    </RoleGuard>
  );
}
