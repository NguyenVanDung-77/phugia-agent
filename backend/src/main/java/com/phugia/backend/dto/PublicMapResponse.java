
package com.phugia.backend.dto;

import com.phugia.backend.enums.UnitSaleStatus;

import java.util.List;

public record PublicMapResponse(

        Long id,

        String name,

        String imageUrl,

        Integer imageWidth,

        Integer imageHeight,

        List<Zone> zones

) {

    // Thông tin mặt bằng
    public record MasterPlanSummary(

            Long id,

            String name,

            String imageUrl

    ) {
    }

    // Thông tin phân khu
    public record Zone(

            Long id,

            String code,

            String name,

            String polygonJson,

            List<UnitMarker> units

    ) {
    }

    // Thông tin căn hiển thị trên bản đồ
    public record UnitMarker(

            Long id,

            String unitCode,

            String polygonJson,

            UnitSaleStatus saleStatus,

            boolean clickable,

            // Ví dụ mã TEST-002:
            // displayLabel = "002"
            String displayLabel

    ) {
    }
}
