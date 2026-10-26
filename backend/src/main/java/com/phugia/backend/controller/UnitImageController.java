
package com.phugia.backend.controller;

import com.phugia.backend.entity.PropertyUnit;
import com.phugia.backend.repository.PropertyUnitRepository;

import lombok.RequiredArgsConstructor;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.CacheControl;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

import javax.imageio.ImageIO;
import javax.imageio.ImageReader;
import javax.imageio.stream.ImageInputStream;

import java.awt.image.BufferedImage;
import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardOpenOption;
import java.util.Iterator;
import java.util.UUID;
import java.util.concurrent.TimeUnit;

@RestController
@RequiredArgsConstructor
public class UnitImageController {

    private final PropertyUnitRepository unitRepository;

    // ==========================================
    // CẤU HÌNH ẢNH
    // ==========================================

    private static final long MAX_FILE_SIZE =
            5L * 1024 * 1024;

    private static final long MAX_PIXELS =
            12_000_000L;

    @Value(
        "${app.unit-images.directory:uploads/unit-images}"
    )
    private String uploadDirectory;

    // Local: http://localhost:8080
    // Khi triển khai online, đặt PUBLIC_BACKEND_URL
    // thành tên miền HTTPS của backend.

    @Value(
        "${PUBLIC_BACKEND_URL:http://localhost:8080}"
    )
    private String publicBackendUrl;

    // ==========================================
    // 1. UPLOAD ẢNH CHO CĂN ĐÃ LƯU MYSQL
    // ==========================================
    //
    // POST /api/agent/units/{unitId}/image
    //
    // Body: multipart/form-data
    // Trường file: file
    //
    // Chỉ AGENT / ADMIN được upload.

    @PostMapping(
        value = "/api/agent/units/{unitId}/image",
        consumes = MediaType.MULTIPART_FORM_DATA_VALUE
    )
    @PreAuthorize("hasAnyRole('AGENT', 'ADMIN')")
    public UploadResponse uploadUnitImage(
            @PathVariable Long unitId,
            @RequestParam("file") MultipartFile file
    ) {

        PropertyUnit unit = unitRepository
                .findById(unitId)
                .orElseThrow(() ->
                    new ResponseStatusException(
                        HttpStatus.NOT_FOUND,
                        "Không tìm thấy căn."
                    )
                );

        // ======================================
        // KIỂM TRA FILE
        // ======================================

        if (file == null || file.isEmpty()) {
            throw new ResponseStatusException(
                HttpStatus.BAD_REQUEST,
                "Vui lòng chọn ảnh."
            );
        }

        if (file.getSize() > MAX_FILE_SIZE) {
            throw new ResponseStatusException(
                HttpStatus.PAYLOAD_TOO_LARGE,
                "Ảnh không được vượt quá 5 MB."
            );
        }

        try {

            byte[] imageBytes = file.getBytes();

            // Xác minh định dạng bằng dữ liệu ảnh,
            // không tin đuôi file do người dùng gửi.
            String extension =
                    validateAndGetExtension(imageBytes);

            // Tên ngẫu nhiên, tránh trùng tên file.
            String fileName =
                    UUID.randomUUID()
                            .toString()
                            .replace("-", "")
                    + extension;

            Path folder = getUploadFolder();

            Files.createDirectories(folder);

            Path destination =
                    folder.resolve(fileName).normalize();

            // Đảm bảo file nằm trong thư mục upload.
            if (!destination.startsWith(folder)) {
                throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Đường dẫn ảnh không hợp lệ."
                );
            }

            // Không ghi đè file khác.
            Files.write(
                destination,
                imageBytes,
                StandardOpenOption.CREATE_NEW,
                StandardOpenOption.WRITE
            );

            // URL ảnh công khai.
            String baseUrl =
                    publicBackendUrl
                            .trim()
                            .replaceAll("/+$", "");

            if (
                !baseUrl.matches(
                    "https?://[^/\\s?#]+"
                )
            ) {
                Files.deleteIfExists(destination);

                throw new ResponseStatusException(
                    HttpStatus.INTERNAL_SERVER_ERROR,
                    "PUBLIC_BACKEND_URL chưa hợp lệ."
                );
            }

            String imageUrl =
                    baseUrl
                    + "/api/public/unit-images/"
                    + fileName;

            // ==================================
            // LƯU URL ẢNH VÀO MYSQL
            // ==================================

            unit.setImageUrl(imageUrl);

            try {
                unitRepository.saveAndFlush(unit);
            } catch (RuntimeException ex) {
                // Nếu lưu DB lỗi thì xóa file mới.
                try {
                    Files.deleteIfExists(destination);
                } catch (IOException ignored) {
                    // Lỗi dọn dẹp không được che lỗi DB.
                }
                throw ex;
            }

            return new UploadResponse(
                    unit.getId(),
                    imageUrl,
                    imageBytes.length,
                    extension.equals(".png")
                            ? "image/png"
                            : "image/jpeg"
            );

        } catch (IOException ex) {

            throw new ResponseStatusException(
                HttpStatus.INTERNAL_SERVER_ERROR,
                "Không thể lưu ảnh lên máy chủ.",
                ex
            );
        }
    }

    // ==========================================
    // 2. XEM ẢNH ĐÃ UPLOAD
    // ==========================================
    //
    // GET /api/public/unit-images/{fileName}
    //
    // User không cần đăng nhập để trình duyệt
    // tải được ảnh trong phần chi tiết căn.
    //
    // API chi tiết căn đã bán vẫn được bảo vệ
    // bởi PublicMapService như trước.

    @GetMapping(
        "/api/public/unit-images/{fileName:.+}"
    )
    public ResponseEntity<byte[]> getUnitImage(
            @PathVariable String fileName
    ) {

        // Chỉ chấp nhận tên UUID do hệ thống tạo.
        if (
            !fileName.matches(
                "[a-f0-9]{32}\\.(jpg|png)"
            )
        ) {
            throw new ResponseStatusException(
                HttpStatus.NOT_FOUND,
                "Không tìm thấy ảnh."
            );
        }

        Path folder = getUploadFolder();

        Path imagePath =
                folder.resolve(fileName).normalize();

        if (
            !imagePath.startsWith(folder)
            || !Files.isRegularFile(imagePath)
        ) {
            throw new ResponseStatusException(
                HttpStatus.NOT_FOUND,
                "Không tìm thấy ảnh."
            );
        }

        try {

            byte[] bytes =
                    Files.readAllBytes(imagePath);

            MediaType mediaType =
                    fileName.endsWith(".png")
                            ? MediaType.IMAGE_PNG
                            : MediaType.IMAGE_JPEG;

            return ResponseEntity
                    .ok()
                    .contentType(mediaType)
                    .header(
                        "X-Content-Type-Options",
                        "nosniff"
                    )
                    .cacheControl(
                        CacheControl
                                .maxAge(
                                    7,
                                    TimeUnit.DAYS
                                )
                                .cachePublic()
                    )
                    .body(bytes);

        } catch (IOException ex) {

            throw new ResponseStatusException(
                HttpStatus.INTERNAL_SERVER_ERROR,
                "Không thể đọc ảnh.",
                ex
            );
        }
    }

    // ==========================================
    // 3. KIỂM TRA ẢNH JPG / PNG
    // ==========================================

    private String validateAndGetExtension(
            byte[] bytes
    ) {

        if (
            bytes == null
            || bytes.length == 0
            || bytes.length > MAX_FILE_SIZE
        ) {
            throw new ResponseStatusException(
                HttpStatus.BAD_REQUEST,
                "Dung lượng ảnh không hợp lệ."
            );
        }

        try (
            ByteArrayInputStream input =
                    new ByteArrayInputStream(bytes);

            ImageInputStream imageInput =
                    ImageIO.createImageInputStream(input)
        ) {

            if (imageInput == null) {
                throw invalidImage();
            }

            Iterator<ImageReader> readers =
                    ImageIO.getImageReaders(imageInput);

            if (!readers.hasNext()) {
                throw invalidImage();
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

                String extension;

                switch (format) {
                    case "jpeg", "jpg" ->
                            extension = ".jpg";

                    case "png" ->
                            extension = ".png";

                    default ->
                            throw invalidImage();
                }

                int width = reader.getWidth(0);
                int height = reader.getHeight(0);

                if (
                    width <= 0
                    || height <= 0
                    || (long) width * height
                            > MAX_PIXELS
                ) {
                    throw new ResponseStatusException(
                        HttpStatus.BAD_REQUEST,
                        "Kích thước ảnh quá lớn."
                    );
                }

                // Giải mã để phát hiện ảnh hỏng.
                BufferedImage decoded =
                        reader.read(0);

                if (decoded == null) {
                    throw invalidImage();
                }

                return extension;

            } finally {
                reader.dispose();
            }

        } catch (ResponseStatusException ex) {
            throw ex;

        } catch (IOException | RuntimeException ex) {
            throw invalidImage();
        }
    }

    // ==========================================
    // 4. THƯ MỤC LƯU ẢNH
    // ==========================================

    private Path getUploadFolder() {
        return Path.of(uploadDirectory)
                .toAbsolutePath()
                .normalize();
    }

    // ==========================================
    // 5. LỖI ẢNH KHÔNG HỢP LỆ
    // ==========================================

    private ResponseStatusException invalidImage() {
        return new ResponseStatusException(
            HttpStatus.BAD_REQUEST,
            "Ảnh không hợp lệ. Chỉ hỗ trợ JPG và PNG."
        );
    }

    // ==========================================
    // 6. RESPONSE UPLOAD
    // ==========================================

    public record UploadResponse(
            Long unitId,
            String imageUrl,
            long fileSize,
            String contentType
    ) {
    }
}
