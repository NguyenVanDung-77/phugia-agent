
package com.phugia.backend.repository;

import com.phugia.backend.entity.AppUser;
import com.phugia.backend.enums.AppRole;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface AppUserRepository
        extends JpaRepository<AppUser, Long> {

    // Tìm tài khoản để đăng nhập
    Optional<AppUser> findByEmailIgnoreCase(String email);

    // Kiểm tra email đã được sử dụng
    boolean existsByEmailIgnoreCase(String email);

    // Kiểm tra vai trò đã tồn tại
    boolean existsByRole(AppRole role);

    // Đếm Admin còn hoạt động
    long countByRoleAndEnabledTrue(AppRole role);

}
