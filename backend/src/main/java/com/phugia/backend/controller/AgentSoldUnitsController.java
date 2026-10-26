
package com.phugia.backend.controller;

import com.phugia.backend.entity.PropertyUnit;
import com.phugia.backend.enums.UnitSaleStatus;
import com.phugia.backend.repository.MasterPlanRepository;
import com.phugia.backend.repository.PropertyUnitRepository;

import lombok.RequiredArgsConstructor;

import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;

@RestController
@RequestMapping("/api/agent/reports")
@RequiredArgsConstructor
@PreAuthorize("hasAnyRole('AGENT', 'ADMIN')")
public class AgentSoldUnitsController {

    private final PropertyUnitRepository propertyUnitRepository;
    private final MasterPlanRepository masterPlanRepository;

    // ==========================================
    // THÔNG TIN CĂN ĐÃ BÁN
    // ==========================================

    public record SoldUnitResponse(
            Long id,
            String unitCode,
            String zoneCode,
            String zoneName,
            String actualSoldPrice
    ) {
    }

    // ==========================================
    // LẤY DANH SÁCH CĂN ĐÃ BÁN
    // ==========================================
    //
    // GET:
    // /api/agent/reports/master-plans/1/sold-units
    //
    // Chỉ trả về căn SOLD.
    // Không trả về thông tin giá cho USER.
    // Không sửa Polygon và trạng thái.

    @GetMapping(
        "/master-plans/{masterPlanId}/sold-units"
    )
    @Transactional(readOnly = true)
    public List<SoldUnitResponse> getSoldUnits(
            @PathVariable Long masterPlanId
    ) {

        if (!masterPlanRepository.existsById(masterPlanId)) {
            throw new ResponseStatusException(
                    HttpStatus.NOT_FOUND,
                    "Không tìm thấy mặt bằng."
            );
        }

        return propertyUnitRepository
                .findBySiteZone_MasterPlan_IdOrderByIdAsc(
                        masterPlanId
                )
                .stream()
                .filter(unit ->
                        unit.getSaleStatus()
                                == UnitSaleStatus.SOLD
                )
                .map(this::toResponse)
                .toList();
    }

    // ==========================================
    // CHUYỂN ENTITY THÀNH RESPONSE
    // ==========================================
    //
    // Chuyển BigDecimal sang String để
    // JavaScript không làm tròn số tiền lớn.

    private SoldUnitResponse toResponse(
            PropertyUnit unit
    ) {

        return new SoldUnitResponse(
                unit.getId(),
                unit.getUnitCode(),
                unit.getSiteZone().getCode(),
                unit.getSiteZone().getName(),

                unit.getActualSoldPrice() == null
                        ? null
                        : unit.getActualSoldPrice()
                                .toPlainString()
        );
    }
}
