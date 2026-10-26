
import { Link, NavLink } from "react-router";
import { useAuth } from "../../auth/AuthContext";
import { roleHome } from "../../api/client";

import "../../styles/user-premium.css";
import "../../styles/user-contact.css";

export default function UserLayout({ children }) {
  const { user, checking, logout } = useAuth();

  return (
    <div className="pg-user-shell">
      {/* THANH ĐẦU TRANG USER */}
      <header className="uc-site-header">
        <div className="uc-header-inner">
          {/* LOGO */}
          <Link
            to="/user"
            className="uc-site-brand"
            aria-label="Về mặt bằng Phú Gia Royal Park"
          >
            <span
              className="uc-brand-icon"
              aria-hidden="true"
            >
              <svg
                viewBox="0 0 36 36"
                fill="none"
              >
                <path
                  d="m5 17 13-11 13 11M9 15v16h18V15M15 31V21h6v10"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </span>

            <span className="uc-brand-copy">
              <strong>
                PHÚ GIA ROYAL PARK
              </strong>

              <small>
                Mặt bằng bất động sản · Quy Nhơn
              </small>
            </span>
          </Link>

          {/* MENU */}
          <nav
            className="uc-main-nav"
            aria-label="Điều hướng khách hàng"
          >
            <NavLink to="/user" end>
              Khám phá mặt bằng
            </NavLink>
          </nav>

          {/* TÀI KHOẢN */}
          <div className="uc-account-actions">
            {checking ? (
              <span className="uc-auth-checking">
                Đang kiểm tra...
              </span>
            ) : user ? (
              <>
                <span
                  className="uc-user-name"
                  title={
                    user.displayName || user.email
                  }
                >
                  <span
                    className="uc-online-dot"
                    aria-hidden="true"
                  />

                  {user.displayName || user.email}
                </span>

                {/* AGENT / ADMIN VỀ TRANG QUẢN LÝ */}
                {user.role !== "USER" && (
                  <Link
                    className="uc-login-link"
                    to={roleHome(user.role)}
                  >
                    Trang quản lý
                  </Link>
                )}

                <button
                  className="uc-logout-button"
                  type="button"
                  onClick={logout}
                >
                  Đăng xuất
                </button>
              </>
            ) : (
              <>
                {/* KHÁCH CHƯA ĐĂNG NHẬP */}
                <Link
                  className="uc-login-link"
                  to="/login"
                >
                  Đăng nhập
                </Link>

                <Link
                  className="uc-register-link"
                  to="/register"
                >
                  Đăng ký
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      {/* NỘI DUNG USER */}
      <main
        className="ux-main uc-page-content"
        id="main-content"
      >
        {children}
      </main>
    </div>
  );
}
