package com.phugia.backend.entity;

import jakarta.persistence.*;

import lombok.Getter;
import lombok.Setter;
import lombok.NoArgsConstructor;

import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.LocalDateTime;

@Entity
@Table(
    name = "site_zones",
    uniqueConstraints = {
        @UniqueConstraint(
            name = "uk_site_zone_plan_code",
            columnNames = {"master_plan_id", "code"}
        )
    }
)
@Getter
@Setter
@NoArgsConstructor
public class SiteZone {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    // Mặt bằng tổng chứa phân khu
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(
        name = "master_plan_id",
        nullable = false
    )
    private MasterPlan masterPlan;

    // Ví dụ: RUBY, SAPPHIRE, CRYSTAL
    @Column(nullable = false, length = 50)
    private String code;

    // Tên phân khu hiển thị
    @Column(nullable = false, length = 150)
    private String name;

    // Mô tả phân khu
    @Column(columnDefinition = "TEXT")
    private String description;

    // Vùng tọa độ phân khu trên ảnh gốc
    @Column(name = "polygon_json", columnDefinition = "LONGTEXT")
    private String polygonJson;

    // Thứ tự hiển thị
    @Column(name = "sort_order")
    private Integer sortOrder = 0;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;
}