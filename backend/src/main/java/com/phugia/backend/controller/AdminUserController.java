
package com.phugia.backend.controller;

import com.phugia.backend.dto.AdminUserDto;
import com.phugia.backend.service.AdminUserService;

import jakarta.validation.Valid;

import lombok.RequiredArgsConstructor;

import org.springframework.http.HttpStatus;

import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;

import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/admin/users")
@RequiredArgsConstructor
@PreAuthorize("hasRole('ADMIN')")
public class AdminUserController {

    private final AdminUserService adminUserService;

    // =========================================
    // GET /api/admin/users
    // =========================================

    @GetMapping
    public List<AdminUserDto.UserResponse> getAllUsers() {

        return adminUserService.getAllUsers();
    }

    // =========================================
    // POST /api/admin/users
    // =========================================

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public AdminUserDto.UserResponse createUser(
            @Valid @RequestBody AdminUserDto.CreateRequest request
    ) {

        return adminUserService.createUser(request);
    }

    // =========================================
    // PATCH /api/admin/users/{id}/role
    // =========================================

    @PatchMapping("/{userId}/role")
    public AdminUserDto.UserResponse changeRole(
            @PathVariable Long userId,
            @Valid @RequestBody AdminUserDto.RoleRequest request,
            Authentication authentication
    ) {

        return adminUserService.changeRole(
                userId,
                request,
                authentication.getName()
        );
    }

    // =========================================
    // PATCH /api/admin/users/{id}/status
    // =========================================

    @PatchMapping("/{userId}/status")
    public AdminUserDto.UserResponse changeStatus(
            @PathVariable Long userId,
            @Valid @RequestBody AdminUserDto.StatusRequest request,
            Authentication authentication
    ) {

        return adminUserService.changeStatus(
                userId,
                request,
                authentication.getName()
        );
    }
}
