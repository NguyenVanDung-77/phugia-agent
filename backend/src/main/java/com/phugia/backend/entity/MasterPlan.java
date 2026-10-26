package com.phugia.backend.entity;

import jakarta.persistence.*;

import lombok.Getter;
import lombok.Setter;
import lombok.NoArgsConstructor;

import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.LocalDateTime;

@Entity
@Table(name = "master_plans")
@Getter
@Setter
@NoArgsConstructor
public class MasterPlan {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    // Tên mặt bằng
    @Column(nullable = false, length = 255)
    private String name;

    // Đường dẫn ảnh mặt bằng GỐC
    @Column(name = "image_url", length = 1000)
    private String imageUrl;

    // Chiều rộng ảnh gốc
    @Column(name = "image_width")
    private Integer imageWidth;

    // Chiều cao ảnh gốc
    @Column(name = "image_height")
    private Integer imageHeight;

    // Mặt bằng có được sử dụng hay không
    @Column(nullable = false)
    private Boolean active = true;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;
}