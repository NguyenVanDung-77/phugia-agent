
import { useState } from "react";

import {
  Link,
  Navigate,
  useNavigate,
} from "react-router";

import {
  api,
  roleHome,
} from "../api/client";

import { useAuth } from "../auth/AuthContext";

import "../styles/auth-premium.css";

const EMPTY = {
  displayName: "",
  email: "",
  password: "",
  confirm: "",
};

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
// TRANG ĐĂNG KÝ TÀI KHOẢN USER
// ========================================

export default function RegisterPage() {
  const { user, checking } = useAuth();

  const navigate = useNavigate();

  const [form, setForm] = useState({
    ...EMPTY,
  });

  const [showPassword, setShowPassword] =
    useState(false);

  const [showConfirm, setShowConfirm] =
    useState(false);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  function update(field, value) {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  }

  // ======================================
  // GỬI YÊU CẦU ĐĂNG KÝ
  // ======================================

  async function handleSubmit(event) {
    event.preventDefault();

    if (busy) return;

    const email = form.email
      .trim()
      .toLowerCase();

    const displayName =
      form.displayName.trim();

    const bytes = new TextEncoder()
      .encode(form.password)
      .length;

    if (!displayName || !email) {
      setError(
        "Vui lòng nhập họ tên và địa chỉ email."
      );
      return;
    }

    if (
      form.password.length < 12 ||
      bytes > 72
    ) {
      setError(
        "Mật khẩu cần ít nhất 12 ký tự và không vượt quá 72 byte UTF-8."
      );
      return;
    }

    if (form.password !== form.confirm) {
      setError(
        "Hai lần nhập mật khẩu chưa khớp."
      );
      return;
    }

    setBusy(true);
    setError("");

    try {
      await api("/api/auth/register", {
        method: "POST",

        // Đăng ký không cần JWT.
        token: null,

        body: JSON.stringify({
          displayName,
          email,
          password: form.password,
        }),
      });

      setForm({ ...EMPTY });

      // Đăng ký thành công.
      // Người dùng sẽ tự đăng nhập.
      navigate("/login", {
        replace: true,

        state: {
          registered: true,
          email,
        },
      });
    } catch (err) {
      setError(
        err.message ||
          "Không thể đăng ký. Vui lòng thử lại."
      );
    } finally {
      setBusy(false);
    }
  }

  // ======================================
  // KIỂM TRA PHIÊN ĐĂNG NHẬP
  // ======================================

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

  // ======================================
  // GIAO DIỆN ĐĂNG KÝ
  // ======================================

  return (
    <div className="auth-screen">
      <div className="auth-layout">
        {/* CỘT TRÁI */}
        <aside className="auth-story auth-story-register">
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
              BẮT ĐẦU HÀNH TRÌNH
            </div>

            <h2>
              Mỗi lựa chọn,{" "}
              <em>một không gian mới.</em>
            </h2>

            <p>
              Tạo tài khoản miễn phí để khám phá
              mặt bằng dự án, tìm căn theo phân
              khu và xem thông tin chi tiết.
            </p>

            <div className="auth-feature-stack">
              <div>
                <span>01</span>
                <strong>
                  Khám phá 3 phân khu
                </strong>
                <small>
                  Ruby · Sapphire · Crystal
                </small>
              </div>

              <div>
                <span>02</span>
                <strong>
                  Tìm căn trên bản đồ
                </strong>
                <small>
                  Thao tác trực tiếp, dễ quan sát
                </small>
              </div>

              <div>
                <span>03</span>
                <strong>
                  Xem thông tin từng căn
                </strong>
                <small>
                  Hình ảnh, diện tích và bảng giá
                </small>
              </div>
            </div>
          </div>

          <div className="auth-story-foot">
            <span>PHÚ GIA ROYAL PARK</span>
            <i />
            <span>QUY NHƠN</span>
          </div>
        </aside>

        {/* CỘT PHẢI */}
        <main className="auth-main">
          <div className="auth-mobile-brand">
            PHÚ GIA ROYAL PARK
          </div>

          <div className="auth-form-wrap">
            <span className="auth-kicker">
              TÀI KHOẢN KHÁCH HÀNG
            </span>

            <h1>Tạo tài khoản</h1>

            <p className="auth-subtitle">
              Đăng ký tài khoản USER để khám phá
              dự án và xem chi tiết các căn.
            </p>

            {/* THÔNG BÁO LỖI */}
            {error && (
              <div
                className="auth-alert error"
                role="alert"
              >
                {error}
              </div>
            )}

            <form
              className="auth-form"
              onSubmit={handleSubmit}
            >
              {/* HỌ TÊN */}
              <label htmlFor="register-name">
                Họ và tên
              </label>

              <input
                id="register-name"
                type="text"
                required
                maxLength={150}
                autoComplete="name"
                placeholder="Họ tên của bạn"
                value={form.displayName}
                onChange={(event) =>
                  update(
                    "displayName",
                    event.target.value
                  )
                }
              />

              {/* EMAIL */}
              <label htmlFor="register-email">
                Địa chỉ email
              </label>

              <input
                id="register-email"
                type="email"
                required
                maxLength={255}
                autoComplete="email"
                placeholder="name@example.com"
                value={form.email}
                onChange={(event) =>
                  update(
                    "email",
                    event.target.value
                  )
                }
              />

              {/* MẬT KHẨU */}
              <label htmlFor="register-password">
                Mật khẩu
              </label>

              <div className="auth-password">
                <input
                  id="register-password"
                  type={
                    showPassword
                      ? "text"
                      : "password"
                  }
                  required
                  minLength={12}
                  autoComplete="new-password"
                  placeholder="Tối thiểu 12 ký tự"
                  value={form.password}
                  onChange={(event) =>
                    update(
                      "password",
                      event.target.value
                    )
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

              {/* NHẬP LẠI MẬT KHẨU */}
              <label htmlFor="register-confirm">
                Nhập lại mật khẩu
              </label>

              <div className="auth-password">
                <input
                  id="register-confirm"
                  type={
                    showConfirm
                      ? "text"
                      : "password"
                  }
                  required
                  autoComplete="new-password"
                  placeholder="Xác nhận mật khẩu"
                  value={form.confirm}
                  onChange={(event) =>
                    update(
                      "confirm",
                      event.target.value
                    )
                  }
                />

                <button
                  type="button"
                  onClick={() =>
                    setShowConfirm((value) => !value)
                  }
                  aria-label={
                    showConfirm
                      ? "Ẩn mật khẩu xác nhận"
                      : "Hiện mật khẩu xác nhận"
                  }
                >
                  <EyeIcon visible={showConfirm} />
                </button>
              </div>

              <p className="auth-password-note">
                Mật khẩu ít nhất 12 ký tự và tối đa
                72 byte UTF-8.
              </p>

              {/* NÚT ĐĂNG KÝ */}
              <button
                className="auth-submit"
                type="submit"
                disabled={busy}
              >
                {busy
                  ? "Đang tạo tài khoản..."
                  : "Đăng ký tài khoản"}

                <span aria-hidden="true">
                  →
                </span>
              </button>
            </form>

            <p className="auth-switch">
              Đã có tài khoản?{" "}
              <Link to="/login">
                Đăng nhập
              </Link>
            </p>

            <div className="auth-form-bottom">
              Đăng ký công khai chỉ cấp quyền USER.
              Quyền AGENT và ADMIN do quản trị viên
              cấp.
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
