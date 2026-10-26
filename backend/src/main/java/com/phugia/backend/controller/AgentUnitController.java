
package com.phugia.backend.controller;

import com.phugia.backend.entity.PropertyUnit;
import com.phugia.backend.enums.UnitSaleStatus;
import com.phugia.backend.repository.PropertyUnitRepository;

import lombok.RequiredArgsConstructor;

import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.List;

@RestController
@RequestMapping("/api/agent/units")
@RequiredArgsConstructor
@PreAuthorize("hasAnyRole('AGENT', 'ADMIN')")
public class AgentUnitController {

    private final PropertyUnitRepository propertyUnitRepository;

    // ==========================================
    // DỮ LIỆU AGENT GỬI LÊN
    // ==========================================

    public record UnitUpdateRequest(
            String unitCode,
            String imageUrl,
            BigDecimal landArea,
            String direction,
            BigDecimal constructionFloorArea,
            String structureDescription,
            BigDecimal basePrice,
            BigDecimal standardPaymentPrice,
            BigDecimal early70Price,
            BigDecimal early95Price,
            UnitSaleStatus saleStatus
    ) {
    }

    // ==========================================
    // DỮ LIỆU TRẢ VỀ CHO AGENT
    // ==========================================

    public record UnitDetailResponse(
            Long id,
            Long zoneId,
            String zoneCode,
            String zoneName,
            String unitCode,
            String imageUrl,
            BigDecimal landArea,
            String direction,
            BigDecimal constructionFloorArea,
            String structureDescription,
            BigDecimal basePrice,
            BigDecimal standardPaymentPrice,
            BigDecimal early70Price,
            BigDecimal early95Price,
            UnitSaleStatus saleStatus,
            String polygonJson
    ) {
    }

    // ==========================================
    // 1. XEM CHI TIẾT CĂN ĐÃ LƯU
    // ==========================================
    // GET /api/agent/units/{unitId}
    //
    // Agent được xem cả căn đã bán.
    // User vẫn bị chặn bởi PublicMapService.

    @GetMapping("/{unitId}")
    @Transactional(readOnly = true)
    public UnitDetailResponse getUnitDetail(
            @PathVariable Long unitId
    ) {
        PropertyUnit unit = findUnit(unitId);
        return toResponse(unit);
    }

    // ==========================================
    // 2. CẬP NHẬT THÔNG TIN CĂN
    // ==========================================
    // PUT /api/agent/units/{unitId}
    //
    // Không thay đổi Polygon.
    // Không thay đổi phân khu.
    // Thông tin bỏ trống sẽ lưu NULL.

    @PutMapping("/{unitId}")
    @Transactional
    public UnitDetailResponse updateUnit(
            @PathVariable Long unitId,
            @RequestBody UnitUpdateRequest request
    ) {

        PropertyUnit unit = findUnit(unitId);

        if (request == null) {
            throw badRequest("Thiếu dữ liệu cập nhật.");
        }

        if (request.saleStatus() == null) {
            throw badRequest(
                    "Vui lòng chọn trạng thái căn."
            );
        }

        // Chuẩn hóa mã căn
        String newUnitCode = normalizeText(
                request.unitCode(),
                50,
                "Mã căn"
        );

        // Kiểm tra mã căn trùng trong cùng phân khu
        if (newUnitCode != null) {

            List<PropertyUnit> otherUnits =
                    propertyUnitRepository
                            .findBySiteZone_IdOrderByIdAsc(
                                    unit.getSiteZone().getId()
                            );

            for (PropertyUnit other : otherUnits) {

                if (other.getId().equals(unit.getId())) {
                    continue;
                }

                String existingCode = other.getUnitCode();

                if (
                        existingCode != null
                        && existingCode.trim()
                                .equalsIgnoreCase(newUnitCode)
                ) {
                    throw new ResponseStatusException(
                            HttpStatus.CONFLICT,
                            "Mã căn đã tồn tại trong phân khu."
                    );
                }
            }
        }

        // ======================================
        // THÔNG TIN CƠ BẢN
        // ======================================

        unit.setUnitCode(newUnitCode);

        String imageUrl = normalizeText(
                request.imageUrl(),
                1000,
                "Đường dẫn ảnh"
        );

        if (
                imageUrl != null
                && !imageUrl.startsWith("https://")
                && !imageUrl.startsWith("http://")
                && !imageUrl.startsWith("/")
        ) {
            throw badRequest(
                    "Ảnh phải có đường dẫn HTTP, HTTPS " +
                    "hoặc đường dẫn nội bộ bắt đầu bằng /."
            );
        }

        unit.setImageUrl(imageUrl);

        unit.setLandArea(
                validateDecimal(
                        request.landArea(),
                        10,
                        "Diện tích đất"
                )
        );

        unit.setDirection(
                normalizeText(
                        request.direction(),
                        100,
                        "Hướng căn"
                )
        );

        unit.setConstructionFloorArea(
                validateDecimal(
                        request.constructionFloorArea(),
                        10,
                        "Diện tích sàn xây dựng"
                )
        );

        unit.setStructureDescription(
                normalizeText(
                        request.structureDescription(),
                        10000,
                        "Kết cấu"
                )
        );

        // ======================================
        // THÔNG TIN GIÁ
        // ======================================

        unit.setBasePrice(
                validateDecimal(
                        request.basePrice(),
                        17,
                        "Giá gốc"
                )
        );

        unit.setStandardPaymentPrice(
                validateDecimal(
                        request.standardPaymentPrice(),
                        17,
                        "Giá thanh toán tiêu chuẩn"
                )
        );

        unit.setEarly70Price(
                validateDecimal(
                        request.early70Price(),
                        17,
                        "Giá thanh toán sớm 70%"
                )
        );

        unit.setEarly95Price(
                validateDecimal(
                        request.early95Price(),
                        17,
                        "Giá thanh toán sớm 95%"
                )
        );

        // ======================================
        // TRẠNG THÁI
        // ======================================

        unit.setSaleStatus(request.saleStatus());

        // AVAILABLE = trắng
        // SOLD = đỏ nhạt
        // NOT_OPEN = vàng

        PropertyUnit saved =
                propertyUnitRepository.saveAndFlush(unit);

        return toResponse(saved);
    }

    // ==========================================
    // 3. XÓA THÔNG TIN NHƯNG GIỮ VÙNG KHOANH
    // ==========================================
    // DELETE /api/agent/units/{unitId}/details
    //
    // Giữ nguyên ID, phân khu, Polygon,
    // trạng thái mua bán.

    @DeleteMapping("/{unitId}/details")
    @Transactional
    public UnitDetailResponse clearUnitDetails(
            @PathVariable Long unitId
    ) {

        PropertyUnit unit = findUnit(unitId);

        unit.setUnitCode(null);
        unit.setImageUrl(null);
        unit.setLandArea(null);
        unit.setDirection(null);
        unit.setConstructionFloorArea(null);
        unit.setStructureDescription(null);

        unit.setBasePrice(null);
        unit.setStandardPaymentPrice(null);
        unit.setEarly70Price(null);
        unit.setEarly95Price(null);

        // Không xóa Polygon
        // Không xóa trạng thái
        // Không xóa giá bán thực tế dùng cho báo cáo

        PropertyUnit saved =
                propertyUnitRepository.saveAndFlush(unit);

        return toResponse(saved);
    }

    // ==========================================
    // 4. XÓA HẲN CĂN VÀ POLYGON
    // ==========================================
    // DELETE /api/agent/units/{unitId}
    //
    // CẢNH BÁO:
    // Xóa bản ghi khỏi MySQL.
    // Polygon cũng không còn trên bản đồ.

    @DeleteMapping("/{unitId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @Transactional
    public void deleteUnit(
            @PathVariable Long unitId
    ) {

        PropertyUnit unit = findUnit(unitId);

        propertyUnitRepository.delete(unit);
    }

    // ==========================================
    // 5. TÌM CĂN
    // ==========================================

    private PropertyUnit findUnit(Long unitId) {

        return propertyUnitRepository
                .findById(unitId)
                .orElseThrow(() ->
                        new ResponseStatusException(
                                HttpStatus.NOT_FOUND,
                                "Không tìm thấy căn."
                        )
                );
    }

    // ==========================================
    // 6. CHUẨN HÓA TEXT
    // ==========================================

    private String normalizeText(
            String value,
            int maxLength,
            String fieldName
    ) {

        if (value == null || value.isBlank()) {
            return null;
        }

        String normalized = value.trim();

        if (normalized.length() > maxLength) {
            throw badRequest(
                    fieldName +
                    " không được vượt quá " +
                    maxLength +
                    " ký tự."
            );
        }

        return normalized;
    }

    // ==========================================
    // 7. KIỂM TRA DIỆN TÍCH VÀ GIÁ
    // ==========================================
    //
    // integerDigits:
    // 10 đối với DECIMAL(12,2)
    // 17 đối với DECIMAL(19,2)
    //
    // Không có dữ liệu => NULL.
    // Giá trị âm => không hợp lệ.

    private BigDecimal validateDecimal(
            BigDecimal value,
            int integerDigits,
            String fieldName
    ) {

        if (value == null) {
            return null;
        }

        if (value.signum() < 0) {
            throw badRequest(
                    fieldName + " không được âm."
            );
        }

        BigDecimal normalized;

        try {
            normalized = value.setScale(
                    2,
                    RoundingMode.UNNECESSARY
            );
        } catch (ArithmeticException ex) {
            throw badRequest(
                    fieldName +
                    " chỉ được tối đa 2 chữ số thập phân."
            );
        }

        BigDecimal limit =
                BigDecimal.TEN.pow(integerDigits);

        if (normalized.compareTo(limit) >= 0) {
            throw badRequest(
                    fieldName + " vượt quá giới hạn."
            );
        }

        return normalized;
    }

    // ==========================================
    // 8. CHUYỂN ENTITY THÀNH RESPONSE
    // ==========================================

    private UnitDetailResponse toResponse(
            PropertyUnit unit
    ) {

        return new UnitDetailResponse(
                unit.getId(),
                unit.getSiteZone().getId(),
                unit.getSiteZone().getCode(),
                unit.getSiteZone().getName(),

                unit.getUnitCode(),
                unit.getImageUrl(),

                unit.getLandArea(),
                unit.getDirection(),
                unit.getConstructionFloorArea(),
                unit.getStructureDescription(),

                unit.getBasePrice(),
                unit.getStandardPaymentPrice(),
                unit.getEarly70Price(),
                unit.getEarly95Price(),

                unit.getSaleStatus(),
                unit.getPolygonJson()
        );
    }

    // ==========================================
    // 9. TRẢ VỀ LỖI 400
    // ==========================================

    private ResponseStatusException badRequest(
            String message
    ) {

        return new ResponseStatusException(
                HttpStatus.BAD_REQUEST,
                message
        );
    }
}
