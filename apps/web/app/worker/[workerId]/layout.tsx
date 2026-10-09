import type { ReactNode } from "react";
import RoleGuard from "@/components/RoleGuard";

export default async function WorkerLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ workerId: string }>;
}) {
  const { workerId } = await params;

  return (
    <RoleGuard allow={["WORKER", "OPERATOR", "SUPERVISOR"]} workerId={workerId} allowAnonymous>
      {children}
    </RoleGuard>
  );
}
