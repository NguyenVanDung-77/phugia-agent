
package com.phugia.backend.controller;

import com.phugia.backend.service.AgentDraftService;

import lombok.RequiredArgsConstructor;

import org.springframework.security.access.prepost.PreAuthorize;

import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/agent/master-plans")
@RequiredArgsConstructor
@PreAuthorize("hasAnyRole('AGENT', 'ADMIN')")
public class AgentDraftController {

    private final AgentDraftService agentDraftService;

    // ============================================
    // XEM CÁC CĂN ĐÃ LƯU TRONG MYSQL
    // ============================================

    // GET /api/agent/master-plans/1/units

    @GetMapping("/{masterPlanId}/units")
    public List<AgentDraftService.UnitResponse> getUnits(
            @PathVariable Long masterPlanId
    ) {

        return agentDraftService.getUnits(
                masterPlanId
        );
    }

    // ============================================
    // NHẬP BẢN NHÁP POLYGON CỦA AGENT
    // ============================================

    // POST /api/agent/master-plans/1/import-draft

    @PostMapping("/{masterPlanId}/import-draft")
    public AgentDraftService.ImportResponse importDraft(
            @PathVariable Long masterPlanId,

            @RequestBody
            AgentDraftService.ImportRequest request
    ) {

        return agentDraftService.importDraft(
                masterPlanId,
                request
        );
    }
}
