
package com.phugia.backend.service;

import com.phugia.backend.dto.AdminUserDto;

import com.phugia.backend.entity.AppUser;
import com.phugia.backend.enums.AppRole;
import com.phugia.backend.repository.AppUserRepository;

import lombok.RequiredArgsConstructor;

import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.data.domain.Sort;

import org.springframework.http.HttpStatus;

import org.springframework.security.crypto.password.PasswordEncoder;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.nio.charset.StandardCharsets;

import java.util.List;
import java.util.Locale;

@Service
@RequiredArgsConstructor
public class AdminUserService {

    private final AppUserRepository appUserRepository;

    private final PasswordEncoder passwordEncoder;

    // =========================================
    // 1. DANH SÁCH TÀI KHOẢN
    // =========================================

    @Transactional(readOnly = true)
    public List<AdminUserDto.UserResponse> getAllUsers() {

        return appUserRepository
                .findAll(Sort.by(
                        Sort.Direction.ASC,
                        "id"
                ))
                .stream()
                .map(this::toResponse)
                .toList();
    }

    // =========================================
    // 2. TẠO TÀI KHOẢN
    // =========================================

    @Transactional
    public AdminUserDto.UserResponse createUser(
            AdminUserDto.CreateRequest request
    ) {

        String email = request.email()
                .trim()
                .toLowerCase(Locale.ROOT);

        if (appUserRepository.existsByEmailIgnoreCase(email)) {
            throw new ResponseStatusException(
                    HttpStatus.CONFLICT,
                    "Email da ton tai trong he thong"
            );
        }

        // BCrypt giới hạn đầu vào ở 72 byte.
        // Không cắt hoặc trim mật khẩu của người dùng.
        String password = request.password();

        int passwordBytes = password
                .getBytes(StandardCharsets.UTF_8)
                .length;

        if (password.length() < 12 || passwordBytes > 72) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Mat khau can it nhat 12 ky tu "
                    + "va khong qua 72 byte UTF-8"
            );
        }

        AppUser user = new AppUser();

        user.setEmail(email);

        user.setDisplayName(
                normalizeDisplayName(request.displayName())
        );

        user.setPasswordHash(
                passwordEncoder.encode(password)
        );

        user.setRole(request.role());

        user.setEnabled(true);

        try {
            user = appUserRepository.saveAndFlush(user);
        } catch (DataIntegrityViolationException ex) {
            throw new ResponseStatusException(
                    HttpStatus.CONFLICT,
                    "Khong the tao tai khoan. "
                    + "Email co the da ton tai",
                    ex
            );
        }

        return toResponse(user);
    }

    // =========================================
    // 3. THAY ĐỔI VAI TRÒ
    // =========================================

    @Transactional
    public AdminUserDto.UserResponse changeRole(
            Long userId,
            AdminUserDto.RoleRequest request,
            String currentAdminEmail
    ) {

        AppUser user = findUser(userId);

        if (isCurrentAdmin(user, currentAdminEmail)) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Khong the tu thay doi vai tro cua minh"
            );
        }

        // Tránh hạ quyền Admin hoạt động cuối cùng.
        if (
                user.getRole() == AppRole.ADMIN
                && request.role() != AppRole.ADMIN
                && Boolean.TRUE.equals(user.getEnabled())
                && appUserRepository.countByRoleAndEnabledTrue(
                        AppRole.ADMIN
                ) <= 1
        ) {
            throw new ResponseStatusException(
                    HttpStatus.CONFLICT,
                    "Phai giu it nhat mot ADMIN dang hoat dong"
            );
        }

        user.setRole(request.role());

        return toResponse(
                appUserRepository.save(user)
        );
    }

    // =========================================
    // 4. KHÓA / MỞ TÀI KHOẢN
    // =========================================

    @Transactional
    public AdminUserDto.UserResponse changeStatus(
            Long userId,
            AdminUserDto.StatusRequest request,
            String currentAdminEmail
    ) {

        AppUser user = findUser(userId);

        boolean newEnabled = request.enabled();

        // Không cho Admin tự khóa tài khoản đang dùng.
        if (
                isCurrentAdmin(user, currentAdminEmail)
                && !newEnabled
        ) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Khong the tu khoa tai khoan cua minh"
            );
        }

        // Tránh vô tình khóa Admin hoạt động cuối cùng.
        if (
                user.getRole() == AppRole.ADMIN
                && Boolean.TRUE.equals(user.getEnabled())
                && !newEnabled
                && appUserRepository.countByRoleAndEnabledTrue(
                        AppRole.ADMIN
                ) <= 1
        ) {
            throw new ResponseStatusException(
                    HttpStatus.CONFLICT,
                    "Phai giu it nhat mot ADMIN dang hoat dong"
            );
        }

        user.setEnabled(newEnabled);

        return toResponse(
                appUserRepository.save(user)
        );
    }

    // =========================================
    // HELPERS
    // =========================================

    private AppUser findUser(Long userId) {

        return appUserRepository
                .findById(userId)
                .orElseThrow(() ->
                        new ResponseStatusException(
                                HttpStatus.NOT_FOUND,
                                "Khong tim thay tai khoan"
                        )
                );
    }

    private boolean isCurrentAdmin(
            AppUser user,
            String currentAdminEmail
    ) {

        return currentAdminEmail != null
                && user.getEmail()
                .equalsIgnoreCase(currentAdminEmail);
    }

    private String normalizeDisplayName(String value) {

        if (value == null || value.isBlank()) {
            return null;
        }

        return value.trim();
    }

    private AdminUserDto.UserResponse toResponse(
            AppUser user
    ) {

        return new AdminUserDto.UserResponse(
                user.getId(),
                user.getEmail(),
                user.getDisplayName(),
                user.getRole(),
                user.getEnabled(),
                user.getCreatedAt()
        );
    }
}
