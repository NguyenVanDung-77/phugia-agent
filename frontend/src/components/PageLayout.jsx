
import { useLocation } from "react-router";

import UserLayout from "./layouts/UserLayout";
import AgentLayout from "./layouts/AgentLayout";
import AdminLayout from "./layouts/AdminLayout";

// Sử dụng đúng giao diện theo từng khu vực,
// không lặp lại header.
export default function PageLayout({
  title,
  subtitle,
  children,
}) {
  const { pathname } = useLocation();

  if (
    pathname === "/user" ||
    pathname.startsWith("/user/")
  ) {
    return (
      <UserLayout title={title} subtitle={subtitle}>
        {children}
      </UserLayout>
    );
  }

  if (
    pathname === "/agent" ||
    pathname.startsWith("/agent/")
  ) {
    return (
      <AgentLayout title={title} subtitle={subtitle}>
        {children}
      </AgentLayout>
    );
  }

  if (
    pathname === "/admin" ||
    pathname.startsWith("/admin/")
  ) {
    return (
      <AdminLayout title={title} subtitle={subtitle}>
        {children}
      </AdminLayout>
    );
  }

  return (
    <main className="page-body">
      {children}
    </main>
  );
}
