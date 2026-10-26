import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import { api, TOKEN_KEY } from "../api/client";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [checking, setChecking] = useState(true);

  // ======================================
  // ĐĂNG XUẤT
  // ======================================

  const logout = useCallback(() => {
    sessionStorage.removeItem(TOKEN_KEY);
    setUser(null);
  }, []);

  // ======================================
  // KIỂM TRA JWT KHI TẢI TRANG
  // ======================================

  useEffect(() => {
    let active = true;

    const savedToken = sessionStorage.getItem(TOKEN_KEY);

    if (!savedToken) {
      setChecking(false);
      return;
    }

    api("/api/auth/me", {
      token: savedToken,
    })
      .then((account) => {
        if (active) {
          setUser(account);
        }
      })
      .catch(() => {
        if (active) {
          logout();
        }
      })
      .finally(() => {
        if (active) {
          setChecking(false);
        }
      });

    return () => {
      active = false;
    };
  }, [logout]);

  // ======================================
  // ĐĂNG NHẬP CHUNG CHO 3 ROLE
  // ======================================

  async function login(email, password) {
    const result = await api("/api/auth/login", {
      method: "POST",
      token: null,
      body: JSON.stringify({
        email: email.trim(),
        password,
      }),
    });

    if (!result.accessToken) {
      throw new Error(
        "Backend không trả accessToken."
      );
    }

    // Xác minh lại JWT và role qua Backend.
    const account = await api("/api/auth/me", {
      token: result.accessToken,
    });

    if (!["USER", "AGENT", "ADMIN"].includes(account.role)) {
      throw new Error(
        "Vai trò tài khoản không hợp lệ."
      );
    }

    sessionStorage.setItem(
      TOKEN_KEY,
      result.accessToken
    );

    setUser(account);

    return account;
  }

  const value = useMemo(
    () => ({
      user,
      checking,
      login,
      logout,
    }),
    [user, checking, logout]
  );

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error(
      "useAuth phải được dùng bên trong AuthProvider."
    );
  }

  return context;
}