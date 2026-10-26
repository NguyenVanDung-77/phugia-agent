package com.phugia.backend.repository;

import com.phugia.backend.entity.PropertyUnit;
import com.phugia.backend.enums.UnitSaleStatus;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface PropertyUnitRepository
        extends JpaRepository<PropertyUnit, Long> {

    // =========================================
    // LẤY CĂN THEO PHÂN KHU
    // =========================================

    List<PropertyUnit> findBySiteZone_IdOrderByIdAsc(
            Long siteZoneId
    );


    // =========================================
    // LẤY TẤT CẢ CĂN THUỘC MỘT MẶT BẰNG
    // =========================================

    List<PropertyUnit>
    findBySiteZone_MasterPlan_IdOrderByIdAsc(
            Long masterPlanId
    );


    // =========================================
    // LỌC CĂN THEO TRẠNG THÁI
    // =========================================

    List<PropertyUnit> findBySaleStatus(
            UnitSaleStatus saleStatus
    );


    // =========================================
    // ĐẾM SỐ CĂN THEO TRẠNG THÁI
    // =========================================

    long countBySaleStatus(
            UnitSaleStatus saleStatus
    );


    // =========================================
    // LẤY CĂN THEO PHÂN KHU VÀ TRẠNG THÁI
    // =========================================

    List<PropertyUnit> findBySiteZone_IdAndSaleStatus(
            Long siteZoneId,
            UnitSaleStatus saleStatus
    );

}