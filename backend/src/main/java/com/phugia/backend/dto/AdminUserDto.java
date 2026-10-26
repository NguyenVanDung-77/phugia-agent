
package com.phugia.backend.dto;

import com.phugia.backend.enums.AppRole;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.time.LocalDateTime;

public final class AdminUserDto {

    private AdminUserDto() {
    }

    // =========================================
    // TẠO TÀI KHOẢN
    // =========================================

    public record CreateRequest(

            @NotBlank
            @Email
            @Size(max = 255)
            String email,

            @NotBlank
            String password,

            @Size(max = 150)
            String displayName,

            @NotNull
            AppRole role

    ) {
    }

    // =========================================
    // ĐỔI VAI TRÒ
    // =========================================

    public record RoleRequest(

            @NotNull
            AppRole role

    ) {
    }

    // =========================================
    // KHÓA / MỞ TÀI KHOẢN
    // =========================================

    public record StatusRequest(

            @NotNull
            Boolean enabled

    ) {
    }

    // =========================================
    // RESPONSE - KHÔNG TRẢ PASSWORD HASH
    // =========================================

    public record UserResponse(

            Long id,

            String email,

            String displayName,

            AppRole role,

            Boolean enabled,

            LocalDateTime createdAt

    ) {
    }
}
