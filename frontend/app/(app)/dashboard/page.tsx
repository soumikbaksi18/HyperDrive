import { Suspense } from "react";
import type { Metadata } from "next";
import { DashboardHome } from "@/components/dashboard/dashboard-home";

export const metadata: Metadata = {
  title: "Dashboard",
};

export default function DashboardPage() {
  return (
    <Suspense
      fallback={
        <div className="px-6 py-10 text-sm text-white/50">Opening the desk…</div>
      }
    >
      <DashboardHome />
    </Suspense>
  );
}
