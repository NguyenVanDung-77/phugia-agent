package com.phugia.backend.controller;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.phugia.backend.entity.MasterPlan;
import com.phugia.backend.entity.SiteZone;
import com.phugia.backend.repository.MasterPlanRepository;
import com.phugia.backend.repository.SiteZoneRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.Locale;

@RestController
@RequestMapping("/api/agent/master-plans/{masterPlanId}/zones")
@RequiredArgsConstructor
@PreAuthorize("hasAnyRole('AGENT','ADMIN')")
public class AgentZonePolygonController {

    private final MasterPlanRepository masterPlanRepository;
    private final SiteZoneRepository siteZoneRepository;
    private final ObjectMapper objectMapper;

    public record Point(double x, double y) {}

    public record SavePolygonRequest(List<Point> points) {}

    public record ZonePolygonResponse(
            Long id,
            String code,
            String name,
            String polygonJson
    ) {}

    // ==========================================
    // LƯU RANH GIỚI RUBY / SAPPHIRE / CRYSTAL
    // ==========================================

    @PutMapping("/{zoneCode}/polygon")
    @Transactional
    public ZonePolygonResponse savePolygon(
            @PathVariable Long masterPlanId,
            @PathVariable String zoneCode,
            @RequestBody SavePolygonRequest request) {

        MasterPlan plan = masterPlanRepository.findById(masterPlanId)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND,
                        "Không tìm thấy mặt bằng."
                ));

        SiteZone zone = findZone(masterPlanId, zoneCode);

        if (request == null || request.points() == null) {
            throw badRequest("Thiếu tọa độ ranh giới phân khu.");
        }

        List<Point> points = request.points();

        if (points.size() < 3 || points.size() > 150) {
            throw badRequest("Ranh giới cần từ 3 đến 150 điểm.");
        }

        if (
                plan.getImageWidth() == null
                || plan.getImageHeight() == null
        ) {
            throw badRequest(
                    "Mặt bằng chưa có kích thước ảnh gốc."
            );
        }

        int n = points.size();

        if (
                n > 3
                && same(points.get(0), points.get(n - 1))
        ) {
            n--;
        }

        if (n < 3) {
            throw badRequest(
                    "Ranh giới cần ít nhất 3 đỉnh khác nhau."
            );
        }

        double areaTwice = 0;

        for (int i = 0; i < n; i++) {
            Point a = points.get(i);
            Point b = points.get((i + 1) % n);

            if (
                    a == null
                    || b == null
                    || !Double.isFinite(a.x())
                    || !Double.isFinite(a.y())
                    || a.x() < 0
                    || a.y() < 0
                    || a.x() > plan.getImageWidth()
                    || a.y() > plan.getImageHeight()
            ) {
                throw badRequest(
                        "Tọa độ nằm ngoài ảnh mặt bằng gốc."
                );
            }

            if (same(a, b)) {
                throw badRequest(
                        "Không được có 2 điểm liền nhau trùng nhau."
                );
            }

            areaTwice +=
                    a.x() * b.y()
                    - b.x() * a.y();
        }

        if (Math.abs(areaTwice) / 2.0 < 1) {
            throw badRequest(
                    "Ranh giới không tạo thành diện tích hợp lệ."
            );
        }

        try {
            // Chỉ lưu Polygon phân khu,
            // không sửa Polygon của bất kỳ căn nào.
            zone.setPolygonJson(
                    objectMapper.writeValueAsString(
                            points.subList(0, n)
                    )
            );
        } catch (JsonProcessingException ex) {
            throw badRequest(
                    "Không thể lưu tọa độ ranh giới."
            );
        }

        return respond(
                siteZoneRepository.saveAndFlush(zone)
        );
    }

    // ==========================================
    // XÓA RIÊNG RANH GIỚI PHÂN KHU
    // KHÔNG XÓA CĂN
    // ==========================================

    @DeleteMapping("/{zoneCode}/polygon")
    @Transactional
    public ZonePolygonResponse clearPolygon(
            @PathVariable Long masterPlanId,
            @PathVariable String zoneCode) {

        if (!masterPlanRepository.existsById(masterPlanId)) {
            throw new ResponseStatusException(
                    HttpStatus.NOT_FOUND,
                    "Không tìm thấy mặt bằng."
            );
        }

        SiteZone zone = findZone(masterPlanId, zoneCode);

        zone.setPolygonJson(null);

        return respond(
                siteZoneRepository.saveAndFlush(zone)
        );
    }

    // ==========================================
    // CHỈ CHO PHÉP 3 PHÂN KHU CỐ ĐỊNH
    // ==========================================

    private SiteZone findZone(
            Long masterPlanId,
            String code) {

        String normalized = code
                .trim()
                .toUpperCase(Locale.ROOT);

        if (!List.of(
                "RUBY",
                "SAPPHIRE",
                "CRYSTAL"
        ).contains(normalized)) {
            throw badRequest(
                    "Chỉ hỗ trợ Ruby, Sapphire, Crystal."
            );
        }

        return siteZoneRepository
                .findByMasterPlan_IdAndCode(
                        masterPlanId,
                        normalized
                )
                .orElseThrow(() ->
                        new ResponseStatusException(
                                HttpStatus.NOT_FOUND,
                                "Không tìm thấy phân khu."
                        )
                );
    }

    private boolean same(Point a, Point b) {
        return a != null
                && b != null
                && a.x() == b.x()
                && a.y() == b.y();
    }

    private ZonePolygonResponse respond(
            SiteZone zone) {

        return new ZonePolygonResponse(
                zone.getId(),
                zone.getCode(),
                zone.getName(),
                zone.getPolygonJson()
        );
    }

    private ResponseStatusException badRequest(
            String message) {

        return new ResponseStatusException(
                HttpStatus.BAD_REQUEST,
                message
        );
    }
}