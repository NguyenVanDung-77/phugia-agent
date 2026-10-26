
package com.phugia.backend.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

import com.phugia.backend.entity.MasterPlan;
import com.phugia.backend.entity.SiteZone;
import com.phugia.backend.entity.PropertyUnit;

import com.phugia.backend.enums.UnitSaleStatus;

import com.phugia.backend.repository.MasterPlanRepository;
import com.phugia.backend.repository.SiteZoneRepository;
import com.phugia.backend.repository.PropertyUnitRepository;

import lombok.RequiredArgsConstructor;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class AgentDraftService {

    private final MasterPlanRepository masterPlanRepository;

    private final SiteZoneRepository siteZoneRepository;

    private final PropertyUnitRepository propertyUnitRepository;

    private final ObjectMapper objectMapper;

    private static final int MAX_IMPORT_UNITS = 200;

    private static final int MAX_POLYGON_POINTS = 150;

    // ============================================
    // DTO - NHẬN JSON TỪ TRANG AGENT
    // ============================================

    public record DraftUnit(
            String zoneCode,
            String unitCode,
            UnitSaleStatus saleStatus,
            String polygonJson
    ) {
    }

    public record ImportRequest(
            String imageUrl,
            Integer imageWidth,
            Integer imageHeight,
            List<DraftUnit> units
    ) {
    }

    public record Vertex(
            double x,
            double y
    ) {
    }

    public record UnitResponse(
            Long id,
            Long zoneId,
            String zoneCode,
            String unitCode,
            UnitSaleStatus saleStatus,
            String polygonJson
    ) {
    }

    public record ImportResponse(
            int created,
            int skipped,
            List<UnitResponse> units
    ) {
    }

    // ============================================
    // 1. LẤY CÁC CĂN ĐÃ LƯU MYSQL
    // ============================================

    @Transactional(readOnly = true)
    public List<UnitResponse> getUnits(
            Long masterPlanId
    ) {

        requireMasterPlan(masterPlanId);

        return propertyUnitRepository
                .findBySiteZone_MasterPlan_IdOrderByIdAsc(
                        masterPlanId
                )
                .stream()
                .map(this::toResponse)
                .toList();
    }

    // ============================================
    // 2. NHẬP POLYGON TỪ AGENT VÀO MYSQL
    // ============================================

    @Transactional
    public ImportResponse importDraft(
            Long masterPlanId,
            ImportRequest request
    ) {

        MasterPlan masterPlan =
                requireMasterPlan(masterPlanId);

        if (request == null) {
            throw badRequest(
                    "Du lieu JSON khong hop le."
            );
        }

        // ====================================
        // KIỂM TRA KÍCH THƯỚC ẢNH GỐC
        // ====================================

        if (
                !Objects.equals(
                        request.imageWidth(),
                        masterPlan.getImageWidth()
                )
                ||
                !Objects.equals(
                        request.imageHeight(),
                        masterPlan.getImageHeight()
                )
        ) {
            throw badRequest(
                    "Kich thuoc anh khong khop MySQL. "
                    + "Khong the luu Polygon."
            );
        }

        if (
                request.imageUrl() != null
                && !request.imageUrl().isBlank()
                && !Objects.equals(
                        request.imageUrl(),
                        masterPlan.getImageUrl()
                )
        ) {
            throw badRequest(
                    "Duong dan anh khong khop mat bang goc."
            );
        }

        // ====================================
        // KIỂM TRA SỐ LƯỢNG CĂN
        // ====================================

        if (
                request.units() == null
                || request.units().isEmpty()
        ) {
            throw badRequest(
                    "Khong co can nao de luu."
            );
        }

        if (
                request.units().size()
                        > MAX_IMPORT_UNITS
        ) {
            throw badRequest(
                    "Moi lan chi duoc nhap toi da "
                    + MAX_IMPORT_UNITS
                    + " can."
            );
        }

        // ====================================
        // TẢI DANH SÁCH PHÂN KHU
        // ====================================

        Map<String, SiteZone> zoneMap =
                siteZoneRepository
                        .findByMasterPlan_IdOrderBySortOrderAscIdAsc(
                                masterPlanId
                        )
                        .stream()
                        .collect(
                                Collectors.toMap(
                                        zone -> zone.getCode()
                                                .toUpperCase(
                                                        Locale.ROOT
                                                ),
                                        zone -> zone
                                )
                        );

        Map<Long, List<PropertyUnit>> existingByZone =
                new HashMap<>();

        List<UnitResponse> results =
                new ArrayList<>();

        int created = 0;
        int skipped = 0;

        // ====================================
        // XỬ LÝ TỪNG CĂN
        // ====================================

        for (DraftUnit draft : request.units()) {

            if (draft == null) {
                throw badRequest(
                        "Danh sach co can khong hop le."
                );
            }

            String zoneCode =
                    normalizeZoneCode(
                            draft.zoneCode()
                    );

            SiteZone zone = zoneMap.get(
                    zoneCode
            );

            if (zone == null) {
                throw badRequest(
                        "Khong tim thay phan khu: "
                        + zoneCode
                );
            }

            if (draft.saleStatus() == null) {
                throw badRequest(
                        "Can thieu trang thai mua ban."
                );
            }

            String unitCode =
                    normalizeUnitCode(
                            draft.unitCode()
                    );

            // =================================
            // PHÂN TÍCH TỌA ĐỘ POLYGON
            // =================================

            List<Vertex> vertices =
                    parseVertices(
                            draft.polygonJson(),
                            masterPlan.getImageWidth(),
                            masterPlan.getImageHeight()
                    );

            // Giữ nguyên kiểu Polygon hợp lệ từ
            // bản nháp, kể cả kiểu có điểm cuối
            // trùng điểm đầu.
            String normalizedPolygonJson =
                    serializeVertices(vertices);

            // =================================
            // KIỂM TRA CĂN ĐÃ TỒN TẠI
            // =================================

            List<PropertyUnit> existingUnits =
                    existingByZone.computeIfAbsent(
                            zone.getId(),
                            id -> new ArrayList<>(
                                    propertyUnitRepository
                                            .findBySiteZone_IdOrderByIdAsc(
                                                    id
                                            )
                            )
                    );

            PropertyUnit duplicate = null;

            for (PropertyUnit existing : existingUnits) {

                String oldCode =
                        normalizeUnitCode(
                                existing.getUnitCode()
                        );

                boolean sameCode =
                        unitCode != null
                        && unitCode.equalsIgnoreCase(
                                oldCode == null
                                        ? ""
                                        : oldCode
                        );

                boolean samePolygon =
                        samePolygon(
                                existing.getPolygonJson(),
                                vertices,
                                masterPlan
                        );

                // Không trùng mã và không trùng
                // Polygon thì kiểm tra căn kế tiếp.
                if (!sameCode && !samePolygon) {
                    continue;
                }

                // Căn đã tồn tại và toàn bộ thông tin
                // cơ bản trùng khớp thì bỏ qua.
                if (
                        samePolygon
                        && Objects.equals(
                                oldCode,
                                unitCode
                        )
                        && existing.getSaleStatus()
                                == draft.saleStatus()
                ) {
                    duplicate = existing;
                    break;
                }

                // Có xung đột:
                // Không tự ghi đè căn đã lưu.
                throw new ResponseStatusException(
                        HttpStatus.CONFLICT,
                        "Can trung ma hoac trung Polygon "
                        + "trong phan khu "
                        + zoneCode
                        + ". Can kiem tra truoc khi cap nhat."
                );
            }

            if (duplicate != null) {
                skipped++;

                results.add(
                        toResponse(duplicate)
                );

                continue;
            }

            // =================================
            // TẠO CĂN MỚI
            // =================================

            PropertyUnit newUnit =
                    new PropertyUnit();

            newUnit.setSiteZone(zone);

            newUnit.setUnitCode(
                    unitCode
            );

            newUnit.setSaleStatus(
                    draft.saleStatus()
            );

            newUnit.setPolygonJson(
                    normalizedPolygonJson
            );

            // Chưa nhập các thông tin:
            // - Diện tích đất
            // - Hướng
            // - Diện tích sàn xây dựng
            // - Kết cấu
            // - Các mức giá
            // - Ảnh riêng của căn
            //
            // Sẽ bổ sung ở bước chỉnh sửa căn.
            // Không gán actualSoldPrice ở đây.

            PropertyUnit saved =
                    propertyUnitRepository
                            .saveAndFlush(
                                    newUnit
                            );

            existingUnits.add(
                    saved
            );

            results.add(
                    toResponse(saved)
            );

            created++;
        }

        return new ImportResponse(
                created,
                skipped,
                List.copyOf(results)
        );
    }

    // ============================================
    // 3. KIỂM TRA MẶT BẰNG
    // ============================================

    private MasterPlan requireMasterPlan(
            Long id
    ) {

        return masterPlanRepository
                .findById(id)
                .orElseThrow(() ->
                        new ResponseStatusException(
                                HttpStatus.NOT_FOUND,
                                "Khong tim thay mat bang."
                        )
                );
    }

    // ============================================
    // 4. KIỂM TRA TỌA ĐỘ POLYGON
    //
    // ĐÃ SỬA:
    // CHẤP NHẬN 2 KIỂU POLYGON:
    //
    // A -> B -> C -> D
    //
    // HOẶC:
    //
    // A -> B -> C -> D -> A
    //
    // CẢ HAI ĐỀU HỢP LỆ.
    // ============================================

    private List<Vertex> parseVertices(
            String polygonJson,
            int width,
            int height
    ) {

        if (
                polygonJson == null
                || polygonJson.isBlank()
        ) {
            throw badRequest(
                    "Polygon khong duoc de trong."
            );
        }

        final JsonNode root;

        try {

            root = objectMapper.readTree(
                    polygonJson
            );

        } catch (JsonProcessingException ex) {

            throw badRequest(
                    "Polygon khong phai JSON hop le."
            );
        }

        if (
                root == null
                || !root.isArray()
                || root.size() < 3
                || root.size() > MAX_POLYGON_POINTS
        ) {
            throw badRequest(
                    "Polygon phai co tu 3 den "
                    + MAX_POLYGON_POINTS
                    + " diem."
            );
        }

        List<Vertex> vertices =
                new ArrayList<>();

        // ====================================
        // ĐỌC TỪNG ĐIỂM
        // ====================================

        for (JsonNode point : root) {

            if (
                    point == null
                    || !point.isObject()
            ) {
                throw badRequest(
                        "Moi diem phai la object co x, y."
                );
            }

            JsonNode xNode =
                    point.get("x");

            JsonNode yNode =
                    point.get("y");

            if (
                    xNode == null
                    || yNode == null
                    || !xNode.isNumber()
                    || !yNode.isNumber()
            ) {
                throw badRequest(
                        "Moi diem phai co x va y la so."
                );
            }

            double x =
                    xNode.asDouble();

            double y =
                    yNode.asDouble();

            if (
                    !Double.isFinite(x)
                    || !Double.isFinite(y)
                    || x < 0
                    || y < 0
                    || x > width
                    || y > height
            ) {
                throw badRequest(
                        "Toa do Polygon vuot khoi anh goc."
                );
            }

            Vertex vertex =
                    new Vertex(x, y);

            // Không cho phép hai điểm
            // LIỀN NHAU trùng nhau.
            if (
                    !vertices.isEmpty()
                    && vertices
                            .get(vertices.size() - 1)
                            .equals(vertex)
            ) {
                throw badRequest(
                        "Polygon co hai diem lien tiep trung nhau."
                );
            }

            vertices.add(
                    vertex
            );
        }

        // ====================================
        // SỬA LỖI QUAN TRỌNG
        // ====================================
        //
        // Trước đây:
        // Nếu điểm đầu bằng điểm cuối => báo lỗi.
        //
        // Bây giờ:
        // Điểm đầu bằng điểm cuối vẫn hợp lệ.
        //
        // Chỉ cần đảm bảo sau khi bỏ điểm
        // đóng hình thì còn ít nhất 3 đỉnh.

        boolean hasClosingPoint =
                vertices.size() >= 2
                && vertices.get(0).equals(
                        vertices.get(
                                vertices.size() - 1
                        )
                );

        int uniqueVertexCount =
                vertices.size()
                        - (hasClosingPoint ? 1 : 0);

        if (uniqueVertexCount < 3) {
            throw badRequest(
                    "Polygon phai co it nhat 3 dinh."
            );
        }

        // ====================================
        // KIỂM TRA DIỆN TÍCH
        // ====================================

        double area = 0;

        // Dùng số đỉnh thực tế, không cần
        // tính lại điểm đóng hình nếu có.
        for (
                int i = 0;
                i < uniqueVertexCount;
                i++
        ) {

            Vertex current =
                    vertices.get(i);

            Vertex next =
                    vertices.get(
                            (i + 1)
                                    % uniqueVertexCount
                    );

            area +=
                    current.x() * next.y();

            area -=
                    next.x() * current.y();
        }

        if (Math.abs(area / 2.0) < 1.0) {
            throw badRequest(
                    "Polygon khong tao thanh vung hop le."
            );
        }

        return vertices;
    }

    // ============================================
    // 5. CHUYỂN POLYGON SANG JSON
    // ============================================

    private String serializeVertices(
            List<Vertex> vertices
    ) {

        try {

            return objectMapper.writeValueAsString(
                    vertices
            );

        } catch (JsonProcessingException ex) {

            throw new IllegalStateException(
                    "Khong the ghi JSON Polygon.",
                    ex
            );
        }
    }

    // ============================================
    // 6. SO SÁNH POLYGON
    //
    // Hai Polygon được coi là cùng tọa độ
    // nếu chỉ khác cách viết điểm đóng hình.
    // ============================================

    private boolean samePolygon(
            String oldPolygonJson,
            List<Vertex> newVertices,
            MasterPlan masterPlan
    ) {

        if (
                oldPolygonJson == null
                || oldPolygonJson.isBlank()
        ) {
            return false;
        }

        try {

            List<Vertex> oldVertices =
                    parseVertices(
                            oldPolygonJson,
                            masterPlan.getImageWidth(),
                            masterPlan.getImageHeight()
                    );

            return removeClosingPoint(
                    oldVertices
            ).equals(
                    removeClosingPoint(
                            newVertices
                    )
            );

        } catch (ResponseStatusException ex) {

            return false;
        }
    }

    // ============================================
    // 7. BỎ ĐIỂM ĐÓNG HÌNH KHI SO SÁNH
    //
    // KHÔNG XÓA ĐIỂM TRONG DỮ LIỆU MYSQL
    // ============================================

    private List<Vertex> removeClosingPoint(
            List<Vertex> vertices
    ) {

        if (
                vertices.size() >= 2
                && vertices.get(0).equals(
                        vertices.get(
                                vertices.size() - 1
                        )
                )
        ) {
            return vertices.subList(
                    0,
                    vertices.size() - 1
            );
        }

        return vertices;
    }

    // ============================================
    // 8. CHUẨN HÓA MÃ PHÂN KHU
    // ============================================

    private String normalizeZoneCode(
            String value
    ) {

        if (
                value == null
                || value.isBlank()
        ) {
            throw badRequest(
                    "Thieu ma phan khu."
            );
        }

        return value.trim()
                .toUpperCase(
                        Locale.ROOT
                );
    }

    // ============================================
    // 9. CHUẨN HÓA MÃ CĂN
    // ============================================

    private String normalizeUnitCode(
            String value
    ) {

        if (
                value == null
                || value.isBlank()
        ) {
            return null;
        }

        String code =
                value.trim();

        if (code.length() > 50) {
            throw badRequest(
                    "Ma can khong duoc qua 50 ky tu."
            );
        }

        return code;
    }

    // ============================================
    // 10. TRẢ KẾT QUẢ CHO AGENT
    // ============================================

    private UnitResponse toResponse(
            PropertyUnit unit
    ) {

        return new UnitResponse(
                unit.getId(),
                unit.getSiteZone().getId(),
                unit.getSiteZone().getCode(),
                unit.getUnitCode(),
                unit.getSaleStatus(),
                unit.getPolygonJson()
        );
    }

    // ============================================
    // 11. TẠO LỖI HTTP 400
    // ============================================

    private ResponseStatusException badRequest(
            String message
    ) {

        return new ResponseStatusException(
                HttpStatus.BAD_REQUEST,
                message
        );
    }
}
