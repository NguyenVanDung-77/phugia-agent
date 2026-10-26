package com.phugia.backend.repository;

import com.phugia.backend.entity.MasterPlan;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface MasterPlanRepository
        extends JpaRepository<MasterPlan, Long> {

    // Lấy danh sách mặt bằng đang hoạt động
    List<MasterPlan> findByActiveTrueOrderByIdAsc();

}