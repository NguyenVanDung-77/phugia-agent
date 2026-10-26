
package com.phugia.backend.controller;

import com.phugia.backend.entity.MasterPlan;
import com.phugia.backend.entity.PropertyUnit;
import com.phugia.backend.entity.SiteZone;
import com.phugia.backend.enums.UnitSaleStatus;
import com.phugia.backend.repository.MasterPlanRepository;
import com.phugia.backend.repository.PropertyUnitRepository;
import com.phugia.backend.repository.SiteZoneRepository;

import lombok.RequiredArgsConstructor;

import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;

import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.transaction.annotation.Transactional;

import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.math.RoundingMode;

import java.nio.charset.StandardCharsets;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/agent/reports")
@RequiredArgsConstructor
@PreAuthorize("hasAnyRole('AGENT', 'ADMIN')")
public class AgentReportController {

    private final MasterPlanRepository masterPlanRepository;
    private final SiteZoneRepository siteZoneRepository;
    private final PropertyUnitRepository propertyUnitRepository;

    private static final DateTimeFormatter DATE_FORMAT =
            DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss");

    // ==========================================
    // 1. CẤU TRÚC SỐ LIỆU THỐNG KÊ
    // ==========================================

    public record StatusMetrics(
            long totalUnits,
            long availableUnits,
            long soldUnits,
            long notOpenUnits,

            // Số căn đã bán có giá thực tế
            long soldWithActualPrice,

            // Số căn đã bán thiếu giá thực tế
            long soldMissingActualPrice,

            // Tổng giá trị các căn đã bán
            // có ghi nhận giá thực tế
            BigDecimal recordedSoldValue
    ) {
    }

    // Thống kê một phân khu
    public record ZoneSummary(
            Long zoneId,
            String zoneCode,
            String zoneName,
            StatusMetrics metrics
    ) {
    }

    // Thống kê toàn bộ mặt bằng
    public record ReportResponse(
            Long masterPlanId,
            String masterPlanName,
            StatusMetrics totals,
            List<ZoneSummary> zones
    ) {
    }

    // Giá bán thực tế Agent nhập
    public record ActualSoldPriceRequest(
            BigDecimal actualSoldPrice
    ) {
    }

    // Phản hồi sau khi lưu giá
    public record ActualSoldPriceResponse(
            Long unitId,
            String unitCode,
            UnitSaleStatus saleStatus,
            BigDecimal actualSoldPrice
    ) {
    }

    // ==========================================
    // 2. THỐNG KÊ TOÀN BỘ MẶT BẰNG
    // ==========================================
    //
    // GET
    // /api/agent/reports/master-plans/{id}/summary
    //
    // Ví dụ:
    // /api/agent/reports/master-plans/1/summary
    //
    // Chỉ AGENT và ADMIN được xem.

    @GetMapping("/master-plans/{masterPlanId}/summary")
    @Transactional(readOnly = true)
    public ReportResponse getSummary(
            @PathVariable Long masterPlanId
    ) {

        MasterPlan masterPlan =
                requireMasterPlan(masterPlanId);

        List<SiteZone> zones =
                siteZoneRepository
                        .findByMasterPlan_IdOrderBySortOrderAscIdAsc(
                                masterPlanId
                        );

        List<PropertyUnit> units =
                propertyUnitRepository
                        .findBySiteZone_MasterPlan_IdOrderByIdAsc(
                                masterPlanId
                        );

        // Thống kê toàn bộ căn
        StatusMetrics totals = calculateMetrics(units);

        // Gom các căn theo phân khu
        Map<Long, List<PropertyUnit>> unitsByZone =
                new HashMap<>();

        for (PropertyUnit unit : units) {

            Long zoneId = unit.getSiteZone().getId();

            unitsByZone
                    .computeIfAbsent(
                            zoneId,
                            key -> new ArrayList<>()
                    )
                    .add(unit);
        }

        // Thống kê từng phân khu
        List<ZoneSummary> zoneSummaries =
                new ArrayList<>();

        for (SiteZone zone : zones) {

            List<PropertyUnit> zoneUnits =
                    unitsByZone.getOrDefault(
                            zone.getId(),
                            List.of()
                    );

            zoneSummaries.add(
                    new ZoneSummary(
                            zone.getId(),
                            zone.getCode(),
                            zone.getName(),
                            calculateMetrics(zoneUnits)
                    )
            );
        }

        return new ReportResponse(
                masterPlan.getId(),
                masterPlan.getName(),
                totals,
                zoneSummaries
        );
    }

    // ==========================================
    // 3. TÍNH TOÁN SỐ LIỆU
    // ==========================================
    //
    // AVAILABLE = chưa bán
    // SOLD      = đã bán
    // NOT_OPEN  = chưa mở bán
    //
    // Chỉ cộng actualSoldPrice khi căn SOLD.
    // Không lấy giá gốc làm giá thực tế.
    // Không lấy giá phương thức thanh toán
    // để thay cho giá bán thực tế.

    private StatusMetrics calculateMetrics(
            List<PropertyUnit> units
    ) {

        long available = 0;
        long sold = 0;
        long notOpen = 0;

        long soldWithPrice = 0;
        long soldMissingPrice = 0;

        BigDecimal recordedSoldValue =
                BigDecimal.ZERO;

        for (PropertyUnit unit : units) {

            UnitSaleStatus status =
                    unit.getSaleStatus();

            if (status == UnitSaleStatus.AVAILABLE) {

                available++;
            }

            else if (status == UnitSaleStatus.NOT_OPEN) {

                notOpen++;
            }

            else if (status == UnitSaleStatus.SOLD) {

                sold++;

                BigDecimal actualPrice =
                        unit.getActualSoldPrice();

                if (
                        actualPrice != null
                        && actualPrice.signum() >= 0
                ) {

                    soldWithPrice++;

                    recordedSoldValue =
                            recordedSoldValue.add(
                                    actualPrice
                            );

                } else {

                    soldMissingPrice++;
                }
            }
        }

        return new StatusMetrics(
                units.size(),
                available,
                sold,
                notOpen,
                soldWithPrice,
                soldMissingPrice,
                recordedSoldValue
        );
    }

    // ==========================================
    // 4. CẬP NHẬT GIÁ BÁN THỰC TẾ
    // ==========================================
    //
    // PUT
    // /api/agent/reports/units/{unitId}/actual-sold-price
    //
    // Body:
    // {
    //   "actualSoldPrice": 3500000000
    // }
    //
    // Nếu muốn xóa giá bán thực tế:
    // {
    //   "actualSoldPrice": null
    // }
    //
    // Chỉ cho phép nhập giá khi căn SOLD.
    // Không ảnh hưởng Polygon và thông tin khác.

    @PutMapping("/units/{unitId}/actual-sold-price")
    @Transactional
    public ActualSoldPriceResponse updateActualSoldPrice(
            @PathVariable Long unitId,
            @RequestBody ActualSoldPriceRequest request
    ) {

        if (request == null) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Thiếu dữ liệu giá bán thực tế."
            );
        }

        PropertyUnit unit =
                propertyUnitRepository
                        .findById(unitId)
                        .orElseThrow(() ->
                                new ResponseStatusException(
                                        HttpStatus.NOT_FOUND,
                                        "Không tìm thấy căn."
                                )
                        );

        BigDecimal price =
                request.actualSoldPrice();

        // Không cho ghi giá bán thực tế
        // nếu căn chưa ở trạng thái SOLD.
        // Vẫn cho phép xóa giá cũ bằng null.

        if (
                price != null
                && unit.getSaleStatus() != UnitSaleStatus.SOLD
        ) {

            throw new ResponseStatusException(
                    HttpStatus.CONFLICT,
                    "Chỉ được nhập giá bán thực tế "
                    + "cho căn có trạng thái Đã bán."
            );
        }

        if (price != null) {

            if (price.signum() < 0) {

                throw new ResponseStatusException(
                        HttpStatus.BAD_REQUEST,
                        "Giá bán thực tế không được âm."
                );
            }

            try {

                price = price.setScale(
                        2,
                        RoundingMode.UNNECESSARY
                );

            } catch (ArithmeticException ex) {

                throw new ResponseStatusException(
                        HttpStatus.BAD_REQUEST,
                        "Giá bán thực tế chỉ được "
                        + "tối đa 2 chữ số thập phân."
                );
            }

            // Khớp DECIMAL(19,2) trong Entity
            if (
                    price.compareTo(
                            BigDecimal.TEN.pow(17)
                    ) >= 0
            ) {

                throw new ResponseStatusException(
                        HttpStatus.BAD_REQUEST,
                        "Giá bán thực tế vượt quá giới hạn."
                );
            }
        }

        unit.setActualSoldPrice(price);

        PropertyUnit saved =
                propertyUnitRepository.saveAndFlush(unit);

        return new ActualSoldPriceResponse(
                saved.getId(),
                saved.getUnitCode(),
                saved.getSaleStatus(),
                saved.getActualSoldPrice()
        );
    }

    // ==========================================
    // 5. XUẤT DANH SÁCH CĂN RA CSV
    // ==========================================
    //
    // GET
    // /api/agent/reports/master-plans/{id}/export.csv
    //
    // File mở được bằng Excel.
    // UTF-8 BOM hỗ trợ tiếng Việt.
    //
    // Chỉ AGENT / ADMIN được tải.

    @GetMapping(
            value = "/master-plans/{masterPlanId}/export.csv",
            produces = "text/csv"
    )
    @Transactional(readOnly = true)
    public ResponseEntity<byte[]> exportCsv(
            @PathVariable Long masterPlanId
    ) {

        requireMasterPlan(masterPlanId);

        List<PropertyUnit> units =
                propertyUnitRepository
                        .findBySiteZone_MasterPlan_IdOrderByIdAsc(
                                masterPlanId
                        );

        StringBuilder csv = new StringBuilder();

        // UTF-8 BOM để Excel nhận tiếng Việt
        csv.append('\uFEFF');

        // Dòng tiêu đề
        appendCsvRow(
                csv,
                "ID",
                "Phân khu",
                "Mã căn",
                "Trạng thái",
                "Diện tích đất (m2)",
                "Hướng",
                "Diện tích sàn (m2)",
                "Kết cấu",
                "Giá gốc (VND)",
                "Thanh toán tiêu chuẩn (VND)",
                "Thanh toán sớm 70% (VND)",
                "Thanh toán sớm 95% (VND)",
                "Giá bán thực tế (VND)",
                "Cập nhật lúc"
        );

        // Xuất từng căn
        for (PropertyUnit unit : units) {

            SiteZone zone = unit.getSiteZone();

            appendCsvRow(
                    csv,

                    asText(unit.getId()),

                    asText(zone.getName()),

                    asText(unit.getUnitCode()),

                    statusLabel(unit.getSaleStatus()),

                    asText(unit.getLandArea()),

                    asText(unit.getDirection()),

                    asText(unit.getConstructionFloorArea()),

                    asText(unit.getStructureDescription()),

                    asText(unit.getBasePrice()),

                    asText(unit.getStandardPaymentPrice()),

                    asText(unit.getEarly70Price()),

                    asText(unit.getEarly95Price()),

                    asText(unit.getActualSoldPrice()),

                    formatDate(unit.getUpdatedAt())
            );
        }

        byte[] bytes = csv.toString()
                .getBytes(StandardCharsets.UTF_8);

        String fileName =
                "phugia-report-plan-"
                + masterPlanId
                + ".csv";

        return ResponseEntity
                .ok()
                .header(
                        HttpHeaders.CONTENT_DISPOSITION,
                        "attachment; filename=\"" + fileName + "\""
                )
                .contentType(
                        MediaType.parseMediaType(
                                "text/csv;charset=UTF-8"
                        )
                )
                .body(bytes);
    }

    // ==========================================
    // 6. TẠO MỘT DÒNG CSV
    // ==========================================

    private void appendCsvRow(
            StringBuilder csv,
            String... cells
    ) {

        for (int i = 0; i < cells.length; i++) {

            if (i > 0) {
                csv.append(',');
            }

            csv.append(
                    escapeCsv(cells[i])
            );
        }

        csv.append("\r\n");
    }

    // ==========================================
    // 7. ESCAPE CSV
    // ==========================================
    //
    // Dữ liệu người dùng có thể chứa dấu phẩy,
    // dấu nháy kép hoặc xuống dòng.
    //
    // Chặn chuỗi có thể bị Excel hiểu
    // thành công thức khi mở CSV.

    private String escapeCsv(String input) {

        String value = input == null ? "" : input;

        String start = value.stripLeading();

        if (
                start.startsWith("=")
                || start.startsWith("+")
                || start.startsWith("-")
                || start.startsWith("@")
        ) {

            value = "'" + value;
        }

        return "\"" +
                value.replace("\"", "\"\"") +
                "\"";
    }

    // ==========================================
    // 8. CHUYỂN DỮ LIỆU THÀNH CHUỖI
    // ==========================================

    private String asText(Object value) {

        if (value == null) {
            return "";
        }

        if (value instanceof BigDecimal number) {
            return number.toPlainString();
        }

        return value.toString();
    }

    // ==========================================
    // 9. NHÃN TRẠNG THÁI
    // ==========================================

    private String statusLabel(UnitSaleStatus status) {

        if (status == UnitSaleStatus.SOLD) {
            return "Đã bán";
        }

        if (status == UnitSaleStatus.AVAILABLE) {
            return "Chưa bán";
        }

        if (status == UnitSaleStatus.NOT_OPEN) {
            return "Chưa mở bán";
        }

        return "Không xác định";
    }

    // ==========================================
    // 10. ĐỊNH DẠNG NGÀY CẬP NHẬT
    // ==========================================

    private String formatDate(LocalDateTime value) {

        if (value == null) {
            return "";
        }

        return DATE_FORMAT.format(value);
    }

    // ==========================================
    // 11. KIỂM TRA MẶT BẰNG
    // ==========================================

    private MasterPlan requireMasterPlan(Long id) {

        return masterPlanRepository
                .findById(id)
                .orElseThrow(() ->
                        new ResponseStatusException(
                                HttpStatus.NOT_FOUND,
                                "Không tìm thấy mặt bằng."
                        )
                );
    }
}
