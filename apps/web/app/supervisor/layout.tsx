import type { ReactNode } from "react";
import RoleGuard from "@/components/RoleGuard";

export default function SupervisorLayout({ children }: { children: ReactNode }) {
  return <RoleGuard allow={["SUPERVISOR"]}>{children}</RoleGuard>;
}
