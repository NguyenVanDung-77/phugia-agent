
import { useState } from "react";
import {
  Link,
  Navigate,
  useLocation,
  useNavigate,
} from "react-router";

import { useAuth } from "../auth/AuthContext";
import { roleHome } from "../api/client";

import "../styles/auth-premium.css";

function EyeIcon({ visible }) {
  return visible ? (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M3 3l18 18M10.5 5.2A11 11 0 0 1 12 5c6 0 10 7 10 7a15 15 0 0 1-3.1 3.9M6.5 6.5C3.5 8.6 2 12 2 12s4 7 10 7c1.5 0 2.9-.4 4.1-1"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <path
        d="M10.6 10.6a2 2 0 0 0 2.8 2.8"
        stroke="currentColor"
        strokeWidth="1.8"
      />
    </svg>
  ) : (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7-10-7-10-7Z"
        stroke="currentColor"
        strokeWidth="1.8"
      />
      <circle
        cx="12"
        cy="12"
        r="3"
        stroke="currentColor"
        strokeWidth="1.8"
      />
    </svg>
  );
}

// ========================================
// HỌA TIẾT TRANG TRÍ
// ========================================

function Decor() {
  return (
    <div className="auth-decor" aria-hidden="true">
      <span className="auth-decor-loop one" />
      <span className="auth-decor-loop two" />

      <svg viewBox="0 0 380 290" fill="none">
        <rect
          x="70"
          y="36"
          width="240"
          height="210"
          rx="25"
          stroke="currentColor"
          strokeOpacity=".24"
          strokeWidth="1.6"
        />

        <path
          d="M114 223V91l76-53 76 53v132M114 104h152M152 104v119M190 104v119M228 104v119M115 164h150"
          stroke="currentColor"
          strokeOpacity=".65"
          strokeWidth="1.8"
          strokeLinejoin="round"
        />

        <rect
          x="158"
          y="111"
          width="26"
          height="46"
          rx="5"
          fill="#D6EACB"
          fillOpacity=".28"
        />

        <rect
          x="196"
          y="170"
          width="27"
          height="46"
          rx="5"
          fill="#E8D5AB"
          fillOpacity=".5"
        />

        <path
          d="M70 91H41M310 166h31M190 37V15"
          stroke="currentColor"
          strokeOpacity=".3"
          strokeWidth="1.7"
        />

        <circle
          cx="190"
          cy="142"
          r="110"
          stroke="currentColor"
          strokeOpacity=".12"
        />
      </svg>
    </div>
  );
}

// ========================================
// TRANG ĐĂNG NHẬP
// ========================================

export default function LoginPage() {
  const { user, checking, login } = useAuth();

  const navigate = useNavigate();
  const location = useLocation();

  const registered =
    location.state?.registered === true;

  const [email, setEmail] = useState(
    location.state?.email || ""
  );

  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(event) {
    event.preventDefault();

    if (loading) return;

    setLoading(true);
    setError("");

    try {
      const account = await login(
        email.trim(),
        password
      );

      setPassword("");

      // Chuyển theo role thật từ Backend.
      navigate(
        roleHome(account.role),
        { replace: true }
      );
    } catch (err) {
      setError(
        err.message ||
          "Không thể đăng nhập. Vui lòng thử lại."
      );
    } finally {
      setLoading(false);
    }
  }

  if (checking) {
    return (
      <div className="center-state">
        Đang xác minh tài khoản...
      </div>
    );
  }

  if (user) {
    return (
      <Navigate
        to={roleHome(user.role)}
        replace
      />
    );
  }

  return (
    <div className="auth-screen">
      <div className="auth-layout">
        {/* CỘT TRÁI */}
        <aside className="auth-story">
          <Link
            to="/login"
            className="auth-story-brand"
          >
            <span className="auth-brand-symbol">
              ✧
            </span>

            <span>
              <strong>
                PHÚ GIA ROYAL PARK
              </strong>

              <small>
                QUY NHƠN · VIỆT NAM
              </small>
            </span>
          </Link>

          <div className="auth-story-center">
            <div className="auth-story-overline">
              <span />
              KHÔNG GIAN SỐNG CỦA BẠN
            </div>

            <h2>
              Khám phá căn nhà{" "}
              <em>phù hợp với bạn.</em>
            </h2>

            <p>
              Tra cứu mặt bằng tương tác,
              khám phá từng phân khu và xem
              thông tin căn trong một không
              gian trực quan.
            </p>

            <Decor />
          </div>

          <div className="auth-story-foot">
            <span>RUBY</span>
            <i />
            <span>SAPPHIRE</span>
            <i />
            <span>CRYSTAL</span>
          </div>
        </aside>

        {/* CỘT PHẢI */}
        <main className="auth-main">
          <div className="auth-mobile-brand">
            PHÚ GIA ROYAL PARK
          </div>

          <div className="auth-form-wrap">
            <span className="auth-kicker">
              CHÀO MỪNG TRỞ LẠI
            </span>

            <h1>Đăng nhập</h1>

            <p className="auth-subtitle">
              Tiếp tục khám phá Phú Gia Royal
              Park với tài khoản của bạn.
            </p>

            {/* ĐĂNG KÝ THÀNH CÔNG */}
            {registered && (
              <div
                className="auth-alert success"
                role="status"
              >
                Đăng ký thành công! Hãy đăng nhập
                bằng tài khoản vừa tạo.
              </div>
            )}

            {/* LỖI ĐĂNG NHẬP */}
            {error && (
              <div
                className="auth-alert error"
                role="alert"
              >
                {error}
              </div>
            )}

            <form
              onSubmit={handleSubmit}
              className="auth-form"
            >
              <label htmlFor="login-email">
                Địa chỉ email
              </label>

              <input
                id="login-email"
                type="email"
                autoComplete="username"
                required
                maxLength={255}
                placeholder="name@example.com"
                value={email}
                onChange={(e) =>
                  setEmail(e.target.value)
                }
              />

              <div className="auth-label-row">
                <label htmlFor="login-password">
                  Mật khẩu
                </label>
              </div>

              <div className="auth-password">
                <input
                  id="login-password"
                  type={
                    showPassword
                      ? "text"
                      : "password"
                  }
                  required
                  autoComplete="current-password"
                  placeholder="Nhập mật khẩu"
                  value={password}
                  onChange={(e) =>
                    setPassword(e.target.value)
                  }
                />

                <button
                  type="button"
                  onClick={() =>
                    setShowPassword((value) => !value)
                  }
                  aria-label={
                    showPassword
                      ? "Ẩn mật khẩu"
                      : "Hiện mật khẩu"
                  }
                >
                  <EyeIcon visible={showPassword} />
                </button>
              </div>

              <button
                className="auth-submit"
                type="submit"
                disabled={loading}
              >
                {loading
                  ? "Đang đăng nhập..."
                  : "Đăng nhập"}

                <span aria-hidden="true">
                  →
                </span>
              </button>
            </form>

            <p className="auth-switch">
              Chưa có tài khoản?{" "}
              <Link to="/register">
                Đăng ký ngay
              </Link>
            </p>

            <div className="auth-form-bottom">
              Tài khoản nhân viên và quản trị
              viên được cấp bởi ADMIN.
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
