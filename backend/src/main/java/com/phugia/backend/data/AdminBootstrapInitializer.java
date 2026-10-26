
package com.phugia.backend.data;

import com.phugia.backend.entity.AppUser;
import com.phugia.backend.enums.AppRole;
import com.phugia.backend.repository.AppUserRepository;

import lombok.RequiredArgsConstructor;

import org.springframework.beans.factory.annotation.Value;

import org.springframework.boot.CommandLineRunner;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import org.springframework.security.crypto.password.PasswordEncoder;

import java.util.Locale;

@Component
@RequiredArgsConstructor
public class AdminBootstrapInitializer implements CommandLineRunner {

    private final AppUserRepository appUserRepository;

    private final PasswordEncoder passwordEncoder;

    @Value("${app.bootstrap.admin-email:}")
    private String bootstrapEmail;

    @Value("${app.bootstrap.admin-password:}")
    private String bootstrapPassword;

    @Override
    @Transactional
    public void run(String... args) {

        // Không tạo trùng nếu đã có Admin.
        if (appUserRepository.existsByRole(AppRole.ADMIN)) {
            System.out.println(
                "Tai khoan ADMIN da ton tai."
            );
            return;
        }

        if (
            bootstrapEmail == null ||
            bootstrapEmail.isBlank() ||
            bootstrapPassword == null ||
            bootstrapPassword.isBlank()
        ) {
            throw new IllegalStateException(
                "Chua co ADMIN. Can cau hinh " +
                "ADMIN_BOOTSTRAP_EMAIL va " +
                "ADMIN_BOOTSTRAP_PASSWORD."
            );
        }

        String email = bootstrapEmail
                .trim()
                .toLowerCase(Locale.ROOT);

        if (!email.contains("@")) {
            throw new IllegalStateException(
                "Email ADMIN khong hop le."
            );
        }

        if (bootstrapPassword.length() < 12) {
            throw new IllegalStateException(
                "Mat khau ADMIN phai co it nhat 12 ky tu."
            );
        }

        if (appUserRepository.existsByEmailIgnoreCase(email)) {
            throw new IllegalStateException(
                "Email ADMIN da duoc su dung."
            );
        }

        AppUser admin = new AppUser();

        admin.setEmail(email);

        admin.setDisplayName("Quản trị hệ thống");

        admin.setPasswordHash(
            passwordEncoder.encode(bootstrapPassword)
        );

        admin.setRole(AppRole.ADMIN);
        admin.setEnabled(true);

        appUserRepository.save(admin);

        System.out.println(
            "Da khoi tao tai khoan ADMIN thanh cong."
        );
    }
}
