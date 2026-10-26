import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  Stage,
  Layer,
  Image as KonvaImage,
  Line,
  Circle,
  Text as KonvaText,
} from "react-konva";

import { api } from "../../api/client";
import PageLayout from "../../components/PageLayout";
import { parsePoints } from "../../components/MapCanvas";


const ZONE_CODES = [
  "RUBY",
  "SAPPHIRE",
  "CRYSTAL",
];

function coords(points) {
  return points.flatMap((p) => [p.x, p.y]);
}

// ==========================================
// BẢN ĐỒ KHOANH PHÂN KHU DÀNH CHO AGENT
// ==========================================

function ZoneDrawingMap({
  map,
  selectedCode,
  draft,
  drawing,
  onPoint,
  focusKey,
}) {
  const containerRef = useRef(null);
  const stageRef = useRef(null);

  const [size, setSize] = useState({
    width: 0,
    height: 0,
  });

  const [image, setImage] = useState(null);
  const [imageError, setImageError] = useState("");

  const [view, setView] = useState({
    x: 0,
    y: 0,
    scale: 1,
  });

  const initialized = useRef(false);

  // ========================================
  // 1. TẢI ẢNH MẶT BẰNG GỐC
  // ========================================

  useEffect(() => {
    let active = true;
    const img = new window.Image();

    img.onload = () => {
      if (active) {
        setImage(img);
        setImageError("");
      }
    };

    img.onerror = () => {
      if (active) {
        setImage(null);
        setImageError(
          "Không tải được ảnh mặt bằng gốc."
        );
      }
    };

    img.src = map.imageUrl;
    initialized.current = false;

    return () => {
      active = false;
    };
  }, [map.imageUrl]);

  // ========================================
  // 2. KÍCH THƯỚC KHUNG BẢN ĐỒ
  // ========================================

  useEffect(() => {
    const element = containerRef.current;

    if (!element) return undefined;

    const observer = new ResizeObserver(
      ([entry]) => {
        setSize({
          width: Math.max(
            1,
            Math.round(entry.contentRect.width)
          ),

          height: Math.max(
            1,
            Math.round(entry.contentRect.height)
          ),
        });
      }
    );

    observer.observe(element);

    return () => observer.disconnect();
  }, []);

  const width =
    image?.naturalWidth ||
    map.imageWidth ||
    2560;

  const height =
    image?.naturalHeight ||
    map.imageHeight ||
    1810;

  const fit = Math.min(
    size.width / width || 1,
    size.height / height || 1
  );

  // ========================================
  // 3. ĐẶT ẢNH VỪA KHUNG
  // ========================================

  useEffect(() => {
    if (
      !image ||
      !size.width ||
      !size.height ||
      initialized.current
    ) {
      return;
    }

    initialized.current = true;

    setView({
      scale: fit,

      x:
        (size.width - width * fit) / 2,

      y:
        (size.height - height * fit) / 2,
    });
  }, [
    image,
    size.width,
    size.height,
    fit,
    width,
    height,
  ]);

  // ========================================
  // 4. PHÓNG ĐẾN RANH GIỚI ĐÃ LƯU
  // ========================================

  const zone = map.zones.find(
    (item) => item.code === selectedCode
  );

  const vertices = parsePoints(
    zone?.polygonJson
  );

  useEffect(() => {
    if (
      !image ||
      !size.width ||
      !size.height ||
      focusKey === 0 ||
      vertices.length < 3
    ) {
      return;
    }

    const xs = vertices.map((p) => p.x);
    const ys = vertices.map((p) => p.y);

    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);

    const scale = Math.max(
      fit,

      Math.min(
        fit * 20,

        (size.width * 0.72) /
          Math.max(1, maxX - minX),

        (size.height * 0.72) /
          Math.max(1, maxY - minY)
      )
    );

    const frame = window.requestAnimationFrame(
      () => {
        setView({
          scale,

          x:
            size.width / 2 -
            ((minX + maxX) / 2) * scale,

          y:
            size.height / 2 -
            ((minY + maxY) / 2) * scale,
        });
      }
    );

    return () =>
      window.cancelAnimationFrame(frame);

    // focusKey chỉ thay đổi khi chọn vùng cần phóng.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    focusKey,
    image,
    size.width,
    size.height,
  ]);

  // ========================================
  // 5. RESET ZOOM
  // ========================================

  function resetView() {
    initialized.current = true;

    setView({
      scale: fit,

      x:
        (size.width - width * fit) / 2,

      y:
        (size.height - height * fit) / 2,
    });
  }

  // ========================================
  // 6. ZOOM THEO VỊ TRÍ CON TRỎ
  // ========================================

  function zoom(factor, pointer) {
    const stage = stageRef.current;

    if (!stage || !pointer) return;

    const oldScale = stage.scaleX();

    const newScale = Math.min(
      fit * 20,

      Math.max(
        fit,
        oldScale * factor
      )
    );

    const imageX =
      (pointer.x - stage.x()) / oldScale;

    const imageY =
      (pointer.y - stage.y()) / oldScale;

    setView({
      scale: newScale,

      x:
        pointer.x - imageX * newScale,

      y:
        pointer.y - imageY * newScale,
    });
  }

  // ========================================
  // 7. THÊM ĐIỂM RANH GIỚI
  // ========================================

  function addVertex() {
    if (!drawing || !image) return;

    const stage = stageRef.current;
    const cursor = stage?.getPointerPosition();

    if (!cursor) return;

    const x =
      (cursor.x - stage.x()) / stage.scaleX();

    const y =
      (cursor.y - stage.y()) / stage.scaleY();

    if (
      x < 0 ||
      y < 0 ||
      x > width ||
      y > height
    ) {
      return;
    }

    onPoint({
      x: Math.round(x * 10) / 10,
      y: Math.round(y * 10) / 10,
    });
  }

  // ========================================
  // 8. GIAO DIỆN BẢN ĐỒ
  // ========================================

  return (
    <div
      className="panel"
      style={{ minWidth: 0 }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 8,
          marginBottom: 10,
        }}
      >
        <strong style={{ flex: 1 }}>
          Mặt bằng gốc – Agent xem ranh giới
        </strong>

        <button
          className="btn btn-outline"
          type="button"
          onClick={() =>
            zoom(1 / 1.25, {
              x: size.width / 2,
              y: size.height / 2,
            })
          }
        >
          −
        </button>

        <span>
          {Math.round(
            (view.scale / fit) * 100
          ) || 100}%
        </span>

        <button
          className="btn btn-outline"
          type="button"
          onClick={() =>
            zoom(1.25, {
              x: size.width / 2,
              y: size.height / 2,
            })
          }
        >
          +
        </button>

        <button
          className="btn btn-outline"
          type="button"
          onClick={resetView}
        >
          Vừa màn hình
        </button>
      </div>

      {imageError && (
        <div className="error-box">
          {imageError}
        </div>
      )}

      {image &&
        (
          width !== map.imageWidth ||
          height !== map.imageHeight
        ) && (
          <div className="error-box">
            Ảnh gốc không khớp kích thước
            đã lưu MySQL. Không nên khoanh
            khi ảnh chưa đồng bộ.
          </div>
        )}

      <div
        ref={containerRef}
        style={{
          width: "100%",
          height: "min(70vh, 720px)",
          minHeight: 380,
          background: "#e8ede8",
          borderRadius: 10,
          overflow: "hidden",
          touchAction: "none",

          cursor: drawing
            ? "crosshair"
            : "grab",
        }}
      >
        {image &&
          size.width > 0 &&
          size.height > 0 && (
          <Stage
            ref={stageRef}
            width={size.width}
            height={size.height}

            x={view.x}
            y={view.y}

            scaleX={view.scale}
            scaleY={view.scale}

            draggable={!drawing}

            onDragEnd={(e) =>
              setView((old) => ({
                ...old,

                x: e.target.x(),
                y: e.target.y(),
              }))
            }

            onWheel={(e) => {
              e.evt.preventDefault();

              zoom(
                e.evt.deltaY < 0
                  ? 1.2
                  : 1 / 1.2,

                stageRef.current?.getPointerPosition()
              );
            }}

            onMouseDown={addVertex}
            onTap={addVertex}
          >
            <Layer>
              {/* ẢNH MẶT BẰNG NGUYÊN GỐC */}

              <KonvaImage
                image={image}
                width={width}
                height={height}
                listening={false}
              />

              {/* RANH GIỚI ĐÃ LƯU:
                  CHỈ AGENT ĐƯỢC VẼ THẤY */}

              {(map.zones || []).map(
                (item) => {
                  const polygon = parsePoints(
                    item.polygonJson
                  );

                  if (polygon.length < 3) {
                    return null;
                  }

                  const chosen =
                    item.code === selectedCode;

                  return (
                    <ReactZoneOutline
                      key={item.id}
                      item={item}
                      polygon={polygon}
                      chosen={chosen}
                      first={polygon[0]}
                      scale={view.scale}
                    />
                  );
                }
              )}

              {/* ĐƯỜNG ĐANG KHOANH */}

              {draft.length >= 2 && (
                <Line
                  points={coords(draft)}
                  stroke="#1869ce"
                  strokeWidth={3 / view.scale}
                  listening={false}
                />
              )}

              {/* CÁC ĐIỂM ĐANG KHOANH */}

              {draft.map((p, index) => (
                <Circle
                  key={index}
                  x={p.x}
                  y={p.y}
                  radius={5 / view.scale}
                  fill="#ffffff"
                  stroke="#1869ce"
                  strokeWidth={2 / view.scale}
                  listening={false}
                />
              ))}
            </Layer>
          </Stage>
        )}
      </div>

      <p
        className="muted small"
        style={{ marginTop: 8 }}
      >
        {drawing
          ? `Đang khoanh ${selectedCode}: nhấn các góc (${draft.length} điểm), sau đó nhấn Lưu ranh giới.`
          : "Kéo để di chuyển, cuộn chuột để zoom. Nhấn Khoanh lại để tạo ranh giới mới."}
      </p>
    </div>
  );
}

// ==========================================
// ĐƯỜNG VIỀN PHÂN KHU CHỈ CHO AGENT
// ==========================================

function ReactZoneOutline({
  item,
  polygon,
  chosen,
  first,
  scale,
}) {
  return (
    <>
      <Line
        points={coords(polygon)}
        closed

        stroke={
          chosen
            ? "#1755bd"
            : "#522e9c"
        }

        strokeWidth={
          (chosen ? 3 : 2) / scale
        }

        dash={[
          10 / scale,
          5 / scale,
        ]}

        fillEnabled={false}
        listening={false}
      />

      <KonvaText
        x={first.x}
        y={first.y - 18 / scale}

        text={item.name}
        fontSize={14 / scale}
        fontStyle="bold"

        fill="#3c1881"
        stroke="#ffffff"
        strokeWidth={3 / scale}
        fillAfterStrokeEnabled

        listening={false}
      />
    </>
  );
}

// ==========================================
// TRANG QUẢN LÝ PHÂN KHU
// ==========================================

export default function AgentZonesPage() {

  const [map, setMap] = useState(null);

  const [savedUnits, setSavedUnits] =
    useState([]);

  const [selectedCode, setSelectedCode] =
    useState("RUBY");

  const [draft, setDraft] =
    useState([]);

  const [drawing, setDrawing] =
    useState(false);

  const [focusKey, setFocusKey] =
    useState(0);

  const [busy, setBusy] =
    useState(false);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState("");

  const [notice, setNotice] =
    useState("");

  // ========================================
  // 1. TẢI MẶT BẰNG VÀ CĂN TỪ MYSQL
  // ========================================

  useEffect(() => {
    let active = true;

    api("/api/public/master-plans")
      .then((plans) => {
        const plan = Array.isArray(plans) ? plans[0] : null;

        if (!plan?.id) {
          throw new Error("TiDB chưa có mặt bằng đang hoạt động.");
        }

        return Promise.all([
          api(`/api/public/master-plans/${plan.id}/map`),
          api(`/api/agent/master-plans/${plan.id}/units`),
        ]);
      })
      .then(([data, units]) => {
        if (!active) return;

        setMap(data);

        setSavedUnits(
          Array.isArray(units)
            ? units
            : []
        );
      })
      .catch((err) => {
        if (active) {
          setError(err.message);
        }
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, []);

  const zone = map?.zones?.find(
    (z) => z.code === selectedCode
  );

  const zoneUnits = useMemo(
    () =>
      savedUnits.filter(
        (unit) =>
          unit.zoneCode === selectedCode
      ),

    [savedUnits, selectedCode]
  );

  const count = zoneUnits.length;

  const saved = parsePoints(
    zone?.polygonJson
  );

  // ========================================
  // 2. CHỌN PHÂN KHU
  // ========================================

  function chooseZone(code) {
    if (
      draft.length &&
      !window.confirm(
        "Bỏ các điểm đang khoanh để chuyển phân khu?"
      )
    ) {
      return;
    }

    setSelectedCode(code);
    setDraft([]);
    setDrawing(false);

    setError("");
    setNotice("");

    setFocusKey(
      (old) => old + 1
    );
  }

  // ========================================
  // 3. BẮT ĐẦU KHOANH
  // ========================================

  function beginDrawing() {
    if (
      draft.length &&
      !window.confirm(
        "Khoanh lại từ đầu và bỏ các điểm chưa lưu?"
      )
    ) {
      return;
    }

    setDraft([]);
    setDrawing(true);
    setNotice("");
    setError("");
  }

  function addPoint(point) {
    setDraft((old) => {
      const last = old.at(-1);

      if (
        last?.x === point.x &&
        last?.y === point.y
      ) {
        return old;
      }

      return [...old, point];
    });
  }

  // ========================================
  // 4. LƯU VÙNG PHÂN KHU
  // ========================================

  async function save() {
    if (
      !map ||
      !zone ||
      busy ||
      !drawing
    ) {
      return;
    }

    if (
      draft.length < 3 ||
      draft.length > 150
    ) {
      setError(
        "Cần từ 3 đến 150 điểm để tạo vùng phân khu."
      );
      return;
    }

    if (
      saved.length >= 3 &&
      !window.confirm(
        `Ghi đè ranh giới hiện tại của ${zone.name}? Các căn đã gắn phân khu sẽ được giữ nguyên.`
      )
    ) {
      return;
    }

    setBusy(true);
    setError("");

    try {
      await api(
        `/api/agent/master-plans/${map.id}/zones/${selectedCode}/polygon`,
        {
          method: "PUT",

          body: JSON.stringify({
            points: draft,
          }),
        }
      );

      const updated = await api(
        `/api/public/master-plans/${map.id}/map`
      );

      setMap(updated);

      setDraft([]);
      setDrawing(false);

      setFocusKey(
        (old) => old + 1
      );

      setNotice(
        `Đã lưu ranh giới ${zone.name} vào MySQL. ${count} căn trong phân khu vẫn được giữ nguyên.`
      );
    } catch (err) {
      setError(
        `Lưu ranh giới thất bại: ${err.message}`
      );
    } finally {
      setBusy(false);
    }
  }

  // ========================================
  // 5. XÓA RANH GIỚI, KHÔNG XÓA CĂN
  // ========================================

  async function remove() {
    if (
      !map ||
      !zone ||
      busy
    ) {
      return;
    }

    if (
      !window.confirm(
        `Xóa riêng đường ranh giới ${zone.name}? Không xóa các căn đã gắn với phân khu.`
      )
    ) {
      return;
    }

    setBusy(true);
    setError("");

    try {
      await api(
        `/api/agent/master-plans/${map.id}/zones/${selectedCode}/polygon`,
        {
          method: "DELETE",
        }
      );

      const updated = await api(
        `/api/public/master-plans/${map.id}/map`
      );

      setMap(updated);
      setDraft([]);
      setDrawing(false);

      setNotice(
        `Đã xóa đường ranh giới ${zone.name}; các căn vẫn còn.`
      );
    } catch (err) {
      setError(
        `Không thể xóa ranh giới: ${err.message}`
      );
    } finally {
      setBusy(false);
    }
  }

  // ========================================
  // 6. GIAO DIỆN CHÍNH
  // ========================================

  return (
    <PageLayout
      title="Khoanh vùng phân khu"
      subtitle="Agent khoanh Ruby, Sapphire, Crystal. User chỉ dùng ranh giới để phóng tới khu, không nhìn thấy đường viền."
    >
      {error && (
        <div
          className="error-box"
          role="alert"
        >
          {error}
        </div>
      )}

      {notice && (
        <div
          className="notice-box"
          role="status"
        >
          {notice}
        </div>
      )}

      {loading && (
        <div className="panel">
          Đang tải mặt bằng...
        </div>
      )}

      {map && (
        <div
          style={{
            display: "grid",

            gridTemplateColumns:
              "repeat(auto-fit, minmax(min(100%, 350px), 1fr))",

            gap: 14,
            alignItems: "start",
          }}
        >
          {/* CỘT CHỌN PHÂN KHU */}

          <aside
            className="panel"
            style={{ minWidth: 0 }}
          >
            <h2>Chọn phân khu</h2>

            <div
              style={{
                display: "grid",
                gap: 8,
                marginBottom: 16,
              }}
            >
              {ZONE_CODES.map((code) => {
                const item =
                  map.zones.find(
                    (z) => z.code === code
                  );

                const marked =
                  parsePoints(
                    item?.polygonJson
                  ).length >= 3;

                return (
                  <button
                    key={code}
                    type="button"

                    className={`btn ${
                      code === selectedCode
                        ? "btn-primary"
                        : "btn-outline"
                    }`}

                    disabled={busy}

                    onClick={() =>
                      chooseZone(code)
                    }
                  >
                    {item?.name || code}
                    {" · "}
                    {marked
                      ? "Đã khoanh"
                      : "Chưa khoanh"}
                  </button>
                );
              })}
            </div>

            <p>
              <b>
                {zone?.name || selectedCode}
              </b>
            </p>

            <p className="muted small">
              Đã gắn {count} căn vào phân khu
              qua mục Phân khu khi Agent khoanh căn.
              Không cần khoanh lại các căn.
            </p>

            <div
              style={{
                display: "grid",
                gap: 8,
              }}
            >
              <button
                type="button"
                className="btn btn-primary"
                disabled={busy}
                onClick={beginDrawing}
              >
                Khoanh / khoanh lại ranh giới
              </button>

              <button
                type="button"
                className="btn btn-outline"

                disabled={
                  busy ||
                  !draft.length
                }

                onClick={() =>
                  setDraft((old) =>
                    old.slice(0, -1)
                  )
                }
              >
                Bỏ điểm cuối
              </button>

              <button
                type="button"
                className="btn btn-outline"

                disabled={
                  busy ||
                  !draft.length
                }

                onClick={() =>
                  setDraft([])
                }
              >
                Bỏ điểm đang khoanh
              </button>

              <button
                type="button"
                className="btn btn-primary"

                disabled={
                  busy ||
                  !drawing ||
                  draft.length < 3
                }

                onClick={save}
              >
                {busy
                  ? "Đang xử lý..."
                  : "Lưu ranh giới vào MySQL"}
              </button>

              <button
                type="button"
                className="btn btn-outline"

                disabled={
                  busy ||
                  !saved.length
                }

                onClick={() =>
                  setFocusKey(
                    (old) => old + 1
                  )
                }
              >
                Phóng tới ranh giới đã lưu
              </button>

              <button
                type="button"
                className="btn btn-danger"

                disabled={
                  busy ||
                  !saved.length
                }

                onClick={remove}
              >
                Xóa riêng ranh giới
              </button>
            </div>

            <hr
              style={{
                margin: "18px 0",
                border: 0,
                borderTop:
                  "1px solid #e0e8e1",
              }}
            />

            <h3>
              Căn thuộc{" "}
              {zone?.name || selectedCode}
            </h3>

            <div
              style={{
                display: "grid",
                gap: 5,
                maxHeight: 300,
                overflowY: "auto",
              }}
            >
              {!count && (
                <p className="muted small">
                  Chưa có căn nào được gắn
                  vào phân khu này.
                </p>
              )}

              {zoneUnits.map((unit) => (
                <div
                  key={unit.id}
                  className="muted small"
                >
                  {unit.unitCode ||
                    `Căn #${unit.id}`}
                </div>
              ))}
            </div>
          </aside>

          {/* CỘT BẢN ĐỒ */}

          <ZoneDrawingMap
            map={map}
            selectedCode={selectedCode}
            draft={draft}
            drawing={drawing}
            onPoint={addPoint}
            focusKey={focusKey}
          />
        </div>
      )}
    </PageLayout>
  );
}