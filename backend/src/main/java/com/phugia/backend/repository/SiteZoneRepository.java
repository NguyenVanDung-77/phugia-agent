package com.phugia.backend.repository;

import com.phugia.backend.entity.SiteZone;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface SiteZoneRepository
        extends JpaRepository<SiteZone, Long> {

    // Lấy các phân khu theo mặt bằng
    List<SiteZone> findByMasterPlan_IdOrderBySortOrderAscIdAsc(
            Long masterPlanId
    );

    // Tìm phân khu theo mặt bằng và mã phân khu
    Optional<SiteZone> findByMasterPlan_IdAndCode(
            Long masterPlanId,
            String code
    );

    // Kiểm tra mã phân khu đã tồn tại hay chưa
    boolean existsByMasterPlan_IdAndCode(
            Long masterPlanId,
            String code
    );

}