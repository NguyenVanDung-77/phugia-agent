package com.phugia.backend.controller;

import com.phugia.backend.dto.PublicMapResponse;
import com.phugia.backend.dto.PublicUnitDetailResponse;

import com.phugia.backend.service.PublicMapService;

import lombok.RequiredArgsConstructor;

import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/public")
@RequiredArgsConstructor

@CrossOrigin(origins = {
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "https://phugia-frontend.onrender.com"
})
public class PublicMapController {

    private final PublicMapService publicMapService;


    // =====================================================
    // DANH SÁCH MẶT BẰNG
    // GET /api/public/master-plans
    // =====================================================

    @GetMapping("/master-plans")
    public List<PublicMapResponse.MasterPlanSummary>
    getMasterPlans() {

        return publicMapService.getActiveMasterPlans();
    }


    // =====================================================
    // XEM ẢNH MẶT BẰNG VÀ TOẠ ĐỘ CÁC CĂN
    // GET /api/public/master-plans/{id}/map
    // =====================================================

    @GetMapping("/master-plans/{masterPlanId}/map")
    public PublicMapResponse getMasterPlanMap(
            @PathVariable Long masterPlanId
    ) {

        return publicMapService.getMasterPlanMap(
                masterPlanId
        );
    }


    // =====================================================
    // XEM CHI TIẾT CĂN
    // GET /api/public/units/{id}
    // =====================================================

    @GetMapping("/units/{unitId}")
    public PublicUnitDetailResponse getUnitDetail(
            @PathVariable Long unitId
    ) {

        return publicMapService.getUnitDetail(unitId);
    }
}