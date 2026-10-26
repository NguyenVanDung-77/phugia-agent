
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import { api } from "../../api/client";
import { useAuth } from "../../auth/AuthContext";
import PageLayout from "../../components/PageLayout";

const ROLES = ["USER", "AGENT", "ADMIN"];

const EMPTY_FORM = {
  email: "",
  displayName: "",
  password: "",
  role: "AGENT",
};

const PAGE_SIZE = 10;

function Icon({ name, size = 18 }) {
  const paths = {
    plus: <path d="M12 5v14M5 12h14" />,
    search: (
      <>
        <circle cx="11" cy="11" r="7" />
        <path d="m16.2 16.2 4 4" />
      </>
    ),
    refresh: (
      <>
        <path d="M20 7v5h-5M4 17v-5h5" />
        <path d="M5 9a8 8 0 0 1 13-2l2 5M4 12l2 5a8 8 0 0 0 13-2" />
      </>
    ),
    close: <path d="M5 5l14 14M19 5 5 19" />,
    users: (
      <>
        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
      </>
    ),
    shield: (
      <>
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" />
        <path d="m9 12 2 2 4-4" />
      </>
    ),
    lock: (
      <>
        <rect x="4" y="10" width="16" height="11" rx="2" />
        <path d="M8 10V7a4 4 0 0 1 8 0v3" />
      </>
    ),
    unlock: (
      <>
        <rect x="4" y="10" width="16" height="11" rx="2" />
        <path d="M8 10V7a4 4 0 0 1 7-2.7" />
      </>
    ),
    left: <path d="m15 18-6-6 6-6" />,
    right: <path d="m9 18 6-6-6-6" />,
    eye: (
      <>
        <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z" />
        <circle cx="12" cy="12" r="3" />
      </>
    ),
    eyeOff: (
      <>
        <path d="M3 3l18 18M9.9 5.2A10.6 10.6 0 0 1 12 5c6.4 0 10 7 10 7a14.5 14.5 0 0 1-3.1 3.8M6.4 6.4C3.7 8.4 2 12 2 12s3.6 7 10 7a9.9 9.9 0 0 0 4.1-.9" />
        <path d="M10.6 10.6a2 2 0 0 0 2.8 2.8" />
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
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths[name] || paths.users}
    </svg>
  );
}

function roleName(role) {
  return {
    USER: "Khách hàng",
    AGENT: "Nhân viên",
    ADMIN: "Quản trị viên",
  }[role] || role;
}

export default function AdminPage() {
  const { user } = useAuth();

  // DANH SÁCH TÀI KHOẢN
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy] = useState(false);

  // THÔNG BÁO
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  // TẠO TÀI KHOẢN
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [showPassword, setShowPassword] = useState(false);

  // TÌM KIẾM VÀ LỌC
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [page, setPage] = useState(1);

  // ======================================
  // TẢI DANH SÁCH TÀI KHOẢN
  // ======================================

  const loadUsers = useCallback(async () => {
    const data = await api("/api/admin/users");

    if (!Array.isArray(data)) {
      throw new Error(
        "Dữ liệu tài khoản trả về không hợp lệ."
      );
    }

    setUsers(data);
  }, []);

  useEffect(() => {
    let active = true;

    api("/api/admin/users")
      .then((data) => {
        if (!active) return;

        if (!Array.isArray(data)) {
          throw new Error(
            "Dữ liệu tài khoản trả về không hợp lệ."
          );
        }

        setUsers(data);
      })
      .catch((err) => {
        if (active) {
          setError(
            err.message ||
              "Không tải được danh sách tài khoản."
          );
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  // ĐÓNG CỬA SỔ BẰNG PHÍM ESC
  useEffect(() => {
    if (!createOpen) return undefined;

    function onEscape(event) {
      if (event.key === "Escape" && !busy) {
        setCreateOpen(false);
      }
    }

    window.addEventListener("keydown", onEscape);

    return () =>
      window.removeEventListener("keydown", onEscape);
  }, [createOpen, busy]);

  // ======================================
  // THỐNG KÊ TÀI KHOẢN
  // ======================================

  const stats = useMemo(
    () => ({
      all: users.length,

      agent: users.filter(
        (item) => item.role === "AGENT"
      ).length,

      user: users.filter(
        (item) => item.role === "USER"
      ).length,

      locked: users.filter(
        (item) => !item.enabled
      ).length,
    }),
    [users]
  );

  // ======================================
  // TÌM KIẾM / LỌC
  // ======================================

  const filtered = useMemo(() => {
    const keyword = search
      .trim()
      .toLocaleLowerCase("vi-VN");

    return users.filter((item) => {
      const text = `
        ${item.id}
        ${item.displayName || ""}
        ${item.email || ""}
      `.toLocaleLowerCase("vi-VN");

      const matchesSearch =
        !keyword || text.includes(keyword);

      const matchesRole =
        roleFilter === "ALL" ||
        item.role === roleFilter;

      const matchesStatus =
        statusFilter === "ALL" ||
        (statusFilter === "ACTIVE"
          ? Boolean(item.enabled)
          : !item.enabled);

      return (
        matchesSearch &&
        matchesRole &&
        matchesStatus
      );
    });
  }, [
    users,
    search,
    roleFilter,
    statusFilter,
  ]);

  // ======================================
  // PHÂN TRANG
  // ======================================

  const pageCount = Math.max(
    1,
    Math.ceil(filtered.length / PAGE_SIZE)
  );

  const currentPage = Math.min(page, pageCount);
  const start = (currentPage - 1) * PAGE_SIZE;

  const visible = filtered.slice(
    start,
    start + PAGE_SIZE
  );

  // ======================================
  // LÀM MỚI
  // ======================================

  async function refresh() {
    if (busy || refreshing) return;

    setRefreshing(true);
    setError("");

    try {
      await loadUsers();
    } catch (err) {
      setError(err.message || "Làm mới thất bại.");
    } finally {
      setRefreshing(false);
    }
  }

  // ======================================
  // ĐÓNG / MỞ TẠO TÀI KHOẢN
  // ======================================

  function openCreate() {
    setForm({ ...EMPTY_FORM });
    setShowPassword(false);
    setError("");
    setCreateOpen(true);
  }

  function closeCreate() {
    if (busy) return;

    setCreateOpen(false);
    setForm({ ...EMPTY_FORM });
    setShowPassword(false);
    setError("");
  }

  // ======================================
  // TẠO TÀI KHOẢN MỚI
  // ======================================

  async function createUser(event) {
    event.preventDefault();

    if (busy) return;

    const payload = {
      email: form.email.trim().toLowerCase(),
      displayName: form.displayName.trim(),
      password: form.password,
      role: form.role,
    };

    if (
      !payload.email ||
      payload.password.length < 12 ||
      !ROLES.includes(payload.role)
    ) {
      setError(
        "Vui lòng nhập email, mật khẩu từ 12 ký tự và vai trò hợp lệ."
      );
      return;
    }

    setBusy(true);
    setError("");
    setNotice("");

    try {
      await api("/api/admin/users", {
        method: "POST",
        body: JSON.stringify(payload),
      });

      setForm({ ...EMPTY_FORM });
      setCreateOpen(false);

      await loadUsers();

      setNotice("Đã tạo tài khoản thành công.");
      setPage(1);
    } catch (err) {
      setError(
        err.message || "Tạo tài khoản thất bại."
      );
    } finally {
      setBusy(false);
    }
  }

  // ======================================
  // ĐỔI VAI TRÒ / KHÓA / MỞ KHÓA
  // ======================================

  async function updateUser(item, action, payload) {
    if (busy || refreshing) return;

    // KHÔNG TỰ THAY ĐỔI QUYỀN CỦA MÌNH
    if (String(item.id) === String(user?.id)) {
      return;
    }

    const message =
      action === "role"
        ? `Đổi quyền tài khoản ${item.email} từ ${item.role} sang ${payload.role}?`
        : `${
            payload.enabled ? "Mở khóa" : "Khóa"
          } tài khoản ${item.email}?`;

    if (!window.confirm(message)) {
      return;
    }

    setBusy(true);
    setError("");
    setNotice("");

    try {
      await api(
        `/api/admin/users/${item.id}/${action}`,
        {
          method: "PATCH",
          body: JSON.stringify(payload),
        }
      );

      await loadUsers();

      setNotice(
        action === "role"
          ? "Đã cập nhật phân quyền thành công."
          : "Đã cập nhật trạng thái tài khoản."
      );
    } catch (err) {
      setError(
        err.message || "Cập nhật tài khoản thất bại."
      );
    } finally {
      setBusy(false);
    }
  }

  // ======================================
  // GIAO DIỆN ADMIN
  // ======================================

  return (
    <PageLayout
      title="Quản trị hệ thống"
      subtitle="Quản lý tài khoản và phân quyền truy cập hệ thống."
    >
      <div className="adm-dashboard">
        {/* TIÊU ĐỀ VÀ NÚT THÊM */}
        <div className="adm-dashboard-top">
          <div>
            <span className="adm-overline">
              TỔNG QUAN TÀI KHOẢN
            </span>

            <h2>Quản lý người dùng</h2>

            <p>
              Theo dõi nhân viên, khách hàng và
              quyền truy cập tại một nơi.
            </p>
          </div>

          <button
            type="button"
            className="adm-button adm-button-primary"
            onClick={openCreate}
            disabled={busy}
          >
            <Icon name="plus" size={18} />
            Tạo tài khoản
          </button>
        </div>

        {/* CÁC THẺ THỐNG KÊ */}
        <div className="adm-stats">
          <div className="adm-stat-card">
            <span className="adm-stat-icon teal">
              <Icon name="users" />
            </span>

            <div>
              <strong>{stats.all}</strong>
              <span>Tổng tài khoản</span>
            </div>
          </div>

          <div className="adm-stat-card">
            <span className="adm-stat-icon blue">
              <Icon name="shield" />
            </span>

            <div>
              <strong>{stats.agent}</strong>
              <span>Nhân viên Agent</span>
            </div>
          </div>

          <div className="adm-stat-card">
            <span className="adm-stat-icon violet">
              <Icon name="users" />
            </span>

            <div>
              <strong>{stats.user}</strong>
              <span>Khách hàng User</span>
            </div>
          </div>

          <div className="adm-stat-card">
            <span className="adm-stat-icon orange">
              <Icon name="lock" />
            </span>

            <div>
              <strong>{stats.locked}</strong>
              <span>Tài khoản đã khóa</span>
            </div>
          </div>
        </div>

        {/* THÔNG BÁO LỖI / THÀNH CÔNG */}
        {error && (
          <div
            className="adm-alert adm-alert-error"
            role="alert"
          >
            <span>{error}</span>

            <button
              type="button"
              onClick={() => setError("")}
              aria-label="Đóng thông báo lỗi"
            >
              <Icon name="close" size={17} />
            </button>
          </div>
        )}

        {notice && (
          <div
            className="adm-alert adm-alert-success"
            role="status"
          >
            <span>{notice}</span>

            <button
              type="button"
              onClick={() => setNotice("")}
              aria-label="Đóng thông báo"
            >
              <Icon name="close" size={17} />
            </button>
          </div>
        )}

        {/* BẢNG QUẢN LÝ TÀI KHOẢN */}
        <section
          className="adm-table-card"
          aria-label="Danh sách tài khoản"
        >
          <div className="adm-table-top">
            <div>
              <h3>
                Danh sách tài khoản
                <span>{filtered.length}</span>
              </h3>

              <p>
                Thay đổi vai trò hoặc trạng thái
                ngay trong bảng.
              </p>
            </div>

            <button
              type="button"
              className="adm-button adm-button-light"
              disabled={busy || refreshing || loading}
              onClick={refresh}
            >
              <Icon name="refresh" size={16} />

              {refreshing
                ? "Đang tải..."
                : "Làm mới"}
            </button>
          </div>

          {/* TÌM KIẾM VÀ LỌC */}
          <div className="adm-filters">
            <label className="adm-search">
              <Icon name="search" size={19} />

              <input
                type="search"
                placeholder="Tìm theo tên, email hoặc ID..."
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value);
                  setPage(1);
                }}
                aria-label="Tìm tài khoản"
              />
            </label>

            <select
              aria-label="Lọc vai trò"
              value={roleFilter}
              onChange={(event) => {
                setRoleFilter(event.target.value);
                setPage(1);
              }}
            >
              <option value="ALL">
                Tất cả vai trò
              </option>

              {ROLES.map((role) => (
                <option key={role} value={role}>
                  {roleName(role)}
                </option>
              ))}
            </select>

            <select
              aria-label="Lọc trạng thái"
              value={statusFilter}
              onChange={(event) => {
                setStatusFilter(event.target.value);
                setPage(1);
              }}
            >
              <option value="ALL">
                Mọi trạng thái
              </option>

              <option value="ACTIVE">
                Hoạt động
              </option>

              <option value="LOCKED">
                Đã khóa
              </option>
            </select>
          </div>

          {/* BẢNG DỮ LIỆU */}
          <div className="adm-table-scroll">
            <table className="adm-table">
              <thead>
                <tr>
                  <th>TÀI KHOẢN</th>
                  <th>VAI TRÒ</th>
                  <th>TRẠNG THÁI</th>
                  <th>ID</th>
                  <th>THAO TÁC</th>
                </tr>
              </thead>

              <tbody>
                {loading ? (
                  <tr>
                    <td
                      colSpan={5}
                      className="adm-empty"
                    >
                      Đang tải danh sách tài khoản...
                    </td>
                  </tr>
                ) : visible.length === 0 ? (
                  <tr>
                    <td
                      colSpan={5}
                      className="adm-empty"
                    >
                      Không có tài khoản nào phù hợp
                      với bộ lọc.
                    </td>
                  </tr>
                ) : (
                  visible.map((item) => {
                    const self =
                      String(item.id) ===
                      String(user?.id);

                    const itemName =
                      item.displayName ||
                      "Chưa đặt tên";

                    const initial = (
                      itemName === "Chưa đặt tên"
                        ? item.email || "U"
                        : itemName
                    )
                      .charAt(0)
                      .toUpperCase();

                    return (
                      <tr key={item.id}>
                        {/* TÀI KHOẢN */}
                        <td>
                          <div className="adm-table-person">
                            <span className="adm-person-avatar">
                              {initial}
                            </span>

                            <span className="adm-person-text">
                              <strong>
                                {itemName}

                                {self && (
                                  <span className="adm-self">
                                    Bạn
                                  </span>
                                )}
                              </strong>

                              <small>
                                {item.email}
                              </small>
                            </span>
                          </div>
                        </td>

                        {/* VAI TRÒ */}
                        <td>
                          <select
                            className="adm-role-select"
                            value={item.role}
                            disabled={
                              busy ||
                              refreshing ||
                              self
                            }
                            aria-label={`Vai trò của ${item.email}`}
                            title={
                              self
                                ? "Không thể tự thay đổi quyền"
                                : "Thay đổi vai trò"
                            }
                            onChange={(event) =>
                              updateUser(
                                item,
                                "role",
                                {
                                  role: event.target.value,
                                }
                              )
                            }
                          >
                            {ROLES.map((role) => (
                              <option
                                key={role}
                                value={role}
                              >
                                {roleName(role)}
                              </option>
                            ))}
                          </select>
                        </td>

                        {/* TRẠNG THÁI */}
                        <td>
                          <span
                            className={`adm-status-pill${
                              item.enabled
                                ? " enabled"
                                : " disabled"
                            }`}
                          >
                            <i />

                            {item.enabled
                              ? "Hoạt động"
                              : "Đã khóa"}
                          </span>
                        </td>

                        {/* ID */}
                        <td>
                          <span className="adm-id">
                            #{item.id}
                          </span>
                        </td>

                        {/* KHÓA / MỞ */}
                        <td>
                          <button
                            type="button"
                            className={`adm-action-button${
                              item.enabled
                                ? " danger"
                                : " unlock"
                            }`}
                            disabled={
                              busy ||
                              refreshing ||
                              self
                            }
                            title={
                              self
                                ? "Không thể tự khóa tài khoản"
                                : undefined
                            }
                            onClick={() =>
                              updateUser(
                                item,
                                "status",
                                {
                                  enabled: !item.enabled,
                                }
                              )
                            }
                          >
                            <Icon
                              name={
                                item.enabled
                                  ? "lock"
                                  : "unlock"
                              }
                              size={15}
                            />

                            {item.enabled
                              ? "Khóa"
                              : "Mở khóa"}
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* PHÂN TRANG */}
          <div className="adm-table-footer">
            <span>
              {filtered.length
                ? `Hiển thị ${start + 1}–${
                    start + visible.length
                  } / ${filtered.length} tài khoản`
                : "Không có kết quả"}
            </span>

            <div className="adm-pager">
              <button
                type="button"
                aria-label="Trang trước"
                disabled={currentPage <= 1}
                onClick={() =>
                  setPage((p) =>
                    Math.max(1, p - 1)
                  )
                }
              >
                <Icon name="left" size={17} />
              </button>

              <span>
                Trang {currentPage} / {pageCount}
              </span>

              <button
                type="button"
                aria-label="Trang sau"
                disabled={
                  currentPage >= pageCount
                }
                onClick={() =>
                  setPage((p) =>
                    Math.min(pageCount, p + 1)
                  )
                }
              >
                <Icon name="right" size={17} />
              </button>
            </div>
          </div>
        </section>

        <p className="adm-safety-note">
          <Icon name="shield" size={16} />

          Tài khoản Admin đang đăng nhập không thể
          tự thay đổi vai trò hoặc khóa chính mình.
          Mọi thay đổi được kiểm tra quyền tại Backend.
        </p>
      </div>

      {/* ====================================
          CỬA SỔ TẠO TÀI KHOẢN
      ==================================== */}

      {createOpen && (
        <div
          className="adm-modal-overlay"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              closeCreate();
            }
          }}
        >
          <section
            className="adm-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="adm-create-title"
          >
            <div className="adm-modal-header">
              <div>
                <span className="adm-overline">
                  QUẢN LÝ TÀI KHOẢN
                </span>

                <h2 id="adm-create-title">
                  Tạo tài khoản mới
                </h2>

                <p>
                  Nhập thông tin và cấp vai trò
                  truy cập phù hợp.
                </p>
              </div>

              <button
                type="button"
                className="adm-modal-close"
                onClick={closeCreate}
                disabled={busy}
                aria-label="Đóng"
              >
                <Icon name="close" size={20} />
              </button>
            </div>

            {/* HIỂN THỊ LỖI NGAY TRONG FORM */}
            {error && (
              <div
                className="adm-alert adm-alert-error adm-modal-error"
                role="alert"
              >
                {error}
              </div>
            )}

            <form
              className="adm-create-form"
              onSubmit={createUser}
            >
              {/* HỌ TÊN */}
              <label>
                <span>Họ tên hiển thị</span>

                <input
                  type="text"
                  maxLength={150}
                  value={form.displayName}
                  placeholder="Nhập họ tên"
                  onChange={(event) =>
                    setForm((old) => ({
                      ...old,
                      displayName: event.target.value,
                    }))
                  }
                />
              </label>

              {/* EMAIL */}
              <label>
                <span>
                  Email <b>*</b>
                </span>

                <input
                  type="email"
                  required
                  autoComplete="off"
                  value={form.email}
                  placeholder="name@phugia.vn"
                  onChange={(event) =>
                    setForm((old) => ({
                      ...old,
                      email: event.target.value,
                    }))
                  }
                />
              </label>

              {/* MẬT KHẨU */}
              <label>
                <span>
                  Mật khẩu <b>*</b>
                </span>

                <div className="adm-password-wrap">
                  <input
                    type={
                      showPassword
                        ? "text"
                        : "password"
                    }
                    required
                    minLength={12}
                    autoComplete="new-password"
                    value={form.password}
                    placeholder="Ít nhất 12 ký tự"
                    onChange={(event) =>
                      setForm((old) => ({
                        ...old,
                        password: event.target.value,
                      }))
                    }
                  />

                  <button
                    type="button"
                    aria-label={
                      showPassword
                        ? "Ẩn mật khẩu"
                        : "Hiện mật khẩu"
                    }
                    onClick={() =>
                      setShowPassword((value) => !value)
                    }
                  >
                    <Icon
                      name={
                        showPassword
                          ? "eyeOff"
                          : "eye"
                      }
                      size={18}
                    />
                  </button>
                </div>

                <small>
                  Tối thiểu 12 ký tự. Không chia sẻ
                  mật khẩu với người khác.
                </small>
              </label>

              {/* VAI TRÒ */}
              <label>
                <span>
                  Vai trò <b>*</b>
                </span>

                <select
                  required
                  value={form.role}
                  onChange={(event) =>
                    setForm((old) => ({
                      ...old,
                      role: event.target.value,
                    }))
                  }
                >
                  {ROLES.map((role) => (
                    <option
                      key={role}
                      value={role}
                    >
                      {roleName(role)} ({role})
                    </option>
                  ))}
                </select>
              </label>

              {/* NÚT THAO TÁC */}
              <div className="adm-modal-actions">
                <button
                  type="button"
                  className="adm-button adm-button-light"
                  disabled={busy}
                  onClick={closeCreate}
                >
                  Hủy
                </button>

                <button
                  type="submit"
                  className="adm-button adm-button-primary"
                  disabled={busy}
                >
                  <Icon name="plus" size={17} />

                  {busy
                    ? "Đang tạo..."
                    : "Tạo tài khoản"}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
    </PageLayout>
  );
}
