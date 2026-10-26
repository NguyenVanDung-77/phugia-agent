
import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  Link,
  useLocation,
  useNavigate,
} from "react-router";

import { api } from "../../api/client";
import PageLayout from "../../components/PageLayout";
import MapCanvas, {
  parsePoints,
} from "../../components/MapCanvas";

const ORDER = ["RUBY", "SAPPHIRE", "CRYSTAL"];

const STATUS = {
  AVAILABLE: "Chưa bán",
  NOT_OPEN: "Chưa mở bán",
  SOLD: "Đã bán",
};

function zoneBounds(zone) {
  const boundary = parsePoints(zone?.polygonJson);

  if (boundary.length >= 3) {
    return boundary;
  }

  const points = (zone?.units || []).flatMap(
    (unit) => parsePoints(unit.polygonJson)
  );

  if (points.length < 3) return [];

  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);

  return [
    { x: Math.min(...xs), y: Math.min(...ys) },
    { x: Math.max(...xs), y: Math.min(...ys) },
    { x: Math.max(...xs), y: Math.max(...ys) },
    { x: Math.min(...xs), y: Math.max(...ys) },
  ];
}

export default function UserPage() {
  const navigate = useNavigate();
  const location = useLocation();

  const previous = location.state || {};

  const [plans, setPlans] = useState([]);
  const [planId, setPlanId] = useState(
    previous.planId || null
  );

  const [map, setMap] = useState(null);
  const [zoneId, setZoneId] = useState(
    previous.zoneId || "ALL"
  );

  const [search, setSearch] = useState(
    previous.search || ""
  );

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reload, setReload] = useState(0);
  const [mapVersion, setMapVersion] = useState(0);
  const [focusTarget, setFocusTarget] = useState(null);

  const sequence = useRef(0);

  // ====================================
  // TẢI DANH SÁCH MẶT BẰNG
  // ====================================

  useEffect(() => {
    let active = true;

    api("/api/public/master-plans")
      .then((data) => {
        if (!active) return;

        const list = Array.isArray(data) ? data : [];

        setPlans(list);

        setPlanId((old) =>
          list.some((p) => String(p.id) === String(old))
            ? old
            : list[0]?.id || null
        );

        if (!list.length) {
          setLoading(false);
        }
      })
      .catch((err) => {
        if (!active) return;

        setError(err.message);
        setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  // ====================================
  // TẢI BẢN ĐỒ VÀ POLYGON
  // ====================================

  useEffect(() => {
    if (!planId) return undefined;

    let active = true;

    api(`/api/public/master-plans/${planId}/map`)
      .then((data) => {
        if (!active) return;

        setMap(data);
        setError("");
      })
      .catch((err) => {
        if (active) setError(err.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [planId, reload]);

  // ====================================
  // SẮP XẾP PHÂN KHU
  // ====================================

  const zones = useMemo(
    () =>
      (map?.zones || []).slice().sort((a, b) => {
        const aIndex = ORDER.indexOf(
          String(a.code).toUpperCase()
        );

        const bIndex = ORDER.indexOf(
          String(b.code).toUpperCase()
        );

        return (
          (aIndex < 0 ? 99 : aIndex) -
          (bIndex < 0 ? 99 : bIndex)
        );
      }),
    [map]
  );

  const visibleZones = zones.filter(
    (zone) =>
      zoneId === "ALL" ||
      String(zone.id) === String(zoneId)
  );

  const activeZone = zones.find(
    (zone) => String(zone.id) === String(zoneId)
  );

  const units = visibleZones.flatMap((zone) =>
    (zone.units || []).map((unit) => ({
      ...unit,
      zoneCode: zone.code,
      zoneName: zone.name,
    }))
  );

  const allCount = zones.reduce(
    (sum, zone) => sum + (zone.units || []).length,
    0
  );

  const counts = {
    AVAILABLE: units.filter(
      (unit) => unit.saleStatus === "AVAILABLE"
    ).length,

    NOT_OPEN: units.filter(
      (unit) => unit.saleStatus === "NOT_OPEN"
    ).length,

    SOLD: units.filter(
      (unit) => unit.saleStatus === "SOLD"
    ).length,
  };

  // ====================================
  // DANH SÁCH CĂN ĐƯỢC XEM
  // ====================================

  const keyword = search
    .trim()
    .toLocaleLowerCase("vi-VN");

  const groups = visibleZones.map((zone) => ({
    ...zone,

    selectable: (zone.units || [])
      .filter(
        (unit) =>
          unit.saleStatus !== "SOLD" &&
          unit.clickable !== false
      )
      .filter(
        (unit) =>
          !keyword ||
          String(unit.unitCode || "")
            .toLocaleLowerCase("vi-VN")
            .includes(keyword)
      )
      .sort((a, b) =>
        String(a.unitCode || "").localeCompare(
          String(b.unitCode || ""),
          "vi",
          { numeric: true }
        )
      ),
  }));

  const selectableCount = groups.reduce(
    (sum, group) => sum + group.selectable.length,
    0
  );

  // ====================================
  // LỌC PHÂN KHU VÀ TỰ PHÓNG
  // ====================================

  function chooseZone(id) {
    setZoneId(id);
    setSearch("");

    if (id === "ALL") {
      setFocusTarget(null);
      setMapVersion((old) => old + 1);
      return;
    }

    const zone = zones.find(
      (item) => String(item.id) === String(id)
    );

    const points = zoneBounds(zone);

    setFocusTarget(
      points.length >= 3
        ? {
            points,
            key: ++sequence.current,
          }
        : null
    );
  }

  // ====================================
  // MỞ TRANG CHI TIẾT CĂN
  // ====================================

  function openDetail(unit) {
    if (
      !unit ||
      !unit.id ||
      unit.saleStatus === "SOLD" ||
      unit.clickable === false
    ) {
      return;
    }

    navigate(`/user/units/${unit.id}`, {
      state: {
        planId,
        zoneId,
        search,
      },
    });
  }

  // ====================================
  // LÀM MỚI
  // ====================================

  function refresh() {
    if (!planId || loading) return;

    setLoading(true);
    setError("");
    setMap(null);
    setFocusTarget(null);

    setMapVersion((old) => old + 1);
    setReload((old) => old + 1);
  }

  // ====================================
  // GIAO DIỆN TRANG USER
  // ====================================

  return (
    <PageLayout title="Mặt bằng dự án">
      <div className="ux-page">
        {/* TIÊU ĐỀ */}
        <div className="ux-toolbar">
          <div className="ux-toolbar-title">
            <span className="ux-eyebrow">
              PHÚ GIA ROYAL PARK · QUY NHƠN
            </span>
            <h1>Mặt bằng tương tác</h1>
          </div>

          <div className="ux-toolbar-actions">
            {plans.length > 1 && (
              <select
                aria-label="Chọn mặt bằng"
                value={planId ?? ""}
                onChange={(event) => {
                  setPlanId(Number(event.target.value));
                  setZoneId("ALL");
                  setMap(null);
                  setFocusTarget(null);
                  setLoading(true);
                }}
              >
                {plans.map((plan) => (
                  <option key={plan.id} value={plan.id}>
                    {plan.name}
                  </option>
                ))}
              </select>
            )}

            <button
              type="button"
              className="ux-refresh"
              disabled={!planId || loading}
              onClick={refresh}
            >
              ↻ Làm mới
            </button>
          </div>
        </div>

        {error && (
          <div className="error-box" role="alert">
            {error}
          </div>
        )}

        {loading ? (
          <div className="ux-state" role="status">
            <span className="ux-spinner" />
            <strong>Đang tải mặt bằng...</strong>
          </div>
        ) : !map ? (
          <div className="ux-state">
            <strong>Chưa có mặt bằng để hiển thị.</strong>
            <p>Kiểm tra kết nối Backend và thử lại.</p>
          </div>
        ) : (
          <>
            {/* CHỌN PHÂN KHU */}
            <div
              className="ux-zones"
              role="group"
              aria-label="Chọn phân khu"
            >
              <button
                type="button"
                className={`ux-zone ${
                  zoneId === "ALL" ? "active" : ""
                }`}
                onClick={() => chooseZone("ALL")}
              >
                <span className="ux-zone-name">
                  Toàn bộ
                </span>

                <span className="ux-zone-count">
                  {allCount}
                </span>
              </button>

              {zones.map((zone) => (
                <button
                  type="button"
                  key={zone.id}
                  className={`ux-zone ux-zone-${String(
                    zone.code
                  ).toLowerCase()} ${
                    String(zone.id) === String(zoneId)
                      ? "active"
                      : ""
                  }`}
                  onClick={() =>
                    chooseZone(String(zone.id))
                  }
                >
                  <span className="ux-zone-name">
                    {zone.name}
                  </span>

                  <span className="ux-zone-count">
                    {(zone.units || []).length}
                  </span>
                </button>
              ))}
            </div>

            {/* TRẠNG THÁI */}
            <div className="ux-statusbar">
              <div className="ux-status-location">
                ⌖ {activeZone?.name || "Toàn bộ dự án"}

                <span>
                  {units.length} căn
                </span>
              </div>

              <div className="ux-status-list">
                {Object.keys(STATUS).map((key) => (
                  <div className="ux-status" key={key}>
                    <i
                      className={`ux-dot ${
                        key === "AVAILABLE"
                          ? "available"
                          : key === "SOLD"
                            ? "sold"
                            : "not-open"
                      }`}
                    />

                    <span>{STATUS[key]}</span>
                    <strong>{counts[key]}</strong>
                  </div>
                ))}
              </div>
            </div>

            <div className="ux-workspace">
              {/* BẢN ĐỒ */}
              <section className="ux-map-panel">
                <div className="ux-panel-heading">
                  <div>
                    <strong>Bản đồ dự án</strong>
                    <span>
                      Chọn căn chưa bán hoặc chưa mở bán
                      để xem trang chi tiết riêng.
                    </span>
                  </div>
                </div>

                <div className="ux-map-surface">
                  <MapCanvas
                    key={`${planId}-${mapVersion}`}
                    imageUrl={map.imageUrl}
                    expectedWidth={map.imageWidth}
                    expectedHeight={map.imageHeight}
                    units={units}
                    mode="view"
                    focusTarget={focusTarget}
                    onUnitClick={openDetail}
                  />
                </div>

                <div className="ux-map-hint">
                  Kéo bản đồ để di chuyển · Dùng +/−
                  hoặc cuộn chuột để phóng to.
                </div>
              </section>

              {/* DANH SÁCH CĂN */}
              <aside className="ux-side-panel">
                <div className="ux-side-top">
                  <div className="ux-side-heading">
                    <div>
                      <span className="ux-eyebrow">
                        DANH SÁCH CĂN
                      </span>

                      <h2>
                        {activeZone?.name || "Tất cả căn"}
                      </h2>
                    </div>

                    <span className="ux-result-count">
                      {selectableCount} căn
                    </span>
                  </div>

                  <label className="ux-search">
                    <span aria-hidden="true">⌕</span>

                    <input
                      type="search"
                      value={search}
                      placeholder="Tìm mã căn..."
                      aria-label="Tìm mã căn"
                      onChange={(event) =>
                        setSearch(event.target.value)
                      }
                    />
                  </label>

                  <div className="ux-unit-list">
                    {groups.map((group) => (
                      <section
                        className="ux-unit-group"
                        key={group.id}
                      >
                        <div className="ux-group-heading">
                          <span>{group.name}</span>

                          <small>
                            {group.selectable.length} căn
                          </small>
                        </div>

                        {group.selectable.map((unit) => (
                          <Link
                            key={unit.id}
                            className="ux-unit"
                            to={`/user/units/${unit.id}`}
                            state={{
                              planId,
                              zoneId,
                              search,
                            }}
                            aria-label={`Xem chi tiết căn ${
                              unit.unitCode || unit.id
                            }`}
                          >
                            <span className="ux-unit-mark">
                              ⌂
                            </span>

                            <span className="ux-unit-body">
                              <strong>
                                {unit.unitCode ||
                                  `Căn #${unit.id}`}
                              </strong>

                              <small>
                                <i
                                  className={`ux-dot ${
                                    unit.saleStatus ===
                                    "AVAILABLE"
                                      ? "available"
                                      : "not-open"
                                  }`}
                                />

                                {STATUS[unit.saleStatus] ||
                                  "Chưa cập nhật"}
                              </small>
                            </span>

                            <span aria-hidden="true">→</span>
                          </Link>
                        ))}

                        {!group.selectable.length && (
                          <p className="ux-empty-result">
                            Không có căn phù hợp.
                          </p>
                        )}

                        {(group.units || []).some(
                          (unit) =>
                            unit.saleStatus === "SOLD"
                        ) && (
                          <p className="ux-sold-hint">
                            {(group.units || []).filter(
                              (unit) =>
                                unit.saleStatus === "SOLD"
                            ).length}{" "}
                            căn đã bán, không mở chi tiết
                          </p>
                        )}
                      </section>
                    ))}
                  </div>
                </div>
              </aside>
            </div>
          </>
        )}
      </div>
    </PageLayout>
  );
}
