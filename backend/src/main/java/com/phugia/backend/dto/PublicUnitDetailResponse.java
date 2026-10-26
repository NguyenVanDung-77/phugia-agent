package com.phugia.backend.dto;

import com.phugia.backend.enums.UnitSaleStatus;

import java.math.BigDecimal;

public record PublicUnitDetailResponse(

        Long id,

        // Mã căn
        String unitCode,

        // Phân khu
        String zoneName,

        // Ảnh căn
        String imageUrl,

        // Diện tích
        BigDecimal landArea,

        // Hướng
        String direction,

        // Diện tích sàn xây dựng
        BigDecimal constructionFloorArea,

        // Kết cấu
        String structureDescription,

        // Giá gốc
        BigDecimal basePrice,

        // Thanh toán tiêu chuẩn
        BigDecimal standardPaymentPrice,

        // Thanh toán sớm 70%
        BigDecimal early70Price,

        // Thanh toán sớm 95%
        BigDecimal early95Price,

        // Trạng thái
        UnitSaleStatus saleStatus

) {
}