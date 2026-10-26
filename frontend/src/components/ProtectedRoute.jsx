import { Navigate } from "react-router";

import { useAuth } from "../auth/AuthContext";
import { roleHome } from "../api/client";

export default function ProtectedRoute({
  roles,
  children,
}) {
  const { user, checking } = useAuth();

  if (checking) {
    return (
      <div className="center-state">
        Đang xác minh quyền truy cập...
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (!roles.includes(user.role)) {
    return (
      <Navigate
        to={roleHome(user.role)}
        replace
      />
    );
  }

  return children;
}