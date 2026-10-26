
import { useState } from "react";
import { NavLink, useLocation, useNavigate } from "react-router";
import { useAuth } from "../../auth/AuthContext";
import "../../styles/agent-premium.css";

const NAV_ITEMS = [
  {
    to: "/agent",
    label: "Quản lý căn",
    description: "Mặt bằng & thông tin căn",
    icon: "building",
  },
  {
    to: "/agent/zones",
    label: "Quản lý phân khu",
    description: "Ruby · Sapphire · Crystal",
    icon: "layers",
  },
  {
    to: "/agent/reports",
    label: "Báo cáo bán hàng",
    description: "Thống kê & xuất dữ liệu",
    icon: "chart",
  },
];

function Icon({ name, size = 20 }) {
  const shapes = {
    building: (
      <>
        <rect x="4" y="3" width="16" height="18" rx="2" />
        <path d="M9 7h2m4 0h0M9 11h2m4 0h0M9 15h2m4 0h0M10 21v-4h4v4" />
      </>
    ),
    layers: (
      <>
        <path d="m12 3 9 5-9 5-9-5 9-5Z" />
        <path d="m3 12 9 5 9-5M3 17l9 5 9-5" />
      </>
    ),
    chart: (
      <>
        <rect x="3" y="3" width="18" height="18" rx="3" />
        <path d="M7 16v-4m5 4V8m5 8v-6" />
      </>
    ),
    panel: (
      <>
        <rect x="3" y="4" width="18" height="16" rx="2" />
        <path d="M9 4v16" />
      </>
    ),
    chevron: <path d="m9 6 6 6-6 6" />,
    logout: (
      <>
        <path d="M10 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h4" />
        <path d="m14 8 4 4-4 4M9 12h9" />
      </>
    ),
    shield: (
      <>
        <path d="m12 2 8 4v6c0 5-3.2 8-8 10-4.8-2-8-5-8-10V6l8-4Z" />
        <path d="m9 12 2 2 4-4" />
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
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {shapes[name] || shapes.building}
    </svg>
  );
}

export default function AgentLayout({ title, subtitle, children }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);

  const selected =
    NAV_ITEMS.find((item) => item.to === location.pathname) ||
    NAV_ITEMS[0];

  const page =
    selected.to === "/agent/zones"
      ? "zones"
      : selected.to === "/agent/reports"
        ? "reports"
        : "units";

  const displayName =
    user?.displayName?.trim() || user?.email || "Nhân viên";

  const avatarLetter = displayName.charAt(0).toUpperCase();

  function handleLogout() {
    logout();
    navigate("/login", { replace: true });
  }

  return (
    <div
      className={`ag-shell ag-page-${page}${collapsed ? " ag-collapsed" : ""}`}
    >
      {/* SIDEBAR AGENT */}
      <aside className="ag-sidebar" aria-label="Thanh quản lý Agent">
        <div className="ag-brand">
          <div className="ag-brand-mark" aria-hidden="true">
            <span className="ag-mark-roof" />
            <span className="ag-mark-buildings" />
          </div>

          <div className="ag-brand-copy">
            <strong>PHÚ GIA</strong>
            <small>ROYAL PARK · AGENT</small>
          </div>
        </div>

        {/* MENU CHỨC NĂNG */}
        <div className="ag-nav-section">
          <p className="ag-nav-caption">
            KHÔNG GIAN LÀM VIỆC
          </p>

          <nav className="ag-nav" aria-label="Chức năng Agent">
            {NAV_ITEMS.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === "/agent"}
                title={collapsed ? item.label : undefined}
                className={({ isActive }) =>
                  `ag-nav-link${isActive ? " is-active" : ""}`
                }
              >
                <span className="ag-nav-icon">
                  <Icon name={item.icon} size={19} />
                </span>

                <span className="ag-nav-copy">
                  <strong>{item.label}</strong>
                  <small>{item.description}</small>
                </span>

                <span className="ag-nav-arrow">
                  <Icon name="chevron" size={15} />
                </span>
              </NavLink>
            ))}
          </nav>
        </div>

        {/* TÀI KHOẢN AGENT */}
        <div className="ag-sidebar-bottom">
          <div className="ag-account">
            <span className="ag-avatar" aria-hidden="true">
              {avatarLetter}
            </span>

            <span className="ag-account-copy">
              <strong title={displayName}>{displayName}</strong>
              <small>Nhân viên quản lý</small>
            </span>
          </div>

          <button
            type="button"
            className="ag-logout"
            onClick={handleLogout}
            title="Đăng xuất"
          >
            <Icon name="logout" size={18} />
            <span>Đăng xuất</span>
          </button>
        </div>
      </aside>

      {/* KHU VỰC LÀM VIỆC */}
      <div className="ag-workspace">
        {/* TOPBAR */}
        <header className="ag-topbar">
          <div className="ag-breadcrumb">
            <span>Phú Gia Royal Park</span>
            <Icon name="chevron" size={14} />
            <strong>{selected.label}</strong>
          </div>

          <div className="ag-topbar-actions">
            <span className="ag-topbar-badge">
              <span className="ag-live-dot" />
              Agent Workspace
            </span>

            <span
              className="ag-topbar-avatar"
              title={displayName}
            >
              {avatarLetter}
            </span>
          </div>
        </header>

        {/* TIÊU ĐỀ TRANG */}
        <section className="ag-page-header">
          <div className="ag-page-heading">
            <p className="ag-page-kicker">
              <Icon name={selected.icon} size={16} />
              {selected.label.toLocaleUpperCase("vi-VN")}
            </p>

            <h1>{title || selected.label}</h1>

            {subtitle && (
              <p className="ag-page-subtitle">
                {subtitle}
              </p>
            )}
          </div>

          <div className="ag-page-tools">
            <span className="ag-access-tag">
              <Icon name="shield" size={16} />
              Quyền Agent
            </span>

            <button
              type="button"
              className="ag-collapse-button"
              onClick={() =>
                setCollapsed((value) => !value)
              }
              aria-label={
                collapsed
                  ? "Mở rộng menu"
                  : "Thu gọn menu"
              }
              aria-expanded={!collapsed}
              title={
                collapsed
                  ? "Mở rộng menu"
                  : "Thu gọn menu"
              }
            >
              <Icon name="panel" size={18} />
            </button>
          </div>
        </section>

        {/* GIỮ NGUYÊN NỘI DUNG CÁC TRANG */}
        <main className="ag-main" id="main-content">
          {children}
        </main>
      </div>
    </div>
  );
}
