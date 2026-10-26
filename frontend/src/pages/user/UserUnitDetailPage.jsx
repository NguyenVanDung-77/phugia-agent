
import { useEffect, useMemo, useState } from "react";
import {
  useLocation,
  useNavigate,
  useParams,
} from "react-router";

import { api, API_BASE } from "../../api/client";
import PageLayout from "../../components/PageLayout";
import MapCanvas, {
  parsePoints,
} from "../../components/MapCanvas";

const STATUS = {
  AVAILABLE: "Chưa bán",
  NOT_OPEN: "Chưa mở bán",
};

function filled(value) {
  return (
    value !== null &&
    value !== undefined &&
    String(value).trim() !== ""
  );
}

function displayNumber(value, unit = "") {
  if (!filled(value)) return "";

  const match = String(value)
    .trim()
    .match(/^(\d+)(?:\.(\d+))?$/);

  if (!match) return `${value}${unit}`;

  const integer = match[1].replace(
    /\B(?=(\d{3})+(?!\d))/g,
    "."
  );

  const fraction = (match[2] || "").replace(
    /0+$/,
    ""
  );

  return (
    `${integer}${fraction ? `,${fraction}` : ""}${unit}`
  );
}

function imageUrl(raw) {
  if (!filled(raw)) return "";

  const value = String(raw).trim();
  const base = API_BASE.replace(/\/$/, "");

  if (value.startsWith("/api/")) {
    return base + value;
  }

  if (value.startsWith("/")) {
    return value;
  }

  try {
    const url = new URL(value);

    if (
      !["http:", "https:"].includes(url.protocol)
    ) {
      return "";
    }

    if (
      ["localhost", "127.0.0.1"].includes(url.hostname) &&
      url.pathname.startsWith(
        "/api/public/unit-images/"
      )
    ) {
      return base + url.pathname + url.search;
    }

    return url.href;
  } catch {
    return "";
  }
}

function DetailRow({ label, value }) {


  return (
    <div className="udf-row">
      <span>{label}</span>
      <strong>{filled(value) ? value : "Chưa cập nhật"}</strong>
    </div>
  );
}

// ======================================
// THƯ VIỆN ẢNH
// ======================================

function UnitGallery({ images, code }) {
  const [index, setIndex] = useState(0);
  const [large, setLarge] = useState(false);
  const [failed, setFailed] = useState([]);

  const current = images[index] || images[0];
  const isFailed = failed.includes(current?.src);

  function move(delta) {
    setIndex(
      (old) =>
        (old + delta + images.length) % images.length
    );
  }

  useEffect(() => {
    if (!large) return undefined;

    function handleKey(event) {
      if (event.key === "Escape") {
        setLarge(false);
      }

      if (
        event.key === "ArrowLeft" &&
        images.length > 1
      ) {
        setIndex(
          (old) =>
            (old - 1 + images.length) % images.length
        );
      }

      if (
        event.key === "ArrowRight" &&
        images.length > 1
      ) {
        setIndex(
          (old) =>
            (old + 1) % images.length
        );
      }
    }

    window.addEventListener("keydown", handleKey);

    return () =>
      window.removeEventListener("keydown", handleKey);
  }, [large, images.length]);

  if (!images.length) {
    return (
      <div className="udf-no-photo">
        Căn này chưa có hình ảnh.
      </div>
    );
  }

  return (
    <div className="udf-gallery">
      <div className="udf-photo">
        {isFailed ? (
          <div className="udf-no-photo">
            Không tải được ảnh này.
          </div>
        ) : (
          <button
            type="button"
            className="udf-photo-button"
            onClick={() => setLarge(true)}
          >
            <img
              src={current.src}
              alt={`Căn ${code}, ảnh ${index + 1}`}
              onError={() =>
                setFailed((old) => [
                  ...new Set([...old, current.src]),
                ])
              }
            />

            <span>⤢ Phóng to</span>
          </button>
        )}

        {images.length > 1 && (
          <div className="udf-arrows">
            <button
              type="button"
              aria-label="Ảnh trước"
              onClick={() => move(-1)}
            >
              ‹
            </button>

            <button
              type="button"
              aria-label="Ảnh sau"
              onClick={() => move(1)}
            >
              ›
            </button>
          </div>
        )}
      </div>

      <div className="udf-gallery-info">
        <strong>Hình ảnh căn</strong>
        <small>
          {index + 1}/{images.length}
        </small>
      </div>

      {images.length > 1 && (
        <div className="udf-thumbs">
          {images.map((photo, i) => (
            <button
              key={`${photo.src}-${i}`}
              type="button"
              className={i === index ? "active" : ""}
              onClick={() => setIndex(i)}
              aria-label={`Xem ảnh ${i + 1}`}
            >
              <img
                src={photo.src}
                alt={`Ảnh thu nhỏ ${i + 1}`}
              />
            </button>
          ))}
        </div>
      )}

      {/* PHÓNG TO ẢNH */}
      {large && (
        <div
          className="udf-lightbox"
          role="presentation"
          onMouseDown={(event) => {
            if (
              event.target === event.currentTarget
            ) {
              setLarge(false);
            }
          }}
        >
          <div
            className="udf-lightbox-inner"
            role="dialog"
            aria-modal="true"
            aria-label="Ảnh căn phóng lớn"
          >
            <div className="udf-lightbox-bar">
              <strong>
                {code} · {index + 1}/{images.length}
              </strong>

              <button
                type="button"
                onClick={() => setLarge(false)}
              >
                Đóng ×
              </button>
            </div>

            {isFailed ? (
              <p>Không tải được ảnh này.</p>
            ) : (
              <img
                src={current.src}
                alt={`Ảnh lớn ${index + 1}`}
              />
            )}

            {images.length > 1 && (
              <div className="udf-lightbox-actions">
                <button
                  type="button"
                  onClick={() => move(-1)}
                >
                  ← Trước
                </button>

                <button
                  type="button"
                  onClick={() => move(1)}
                >
                  Sau →
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ======================================
// TRANG CHI TIẾT CĂN RIÊNG
// ======================================

export default function UserUnitDetailPage() {
  const { unitId } = useParams();

  const navigate = useNavigate();
  const location = useLocation();

  const backState = location.state || {};
  const planId = backState.planId || 1;

  const [detail, setDetail] = useState(null);
  const [gallery, setGallery] = useState([]);
  const [map, setMap] = useState(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [extraError, setExtraError] = useState("");

  // ====================================
  // 1. LẤY CHI TIẾT CĂN TỪ BACKEND
  // ====================================

  useEffect(() => {
    let active = true;

    async function loadDetail() {
      try {
        if (!/^\d+$/.test(String(unitId))) {
          throw new Error(
            "Đường dẫn căn không hợp lệ."
          );
        }

        const info = await api(
          `/api/public/units/${unitId}`
        );

        if (!active) return;

        if (
          !info ||
          info.saleStatus === "SOLD"
        ) {
          throw new Error(
            "Căn đã bán hoặc không được phép xem chi tiết."
          );
        }

        setDetail(info);

        // Lỗi tải ảnh không được làm mất trang.
        try {
          const response = await api(
            `/api/public/units/${unitId}/gallery`
          );

          if (active) {
            setGallery(
              Array.isArray(response?.images)
                ? response.images
                : Array.isArray(response)
                  ? response
                  : []
            );
          }
        } catch (err) {
          if (active) {
            setExtraError(
              `Chưa tải được thư viện ảnh: ${err.message}`
            );
          }
        }
      } catch (err) {
        if (active) {
          setError(
            err.message ||
              "Không tải được thông tin căn."
          );
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    loadDetail();

    return () => {
      active = false;
    };
  }, [unitId]);

  // ====================================
  // 2. LẤY VỊ TRÍ TRÊN MẶT BẰNG
  // ====================================

  useEffect(() => {
    if (!detail) return undefined;

    let active = true;

    api(
      `/api/public/master-plans/${planId}/map`
    )
      .then((result) => {
        if (active) {
          setMap(result);
        }
      })
      .catch(() => {
        if (active) {
          setMap(null);
        }
      });

    return () => {
      active = false;
    };
  }, [detail, planId]);

  // ====================================
  // 3. ẢNH KHÔNG TRÙNG
  // ====================================

  const images = useMemo(() => {
    const seen = new Set();

    return [
      ...gallery.map((photo) => photo.imageUrl),
      detail?.imageUrl,
    ]
      .map(imageUrl)
      .filter((url) => {
        if (!url || seen.has(url)) {
          return false;
        }

        seen.add(url);
        return true;
      })
      .map((src) => ({ src }));
  }, [gallery, detail]);

  // ====================================
  // 4. TÌM POLYGON ĐÚNG CĂN
  // ====================================

  const selected = useMemo(
    () =>
      map?.zones
        ?.flatMap((zone) => zone.units || [])
        .find(
          (unit) =>
            String(unit.id) === String(unitId)
        ),
    [map, unitId]
  );

  const focus = useMemo(
    () =>
      selected
        ? {
            points: parsePoints(
              selected.polygonJson
            ),
            key: `unit-${unitId}`,
          }
        : null,
    [selected, unitId]
  );



  function back() {
    navigate("/user", {
      state: backState,
    });
  }

  // ====================================
  // GIAO DIỆN CHÍNH
  // ====================================

  return (
    <PageLayout title="Chi tiết căn">
      <div className="udf-root">
        {/* CSS ĐỘC LẬP CHO TRANG NÀY */}
        <style>
          {`
            .udf-root {
              color: #183d2d;
              max-width: 1460px;
              margin: 0 auto;
            }

            .udf-root button {
              cursor: pointer;
            }

            .udf-back {
              display: flex;
              align-items: center;
              gap: 12px;
              margin-bottom: 22px;
            }

            .udf-back button {
              border: 1px solid #dbe5de;
              border-radius: 10px;
              background: white;
              color: #245a41;
              padding: 11px 16px;
              font-size: 12px;
              font-weight: 750;
            }

            .udf-back span {
              color: #8a998e;
              font-size: 12px;
            }

            .udf-title {
              display: flex;
              align-items: center;
              justify-content: space-between;
              gap: 15px;
              margin-bottom: 22px;
            }

            .udf-title small {
              display: block;
              color: #8e9d92;
              letter-spacing: .12em;
              font-size: 10px;
              font-weight: 800;
            }

            .udf-title h1 {
              font-size: clamp(27px, 3vw, 42px);
              color: #163d2b;
              margin: 8px 0 5px;
            }

            .udf-title p {
              color: #819384;
              font-size: 12px;
              margin: 0;
            }

            .udf-status {
              border-radius: 40px;
              padding: 9px 14px;
              background: #e9f5e9;
              color: #2c6e45;
              font-size: 11px;
              font-weight: 800;
              white-space: nowrap;
            }

            .udf-status.NOT_OPEN {
              background: #fdf4d9;
              color: #8d732e;
            }

            .udf-grid {
              display: grid;
              grid-template-columns:
                minmax(0, 1.35fr)
                minmax(320px, .9fr);
              gap: 18px;
              align-items: start;
            }

            .udf-card {
              min-width: 0;
              background: #fff;
              border: 1px solid #e0e9e1;
              border-radius: 15px;
              overflow: hidden;
              box-shadow: 0 8px 25px #1a402908;
            }

            .udf-photo-card {
              padding: 12px;
            }

            .udf-side {
              display: grid;
              gap: 16px;
              min-width: 0;
            }

            .udf-section {
              padding: 23px;
            }

            .udf-section small {
              font-size: 10px;
              color: #95a396;
              font-weight: 800;
              letter-spacing: .1em;
            }

            .udf-section h2 {
              font-size: 21px;
              color: #214d34;
              margin: 9px 0 16px;
            }

            .udf-row {
              display: flex;
              justify-content: space-between;
              gap: 15px;
              padding: 11px 0;
              border-bottom: 1px solid #edf1ec;
              font-size: 12px;
              line-height: 1.5;
            }

            .udf-row:last-child {
              border-bottom: 0;
            }

            .udf-row span {
              color: #859487;
              max-width: 51%;
            }

            .udf-row strong {
              color: #28563c;
              text-align: right;
              overflow-wrap: anywhere;
            }

            .udf-description {
              white-space: pre-wrap;
              color: #6d8676;
              font-size: 12px;
              line-height: 1.7;
            }

            .udf-price {
              background: #f8fbf7;
            }

            .udf-note {
              font-size: 11px;
              color: #9a8675;
              line-height: 1.7;
            }

            .udf-photo {
              position: relative;
              background: #ecf0e9;
              border-radius: 10px;
              overflow: hidden;
            }

            .udf-photo-button {
              position: relative;
              display: block;
              width: 100%;
              padding: 0;
              border: 0;
              background: transparent;
            }

            .udf-photo-button img {
              display: block;
              width: 100%;
              height: clamp(300px, 42vw, 560px);
              object-fit: contain;
            }

            .udf-photo-button span {
              position: absolute;
              right: 12px;
              bottom: 12px;
              background: #1d3e30dd;
              color: white;
              padding: 9px 12px;
              border-radius: 7px;
              font-size: 11px;
            }

            .udf-no-photo {
              height: 360px;
              display: grid;
              place-items: center;
              color: #8fa093;
              background: #f2f5f0;
              font-size: 13px;
            }

            .udf-arrows {
              position: absolute;
              left: 10px;
              right: 10px;
              top: 50%;
              transform: translateY(-50%);
              display: flex;
              justify-content: space-between;
              pointer-events: none;
            }

            .udf-arrows button {
              pointer-events: auto;
              border: 0;
              background: #fffffff0;
              color: #235138;
              border-radius: 50%;
              width: 38px;
              height: 38px;
              font-size: 26px;
            }

            .udf-gallery-info {
              display: flex;
              justify-content: space-between;
              align-items: center;
              padding: 14px 3px 10px;
              font-size: 12px;
            }

            .udf-gallery-info small {
              color: #8b9a8b;
            }

            .udf-thumbs {
              display: flex;
              gap: 8px;
              overflow-x: auto;
            }

            .udf-thumbs button {
              flex: 0 0 74px;
              height: 65px;
              border: 2px solid transparent;
              border-radius: 8px;
              padding: 2px;
              background: #fff;
            }

            .udf-thumbs button.active {
              border-color: #31865b;
            }

            .udf-thumbs img {
              width: 100%;
              height: 100%;
              object-fit: cover;
              border-radius: 5px;
            }

            .udf-map {
              margin-top: 20px;
              padding: 17px;
            }

            .udf-map h2 {
              font-size: 21px;
              margin: 0 0 14px;
            }

            .udf-map .canvas-area {
              height: min(59vh, 640px);
              min-height: 400px;
            }

            .udf-state {
              background: white;
              border: 1px solid #e4ebe3;
              border-radius: 13px;
              min-height: 230px;
              display: flex;
              flex-direction: column;
              justify-content: center;
              align-items: center;
              gap: 12px;
              padding: 20px;
              text-align: center;
              color: #345d46;
            }

            .udf-state p {
              color: #7d9081;
              font-size: 12px;
            }

            .udf-state button {
              padding: 10px 15px;
              border: 1px solid #d7e6da;
              border-radius: 9px;
              background: #f2f8f2;
              color: #315c42;
            }

            .udf-lightbox {
              position: fixed;
              inset: 0;
              z-index: 999;
              background: #07180fed;
              display: grid;
              place-items: center;
              padding: 20px;
            }

            .udf-lightbox-inner {
              max-width: 1100px;
              width: 100%;
              color: white;
              text-align: center;
            }

            .udf-lightbox-inner > img {
              max-width: 100%;
              max-height: 75vh;
              object-fit: contain;
            }

            .udf-lightbox-bar,
            .udf-lightbox-actions {
              display: flex;
              justify-content: space-between;
              align-items: center;
              gap: 15px;
              margin-bottom: 12px;
            }

            .udf-lightbox-actions {
              justify-content: center;
              margin-top: 12px;
            }

            .udf-lightbox button {
              color: white;
              border: 1px solid #ffffff50;
              border-radius: 8px;
              padding: 9px 12px;
              background: #ffffff20;
            }

            @media (max-width: 1000px) {
              .udf-grid {
                grid-template-columns: 1fr;
              }

              .udf-photo-button img {
                height: 420px;
              }
            }

            @media (max-width: 650px) {
              .udf-title {
                align-items: flex-start;
              }

              .udf-title h1 {
                font-size: 28px;
              }

              .udf-back span {
                display: none;
              }

              .udf-section {
                padding: 17px;
              }

              .udf-photo-button img {
                height: 300px;
              }

              .udf-no-photo {
                height: 270px;
              }

              .udf-map {
                padding: 9px;
              }

              .udf-map .canvas-area {
                height: 390px;
              }
            }
          `}
        </style>

        {/* QUAY LẠI */}
        <div className="udf-back">
          <button type="button" onClick={back}>
            ← Quay về mặt bằng
          </button>

          <span>
            Phú Gia Royal Park / Chi tiết căn
          </span>
        </div>

        {loading ? (
          <div className="udf-state" role="status">
            Đang tải chi tiết căn...
          </div>
        ) : error ? (
          <div className="udf-state" role="alert">
            <strong>
              Không mở được trang chi tiết căn
            </strong>

            <p>{error}</p>

            <button type="button" onClick={back}>
              Quay về mặt bằng
            </button>
          </div>
        ) : detail ? (
          <>
            {/* TIÊU ĐỀ CĂN */}
            <header className="udf-title">
              <div>
                <small>
                  PHÚ GIA ROYAL PARK ·{" "}
                  {detail.zoneName || "QUY NHƠN"}
                </small>

                <h1>
                  {detail.unitCode ||
                    `Căn #${unitId}`}
                </h1>

                <p>
                  Thông tin được cập nhật
                  từ hệ thống dự án.
                </p>
              </div>

              <span
                className={`udf-status ${detail.saleStatus}`}
              >
                {STATUS[detail.saleStatus] ||
                  "Chưa cập nhật"}
              </span>
            </header>

            <div className="udf-grid">
              {/* THƯ VIỆN ẢNH */}
              <section className="udf-card udf-photo-card">
                <UnitGallery
                  key={unitId}
                  images={images}
                  code={detail.unitCode || unitId}
                />

                {extraError && (
                  <p className="udf-note">
                    {extraError}
                  </p>
                )}
              </section>

              {/* THÔNG TIN CĂN */}
              <div className="udf-side">
                <section className="udf-card udf-section">
                  <small>
                    THÔNG TIN BẤT ĐỘNG SẢN
                  </small>

                  <h2>Thông tin căn</h2>

                  <DetailRow
                    label="Mã căn"
                    value={detail.unitCode}
                  />

                  <DetailRow
                    label="Phân khu"
                    value={detail.zoneName}
                  />

                  <DetailRow
                    label="Diện tích đất"
                    value={
                      filled(detail.landArea)
                        ? displayNumber(
                            detail.landArea,
                            " m²"
                          )
                        : ""
                    }
                  />

                  <DetailRow
                    label="Hướng"
                    value={detail.direction}
                  />

                  <DetailRow
                    label="Diện tích sàn xây dựng"
                    value={
                      filled(
                        detail.constructionFloorArea
                      )
                        ? displayNumber(
                            detail.constructionFloorArea,
                            " m²"
                          )
                        : ""
                    }
                  />

                  <div>
                    <h3>Kết cấu</h3>

                    <p className="udf-description">
                      {filled(detail.structureDescription)
                        ? detail.structureDescription
                        : "Chưa cập nhật"}
                    </p>
                  </div>
                </section>

                {/* CÁC MỨC GIÁ */}
                  <section className="udf-card udf-section udf-price">
                    <small>BẢNG GIÁ</small>

                    <h2>
                      Giá và phương thức thanh toán
                    </h2>

                    <DetailRow
                      label="Giá gốc"
                      value={
                        filled(detail.basePrice)
                          ? displayNumber(
                              detail.basePrice,
                              " ₫"
                            )
                          : ""
                      }
                    />

                    <DetailRow
                      label="Thanh toán tiêu chuẩn"
                      value={
                        filled(
                          detail.standardPaymentPrice
                        )
                          ? displayNumber(
                              detail.standardPaymentPrice,
                              " ₫"
                            )
                          : ""
                      }
                    />

                    <DetailRow
                      label="Thanh toán sớm 70%"
                      value={
                        filled(detail.early70Price)
                          ? displayNumber(
                              detail.early70Price,
                              " ₫"
                            )
                          : ""
                      }
                    />

                    <DetailRow
                      label="Thanh toán sớm 95%"
                      value={
                        filled(detail.early95Price)
                          ? displayNumber(
                              detail.early95Price,
                              " ₫"
                            )
                          : ""
                      }
                    />
                  </section>
              </div>
            </div>

            {/* VỊ TRÍ CĂN */}
            {map &&
              selected &&
              parsePoints(
                selected.polygonJson
              ).length >= 3 && (
                <section className="udf-card udf-map">
                  <h2>
                    Vị trí căn trên mặt bằng
                  </h2>

                  <MapCanvas
                    key={`${planId}-${unitId}`}
                    imageUrl={map.imageUrl}
                    expectedWidth={map.imageWidth}
                    expectedHeight={map.imageHeight}
                    units={[
                      {
                        ...selected,
                        clickable: false,
                      },
                    ]}
                    mode="view"
                    selectedId={selected.id}
                    focusTarget={focus}
                  />
                </section>
              )}
          </>
        ) : null}
      </div>
    </PageLayout>
  );
}
