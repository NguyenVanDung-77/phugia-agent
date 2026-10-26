export const API_BASE =
  import.meta.env.VITE_API_URL || "http://localhost:8080";

export const TOKEN_KEY = "phugia_agent_access_token";

export function roleHome(role) {
  switch (role) {
    case "USER":
      return "/user";

    case "AGENT":
      return "/agent";

    case "ADMIN":
      return "/admin";

    default:
      return "/login";
  }
}

export async function api(path, options = {}) {
  const {
    token = sessionStorage.getItem(TOKEN_KEY),
    headers = {},
    ...rest
  } = options;

  const response = await fetch(`${API_BASE}${path}`, {
    ...rest,
    headers: {
      ...(rest.body
        ? { "Content-Type": "application/json" }
        : {}),

      ...(token
        ? { Authorization: `Bearer ${token}` }
        : {}),

      ...headers,
    },
  });

  if (!response.ok) {
    let reason = "";

    try {
      const body = await response.json();

      reason =
        body.detail ||
        body.message ||
        body.error ||
        "";
    } catch {
      // Không phải phản hồi JSON.
    }

    if (response.status === 401) {
      throw new Error(
        "Phiên đăng nhập không hợp lệ hoặc đã hết hạn."
      );
    }

    if (response.status === 403) {
      throw new Error(
        "Tài khoản không có quyền thực hiện thao tác này."
      );
    }

    throw new Error(
      reason || `Yêu cầu thất bại (${response.status}).`
    );
  }

  if (response.status === 204) {
    return null;
  }

  return response.json();
}