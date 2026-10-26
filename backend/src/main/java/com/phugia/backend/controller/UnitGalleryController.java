
package com.phugia.backend.controller;

import com.phugia.backend.entity.PropertyUnit;
import com.phugia.backend.enums.UnitSaleStatus;
import com.phugia.backend.repository.PropertyUnitRepository;

import lombok.RequiredArgsConstructor;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

import javax.imageio.ImageIO;
import javax.imageio.ImageReader;
import javax.imageio.stream.ImageInputStream;

import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardOpenOption;
import java.util.ArrayList;
import java.util.Iterator;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.UUID;

@RestController
@RequiredArgsConstructor
public class UnitGalleryController {

    // ==========================================
    // CẤU HÌNH
    // ==========================================

    private static final long MAX_FILE_SIZE =
            5L * 1024 * 1024;

    private static final long MAX_PIXELS =
            12_000_000L;

    private static final int MAX_IMAGES_PER_UNIT = 20;

    private static final int MAX_FILES_PER_REQUEST = 4;

    private final PropertyUnitRepository propertyUnitRepository;

    @Value(
        "${app.unit-images.directory:uploads/unit-images}"
    )
    private String uploadDirectory;

    // ==========================================
    // RESPONSE
    // ==========================================

    public record GalleryImage(
            int index,
            String imageUrl
    ) {
    }

    public record GalleryResponse(
            Long unitId,
            List<GalleryImage> images
    ) {
    }

    // ==========================================
    // 1. AGENT XEM TẤT CẢ ẢNH CỦA CĂN
    // ==========================================
    //
    // GET /api/agent/units/{id}/gallery

    @GetMapping("/api/agent/units/{unitId}/gallery")
    @PreAuthorize("hasAnyRole('AGENT', 'ADMIN')")
    @Transactional(readOnly = true)
    public GalleryResponse getGallery(
            @PathVariable Long unitId
    ) {

        PropertyUnit unit = findUnit(unitId);

        return toResponse(unit);
    }

    // ==========================================
    // 2. AGENT TẢI NHIỀU ẢNH
    // ==========================================
    //
    // POST /api/agent/units/{id}/gallery
    //
    // multipart/form-data
    // Tên trường: files
    //
    // Mỗi lần tối đa 4 ảnh.
    // Tổng tối đa 20 ảnh mỗi căn.
    //
    // Không ghi đè ảnh cũ.

    @PostMapping(
        value = "/api/agent/units/{unitId}/gallery",
        consumes = MediaType.MULTIPART_FORM_DATA_VALUE
    )
    @PreAuthorize("hasAnyRole('AGENT', 'ADMIN')")
    @Transactional
    public GalleryResponse uploadPhotos(
            @PathVariable Long unitId,
            @RequestParam("files") List<MultipartFile> files
    ) {

        PropertyUnit unit = findUnit(unitId);

        if (
                files == null
                || files.isEmpty()
                || files.size() > MAX_FILES_PER_REQUEST
        ) {
            throw error(
                    HttpStatus.BAD_REQUEST,
                    "Chọn từ 1 đến 4 ảnh mỗi lần tải lên."
            );
        }

        if (
                allUrls(unit).size() + files.size()
                        > MAX_IMAGES_PER_UNIT
        ) {
            throw error(
                    HttpStatus.BAD_REQUEST,
                    "Mỗi căn được lưu tối đa 20 ảnh."
            );
        }

        // ======================================
        // KIỂM TRA TẤT CẢ ẢNH TRƯỚC
        // ======================================

        List<byte[]> contents = new ArrayList<>();

        List<String> extensions = new ArrayList<>();

        try {

            for (MultipartFile file : files) {

                if (
                        file == null
                        || file.isEmpty()
                        || file.getSize() > MAX_FILE_SIZE
                ) {
                    throw error(
                            HttpStatus.BAD_REQUEST,
                            "Mỗi ảnh phải lớn hơn 0 và không quá 5 MB."
                    );
                }

                byte[] bytes = file.getBytes();

                extensions.add(
                        validateImage(bytes)
                );

                contents.add(bytes);
            }

        } catch (IOException ex) {

            throw error(
                    HttpStatus.BAD_REQUEST,
                    "Không thể đọc tệp ảnh."
            );
        }

        // ======================================
        // LƯU FILE VÀO BACKEND
        // ======================================

        Path folder = Path
                .of(uploadDirectory)
                .toAbsolutePath()
                .normalize();

        List<Path> createdFiles =
                new ArrayList<>();

        try {

            Files.createDirectories(folder);

            for (int i = 0; i < contents.size(); i++) {

                String name =
                        UUID.randomUUID()
                                .toString()
                                .replace("-", "")
                        + extensions.get(i);

                Path destination =
                        folder.resolve(name).normalize();

                if (!destination.startsWith(folder)) {
                    throw error(
                            HttpStatus.BAD_REQUEST,
                            "Đường dẫn ảnh không hợp lệ."
                    );
                }

                Files.write(
                        destination,
                        contents.get(i),
                        StandardOpenOption.CREATE_NEW
                );

                createdFiles.add(destination);

                // Đường dẫn tương đối để tránh
                // cố định địa chỉ localhost:8080.
                String imageUrl =
                        "/api/public/unit-images/"
                        + name;

                // Thêm ảnh mới vào danh sách
                // mà không xóa ảnh trước đó.
                unit.getImageUrls().add(imageUrl);

                // Nếu chưa có ảnh đại diện,
                // dùng ảnh đầu tiên vừa tải lên.
                if (
                        unit.getImageUrl() == null
                        || unit.getImageUrl().isBlank()
                ) {
                    unit.setImageUrl(imageUrl);
                }
            }

            propertyUnitRepository.saveAndFlush(unit);

            return toResponse(unit);

        } catch (IOException | RuntimeException ex) {

            // Nếu có lỗi, cố gắng xóa các file
            // vừa ghi trong yêu cầu này.
            for (Path path : createdFiles) {
                try {
                    Files.deleteIfExists(path);
                } catch (IOException ignored) {
                    // Không che lỗi gốc.
                }
            }

            throw ex instanceof ResponseStatusException responseError
                    ? responseError
                    : error(
                            HttpStatus.INTERNAL_SERVER_ERROR,
                            "Không thể lưu ảnh căn."
                    );
        }
    }

    // ==========================================
    // 3. AGENT XÓA MỘT ẢNH
    // ==========================================
    //
    // DELETE
    // /api/agent/units/{id}/gallery/{index}
    //
    // Xóa liên kết ảnh trong MySQL.
    // Không thay đổi Polygon.
    //
    // Giữ file vật lý để có thể khôi phục
    // nếu cần thiết.

    @DeleteMapping(
        "/api/agent/units/{unitId}/gallery/{index}"
    )
    @PreAuthorize("hasAnyRole('AGENT', 'ADMIN')")
    @Transactional
    public GalleryResponse removePhoto(
            @PathVariable Long unitId,
            @PathVariable int index
    ) {

        PropertyUnit unit = findUnit(unitId);

        List<String> urls = allUrls(unit);

        if (
                index < 0
                || index >= urls.size()
        ) {
            throw error(
                    HttpStatus.NOT_FOUND,
                    "Ảnh không còn tồn tại."
            );
        }

        String removed = urls.get(index);

        // Xóa khỏi danh sách nhiều ảnh.
        unit.getImageUrls().removeIf(
                url -> removed.equals(url)
        );

        // Nếu xóa ảnh đại diện thì chọn
        // ảnh còn lại làm đại diện.
        if (removed.equals(unit.getImageUrl())) {

            unit.setImageUrl(null);

            List<String> remaining = allUrls(unit);

            if (!remaining.isEmpty()) {
                unit.setImageUrl(remaining.get(0));
            }
        }

        propertyUnitRepository.saveAndFlush(unit);

        return toResponse(unit);
    }

    // ==========================================
    // 4. USER XEM DANH SÁCH ẢNH
    // ==========================================
    //
    // GET /api/public/units/{id}/gallery
    //
    // Chỉ căn chưa bán / chưa mở bán.
    // Căn đã bán trả 404.

    @GetMapping(
        "/api/public/units/{unitId}/gallery"
    )
    @Transactional(readOnly = true)
    public GalleryResponse publicGallery(
            @PathVariable Long unitId
    ) {

        PropertyUnit unit = findUnit(unitId);

        boolean active = Boolean.TRUE.equals(
                unit.getSiteZone()
                        .getMasterPlan()
                        .getActive()
        );

        if (
                !active
                || unit.getSaleStatus()
                        == UnitSaleStatus.SOLD
        ) {
            throw error(
                    HttpStatus.NOT_FOUND,
                    "Căn không khả dụng."
            );
        }

        return toResponse(unit);
    }

    // ==========================================
    // 5. TÌM CĂN THEO ID
    // ==========================================

    private PropertyUnit findUnit(Long unitId) {

        return propertyUnitRepository
                .findById(unitId)
                .orElseThrow(() ->
                        error(
                                HttpStatus.NOT_FOUND,
                                "Không tìm thấy căn."
                        )
                );
    }

    // ==========================================
    // 6. GỘP ẢNH CŨ VÀ ẢNH MỚI
    // ==========================================
    //
    // imageUrl: ảnh lưu từ phiên bản trước.
    // imageUrls: danh sách ảnh mới.
    //
    // LinkedHashSet bảo đảm không trùng URL
    // và vẫn giữ thứ tự ảnh.

    private List<String> allUrls(
            PropertyUnit unit
    ) {

        LinkedHashSet<String> urls =
                new LinkedHashSet<>();

        if (
                unit.getImageUrl() != null
                && !unit.getImageUrl().isBlank()
        ) {
            urls.add(unit.getImageUrl());
        }

        for (String url : unit.getImageUrls()) {

            if (
                    url != null
                    && !url.isBlank()
            ) {
                urls.add(url);
            }
        }

        return new ArrayList<>(urls);
    }

    // ==========================================
    // 7. TRẢ VỀ DANH SÁCH ẢNH
    // ==========================================

    private GalleryResponse toResponse(
            PropertyUnit unit
    ) {

        List<String> urls = allUrls(unit);

        List<GalleryImage> images =
                new ArrayList<>();

        for (int i = 0; i < urls.size(); i++) {

            images.add(
                    new GalleryImage(
                            i,
                            urls.get(i)
                    )
            );
        }

        return new GalleryResponse(
                unit.getId(),
                images
        );
    }

    // ==========================================
    // 8. KIỂM TRA FILE ẢNH
    // ==========================================

    private String validateImage(
            byte[] bytes
    ) {

        if (
                bytes == null
                || bytes.length == 0
                || bytes.length > MAX_FILE_SIZE
        ) {
            throw error(
                    HttpStatus.BAD_REQUEST,
                    "Ảnh vượt quá 5 MB."
            );
        }

        try (
            ImageInputStream imageInput =
                    ImageIO.createImageInputStream(
                            new ByteArrayInputStream(bytes)
                    )
        ) {

            if (imageInput == null) {
                throw error(
                        HttpStatus.BAD_REQUEST,
                        "Không phải tệp ảnh."
                );
            }

            Iterator<ImageReader> readers =
                    ImageIO.getImageReaders(imageInput);

            if (!readers.hasNext()) {
                throw error(
                        HttpStatus.BAD_REQUEST,
                        "Ảnh không hợp lệ."
                );
            }

            ImageReader reader = readers.next();

            try {

                reader.setInput(
                        imageInput,
                        true,
                        true
                );

                String format =
                        reader.getFormatName()
                                .toLowerCase();

                String extension = switch (format) {

                    case "jpeg", "jpg" -> ".jpg";

                    case "png" -> ".png";

                    default -> throw error(
                            HttpStatus.BAD_REQUEST,
                            "Chỉ chấp nhận JPG và PNG."
                    );
                };

                int width = reader.getWidth(0);

                int height = reader.getHeight(0);

                if (
                        width < 1
                        || height < 1
                        || (long) width * height > MAX_PIXELS
                ) {
                    throw error(
                            HttpStatus.BAD_REQUEST,
                            "Kích thước ảnh quá lớn."
                    );
                }

                if (reader.read(0) == null) {
                    throw error(
                            HttpStatus.BAD_REQUEST,
                            "Ảnh bị hỏng."
                    );
                }

                return extension;

            } finally {

                reader.dispose();
            }

        } catch (ResponseStatusException ex) {

            throw ex;

        } catch (IOException | RuntimeException ex) {

            throw error(
                    HttpStatus.BAD_REQUEST,
                    "Không đọc được ảnh JPG/PNG."
            );
        }
    }

    // ==========================================
    // 9. TRẢ VỀ LỖI HTTP
    // ==========================================

    private ResponseStatusException error(
            HttpStatus code,
            String message
    ) {

        return new ResponseStatusException(
                code,
                message
        );
    }
}
