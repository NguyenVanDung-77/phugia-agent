
package com.phugia.backend.service;

import com.phugia.backend.dto.PublicMapResponse;
import com.phugia.backend.dto.PublicUnitDetailResponse;

import com.phugia.backend.entity.MasterPlan;
import com.phugia.backend.entity.PropertyUnit;
import com.phugia.backend.entity.SiteZone;

import com.phugia.backend.enums.UnitSaleStatus;

import com.phugia.backend.repository.MasterPlanRepository;
import com.phugia.backend.repository.PropertyUnitRepository;
import com.phugia.backend.repository.SiteZoneRepository;

import lombok.RequiredArgsConstructor;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class PublicMapService {

    private final MasterPlanRepository masterPlanRepository;
    private final SiteZoneRepository siteZoneRepository;
    private final PropertyUnitRepository propertyUnitRepository;

    // ==========================================
    // 1. LẤY DANH SÁCH MẶT BẰNG
    // ==========================================

    public List<PublicMapResponse.MasterPlanSummary>
    getActiveMasterPlans() {

        return masterPlanRepository
                .findByActiveTrueOrderByIdAsc()
                .stream()
                .map(plan ->
                        new PublicMapResponse.MasterPlanSummary(
                                plan.getId(),
                                plan.getName(),
                                plan.getImageUrl()
                        )
                )
                .toList();
    }

    // ==========================================
    // 2. LẤY DỮ LIỆU BẢN ĐỒ CHO USER
    // ==========================================

    public PublicMapResponse getMasterPlanMap(
            Long masterPlanId
    ) {

        MasterPlan masterPlan = masterPlanRepository
                .findById(masterPlanId)
                .orElseThrow(() ->
                        new ResponseStatusException(
                                HttpStatus.NOT_FOUND,
                                "Không tìm thấy mặt bằng."
                        )
                );

        if (!Boolean.TRUE.equals(masterPlan.getActive())) {
            throw new ResponseStatusException(
                    HttpStatus.NOT_FOUND,
                    "Mặt bằng không khả dụng."
            );
        }

        List<SiteZone> zones = siteZoneRepository
                .findByMasterPlan_IdOrderBySortOrderAscIdAsc(
                        masterPlanId
                );

        List<PropertyUnit> units = propertyUnitRepository
                .findBySiteZone_MasterPlan_IdOrderByIdAsc(
                        masterPlanId
                );

        Map<Long, List<PropertyUnit>> unitsByZone =
                units.stream().collect(
                        Collectors.groupingBy(
                                unit -> unit.getSiteZone().getId()
                        )
                );

        List<PublicMapResponse.Zone> zoneResponses =
                new ArrayList<>();

        for (SiteZone zone : zones) {

            List<PropertyUnit> zoneUnits =
                    unitsByZone.getOrDefault(
                            zone.getId(),
                            List.of()
                    );

            List<PublicMapResponse.UnitMarker> markers =
                    new ArrayList<>();

            for (PropertyUnit unit : zoneUnits) {

                UnitSaleStatus status = unit.getSaleStatus();

                if (status == null) {
                    status = UnitSaleStatus.NOT_OPEN;
                }

                boolean hasPolygon =
                        unit.getPolygonJson() != null
                        && !unit.getPolygonJson().isBlank();

                // Căn SOLD không thể click xem chi tiết.
                boolean clickable =
                        status != UnitSaleStatus.SOLD
                        && hasPolygon;

                // Không công khai mã đầy đủ của căn đã bán.
                String publicUnitCode =
                        status == UnitSaleStatus.SOLD
                                ? null
                                : unit.getUnitCode();

                // Chỉ lấy số sau dấu "-" để hiển thị.
                // TEST-002 -> 002
                // RUBY-015 -> 015
                String displayLabel =
                        extractDisplayLabel(
                                unit.getUnitCode()
                        );

                markers.add(
                        new PublicMapResponse.UnitMarker(
                                unit.getId(),
                                publicUnitCode,
                                unit.getPolygonJson(),
                                status,
                                clickable,
                                displayLabel
                        )
                );
            }

            zoneResponses.add(
                    new PublicMapResponse.Zone(
                            zone.getId(),
                            zone.getCode(),
                            zone.getName(),
                            zone.getPolygonJson(),
                            markers
                    )
            );
        }

        return new PublicMapResponse(
                masterPlan.getId(),
                masterPlan.getName(),
                masterPlan.getImageUrl(),
                masterPlan.getImageWidth(),
                masterPlan.getImageHeight(),
                zoneResponses
        );
    }

    // ==========================================
    // 3. USER XEM CHI TIẾT CĂN
    // ==========================================

    public PublicUnitDetailResponse getUnitDetail(
            Long unitId
    ) {

        PropertyUnit unit = propertyUnitRepository
                .findById(unitId)
                .orElseThrow(() ->
                        new ResponseStatusException(
                                HttpStatus.NOT_FOUND,
                                "Không tìm thấy căn."
                        )
                );

        MasterPlan masterPlan =
                unit.getSiteZone().getMasterPlan();

        if (!Boolean.TRUE.equals(masterPlan.getActive())) {
            throw new ResponseStatusException(
                    HttpStatus.NOT_FOUND,
                    "Căn không khả dụng."
            );
        }

        // Đã bán không được xem chi tiết,
        // kể cả khi gọi API trực tiếp.
        if (unit.getSaleStatus() == UnitSaleStatus.SOLD) {
            throw new ResponseStatusException(
                    HttpStatus.NOT_FOUND,
                    "Căn đã bán không thể xem chi tiết."
            );
        }

        return new PublicUnitDetailResponse(
                unit.getId(),
                unit.getUnitCode(),
                unit.getSiteZone().getName(),
                unit.getImageUrl(),
                unit.getLandArea(),
                unit.getDirection(),
                unit.getConstructionFloorArea(),
                unit.getStructureDescription(),
                unit.getBasePrice(),
                unit.getStandardPaymentPrice(),
                unit.getEarly70Price(),
                unit.getEarly95Price(),
                unit.getSaleStatus()
        );
    }

    // ==========================================
    // 4. TÁCH SỐ HIỂN THỊ TRÊN POLYGON
    // ==========================================
    //
    // TEST-002    -> 002
    // RUBY-15     -> 15
    // A-B-001     -> 001
    // TEST        -> null
    // TEST-ABC    -> null
    //
    // Giữ nguyên số 0 ở đầu.

    private String extractDisplayLabel(String unitCode) {

        if (unitCode == null) {
            return null;
        }

        String code = unitCode.trim();

        int dashIndex = code.lastIndexOf('-');

        if (
                dashIndex < 0 ||
                dashIndex == code.length() - 1
        ) {
            return null;
        }

        String suffix =
                code.substring(dashIndex + 1);

        return suffix.matches("[0-9]+")
                ? suffix
                : null;
    }
}
