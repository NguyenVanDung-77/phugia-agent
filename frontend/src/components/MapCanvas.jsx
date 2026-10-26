
/* eslint-disable react-refresh/only-export-components */
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
  Group,
  Rect,
  Text as KonvaText,
} from "react-konva";

const STATUS_COLORS = {
  AVAILABLE: "#ffffff",
  SOLD: "#f4a7a7",
  NOT_OPEN: "#f6d96b",
};

// ĐỌC TỌA ĐỘ POLYGON
export function parsePoints(value) {
  if (!value) return [];

  try {
    const data =
      typeof value === "string"
        ? JSON.parse(value)
        : value;

    if (!Array.isArray(data)) {
      return [];
    }

    const result = data.map((p) => ({
      x: Number(p.x),
      y: Number(p.y),
    }));

    return result.every(
      (p) =>
        Number.isFinite(p.x) &&
        Number.isFinite(p.y)
    )
      ? result
      : [];
  } catch {
    return [];
  }
}

function flat(points) {
  return points.flatMap((p) => [
    p.x,
    p.y,
  ]);
}

// NHÃN SỐ CĂN
function labelNumber(unit) {
  const label = String(
    unit.displayLabel ?? ""
  ).trim();

  if (/^\d+$/.test(label)) {
    return label;
  }

  return (
    String(unit.unitCode ?? "")
      .match(/-(\d+)$/)?.[1] ?? ""
  );
}

// XÁC ĐỊNH VỊ TRÍ NHÃN TRONG POLYGON
function anchorFor(points) {
  const minY = Math.min(
    ...points.map((p) => p.y)
  );
  const maxY = Math.max(
    ...points.map((p) => p.y)
  );
  const height = maxY - minY;

  if (height <= 0) return null;

  for (const fraction of [
    0.22,
    0.28,
    0.35,
    0.5,
  ]) {
    const y = minY + height * fraction;
    const crossings = [];

    for (
      let i = 0;
      i < points.length;
      i += 1
    ) {
      const a = points[i];
      const b =
        points[(i + 1) % points.length];

      if (
        (a.y <= y && y < b.y) ||
        (b.y <= y && y < a.y)
      ) {
        crossings.push(
          a.x +
            ((y - a.y) * (b.x - a.x)) /
              (b.y - a.y)
        );
      }
    }

    crossings.sort((a, b) => a - b);

    let best = null;

    for (
      let i = 0;
      i + 1 < crossings.length;
      i += 2
    ) {
      const width =
        crossings[i + 1] - crossings[i];

      if (!best || width > best.width) {
        best = {
          x:
            (crossings[i] +
              crossings[i + 1]) /
            2,
          y,
          width,
          height,
        };
      }
    }

    if (best && best.width > 0) {
      return best;
    }
  }

  return null;
}

// BẢN ĐỒ TƯƠNG TÁC DÙNG CHUNG
export default function MapCanvas({
  imageUrl = "/images/phu-gia-master-plan.png",
  expectedWidth,
  expectedHeight,
  units = [],
  mode = "view",
  points = [],
  onAddPoint,
  onUnitClick,
  selectedId,
  focusTarget,
}) {
  const containerRef = useRef(null);
  const stageRef = useRef(null);

  const [size, setSize] = useState({
    width: 0,
    height: 0,
  });

  const [image, setImage] =
    useState(null);

  const [imageError, setImageError] =
    useState("");

  const [view, setView] = useState({
    x: 0,
    y: 0,
    scale: 1,
  });

  // ========================================
  // 1. TẢI ẢNH MẶT BẰNG GỐC
  // ========================================

  useEffect(() => {
    let active = true;
    const img = new window.Image();

    img.onload = () => {
      if (!active) return;

      setImage(img);
      setImageError("");
    };

    img.onerror = () => {
      if (!active) return;

      setImageError(
        "Không tải được ảnh mặt bằng gốc."
      );
    };

    img.src = imageUrl;

    return () => {
      active = false;
    };
  }, [imageUrl]);

  // ========================================
  // 2. ĐO KHUNG BẢN ĐỒ
  // ========================================

  useEffect(() => {
    const element =
      containerRef.current;

    if (!element) {
      return undefined;
    }

    const observer = new ResizeObserver(
      ([entry]) => {
        setSize({
          width: Math.max(
            1,
            Math.round(
              entry.contentRect.width
            )
          ),

          height: Math.max(
            1,
            Math.round(
              entry.contentRect.height
            )
          ),
        });
      }
    );

    observer.observe(element);

    return () => observer.disconnect();
  }, []);

  const imageWidth =
    image?.naturalWidth ||
    expectedWidth ||
    2560;

  const imageHeight =
    image?.naturalHeight ||
    expectedHeight ||
    1810;

  const fitScale = useMemo(() => {
    if (
      !size.width ||
      !size.height
    ) {
      return 1;
    }

    return Math.min(
      size.width / imageWidth,
      size.height / imageHeight
    );
  }, [
    size.width,
    size.height,
    imageWidth,
    imageHeight,
  ]);

  // ========================================
  // 3. TỰ ZOOM ĐẾN POLYGON
  //
  // QUAN TRỌNG:
  // - Đợi ảnh tải xong.
  // - Đợi khung có kích thước.
  // - Nếu có focusTarget thì phóng căn.
  // - Nếu không có thì vừa màn hình.
  // - Không để reset zoom ghi đè.
  // ========================================

  useEffect(() => {
    if (
      !image ||
      !size.width ||
      !size.height
    ) {
      return undefined;
    }

    const vertices = parsePoints(
      focusTarget?.points
    );

    let target = {
      scale: fitScale,

      x:
        (size.width -
          imageWidth * fitScale) /
        2,

      y:
        (size.height -
          imageHeight * fitScale) /
        2,
    };

    if (vertices.length >= 3) {
      const xs = vertices.map(
        (p) => p.x
      );

      const ys = vertices.map(
        (p) => p.y
      );

      const minX = Math.min(...xs);
      const maxX = Math.max(...xs);

      const minY = Math.min(...ys);
      const maxY = Math.max(...ys);

      const width = Math.max(
        1,
        maxX - minX
      );

      const height = Math.max(
        1,
        maxY - minY
      );

      const scale = Math.max(
        fitScale,

        Math.min(
          fitScale * 20,

          (size.width * 0.54) /
            width,

          (size.height * 0.54) /
            height
        )
      );

      target = {
        scale,

        x:
          size.width / 2 -
          ((minX + maxX) * scale) /
            2,

        y:
          size.height / 2 -
          ((minY + maxY) * scale) /
            2,
      };
    }

    const frame =
      window.requestAnimationFrame(
        () => setView(target)
      );

    return () =>
      window.cancelAnimationFrame(frame);
  }, [
    image,
    imageWidth,
    imageHeight,
    fitScale,
    size.width,
    size.height,
    focusTarget,
  ]);

  // ========================================
  // 4. VỪA MÀN HÌNH
  // ========================================

  function resetView() {
    setView({
      scale: fitScale,

      x:
        (size.width -
          imageWidth * fitScale) /
        2,

      y:
        (size.height -
          imageHeight * fitScale) /
        2,
    });
  }

  // ========================================
  // 5. ZOOM CHUỘT / NÚT
  // ========================================

  function zoomAt(pointer, factor) {
    const stage = stageRef.current;

    if (!stage || !pointer) {
      return;
    }

    const oldScale = stage.scaleX();

    if (!oldScale) return;

    const newScale = Math.min(
      fitScale * 20,

      Math.max(
        fitScale,
        oldScale * factor
      )
    );

    const imageX =
      (pointer.x - stage.x()) /
      oldScale;

    const imageY =
      (pointer.y - stage.y()) /
      oldScale;

    setView({
      scale: newScale,

      x:
        pointer.x -
        imageX * newScale,

      y:
        pointer.y -
        imageY * newScale,
    });
  }

  // ========================================
  // 6. AGENT KHOANH CĂN
  // ========================================

  function addDrawingPoint() {
    if (
      mode !== "draw" ||
      !onAddPoint ||
      !image
    ) {
      return;
    }

    const stage = stageRef.current;

    const pointer =
      stage?.getPointerPosition();

    if (!pointer) return;

    const x =
      (pointer.x - stage.x()) /
      stage.scaleX();

    const y =
      (pointer.y - stage.y()) /
      stage.scaleY();

    if (
      x < 0 ||
      y < 0 ||
      x > imageWidth ||
      y > imageHeight
    ) {
      return;
    }

    onAddPoint({
      x: Math.round(x * 10) / 10,
      y: Math.round(y * 10) / 10,
    });
  }

  const mismatch = Boolean(
    image &&
      expectedWidth &&
      expectedHeight &&
      (imageWidth !== expectedWidth ||
        imageHeight !== expectedHeight)
  );

  // ========================================
  // 7. GIAO DIỆN MAP
  // ========================================

  return (
    <div className="canvas-frame">
      {/* THANH ZOOM */}
      <div className="map-controls">
        <span>
          Ảnh gốc: {imageWidth} ×{" "}
          {imageHeight} px
        </span>

        <div className="control-buttons">
          <button
            type="button"
            className="btn btn-outline"
            aria-label="Thu nhỏ bản đồ"
            onClick={() =>
              zoomAt(
                {
                  x: size.width / 2,
                  y: size.height / 2,
                },
                1 / 1.25
              )
            }
          >
            −
          </button>

          <span>
            {Math.round(
              (view.scale / fitScale) *
                100
            ) || 100}
            %
          </span>

          <button
            type="button"
            className="btn btn-outline"
            aria-label="Phóng to bản đồ"
            onClick={() =>
              zoomAt(
                {
                  x: size.width / 2,
                  y: size.height / 2,
                },
                1.25
              )
            }
          >
            +
          </button>

          <button
            type="button"
            className="btn btn-outline"
            onClick={resetView}
          >
            Vừa màn hình
          </button>
        </div>
      </div>

      {mismatch && (
        <div className="error-box">
          Kích thước ảnh khác MySQL,
          không nên lưu Polygon khi chưa
          đồng bộ.
        </div>
      )}

      {imageError && (
        <div className="error-box">
          {imageError}
        </div>
      )}

      <div
        ref={containerRef}
        className={`canvas-area ${
          mode === "draw"
            ? "drawing"
            : ""
        }`}
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
              draggable={mode !== "draw"}
              onDragEnd={(event) =>
                setView((old) => ({
                  ...old,

                  x: event.target.x(),
                  y: event.target.y(),
                }))
              }
              onWheel={(event) => {
                event.evt.preventDefault();

                zoomAt(
                  stageRef.current?.getPointerPosition(),

                  event.evt.deltaY < 0
                    ? 1.17
                    : 1 / 1.17
                );
              }}
              onPointerDown={
                addDrawingPoint
              }
            >
              <Layer>
                {/* ẢNH GỐC */}
                <KonvaImage
                  image={image}
                  x={0}
                  y={0}
                  width={imageWidth}
                  height={imageHeight}
                  listening={false}
                />

                {/* POLYGON CÁC CĂN */}
                {units.map((unit) => {
                  const vertices =
                    parsePoints(
                      unit.points ??
                        unit.polygonJson
                    );

                  if (
                    vertices.length < 3
                  ) {
                    return null;
                  }

                  const status =
                    unit.saleStatus ||
                    "NOT_OPEN";

                  const clickable =
                    mode !== "draw" &&
                    (mode !== "view" ||
                      status !== "SOLD") &&
                    unit.clickable !== false;

                  return (
                    <Line
                      key={unit.id}
                      points={flat(vertices)}
                      closed
                      fill={
                        STATUS_COLORS[
                          status
                        ] ||
                        STATUS_COLORS.NOT_OPEN
                      }
                      opacity={0.72}
                      stroke={
                        selectedId ===
                        unit.id
                          ? "#1769d2"
                          : "#666666"
                      }
                      strokeWidth={
                        (selectedId ===
                        unit.id
                          ? 3
                          : 1.2) /
                        view.scale
                      }
                      lineJoin="round"
                      listening={clickable}
                      onClick={(event) => {
                        event.cancelBubble =
                          true;

                        onUnitClick?.(
                          unit
                        );
                      }}
                      onTap={(event) => {
                        event.cancelBubble =
                          true;

                        onUnitClick?.(
                          unit
                        );
                      }}
                    />
                  );
                })}

                {/* NHÃN SỐ CĂN */}
                {units.map((unit) => {
                  const number =
                    labelNumber(unit);

                  const vertices =
                    parsePoints(
                      unit.points ??
                        unit.polygonJson
                    );

                  if (
                    !number ||
                    vertices.length < 3
                  ) {
                    return null;
                  }

                  const anchor =
                    anchorFor(vertices);

                  if (!anchor) {
                    return null;
                  }

                  const w = Math.max(
                    32,
                    number.length *
                      10 +
                      15
                  );

                  const h = 25;

                  const fit = Math.min(
                    1,

                    (anchor.width *
                      view.scale *
                      0.85) /
                      w,

                    (anchor.height *
                      view.scale *
                      0.38) /
                      h
                  );

                  if (fit * h < 5) {
                    return null;
                  }

                  return (
                    <Group
                      key={`number-${unit.id}`}
                      x={anchor.x}
                      y={anchor.y}
                      scaleX={
                        fit / view.scale
                      }
                      scaleY={
                        fit / view.scale
                      }
                      listening={false}
                    >
                      <Rect
                        x={-w / 2}
                        y={-h / 2}
                        width={w}
                        height={h}
                        cornerRadius={
                          h / 2
                        }
                        fill="#fff"
                        stroke="#111"
                        strokeWidth={
                          1.3
                        }
                      />

                      <KonvaText
                        x={-w / 2}
                        y={
                          -h / 2 + 1
                        }
                        width={w}
                        height={h - 2}
                        text={number}
                        fontSize={16}
                        fontStyle="bold"
                        fill="#000"
                        align="center"
                        verticalAlign="middle"
                        listening={
                          false
                        }
                      />
                    </Group>
                  );
                })}

                {/* ĐƯỜNG ĐANG KHOANH */}
                {mode === "draw" &&
                  points.length > 1 && (
                    <Line
                      points={flat(
                        points
                      )}
                      stroke="#086bd9"
                      strokeWidth={
                        3 /
                        view.scale
                      }
                      listening={
                        false
                      }
                    />
                  )}

                {/* CÁC ĐỈNH ĐANG KHOANH */}
                {mode === "draw" &&
                  points.map(
                    (point, index) => (
                      <Circle
                        key={index}
                        x={point.x}
                        y={point.y}
                        radius={
                          5 /
                          view.scale
                        }
                        fill="#fff"
                        stroke="#086bd9"
                        strokeWidth={
                          2 /
                          view.scale
                        }
                        listening={
                          false
                        }
                      />
                    )
                  )}
              </Layer>
            </Stage>
          )}
      </div>

      <div className="canvas-footer">
        {mode === "draw"
          ? "Nhấn lần lượt vào các góc căn để khoanh vùng."
          : "Kéo ảnh để di chuyển. Cuộn chuột để zoom."}
      </div>
    </div>
  );
}
