
package com.phugia.backend.controller;

import com.phugia.backend.entity.PropertyUnit;
import com.phugia.backend.entity.SiteZone;

import com.phugia.backend.repository.PropertyUnitRepository;
import com.phugia.backend.repository.SiteZoneRepository;

import lombok.RequiredArgsConstructor;

import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.util.Locale;
import java.util.Set;

@RestController
@RequestMapping("/api/agent/units")
@RequiredArgsConstructor
@PreAuthorize("hasAnyRole('AGENT', 'ADMIN')")
public class AgentUnitZoneController {

    private static final Set<String> VALID_ZONES =
            Set.of("RUBY", "SAPPHIRE", "CRYSTAL");

    private final PropertyUnitRepository propertyUnitRepository;
    private final SiteZoneRepository siteZoneRepository;

    public record ChangeZoneRequest(
            String zoneCode
    ) {
    }

    public record ChangeZoneResponse(
            Long unitId,
            String unitCode,
            Long zoneId,
            String zoneCode,
            String zoneName
    ) {
    }

    // ==========================================
    // THAY ĐỔI PHÂN KHU CHO CĂN ĐÃ LƯU
    // ==========================================
    //
    // PUT /api/agent/units/{unitId}/zone
    //
    // Ví dụ:
    // {
    //   "zoneCode": "SAPPHIRE"
    // }
    //
    // Chỉ cập nhật site_zone_id.
    //
    // Giữ nguyên:
    // - Polygon
    // - Mã căn
    // - Ảnh
    // - Diện tích
    // - Hướng
    // - Kết cấu
    // - Giá
    // - Trạng thái

    @PutMapping("/{unitId}/zone")
    @Transactional
    public ChangeZoneResponse changeZone(
            @PathVariable Long unitId,
            @RequestBody ChangeZoneRequest request
    ) {

        if (
                request == null
                || request.zoneCode() == null
        ) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Vui lòng chọn phân khu."
            );
        }

        String code = request.zoneCode()
                .trim()
                .toUpperCase(Locale.ROOT);

        if (!VALID_ZONES.contains(code)) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Phân khu chỉ có thể là RUBY, SAPPHIRE hoặc CRYSTAL."
            );
        }

        PropertyUnit unit = propertyUnitRepository
                .findById(unitId)
                .orElseThrow(() ->
                        new ResponseStatusException(
                                HttpStatus.NOT_FOUND,
                                "Không tìm thấy căn."
                        )
                );

        // Lấy mặt bằng đang chứa căn.
        Long masterPlanId = unit
                .getSiteZone()
                .getMasterPlan()
                .getId();

        // Chỉ được chuyển sang phân khu
        // thuộc cùng một mặt bằng.
        SiteZone targetZone = siteZoneRepository
                .findByMasterPlan_IdAndCode(
                        masterPlanId,
                        code
                )
                .orElseThrow(() ->
                        new ResponseStatusException(
                                HttpStatus.NOT_FOUND,
                                "Không tìm thấy phân khu " + code
                                + " trên mặt bằng này."
                        )
                );

        // Chỉ thay đổi quan hệ phân khu.
        // Không chỉnh sửa bất cứ thông tin nào khác.
        unit.setSiteZone(targetZone);

        propertyUnitRepository.saveAndFlush(unit);

        return new ChangeZoneResponse(
                unit.getId(),
                unit.getUnitCode(),
                targetZone.getId(),
                targetZone.getCode(),
                targetZone.getName()
        );
    }
}
