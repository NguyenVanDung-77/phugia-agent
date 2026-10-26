
package com.phugia.backend.data;

import com.phugia.backend.entity.MasterPlan;
import com.phugia.backend.entity.SiteZone;

import com.phugia.backend.repository.MasterPlanRepository;
import com.phugia.backend.repository.SiteZoneRepository;

import lombok.RequiredArgsConstructor;

import org.springframework.boot.CommandLineRunner;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.util.Objects;

@Component
@RequiredArgsConstructor
@ConditionalOnProperty(
        name = "app.seed.master-plan",
        havingValue = "true"
)
public class MasterPlanDataInitializer implements CommandLineRunner {

    private final MasterPlanRepository masterPlanRepository;
    private final SiteZoneRepository siteZoneRepository;

    private static final String PLAN_NAME =
            "Phú Gia Royal Park - Quy Nhơn";

    private static final String IMAGE_URL =
            "/images/phu-gia-master-plan.png";

    // Kích thước thực tế Agent đã đọc được
    private static final int IMAGE_WIDTH = 2560;
    private static final int IMAGE_HEIGHT = 1810;

    @Override
    @Transactional
    public void run(String... args) {

        MasterPlan masterPlan = masterPlanRepository
                .findAll()
                .stream()
                .filter(plan -> PLAN_NAME.equals(plan.getName()))
                .findFirst()
                .orElse(null);

        if (masterPlan == null) {

            masterPlan = new MasterPlan();

            masterPlan.setName(PLAN_NAME);
            masterPlan.setImageUrl(IMAGE_URL);
            masterPlan.setImageWidth(IMAGE_WIDTH);
            masterPlan.setImageHeight(IMAGE_HEIGHT);
            masterPlan.setActive(true);

            masterPlan = masterPlanRepository.save(masterPlan);

            System.out.println(
                    "Da tao mat bang Phu Gia Royal Park."
            );

        } else {

            // Cập nhật thông số ảnh nếu đã khởi tạo trước đó.
            // Không xóa dữ liệu mặt bằng hoặc các phân khu.
            boolean needsUpdate =
                    !Objects.equals(
                            masterPlan.getImageUrl(),
                            IMAGE_URL
                    )
                    || !Objects.equals(
                            masterPlan.getImageWidth(),
                            IMAGE_WIDTH
                    )
                    || !Objects.equals(
                            masterPlan.getImageHeight(),
                            IMAGE_HEIGHT
                    );

            if (needsUpdate) {

                masterPlan.setImageUrl(IMAGE_URL);
                masterPlan.setImageWidth(IMAGE_WIDTH);
                masterPlan.setImageHeight(IMAGE_HEIGHT);

                masterPlan = masterPlanRepository.save(masterPlan);

                System.out.println(
                        "Da dong bo kich thuoc anh goc: "
                        + IMAGE_WIDTH + " x " + IMAGE_HEIGHT
                );
            }
        }

        createZoneIfNotExists(
                masterPlan, "RUBY", "Ruby", 1
        );

        createZoneIfNotExists(
                masterPlan, "SAPPHIRE", "Sapphire", 2
        );

        createZoneIfNotExists(
                masterPlan, "CRYSTAL", "Crystal", 3
        );

        System.out.println(
                "Mat bang Phu Gia da san sang."
        );
    }

    private void createZoneIfNotExists(
            MasterPlan masterPlan,
            String code,
            String name,
            int sortOrder
    ) {

        boolean exists = siteZoneRepository
                .existsByMasterPlan_IdAndCode(
                        masterPlan.getId(),
                        code
                );

        if (exists) {
            return;
        }

        SiteZone zone = new SiteZone();

        zone.setMasterPlan(masterPlan);
        zone.setCode(code);
        zone.setName(name);
        zone.setSortOrder(sortOrder);

        zone.setDescription(
                "Phân khu " + name
                + " thuộc dự án Phú Gia Royal Park"
        );

        // Tọa độ phân khu sẽ được Agent thiết lập sau.
        zone.setPolygonJson(null);

        siteZoneRepository.save(zone);

        System.out.println(
                "Da tao phan khu: " + name
        );
    }
}
