
import { Navigate, Route, Routes } from "react-router";
import { useAuth } from "./auth/AuthContext";
import { roleHome } from "./api/client";

import ProtectedRoute from "./components/ProtectedRoute";

import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";

import UserPage from "./pages/user/UserPage";
import UserUnitDetailPage from "./pages/user/UserUnitDetailPage";

import AgentPage from "./pages/agent/AgentPage";
import AgentZonesPage from "./pages/agent/AgentZonesPage";
import AgentReportsPage from "./pages/agent/AgentReportsPage";

import AdminPage from "./pages/admin/AdminPage";

import UserContactDock from "./components/UserContactDock";

// ========================================
// TRANG MẶC ĐỊNH
// Khách chưa đăng nhập cũng vào được USER.
// ========================================

function HomeRedirect() {
  const { user, checking } = useAuth();

  if (checking) {
    return (
      <div className="center-state">
        Đang tải trang...
      </div>
    );
  }

  return (
    <Navigate
      to={user ? roleHome(user.role) : "/user"}
      replace
    />
  );
}

// ========================================
// KHUNG TRANG USER CÔNG KHAI
// Widget xuất hiện trên mọi trang USER.
// ========================================

function PublicUserRoute({ children }) {
  return (
    <>
      {children}
      <UserContactDock />
    </>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<HomeRedirect />} />

      {/* ĐĂNG NHẬP VÀ ĐĂNG KÝ */}
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />

      {/* USER: KHÔNG YÊU CẦU ĐĂNG NHẬP */}
      <Route
        path="/user"
        element={
          <PublicUserRoute>
            <UserPage />
          </PublicUserRoute>
        }
      />

      {/* CHI TIẾT CĂN: KHÔNG YÊU CẦU ĐĂNG NHẬP */}
      <Route
        path="/user/units/:unitId"
        element={
          <PublicUserRoute>
            <UserUnitDetailPage />
          </PublicUserRoute>
        }
      />

      {/* AGENT: VẪN PHẢI ĐĂNG NHẬP */}
      <Route
        path="/agent"
        element={
          <ProtectedRoute roles={["AGENT", "ADMIN"]}>
            <AgentPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/agent/zones"
        element={
          <ProtectedRoute roles={["AGENT", "ADMIN"]}>
            <AgentZonesPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/agent/reports"
        element={
          <ProtectedRoute roles={["AGENT", "ADMIN"]}>
            <AgentReportsPage />
          </ProtectedRoute>
        }
      />

      {/* ADMIN: VẪN PHẢI ĐĂNG NHẬP */}
      <Route
        path="/admin"
        element={
          <ProtectedRoute roles={["ADMIN"]}>
            <AdminPage />
          </ProtectedRoute>
        }
      />

      <Route path="*" element={<HomeRedirect />} />
    </Routes>
  );
}
