
import { useState } from "react";
import { NavLink, useNavigate } from "react-router";
import { useAuth } from "../../auth/AuthContext";
import "../../styles/admin-premium.css";

function Icon({ name, size = 20 }) {
  const icons = {
    shield: (
      <>
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" />
        <path d="m9 12 2 2 4-4" />
      </>
    ),
    users: (
      <>
        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
      </>
    ),
    panel: (
      <>
        <rect x="3" y="4" width="18" height="16" rx="2" />
        <path d="M9 4v16" />
      </>
    ),
    chevron: <path d="m9 18 6-6-6-6" />,
    logout: (
      <>
        <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
        <path d="m16 17 5-5-5-5M21 12H9" />
      </>
    ),
    lock: (
      <>
        <rect x="4" y="10" width="16" height="11" rx="2" />
        <path d="M8 10V7a4 4 0 0 1 8 0v3" />
      </>
    ),
  };

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {icons[name] || icons.shield}
    </svg>
  );
}

export default function AdminLayout({
  title,
  subtitle,
  children,
}) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const [collapsed, setCollapsed] = useState(false);

  const name =
    user?.displayName?.trim() ||
    user?.email ||
    "Quản trị viên";

  function handleLogout() {
    logout();
    navigate("/login", { replace: true });
  }

  return (
    <div
      className={`adm-shell${
        collapsed ? " adm-collapsed" : ""
      }`}
    >
      {/* ====================================
          MENU BÊN TRÁI
      ==================================== */}
      <aside className="adm-sidebar">
        <div className="adm-brand">
          <span className="adm-brand-icon">
            <Icon name="shield" size={24} />
          </span>

          <span className="adm-brand-copy">
            <strong>PHÚ GIA</strong>
            <small>ROYAL PARK · ADMIN</small>
          </span>
        </div>

        <div className="adm-navigation-group">
          <span className="adm-sidebar-label">
            HỆ THỐNG
          </span>

          <nav
            className="adm-navigation"
            aria-label="Điều hướng quản trị"
          >
            <NavLink
              to="/admin"
              end
              title="Quản lý tài khoản"
              className={({ isActive }) =>
                `adm-nav-link${
                  isActive ? " active" : ""
                }`
              }
            >
              <span className="adm-nav-icon">
                <Icon name="users" size={19} />
              </span>

              <span className="adm-nav-text">
                <strong>Quản lý tài khoản</strong>
                <small>Người dùng & phân quyền</small>
              </span>

              <span className="adm-nav-arrow">
                <Icon name="chevron" size={15} />
              </span>
            </NavLink>
          </nav>
        </div>

        {/* TÀI KHOẢN ADMIN */}
        <div className="adm-sidebar-bottom">
          <div className="adm-sidebar-note">
            <Icon name="lock" size={17} />
            <span>Không gian quản trị an toàn</span>
          </div>

          <div className="adm-sidebar-user">
            <span className="adm-avatar">
              {name.charAt(0).toUpperCase()}
            </span>

            <span className="adm-sidebar-user-copy">
              <strong title={name}>{name}</strong>
              <small>Administrator</small>
            </span>
          </div>

          <button
            className="adm-sidebar-logout"
            type="button"
            title="Đăng xuất"
            onClick={handleLogout}
          >
            <Icon name="logout" size={18} />
            <span>Đăng xuất</span>
          </button>
        </div>
      </aside>

      {/* ====================================
          KHÔNG GIAN LÀM VIỆC
      ==================================== */}
      <div className="adm-workspace">
        <header className="adm-topbar">
          <div className="adm-breadcrumb">
            <span>Phú Gia Royal Park</span>
            <Icon name="chevron" size={14} />
            <strong>Quản trị</strong>
          </div>

          <div className="adm-topbar-right">
            <span className="adm-security-label">
              <Icon name="shield" size={15} />
              Khu vực ADMIN
            </span>

            <span
              className="adm-topbar-avatar"
              title={name}
            >
              {name.charAt(0).toUpperCase()}
            </span>
          </div>
        </header>

        <div className="adm-content">
          <div className="adm-page-heading">
            <div className="adm-page-title">
              <span className="adm-heading-kicker">
                QUẢN LÝ HỆ THỐNG
              </span>

              <h1>
                {title || "Quản trị hệ thống"}
              </h1>

              {subtitle && <p>{subtitle}</p>}
            </div>

            <button
              type="button"
              className="adm-collapse"
              aria-label={
                collapsed
                  ? "Mở rộng menu"
                  : "Thu gọn menu"
              }
              title={
                collapsed
                  ? "Mở rộng menu"
                  : "Thu gọn menu"
              }
              aria-expanded={!collapsed}
              onClick={() =>
                setCollapsed((value) => !value)
              }
            >
              <Icon name="panel" size={19} />
            </button>
          </div>

          <main
            className="adm-main"
            id="main-content"
          >
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}
