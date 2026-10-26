
package com.phugia.backend.entity;

import com.phugia.backend.enums.UnitSaleStatus;

import jakarta.persistence.*;

import lombok.Getter;
import lombok.Setter;
import lombok.NoArgsConstructor;

import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(
    name = "property_units",
    indexes = {
        @Index(
            name = "idx_property_unit_zone",
            columnList = "site_zone_id"
        ),
        @Index(
            name = "idx_property_unit_status",
            columnList = "sale_status"
        )
    }
)
@Getter
@Setter
@NoArgsConstructor
public class PropertyUnit {

    // =========================================
    // ID
    // =========================================

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    // =========================================
    // PHÂN KHU
    // =========================================

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(
        name = "site_zone_id",
        nullable = false
    )
    private SiteZone siteZone;

    // =========================================
    // THÔNG TIN CĂN
    // =========================================

    // Mã căn, Agent có thể để trống
    @Column(name = "unit_code", length = 100)
    private String unitCode;

    // Ảnh đại diện cũ.
    // GIỮ NGUYÊN để không mất dữ liệu cũ.
    @Column(name = "image_url", length = 1000)
    private String imageUrl;

    // =========================================
    // DANH SÁCH NHIỀU ẢNH CỦA MỘT CĂN
    // =========================================
    //
    // Hibernate tự tạo bảng property_unit_images.
    //
    // Một căn có thể có nhiều đường dẫn ảnh.
    // Ảnh trong imageUrl cũ vẫn được giữ lại.
    //
    // Bảng mới có:
    // unit_id
    // display_order
    // image_url

    @ElementCollection(fetch = FetchType.LAZY)
    @CollectionTable(
        name = "property_unit_images",
        joinColumns = @JoinColumn(name = "unit_id")
    )
    @OrderColumn(name = "display_order")
    @Column(
        name = "image_url",
        length = 1000,
        nullable = false
    )
    private List<String> imageUrls = new ArrayList<>();

    // =========================================
    // DIỆN TÍCH ĐẤT
    // =========================================

    @Column(
        name = "land_area",
        precision = 12,
        scale = 2
    )
    private BigDecimal landArea;

    // =========================================
    // HƯỚNG CĂN
    // =========================================

    @Column(name = "direction", length = 100)
    private String direction;

    // =========================================
    // DIỆN TÍCH SÀN XÂY DỰNG
    // =========================================

    @Column(
        name = "construction_floor_area",
        precision = 12,
        scale = 2
    )
    private BigDecimal constructionFloorArea;

    // =========================================
    // KẾT CẤU
    // =========================================

    @Column(
        name = "structure_description",
        columnDefinition = "TEXT"
    )
    private String structureDescription;

    // =========================================
    // GIÁ GỐC
    // =========================================

    @Column(
        name = "base_price",
        precision = 19,
        scale = 2
    )
    private BigDecimal basePrice;

    // =========================================
    // THANH TOÁN TIÊU CHUẨN
    // =========================================

    @Column(
        name = "standard_payment_price",
        precision = 19,
        scale = 2
    )
    private BigDecimal standardPaymentPrice;

    // =========================================
    // THANH TOÁN SỚM 70%
    // =========================================

    @Column(
        name = "early_70_price",
        precision = 19,
        scale = 2
    )
    private BigDecimal early70Price;

    // =========================================
    // THANH TOÁN SỚM 95%
    // =========================================

    @Column(
        name = "early_95_price",
        precision = 19,
        scale = 2
    )
    private BigDecimal early95Price;

    // =========================================
    // GIÁ BÁN THỰC TẾ
    // =========================================

    @Column(
        name = "actual_sold_price",
        precision = 19,
        scale = 2
    )
    private BigDecimal actualSoldPrice;

    // =========================================
    // TRẠNG THÁI CĂN
    // =========================================

    @Enumerated(EnumType.STRING)
    @Column(
        name = "sale_status",
        nullable = false,
        length = 30
    )
    private UnitSaleStatus saleStatus =
            UnitSaleStatus.NOT_OPEN;

    // =========================================
    // POLYGON – GIỮ NGUYÊN
    // =========================================

    @Column(
        name = "polygon_json",
        columnDefinition = "LONGTEXT"
    )
    private String polygonJson;

    // =========================================
    // THỜI GIAN
    // =========================================

    @CreationTimestamp
    @Column(
        name = "created_at",
        updatable = false
    )
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;
}
