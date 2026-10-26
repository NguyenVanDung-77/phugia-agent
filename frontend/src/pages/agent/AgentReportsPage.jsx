
import { useEffect, useMemo, useState } from "react";
import { api, API_BASE, TOKEN_KEY } from "../../api/client";
import PageLayout from "../../components/PageLayout";

const STATUS_CARDS = [
  { key: "totalUnits", label: "Tổng căn đã lưu", color: "#a5c3b0" },
  { key: "soldUnits", label: "Đã bán", color: "#efaaaa" },
  { key: "availableUnits", label: "Chưa bán", color: "#dce4df" },
  { key: "notOpenUnits", label: "Chưa mở bán", color: "#f5d56e" },
];

// ==========================================
// ĐỊNH DẠNG SỐ TIỀN
// ==========================================

function money(value) {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return "Chưa nhập";
  }

  const match = String(value).match(
    /^(\d+)(?:\.(\d+))?$/
  );

  if (!match) return String(value);

  const integer = match[1].replace(
    /\B(?=(\d{3})+(?!\d))/g,
    "."
  );

  const fraction = (match[2] || "").replace(
    /0+$/,
    ""
  );

  return (
    integer +
    (fraction ? `,${fraction}` : "") +
    " ₫"
  );
}

// ==========================================
// TÍNH PHẦN TRĂM
// ==========================================

function percent(part, total) {
  if (!total) return 0;

  return Math.max(
    0,
    Math.min(
      100,
      (Number(part || 0) / Number(total)) * 100
    )
  );
}

// ==========================================
// KIỂM TRA GIÁ BÁN
// ==========================================

function validatePrice(raw) {
  const value = String(raw ?? "")
    .trim()
    .replace(",", ".");

  if (!/^\d+(?:\.\d{1,2})?$/.test(value)) {
    throw new Error(
      "Chỉ nhập số không âm, tối đa 2 chữ số thập phân; không dùng dấu phân cách hàng nghìn."
    );
  }

  const integer =
    value.split(".")[0].replace(/^0+/, "") || "0";

  if (integer.length > 17) {
    throw new Error(
      "Giá bán vượt giới hạn cho phép."
    );
  }

  return value;
}

// ==========================================
// BIỂU ĐỒ TỶ LỆ BÁN THEO PHÂN KHU
// ==========================================

function ZoneRateChart({
  zones,
  selectedZone,
  onSelect,
}) {
  return (
    <div
      className="panel"
      style={{ marginBottom: 16 }}
    >
      <h2>Tỷ lệ căn đã bán theo phân khu</h2>

      <p className="muted small">
        Tỷ lệ tính trên số căn đã được khoanh
        và lưu trong MySQL, không phải toàn bộ
        số căn của dự án. Nhấn vào một phân khu
        để lọc báo cáo.
      </p>

      {zones.length === 0 && (
        <p className="muted">
          Chưa có phân khu để thống kê.
        </p>
      )}

      <div
        style={{
          display: "grid",
          gap: 12,
          marginTop: 12,
        }}
      >
        {zones.map((zone) => {
          const total =
            zone.metrics.totalUnits || 0;

          const sold =
            zone.metrics.soldUnits || 0;

          const soldRate = percent(
            sold,
            total
          );

          const chosen =
            String(selectedZone) ===
            String(zone.zoneId);

          return (
            <button
              key={zone.zoneId}
              type="button"
              onClick={() =>
                onSelect(
                  chosen
                    ? "ALL"
                    : String(zone.zoneId)
                )
              }
              aria-pressed={chosen}
              style={{
                textAlign: "left",
                width: "100%",
                padding: 12,
                background: chosen
                  ? "#eef8f0"
                  : "#ffffff",
                border: chosen
                  ? "2px solid #348656"
                  : "1px solid #d8e3dc",
                borderRadius: 10,
                cursor: "pointer",
              }}
            >
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  justifyContent:
                    "space-between",
                  gap: 8,
                  marginBottom: 8,
                }}
              >
                <strong>
                  {zone.zoneName}
                </strong>

                <span>
                  {sold}/{total} căn đã bán
                  {" · "}
                  <b>
                    {soldRate.toFixed(1)}%
                  </b>
                </span>
              </div>

              <div
                role="progressbar"
                aria-label={`Tỷ lệ căn đã bán phân khu ${zone.zoneName}`}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={Number(
                  soldRate.toFixed(1)
                )}
                style={{
                  height: 15,
                  borderRadius: 9,
                  background: "#e7ece8",
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    height: "100%",
                    width: `${soldRate}%`,
                    background: "#e9a4a4",
                  }}
                />
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ==========================================
// TRANG BÁO CÁO AGENT
// ==========================================

export default function AgentReportsPage() {
  const [plans, setPlans] = useState([]);
  const [planId, setPlanId] = useState("");

  const [summary, setSummary] =
    useState(null);

  const [soldUnits, setSoldUnits] =
    useState([]);

  const [zoneFilter, setZoneFilter] =
    useState("ALL");

  const [priceFilter, setPriceFilter] =
    useState("ALL");

  const [search, setSearch] = useState("");

  const [draftPrices, setDraftPrices] =
    useState({});

  const [reloadCount, setReloadCount] =
    useState(0);

  const [loading, setLoading] =
    useState(false);

  const [savingId, setSavingId] =
    useState(null);

  const [exporting, setExporting] =
    useState(false);

  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  // ========================================
  // 1. TẢI DANH SÁCH MẶT BẰNG
  // ========================================

  useEffect(() => {
    let active = true;

    api("/api/public/master-plans")
      .then((items) => {
        if (!active) return;

        const list = Array.isArray(items)
          ? items
          : [];

        setPlans(list);

        if (list.length) {
          setPlanId(
            String(list[0].id)
          );
        } else {
          setError(
            "Chưa có mặt bằng để thống kê."
          );
        }
      })
      .catch((err) => {
        if (active) {
          setError(
            `Không thể tải danh sách mặt bằng: ${err.message}`
          );
        }
      });

    return () => {
      active = false;
    };
  }, []);

  // ========================================
  // 2. LẤY THỐNG KÊ TỪ MYSQL
  // ========================================

  useEffect(() => {
    if (!planId) return;

    let active = true;

    const path =
      `/api/agent/reports/master-plans/${planId}`;

    Promise.all([
      api(`${path}/summary`),
      api(`${path}/sold-units`),
    ])
      .then(([report, units]) => {
        if (!active) return;

        setSummary(report);

        setSoldUnits(
          Array.isArray(units)
            ? units
            : []
        );

        setDraftPrices({});
        setError("");
      })
      .catch((err) => {
        if (!active) return;

        setSummary(null);
        setSoldUnits([]);

        setError(
          `Không thể tải báo cáo: ${err.message}`
        );
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [planId, reloadCount]);

  // ========================================
  // 3. THỐNG KÊ THEO PHÂN KHU
  // ========================================

  const zones = useMemo(
    () => summary?.zones || [],
    [summary]
  );

  const activeZone = zones.find(
    (zone) =>
      String(zone.zoneId) === zoneFilter
  );

  const metrics =
    activeZone?.metrics || summary?.totals;

  const activeZoneName =
    activeZone?.zoneName ||
    "Toàn bộ mặt bằng";

  // ========================================
  // 4. LỌC DANH SÁCH CĂN ĐÃ BÁN
  // ========================================

  const filteredUnits = useMemo(() => {
    const term = search
      .trim()
      .toLocaleLowerCase("vi-VN");

    return soldUnits.filter((unit) => {
      // Lọc phân khu
      if (
        zoneFilter !== "ALL" &&
        unit.zoneCode !==
          zones.find(
            (z) =>
              String(z.zoneId) ===
              zoneFilter
          )?.zoneCode
      ) {
        return false;
      }

      // Chỉ căn thiếu giá
      if (
        priceFilter === "MISSING" &&
        unit.actualSoldPrice !== null &&
        unit.actualSoldPrice !== undefined
      ) {
        return false;
      }

      // Chỉ căn đã có giá
      if (
        priceFilter === "HAS_PRICE" &&
        (
          unit.actualSoldPrice === null ||
          unit.actualSoldPrice === undefined
        )
      ) {
        return false;
      }

      return (
        !term ||
        `${
          unit.unitCode || ""
        } ${
          unit.zoneName || ""
        } ${
          unit.id
        }`
          .toLocaleLowerCase("vi-VN")
          .includes(term)
      );
    });
  }, [
    soldUnits,
    zones,
    zoneFilter,
    priceFilter,
    search,
  ]);

  // ========================================
  // 5. LÀM MỚI BÁO CÁO
  // ========================================

  function refresh() {
    if (
      !planId ||
      loading ||
      savingId !== null
    ) {
      return;
    }

    setNotice("");
    setError("");
    setLoading(true);

    setReloadCount(
      (count) => count + 1
    );
  }

  // ========================================
  // 6. ĐỔI MẶT BẰNG
  // ========================================

  function changePlan(nextId) {
    setPlanId(nextId);

    setSummary(null);
    setSoldUnits([]);

    setZoneFilter("ALL");
    setPriceFilter("ALL");
    setSearch("");
    setDraftPrices({});

    setNotice("");
    setError("");

    setLoading(true);
  }

  // ========================================
  // 7. LƯU HOẶC XÓA GIÁ BÁN THỰC TẾ
  // ========================================

  async function savePrice(
    unit,
    remove = false
  ) {
    if (
      savingId !== null ||
      loading
    ) {
      return;
    }

    let price = null;

    if (!remove) {
      try {
        price = validatePrice(
          draftPrices[unit.id] ??
          unit.actualSoldPrice
        );
      } catch (err) {
        setError(
          `Căn ${
            unit.unitCode || `#${unit.id}`
          }: ${err.message}`
        );
        return;
      }
    } else if (
      !window.confirm(
        `Xóa giá bán thực tế của căn ${
          unit.unitCode || `#${unit.id}`
        }?`
      )
    ) {
      return;
    }

    setSavingId(unit.id);
    setError("");
    setNotice("");

    try {
      await api(
        `/api/agent/reports/units/${unit.id}/actual-sold-price`,
        {
          method: "PUT",
          body: JSON.stringify({
            actualSoldPrice: price,
          }),
        }
      );

      setNotice(
        `Đã ${
          remove ? "xóa" : "lưu"
        } giá bán thực tế căn ${
          unit.unitCode || `#${unit.id}`
        }.`
      );

      setLoading(true);

      setReloadCount(
        (count) => count + 1
      );
    } catch (err) {
      setError(
        `Không thể cập nhật giá: ${err.message}`
      );
    } finally {
      setSavingId(null);
    }
  }

  // ========================================
  // 8. XUẤT BÁO CÁO CSV
  // ========================================

  async function exportCsv() {
    if (!planId || exporting) return;

    setExporting(true);
    setError("");

    try {
      const token =
        sessionStorage.getItem(TOKEN_KEY);

      if (!token) {
        throw new Error(
          "Bạn cần đăng nhập lại."
        );
      }

      const response = await fetch(
        `${API_BASE.replace(
          /\/$/,
          ""
        )}/api/agent/reports/master-plans/${planId}/export.csv`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error(
          `Không thể xuất CSV (HTTP ${response.status}).`
        );
      }

      const blob =
        await response.blob();

      const url =
        URL.createObjectURL(blob);

      const link =
        document.createElement("a");

      link.href = url;

      link.download =
        `phugia-report-plan-${planId}.csv`;

      document.body.appendChild(link);

      link.click();
      link.remove();

      setTimeout(
        () => URL.revokeObjectURL(url),
        1000
      );
    } catch (err) {
      setError(err.message);
    } finally {
      setExporting(false);
    }
  }

  // ========================================
  // 9. GIAO DIỆN
  // ========================================

  return (
    <PageLayout
      title="Báo cáo bán hàng – Agent"
      subtitle="Thống kê trạng thái căn, tỷ lệ bán và giá trị bán ghi nhận từ MySQL."
    >
      {error && (
        <div
          role="alert"
          className="error-box"
        >
          {error}
        </div>
      )}

      {notice && (
        <div className="notice-box">
          {notice}
        </div>
      )}

      {/* CHỌN MẶT BẰNG */}
      <div
        className="panel"
        style={{
          display: "flex",
          gap: 12,
          alignItems: "end",
          flexWrap: "wrap",
          marginBottom: 16,
        }}
      >
        <label
          style={{
            minWidth: 220,
            flex: "1 1 220px",
          }}
        >
          Mặt bằng

          <select
            value={planId}
            onChange={(e) =>
              changePlan(e.target.value)
            }
            disabled={
              loading ||
              savingId !== null
            }
            style={{ marginTop: 6 }}
          >
            {plans.map((plan) => (
              <option
                key={plan.id}
                value={String(plan.id)}
              >
                {plan.name}
              </option>
            ))}
          </select>
        </label>

        <button
          type="button"
          className="btn btn-outline"
          onClick={refresh}
          disabled={
            loading ||
            !planId ||
            savingId !== null
          }
        >
          {loading
            ? "Đang tải..."
            : "Làm mới số liệu"}
        </button>

        <button
          type="button"
          className="btn btn-primary"
          onClick={exportCsv}
          disabled={
            exporting ||
            !planId
          }
        >
          {exporting
            ? "Đang xuất..."
            : "Xuất CSV toàn mặt bằng"}
        </button>
      </div>

      {loading && (
        <div className="notice-box">
          Đang tải số liệu báo cáo...
        </div>
      )}

      {summary && metrics && (
        <>

          {/* BỘ LỌC PHÂN KHU */}
          <div
            className="panel"
            style={{ marginBottom: 16 }}
          >
            <label htmlFor="report-zone-filter">
              Lọc thống kê theo phân khu
            </label>

            <select
              id="report-zone-filter"
              style={{
                maxWidth: 360,
                marginTop: 8,
              }}
              value={zoneFilter}
              onChange={(e) =>
                setZoneFilter(e.target.value)
              }
            >
              <option value="ALL">
                Toàn bộ mặt bằng
              </option>

              {zones.map((zone) => (
                <option
                  key={zone.zoneId}
                  value={String(zone.zoneId)}
                >
                  {zone.zoneName}
                </option>
              ))}
            </select>

            <p
              className="muted small"
              style={{ marginTop: 8 }}
            >
              Đang xem:{" "}
              <b>{activeZoneName}</b>
            </p>
          </div>

          {/* BỐN THẺ THỐNG KÊ */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns:
                "repeat(auto-fit, minmax(165px, 1fr))",
              gap: 12,
              marginBottom: 16,
            }}
          >
            {STATUS_CARDS.map((card) => (
              <div
                key={card.key}
                className="panel"
                style={{
                  borderTop:
                    `5px solid ${card.color}`,
                }}
              >
                <div className="muted small">
                  {card.label}
                </div>

                <div
                  style={{
                    fontSize: 30,
                    fontWeight: 800,
                    color: "#194d35",
                  }}
                >
                  {metrics[card.key] ?? 0}
                </div>
              </div>
            ))}
          </div>

          {/* BIỂU ĐỒ TRẠNG THÁI */}
          <div
            className="panel"
            style={{ marginBottom: 16 }}
          >
            <h2>
              Tiến độ bán – {activeZoneName}
            </h2>

            <div
              style={{
                fontSize: 25,
                fontWeight: 800,
                color: "#205b40",
                marginBottom: 8,
              }}
            >
              {percent(
                metrics.soldUnits,
                metrics.totalUnits
              ).toFixed(1)}
              % căn đã bán
            </div>

            <div
              style={{
                display: "flex",
                height: 21,
                borderRadius: 12,
                overflow: "hidden",
                background: "#e9efeb",
                border:
                  "1px solid #cedbd2",
              }}
            >
              <div
                title="Đã bán"
                style={{
                  width: `${percent(
                    metrics.soldUnits,
                    metrics.totalUnits
                  )}%`,
                  background: "#efaaaa",
                }}
              />

              <div
                title="Chưa bán"
                style={{
                  width: `${percent(
                    metrics.availableUnits,
                    metrics.totalUnits
                  )}%`,
                  background: "#ffffff",
                }}
              />

              <div
                title="Chưa mở bán"
                style={{
                  width: `${percent(
                    metrics.notOpenUnits,
                    metrics.totalUnits
                  )}%`,
                  background: "#f5d56e",
                }}
              />
            </div>

            <p
              className="muted small"
              style={{ marginTop: 9 }}
            >
              Đỏ nhạt: đã bán · Trắng: chưa bán
              · Vàng: chưa mở bán. Chỉ tính
              những căn đã lưu trong MySQL.
            </p>

            <h3 style={{ marginTop: 16 }}>
              Giá trị bán ghi nhận
            </h3>

            <div
              style={{
                fontSize: 26,
                fontWeight: 800,
                color: "#205b40",
              }}
            >
              {money(
                metrics.recordedSoldValue ??
                  "0"
              )}
            </div>

            <p className="muted small">
              {metrics.soldWithActualPrice ?? 0}
              {" "}căn đã bán có giá thực tế;
              {" "}
              {metrics.soldMissingActualPrice ?? 0}
              {" "}căn còn thiếu giá.
              Đây là giá trị ghi nhận,
              không phải tiền đã thu.
            </p>
          </div>

          {/* BIỂU ĐỒ RUBY / SAPPHIRE / CRYSTAL */}
          <ZoneRateChart
            zones={zones}
            selectedZone={zoneFilter}
            onSelect={setZoneFilter}
          />

          {/* BẢNG THEO PHÂN KHU */}
          <div
            className="panel"
            style={{ marginBottom: 16 }}
          >
            <h2>
              Bảng thống kê từng phân khu
            </h2>

            <div className="scroll-x">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Phân khu</th>
                    <th>Tổng căn</th>
                    <th>Đã bán</th>
                    <th>Chưa bán</th>
                    <th>Chưa mở bán</th>
                    <th>Tỷ lệ bán</th>
                    <th>Thiếu giá</th>
                    <th>Giá trị bán ghi nhận</th>
                  </tr>
                </thead>

                <tbody>
                  {zones.map((zone) => (
                    <tr key={zone.zoneId}>
                      <td>
                        <b>
                          {zone.zoneName}
                        </b>
                      </td>

                      <td>
                        {zone.metrics.totalUnits}
                      </td>

                      <td>
                        {zone.metrics.soldUnits}
                      </td>

                      <td>
                        {zone.metrics.availableUnits}
                      </td>

                      <td>
                        {zone.metrics.notOpenUnits}
                      </td>

                      <td>
                        {percent(
                          zone.metrics.soldUnits,
                          zone.metrics.totalUnits
                        ).toFixed(1)}
                        %
                      </td>

                      <td>
                        {zone.metrics.soldMissingActualPrice}
                      </td>

                      <td>
                        {money(
                          zone.metrics.recordedSoldValue
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* QUẢN LÝ GIÁ BÁN THỰC TẾ */}
          <div className="panel">
            <h2>
              Giá bán thực tế của căn đã bán
              {" ("}
              {filteredUnits.length}
              /
              {soldUnits.length}
              {")"}
            </h2>

            <p className="muted small">
              Chỉ căn đã bán mới được nhập
              giá thực tế. Bộ lọc dưới đây
              chỉ ảnh hưởng bảng đang xem;
              nút CSV xuất toàn bộ mặt bằng.
            </p>

            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: 10,
                margin: "12px 0",
              }}
            >
              <input
                type="search"
                value={search}
                onChange={(e) =>
                  setSearch(e.target.value)
                }
                placeholder="Tìm mã căn, ID hoặc phân khu"
                style={{
                  minWidth: 210,
                  flex: "2 1 210px",
                }}
              />

              <select
                value={priceFilter}
                onChange={(e) =>
                  setPriceFilter(e.target.value)
                }
                style={{
                  minWidth: 180,
                  flex: "1 1 180px",
                }}
              >
                <option value="ALL">
                  Tất cả giá
                </option>

                <option value="MISSING">
                  Chưa có giá thực tế
                </option>

                <option value="HAS_PRICE">
                  Đã có giá thực tế
                </option>
              </select>
            </div>

            <div className="scroll-x">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Căn</th>
                    <th>Phân khu</th>
                    <th>Giá đang lưu</th>
                    <th>Nhập giá mới (VNĐ)</th>
                    <th>Thao tác</th>
                  </tr>
                </thead>

                <tbody>
                  {filteredUnits.map((unit) => {
                    const current = String(
                      unit.actualSoldPrice ?? ""
                    );

                    const input =
                      draftPrices[unit.id] ??
                      current;

                    const busy =
                      loading ||
                      savingId !== null;

                    return (
                      <tr key={unit.id}>
                        <td>
                          <b>
                            {unit.unitCode ||
                              `Căn #${unit.id}`}
                          </b>
                          {" "}
                          <small>
                            ID {unit.id}
                          </small>
                        </td>

                        <td>
                          {unit.zoneName}
                        </td>

                        <td>
                          {money(
                            unit.actualSoldPrice
                          )}
                        </td>

                        <td>
                          <input
                            type="text"
                            inputMode="decimal"
                            aria-label={`Giá bán thực tế căn ${
                              unit.unitCode ||
                              unit.id
                            }`}
                            placeholder="Ví dụ: 3500000000"
                            value={input}
                            onChange={(e) =>
                              setDraftPrices(
                                (old) => ({
                                  ...old,
                                  [unit.id]:
                                    e.target.value,
                                })
                              )
                            }
                            disabled={busy}
                            style={{
                              minWidth: 180,
                            }}
                          />
                        </td>

                        <td>
                          <div
                            style={{
                              display: "flex",
                              gap: 7,
                              flexWrap: "wrap",
                            }}
                          >
                            <button
                              type="button"
                              className="btn btn-primary"
                              disabled={
                                busy ||
                                !input.trim() ||
                                input === current
                              }
                              onClick={() =>
                                savePrice(unit)
                              }
                            >
                              {savingId === unit.id
                                ? "Đang lưu..."
                                : "Lưu giá"}
                            </button>

                            <button
                              type="button"
                              className="btn btn-outline"
                              disabled={
                                busy ||
                                unit.actualSoldPrice ==
                                  null
                              }
                              onClick={() =>
                                savePrice(
                                  unit,
                                  true
                                )
                              }
                            >
                              Xóa giá
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}

                  {filteredUnits.length === 0 && (
                    <tr>
                      <td
                        colSpan={5}
                        style={{
                          textAlign: "center",
                        }}
                      >
                        Không có căn phù hợp.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </PageLayout>
  );
}
