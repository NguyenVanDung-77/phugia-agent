package com.phugia.backend.entity;

import com.phugia.backend.enums.AppRole;

import jakarta.persistence.*;

import lombok.Getter;
import lombok.Setter;
import lombok.NoArgsConstructor;

import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.LocalDateTime;

@Entity
@Table(
    name = "app_users",
    uniqueConstraints = {
        @UniqueConstraint(
            name = "uk_app_user_email",
            columnNames = "email"
        )
    }
)
@Getter
@Setter
@NoArgsConstructor
public class AppUser {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    // Email dùng để đăng nhập
    @Column(nullable = false, length = 255)
    private String email;

    // Tên hiển thị
    @Column(name = "display_name", length = 150)
    private String displayName;

    // Mật khẩu đã mã hóa BCrypt
    @Column(name = "password_hash", nullable = false, length = 255)
    private String passwordHash;

    // Vai trò người dùng
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private AppRole role = AppRole.USER;

    // Tài khoản có được phép sử dụng không
    @Column(nullable = false)
    private Boolean enabled = true;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;
}