
package com.phugia.backend.controller;

import com.phugia.backend.entity.AppUser;
import com.phugia.backend.enums.AppRole;
import com.phugia.backend.repository.AppUserRepository;
import com.phugia.backend.security.JwtTokenService;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

import lombok.RequiredArgsConstructor;

import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.nio.charset.StandardCharsets;
import java.util.Locale;

@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
public class AuthController {

    private final AppUserRepository appUserRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtTokenService jwtTokenService;

    // =========================================
    // REQUEST / RESPONSE
    // =========================================

    public record LoginRequest(
            @NotBlank @Email String email,
            @NotBlank String password
    ) {}

    // Người đăng ký không được tự chọn role.
    public record RegisterRequest(
            @NotBlank @Size(max = 150) String displayName,
            @NotBlank @Email @Size(max = 255) String email,
            @NotBlank String password
    ) {}

    public record UserInfo(
            Long id,
            String email,
            String displayName,
            AppRole role
    ) {}

    public record LoginResponse(
            String accessToken,
            String tokenType,
            long expiresInSeconds,
            UserInfo user
    ) {}

    // =========================================
    // ĐĂNG KÝ TÀI KHOẢN USER
    // =========================================

    @PostMapping("/register")
    @ResponseStatus(HttpStatus.CREATED)
    @Transactional
    public UserInfo register(
            @Valid @RequestBody RegisterRequest request
    ) {
        String email = request.email()
                .trim()
                .toLowerCase(Locale.ROOT);

        String displayName = request.displayName().trim();
        String password = request.password();

        if (displayName.isBlank()) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Vui long nhap ho ten"
            );
        }

        // BCrypt giới hạn 72 byte UTF-8.
        int passwordBytes = password
                .getBytes(StandardCharsets.UTF_8)
                .length;

        if (
                password.length() < 12 ||
                passwordBytes > 72
        ) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Mat khau can it nhat 12 ky tu " +
                    "va khong qua 72 byte UTF-8"
            );
        }

        if (
                appUserRepository.existsByEmailIgnoreCase(
                        email
                )
        ) {
            throw new ResponseStatusException(
                    HttpStatus.CONFLICT,
                    "Email da duoc su dung"
            );
        }

        AppUser newUser = new AppUser();

        newUser.setEmail(email);
        newUser.setDisplayName(displayName);

        // Không lưu mật khẩu gốc vào MySQL.
        newUser.setPasswordHash(
                passwordEncoder.encode(password)
        );

        // QUAN TRỌNG:
        // Đăng ký công khai luôn là USER.
        // Không đọc role từ Frontend.
        newUser.setRole(AppRole.USER);
        newUser.setEnabled(true);

        try {
            AppUser saved = appUserRepository
                    .saveAndFlush(newUser);

            return toUserInfo(saved);
        } catch (DataIntegrityViolationException ex) {
            // Chặn trường hợp hai yêu cầu
            // đăng ký trùng email cùng lúc.
            throw new ResponseStatusException(
                    HttpStatus.CONFLICT,
                    "Khong the dang ky. " +
                    "Email co the da duoc su dung"
            );
        }
    }

    // =========================================
    // ĐĂNG NHẬP
    // =========================================

    @PostMapping("/login")
    public LoginResponse login(
            @Valid @RequestBody LoginRequest request
    ) {
        String email = request.email()
                .trim()
                .toLowerCase(Locale.ROOT);

        AppUser user = appUserRepository
                .findByEmailIgnoreCase(email)
                .orElseThrow(this::invalidCredentials);

        if (
                !Boolean.TRUE.equals(user.getEnabled()) ||
                !passwordEncoder.matches(
                        request.password(),
                        user.getPasswordHash()
                )
        ) {
            throw invalidCredentials();
        }

        String token = jwtTokenService.generateToken(user);

        return new LoginResponse(
                token,
                "Bearer",
                jwtTokenService.getExpirySeconds(),
                toUserInfo(user)
        );
    }

    // =========================================
    // TÀI KHOẢN HIỆN TẠI
    // =========================================

    @GetMapping("/me")
    public UserInfo me(
            @AuthenticationPrincipal Jwt jwt
    ) {
        if (jwt == null) {
            throw new ResponseStatusException(
                    HttpStatus.UNAUTHORIZED,
                    "Chua dang nhap"
            );
        }

        final Long userId;

        try {
            userId = Long.valueOf(jwt.getSubject());
        } catch (NumberFormatException ex) {
            throw new ResponseStatusException(
                    HttpStatus.UNAUTHORIZED,
                    "JWT khong hop le"
            );
        }

        AppUser user = appUserRepository
                .findById(userId)
                .orElseThrow(() ->
                        new ResponseStatusException(
                                HttpStatus.UNAUTHORIZED,
                                "Tai khoan khong ton tai"
                        )
                );

        if (!Boolean.TRUE.equals(user.getEnabled())) {
            throw new ResponseStatusException(
                    HttpStatus.UNAUTHORIZED,
                    "Tai khoan da bi khoa"
            );
        }

        return toUserInfo(user);
    }

    // =========================================
    // HELPER
    // =========================================

    private UserInfo toUserInfo(AppUser user) {
        return new UserInfo(
                user.getId(),
                user.getEmail(),
                user.getDisplayName(),
                user.getRole()
        );
    }

    private ResponseStatusException invalidCredentials() {
        return new ResponseStatusException(
                HttpStatus.UNAUTHORIZED,
                "Email hoac mat khau khong chinh xac"
        );
    }
}
