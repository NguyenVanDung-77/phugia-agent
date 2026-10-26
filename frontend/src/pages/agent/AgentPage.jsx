
import { useEffect, useMemo, useRef, useState } from "react";
import { api, API_BASE, TOKEN_KEY } from "../../api/client";
import PageLayout from "../../components/PageLayout";
import MapCanvas, { parsePoints } from "../../components/MapCanvas";
import "../../styles/agent-inventory.css";

const PLAN_ID = 1;
const DRAFT_KEY = "phugia-agent-polygon-draft-v1";
const MAX_IMAGES = 20;
const MAX_IMAGE_SIZE = 5 * 1024 * 1024;

const ZONES = [
  { code: "RUBY", name: "Ruby" },
  { code: "SAPPHIRE", name: "Sapphire" },
  { code: "CRYSTAL", name: "Crystal" },
];

const STATUSES = [
  { value: "AVAILABLE", label: "Chưa bán" },
  { value: "SOLD", label: "Đã bán" },
  { value: "NOT_OPEN", label: "Chưa mở bán" },
];

const FIELDS = {
  unitCode: "",
  imageUrl: "",
  landArea: "",
  direction: "",
  constructionFloorArea: "",
  structureDescription: "",
  basePrice: "",
  standardPaymentPrice: "",
  early70Price: "",
  early95Price: "",
  saleStatus: "AVAILABLE",
};

const TABS = [
  { id: "info", label: "Thông tin" },
  { id: "prices", label: "Giá bán" },
  { id: "photos", label: "Hình ảnh" },
  { id: "zone", label: "Phân khu" },
  { id: "manage", label: "Quản lý" },
];

function normalizeForm(data) {
  return Object.fromEntries(
    Object.keys(FIELDS).map((key) => [
      key,
      data?.[key] == null ? FIELDS[key] : String(data[key]),
    ])
  );
}

function polygonPoints(value) {
  return parsePoints(value);
}

function polygonSignature(value) {
  return JSON.stringify(
    polygonPoints(value).map(({ x, y }) => ({ x, y }))
  );
}

function samePolygon(draft, saved) {
  return (
    draft.zoneCode === saved.zoneCode &&
    polygonSignature(draft.points) ===
      polygonSignature(saved.polygonJson)
  );
}

function validPolygon(points, width, height) {
  if (
    !Array.isArray(points) ||
    points.length < 3 ||
    points.length > 150
  ) {
    return false;
  }

  if (
    !points.every(
      (p) =>
        Number.isFinite(p.x) &&
        Number.isFinite(p.y) &&
        p.x >= 0 &&
        p.y >= 0 &&
        p.x <= width &&
        p.y <= height
    )
  ) {
    return false;
  }

  const area = points.reduce((sum, point, index) => {
    const next = points[(index + 1) % points.length];
    return sum + point.x * next.y - next.x * point.y;
  }, 0);

  return Math.abs(area / 2) >= 1;
}

function readDrafts() {
  try {
    const parsed = JSON.parse(
      localStorage.getItem(DRAFT_KEY) || "[]"
    );

    if (!Array.isArray(parsed)) return [];

    return parsed
      .map((item, index) => ({
        id: String(item.id ?? `old-${index}`),
        zoneCode: item.zoneCode || "RUBY",
        unitCode: item.unitCode || null,
        saleStatus: item.saleStatus || "NOT_OPEN",
        points: polygonPoints(
          item.points ?? item.polygonJson
        ),
      }))
      .filter((item) => item.points.length >= 3);
  } catch {
    return [];
  }
}

function numberValue(value, field, maxDigits) {
  const text = String(value ?? "")
    .trim()
    .replace(",", ".");

  if (!text) return null;

  if (!/^\d+(\.\d{1,2})?$/.test(text)) {
    throw new Error(
      `${field}: nhập số không âm, tối đa 2 chữ số thập phân.`
    );
  }

  const integer =
    text.split(".")[0].replace(/^0+/, "") || "0";

  if (integer.length > maxDigits) {
    throw new Error(`${field}: số vượt giới hạn.`);
  }

  return text;
}

function detailPayload(form) {
  const imageUrl = form.imageUrl.trim();

  if (
    imageUrl &&
    !/^(https?:\/\/|\/)/i.test(imageUrl)
  ) {
    throw new Error(
      "Đường dẫn ảnh phải bắt đầu bằng http(s):// hoặc /."
    );
  }

  return {
    unitCode: form.unitCode.trim() || null,
    imageUrl: imageUrl || null,
    landArea: numberValue(form.landArea, "Diện tích đất", 10),
    direction: form.direction.trim() || null,
    constructionFloorArea: numberValue(
      form.constructionFloorArea,
      "Diện tích sàn",
      10
    ),
    structureDescription:
      form.structureDescription.trim() || null,
    basePrice: numberValue(form.basePrice, "Giá gốc", 17),
    standardPaymentPrice: numberValue(
      form.standardPaymentPrice,
      "Thanh toán tiêu chuẩn",
      17
    ),
    early70Price: numberValue(
      form.early70Price,
      "Thanh toán sớm 70%",
      17
    ),
    early95Price: numberValue(
      form.early95Price,
      "Thanh toán sớm 95%",
      17
    ),
    saleStatus: form.saleStatus,
  };
}

function photoUrl(raw) {
  if (!raw) return "";

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

    if (!["http:", "https:"].includes(url.protocol)) {
      return "";
    }

    if (
      ["localhost", "127.0.0.1"].includes(url.hostname) &&
      url.pathname.startsWith("/api/public/unit-images/")
    ) {
      return base + url.pathname + url.search;
    }

    return url.href;
  } catch {
    return "";
  }
}

function zoneBounds(zone) {
  if (!zone) return [];

  const polygon = polygonPoints(zone.polygonJson);

  if (polygon.length >= 3) return polygon;

  const allPoints = (zone.units || []).flatMap(
    (unit) => polygonPoints(unit.polygonJson)
  );

  if (allPoints.length < 3) return [];

  const xs = allPoints.map((p) => p.x);
  const ys = allPoints.map((p) => p.y);

  return [
    { x: Math.min(...xs), y: Math.min(...ys) },
    { x: Math.max(...xs), y: Math.min(...ys) },
    { x: Math.max(...xs), y: Math.max(...ys) },
    { x: Math.min(...xs), y: Math.max(...ys) },
  ];
}

function StatusBadge({ status }) {
  const label =
    STATUSES.find((item) => item.value === status)?.label ||
    "Chưa cập nhật";

  return (
    <span className={`ai-status ai-${status || "NOT_OPEN"}`}>
      <i />
      {label}
    </span>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder = "",
  inputMode,
  maxLength,
}) {
  return (
    <label className="ai-field">
      <span>{label}</span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        inputMode={inputMode}
        maxLength={maxLength}
      />
    </label>
  );
}

function downloadDraft(data) {
  const blob = new Blob(
    [JSON.stringify(data, null, 2)],
    { type: "application/json;charset=utf-8" }
  );

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");

  a.href = url;
  a.download = "phu-gia-polygon-draft.json";

  document.body.appendChild(a);
  a.click();
  a.remove();

  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function sendPhotos(unitId, files) {
  const token = sessionStorage.getItem(TOKEN_KEY);

  if (!token) throw new Error("Bạn cần đăng nhập lại.");

  const formData = new FormData();

  files.forEach((file) => formData.append("files", file));

  const response = await fetch(
    `${API_BASE.replace(/\/$/, "")}/api/agent/units/${unitId}/gallery`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: formData,
    }
  );

  if (!response.ok) {
    let message = "";

    try {
      const body = await response.json();
      message = body.detail || body.message || "";
    } catch {
      // Backend có thể trả lỗi không phải JSON.
    }

    throw new Error(
      message || `Tải ảnh thất bại (${response.status}).`
    );
  }

  return response.json();
}

export default function AgentPage() {
  // ======================================
  // DỮ LIỆU MẶT BẰNG
  // ======================================

  const [map, setMap] = useState(null);
  const [savedUnits, setSavedUnits] = useState([]);
  const [drafts, setDrafts] = useState(readDrafts);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [savingDrafts, setSavingDrafts] = useState(false);

  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  // ======================================
  // HAI MÀN HÌNH RIÊNG
  // ======================================

  const [screen, setScreen] = useState("browse");
  const [addOpen, setAddOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("info");

  const [selectedZone, setSelectedZone] = useState("ALL");
  const [search, setSearch] = useState("");

  // ======================================
  // KHOANH CĂN MỚI
  // ======================================

  const [zoneCode, setZoneCode] = useState("RUBY");
  const [draftCode, setDraftCode] = useState("");
  const [draftStatus, setDraftStatus] = useState("AVAILABLE");

  const [tool, setTool] = useState("pan");
  const [points, setPoints] = useState([]);
  const [selectedDraftId, setSelectedDraftId] = useState(null);

  const [selectedMapId, setSelectedMapId] = useState(null);
  const [focusTarget, setFocusTarget] = useState(null);

  const importInputRef = useRef(null);
  const focusCounter = useRef(0);

  // ======================================
  // CHỈNH SỬA CĂN ĐÃ LƯU
  // ======================================

  const [selectedSavedId, setSelectedSavedId] = useState(null);

  const [details, setDetails] = useState({ ...FIELDS });
  const [originalDetails, setOriginalDetails] =
    useState({ ...FIELDS });

  const [detailsLoading, setDetailsLoading] = useState(false);
  const [detailsSaving, setDetailsSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const detailRequest = useRef(0);

  // ======================================
  // PHÂN KHU ĐÃ LƯU
  // ======================================

  const [editingZone, setEditingZone] = useState("RUBY");
  const [originalZone, setOriginalZone] = useState("RUBY");
  const [savingZone, setSavingZone] = useState(false);

  // ======================================
  // ẢNH CĂN
  // ======================================

  const [gallery, setGallery] = useState([]);
  const [galleryError, setGalleryError] = useState("");

  const [pendingPhotos, setPendingPhotos] = useState([]);
  const [uploadingPhotos, setUploadingPhotos] = useState(false);
  const [removingPhotoIndex, setRemovingPhotoIndex] = useState(null);

  const photoInputRef = useRef(null);

  const zones = map?.zones?.length ? map.zones : ZONES;

  const detailsDirty =
    selectedSavedId !== null &&
    !detailsLoading &&
    JSON.stringify(details) !== JSON.stringify(originalDetails);

  const zoneDirty =
    selectedSavedId !== null &&
    editingZone !== originalZone;

  const busy =
    detailsLoading ||
    detailsSaving ||
    deleting ||
    uploadingPhotos ||
    removingPhotoIndex !== null ||
    savingZone;

  // ======================================
  // LẤY DỮ LIỆU MYSQL
  // ======================================

  useEffect(() => {
    let active = true;

    Promise.all([
      api(`/api/public/master-plans/${PLAN_ID}/map`),
      api(`/api/agent/master-plans/${PLAN_ID}/units`),
    ])
      .then(([mapData, unitData]) => {
        if (!active) return;

        setMap(mapData);
        setSavedUnits(
          Array.isArray(unitData) ? unitData : []
        );
      })
      .catch((err) => {
        if (active) {
          setError(err.message);
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    localStorage.setItem(
      DRAFT_KEY,
      JSON.stringify(drafts)
    );
  }, [drafts]);

  useEffect(() => {
    return () => {
      pendingPhotos.forEach((photo) =>
        URL.revokeObjectURL(photo.preview)
      );
    };
  }, [pendingPhotos]);

  // ======================================
  // DANH SÁCH BẢN NHÁP CHƯA LƯU
  // ======================================

  const pendingDrafts = useMemo(
    () =>
      drafts.filter(
        (draft) =>
          !savedUnits.some(
            (saved) => samePolygon(draft, saved)
          )
      ),
    [drafts, savedUnits]
  );

  const syncedCount = drafts.length - pendingDrafts.length;

  // ======================================
  // POLYGON TRÊN BẢN ĐỒ
  // ======================================

  const mapUnits = useMemo(
    () => [
      ...savedUnits.map((unit) => ({
        id: `db-${unit.id}`,
        databaseId: unit.id,
        source: "database",
        zoneCode: unit.zoneCode,
        unitCode: unit.unitCode,
        saleStatus: unit.saleStatus,
        points: polygonPoints(unit.polygonJson),
      })),
      ...pendingDrafts.map((unit) => ({
        ...unit,
        id: `draft-${unit.id}`,
        draftId: unit.id,
        source: "draft",
      })),
    ],
    [savedUnits, pendingDrafts]
  );

  // ======================================
  // NHÓM CĂN THEO RUBY / SAPPHIRE / CRYSTAL
  // ======================================

  const groups = useMemo(() => {
    const keyword = search
      .trim()
      .toLocaleLowerCase("vi-VN");

    return zones
      .filter(
        (zone) =>
          selectedZone === "ALL" ||
          zone.code === selectedZone
      )
      .map((zone) => ({
        ...zone,

        saved: savedUnits
          .filter((unit) => unit.zoneCode === zone.code)
          .filter(
            (unit) =>
              !keyword ||
              String(unit.unitCode || `Căn #${unit.id}`)
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

        pending: pendingDrafts
          .filter((unit) => unit.zoneCode === zone.code)
          .filter(
            (unit) =>
              !keyword ||
              String(unit.unitCode || "Căn chưa mã")
                .toLocaleLowerCase("vi-VN")
                .includes(keyword)
          ),
      }));
  }, [zones, savedUnits, pendingDrafts, selectedZone, search]);

  const activeSaved = savedUnits.find(
    (unit) => unit.id === selectedSavedId
  );

  const visibleMapUnits =
    screen === "detail"
      ? mapUnits.filter(
          (unit) =>
            unit.source === "database" &&
            unit.databaseId === selectedSavedId
        )
      : selectedZone === "ALL"
        ? mapUnits
        : mapUnits.filter(
            (unit) => unit.zoneCode === selectedZone
          );

  // ======================================
  // HÀM ĐIỀU HƯỚNG
  // ======================================

  function focusPolygon(vertices) {
    const polygon = polygonPoints(vertices);

    if (polygon.length < 3) {
      setFocusTarget(null);
      return;
    }

    setFocusTarget({
      points: polygon,
      key: ++focusCounter.current,
    });
  }

  function chooseZone(code) {
    setSelectedZone(code);

    if (code === "ALL") {
      setFocusTarget(null);
      return;
    }

    const zone = zones.find((item) => item.code === code);
    focusPolygon(zoneBounds(zone));
  }

  function confirmLeaving() {
    if (busy || savingDrafts) return false;

    if (
      !detailsDirty &&
      !zoneDirty &&
      pendingPhotos.length === 0 &&
      points.length === 0
    ) {
      return true;
    }

    return window.confirm(
      "Có thông tin, ảnh hoặc vùng khoanh chưa lưu. Bạn muốn bỏ các thay đổi này?"
    );
  }

  function clearPhotoSelection() {
    setPendingPhotos([]);

    if (photoInputRef.current) {
      photoInputRef.current.value = "";
    }
  }

  function clearEditor() {
    detailRequest.current += 1;

    setSelectedSavedId(null);
    setDetails({ ...FIELDS });
    setOriginalDetails({ ...FIELDS });

    setDetailsLoading(false);

    setGallery([]);
    setGalleryError("");

    setEditingZone("RUBY");
    setOriginalZone("RUBY");

    clearPhotoSelection();
  }

  function backToList() {
    if (!confirmLeaving()) return;

    clearEditor();

    setScreen("browse");
    setActiveTab("info");
    setSelectedMapId(null);
    setFocusTarget(null);
    setTool("pan");
    setPoints([]);

    window.scrollTo(0, 0);
  }

  function toggleAdd() {
    if (addOpen) {
      if (
        points.length &&
        !window.confirm(
          "Đóng công cụ thêm căn và hủy vùng đang khoanh?"
        )
      ) {
        return;
      }

      setAddOpen(false);
      setPoints([]);
      setTool("pan");
      return;
    }

    if (!confirmLeaving()) return;

    clearEditor();

    setAddOpen(true);
    setScreen("browse");
    setTool("pan");
    setPoints([]);
    setSelectedDraftId(null);
    setSelectedMapId(null);

    if (selectedZone !== "ALL") {
      setZoneCode(selectedZone);
    }
  }

  // ======================================
  // LÀM MỚI MYSQL
  // ======================================

  async function refreshDatabase() {
    setRefreshing(true);

    try {
      const response = await api(
        `/api/agent/master-plans/${PLAN_ID}/units`
      );

      setSavedUnits(
        Array.isArray(response) ? response : []
      );

      return true;
    } catch (err) {
      setError(
        `Không tải được dữ liệu MySQL: ${err.message}`
      );
      return false;
    } finally {
      setRefreshing(false);
    }
  }

  // ======================================
  // MỞ MÀN HÌNH CHỈNH SỬA RIÊNG
  // ======================================

  async function selectSaved(unit) {
    if (!unit || !confirmLeaving()) return;

    const request = ++detailRequest.current;

    setScreen("detail");
    setAddOpen(false);
    setActiveTab("info");

    setSelectedSavedId(unit.id);
    setSelectedDraftId(null);
    setSelectedMapId(`db-${unit.id}`);

    setTool("pan");
    setPoints([]);

    setDetailsLoading(true);
    setDetails({ ...FIELDS });
    setOriginalDetails({ ...FIELDS });

    setGallery([]);
    setGalleryError("");

    clearPhotoSelection();

    setEditingZone(unit.zoneCode);
    setOriginalZone(unit.zoneCode);

    setError("");
    setNotice("");

    focusPolygon(unit.polygonJson);

    window.scrollTo(0, 0);

    const [info, images] = await Promise.allSettled([
      api(`/api/agent/units/${unit.id}`),
      api(`/api/agent/units/${unit.id}/gallery`),
    ]);

    if (request !== detailRequest.current) return;

    if (info.status === "fulfilled") {
      const form = normalizeForm(info.value);

      setDetails(form);
      setOriginalDetails(form);
    } else {
      setError(
        `Không tải được chi tiết căn: ${info.reason.message}`
      );
      setSelectedSavedId(null);
      setScreen("browse");
    }

    if (images.status === "fulfilled") {
      setGallery(images.value.images || []);
    } else {
      setGalleryError(
        `Không tải được ảnh: ${images.reason.message}`
      );
    }

    setDetailsLoading(false);
  }

  function selectDraft(draft) {
    if (!draft || !confirmLeaving()) return;

    clearEditor();

    setScreen("browse");
    setAddOpen(true);
    setTool("pan");

    setSelectedDraftId(draft.id);
    setSelectedMapId(`draft-${draft.id}`);

    setZoneCode(draft.zoneCode);
    setDraftCode(draft.unitCode || "");
    setDraftStatus(draft.saleStatus);

    setSelectedZone(draft.zoneCode);

    setPoints([]);

    focusPolygon(draft.points);

    setError("");
  }

  function clickMapUnit(unit) {
    if (unit.source === "database") {
      const saved = savedUnits.find(
        (item) => item.id === unit.databaseId
      );
      selectSaved(saved);
      return;
    }

    const draft = pendingDrafts.find(
      (item) => item.id === unit.draftId
    );

    selectDraft(draft);
  }

  // ======================================
  // KHOANH VÙNG CĂN MỚI
  // ======================================

  function addPoint(point) {
    if (tool !== "draw") return;

    setPoints((old) => {
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

  function finishPolygon() {
    setError("");
    setNotice("");

    if (
      !map ||
      !validPolygon(
        points,
        map.imageWidth,
        map.imageHeight
      )
    ) {
      setError(
        "Polygon phải có 3–150 điểm hợp lệ và nằm trong ảnh."
      );
      return;
    }

    const draft = {
      id:
        `local-${Date.now()}-` +
        Math.random().toString(36).slice(2, 8),

      zoneCode,
      unitCode: draftCode.trim() || null,
      saleStatus: draftStatus,
      points: [...points],
    };

    setDrafts((old) => [...old, draft]);

    setSelectedDraftId(draft.id);
    setSelectedMapId(`draft-${draft.id}`);

    setPoints([]);
    setDraftCode("");
    setTool("pan");

    setSelectedZone(zoneCode);

    setNotice(
      "Đã khoanh căn và tạo bản nháp. Hãy lưu vào MySQL để chỉnh sửa thông tin và ảnh."
    );
  }

  function updateDraft() {
    if (
      !pendingDrafts.some(
        (item) => item.id === selectedDraftId
      )
    ) {
      setError("Chọn một bản nháp chưa lưu MySQL.");
      return;
    }

    setDrafts((old) =>
      old.map((draft) =>
        draft.id === selectedDraftId
          ? {
              ...draft,
              zoneCode,
              unitCode: draftCode.trim() || null,
              saleStatus: draftStatus,
            }
          : draft
      )
    );

    setSelectedZone(zoneCode);
    setNotice("Đã cập nhật bản nháp.");
    setError("");
  }

  function deleteDraft(id) {
    if (
      !window.confirm(
        "Xóa bản nháp này? Dữ liệu MySQL không bị ảnh hưởng."
      )
    ) {
      return;
    }

    setDrafts((old) =>
      old.filter((draft) => draft.id !== id)
    );

    if (selectedDraftId === id) {
      setSelectedDraftId(null);
      setSelectedMapId(null);
    }

    setNotice("Đã xóa bản nháp.");
  }

  // ======================================
  // LƯU CĂN MỚI VÀO MYSQL
  // ======================================

  async function saveDraftsToMysql() {
    if (!map || savingDrafts) return;

    if (!pendingDrafts.length) {
      setNotice("Không có bản nháp cần lưu.");
      return;
    }

    if (pendingDrafts.length > 200) {
      setError("Mỗi lần chỉ lưu tối đa 200 căn.");
      return;
    }

    for (const draft of pendingDrafts) {
      if (
        !map.zones.some(
          (zone) => zone.code === draft.zoneCode
        ) ||
        !STATUSES.some(
          (status) => status.value === draft.saleStatus
        ) ||
        !validPolygon(
          draft.points,
          map.imageWidth,
          map.imageHeight
        )
      ) {
        setError(
          "Có bản nháp sai phân khu, trạng thái hoặc tọa độ."
        );
        return;
      }
    }

    if (
      !window.confirm(
        `Lưu ${pendingDrafts.length} căn mới vào MySQL?`
      )
    ) {
      return;
    }

    setSavingDrafts(true);
    setError("");

    try {
      const result = await api(
        `/api/agent/master-plans/${map.id}/import-draft`,
        {
          method: "POST",
          body: JSON.stringify({
            imageUrl: map.imageUrl,
            imageWidth: map.imageWidth,
            imageHeight: map.imageHeight,
            units: pendingDrafts.map((draft) => ({
              zoneCode: draft.zoneCode,
              unitCode: draft.unitCode,
              saleStatus: draft.saleStatus,
              polygonJson: JSON.stringify(draft.points),
            })),
          }),
        }
      );

      if (Array.isArray(result.units)) {
        setDrafts((old) =>
          old.filter(
            (draft) =>
              !result.units.some(
                (saved) => samePolygon(draft, saved)
              )
          )
        );
      }

      await refreshDatabase();

      clearEditor();

      setSelectedDraftId(null);
      setSelectedMapId(null);
      setPoints([]);
      setTool("pan");
      setAddOpen(false);

      setNotice(
        `Đã lưu ${result.created} căn, bỏ qua ${result.skipped} căn trùng.`
      );
    } catch (err) {
      setError(
        `Không thể lưu MySQL: ${err.message}`
      );
    } finally {
      setSavingDrafts(false);
    }
  }

  // ======================================
  // XUẤT / NHẬP BẢN NHÁP JSON
  // ======================================

  function exportDrafts() {
    if (!map) return;

    downloadDraft({
      imageUrl: map.imageUrl,
      imageWidth: map.imageWidth,
      imageHeight: map.imageHeight,

      units: drafts.map((draft) => ({
        zoneCode: draft.zoneCode,
        unitCode: draft.unitCode,
        saleStatus: draft.saleStatus,
        polygonJson: JSON.stringify(draft.points),
      })),
    });
  }

  async function importDrafts(event) {
    const file = event.target.files?.[0];

    if (!file) return;

    try {
      if (!map) {
        throw new Error("Chưa tải mặt bằng.");
      }

      const data = JSON.parse(await file.text());

      if (
        data.imageWidth !== map.imageWidth ||
        data.imageHeight !== map.imageHeight ||
        !Array.isArray(data.units) ||
        data.units.length > 200
      ) {
        throw new Error(
          "JSON không đúng kích thước mặt bằng hoặc quá 200 căn."
        );
      }

      const imported = data.units.map((item, index) => {
        const vertices = polygonPoints(
          item.polygonJson ?? item.points
        );

        if (
          !map.zones.some(
            (zone) => zone.code === item.zoneCode
          ) ||
          !STATUSES.some(
            (status) => status.value === item.saleStatus
          ) ||
          !validPolygon(
            vertices,
            map.imageWidth,
            map.imageHeight
          )
        ) {
          throw new Error(
            `Căn thứ ${index + 1} trong JSON không hợp lệ.`
          );
        }

        return {
          id: `import-${Date.now()}-${index}`,
          zoneCode: item.zoneCode,
          unitCode: item.unitCode || null,
          saleStatus: item.saleStatus,
          points: vertices,
        };
      });

      if (
        !window.confirm(
          `Thay bản nháp cũ bằng ${imported.length} căn?`
        )
      ) {
        return;
      }

      setDrafts(imported);
      setSelectedDraftId(null);
      setSelectedMapId(null);
      setPoints([]);
      setTool("pan");

      setNotice(
        `Đã nhập ${imported.length} bản nháp.`
      );
      setError("");
    } catch (err) {
      setError(err.message);
    } finally {
      event.target.value = "";
    }
  }

  // ======================================
  // CHỈNH SỬA THÔNG TIN CĂN
  // ======================================

  function changeDetail(key, value) {
    setDetails((old) => ({
      ...old,
      [key]: value,
    }));
  }

  async function saveDetails(event) {
    event.preventDefault();

    if (!selectedSavedId || busy) return;

    let body;

    try {
      body = detailPayload(details);
    } catch (err) {
      setError(err.message);
      return;
    }

    setDetailsSaving(true);
    setError("");

    try {
      const updated = await api(
        `/api/agent/units/${selectedSavedId}`,
        {
          method: "PUT",
          body: JSON.stringify(body),
        }
      );

      const form = normalizeForm(updated);

      setDetails(form);
      setOriginalDetails(form);

      await refreshDatabase();

      setNotice(
        "Đã cập nhật căn thành công. Polygon và thư viện ảnh được giữ nguyên."
      );
    } catch (err) {
      setError(
        `Không thể cập nhật căn: ${err.message}`
      );
    } finally {
      setDetailsSaving(false);
    }
  }

  // ======================================
  // ĐỔI PHÂN KHU CĂN ĐÃ LƯU
  // ======================================

  async function saveUnitZone() {
    if (
      !selectedSavedId ||
      busy ||
      !zoneDirty
    ) {
      return;
    }

    const unit = savedUnits.find(
      (item) => item.id === selectedSavedId
    );

    if (!unit) {
      setError("Không tìm thấy căn đã lưu.");
      return;
    }

    if (
      !zones.some(
        (zone) => zone.code === editingZone
      )
    ) {
      setError("Phân khu không hợp lệ.");
      return;
    }

    if (
      !window.confirm(
        `Chuyển căn ${unit.unitCode || `#${unit.id}`} sang ${editingZone}?`
      )
    ) {
      return;
    }

    setSavingZone(true);
    setError("");

    try {
      const result = await api(
        `/api/agent/units/${selectedSavedId}/zone`,
        {
          method: "PUT",
          body: JSON.stringify({
            zoneCode: editingZone,
          }),
        }
      );

      setDrafts((old) =>
        old.map((draft) =>
          draft.zoneCode === originalZone &&
          polygonSignature(draft.points) ===
            polygonSignature(unit.polygonJson)
            ? {
                ...draft,
                zoneCode: result.zoneCode,
              }
            : draft
        )
      );

      setEditingZone(result.zoneCode);
      setOriginalZone(result.zoneCode);

      await refreshDatabase();

      setNotice(
        `Đã chuyển căn sang ${result.zoneName}. Polygon, ảnh và thông tin vẫn giữ nguyên.`
      );
    } catch (err) {
      setError(
        `Chuyển phân khu thất bại: ${err.message}`
      );
    } finally {
      setSavingZone(false);
    }
  }

  // ======================================
  // XỬ LÝ HÌNH ẢNH
  // ======================================

  function choosePhotos(event) {
    const files = Array.from(
      event.target.files || []
    );

    if (!files.length) return;

    if (
      files.length > 4 ||
      !files.every(
        (file) =>
          ["image/jpeg", "image/png"].includes(file.type) &&
          file.size > 0 &&
          file.size <= MAX_IMAGE_SIZE
      )
    ) {
      setError(
        "Chỉ chọn tối đa 4 ảnh JPG/PNG mỗi lần, tối đa 5 MB/ảnh."
      );
      event.target.value = "";
      return;
    }

    if (
      gallery.length + files.length > MAX_IMAGES
    ) {
      setError(
        `Mỗi căn chỉ được tối đa ${MAX_IMAGES} ảnh.`
      );
      event.target.value = "";
      return;
    }

    setPendingPhotos(
      files.map((file) => ({
        file,
        preview: URL.createObjectURL(file),
      }))
    );

    setError("");
  }

  async function uploadPhotos() {
    if (
      !selectedSavedId ||
      !pendingPhotos.length ||
      busy
    ) {
      return;
    }

    setUploadingPhotos(true);
    setError("");

    try {
      const response = await sendPhotos(
        selectedSavedId,
        pendingPhotos.map((item) => item.file)
      );

      const images = Array.isArray(response.images)
        ? response.images
        : [];

      setGallery(images);
      setGalleryError("");

      if (!details.imageUrl && images.length) {
        setDetails((old) => ({
          ...old,
          imageUrl: images[0].imageUrl,
        }));

        setOriginalDetails((old) => ({
          ...old,
          imageUrl: images[0].imageUrl,
        }));
      }

      clearPhotoSelection();

      setNotice(
        `Đã tải ảnh thành công. Căn hiện có ${images.length} ảnh.`
      );
    } catch (err) {
      setError(
        `Tải ảnh thất bại: ${err.message}`
      );
    } finally {
      setUploadingPhotos(false);
    }
  }

  async function removePhoto(image) {
    if (!selectedSavedId || busy) return;

    if (
      !window.confirm(
        `Xóa ảnh số ${image.index + 1}?`
      )
    ) {
      return;
    }

    setRemovingPhotoIndex(image.index);
    setError("");

    try {
      const response = await api(
        `/api/agent/units/${selectedSavedId}/gallery/${image.index}`,
        {
          method: "DELETE",
        }
      );

      const images = response.images || [];

      setGallery(images);

      if (
        details.imageUrl === image.imageUrl
      ) {
        const next = images[0]?.imageUrl || "";

        setDetails((old) => ({
          ...old,
          imageUrl: next,
        }));

        setOriginalDetails((old) => ({
          ...old,
          imageUrl: next,
        }));
      }

      setNotice("Đã xóa ảnh thành công.");
    } catch (err) {
      setError(
        `Xóa ảnh thất bại: ${err.message}`
      );
    } finally {
      setRemovingPhotoIndex(null);
    }
  }

  // ======================================
  // XÓA THÔNG TIN / XÓA CĂN
  // ======================================

  async function clearDetails() {
    if (!selectedSavedId || busy) return;

    if (
      !window.confirm(
        "Xóa thông tin căn, giữ Polygon, phân khu và thư viện ảnh?"
      )
    ) {
      return;
    }

    setDeleting(true);
    setError("");

    try {
      const data = await api(
        `/api/agent/units/${selectedSavedId}/details`,
        {
          method: "DELETE",
        }
      );

      const form = normalizeForm(data);

      setDetails(form);
      setOriginalDetails(form);

      await refreshDatabase();

      const photos = await api(
        `/api/agent/units/${selectedSavedId}/gallery`
      );

      setGallery(photos.images || []);

      setNotice(
        "Đã xóa thông tin. Polygon, phân khu và ảnh được giữ nguyên."
      );
    } catch (err) {
      setError(
        `Xóa thông tin thất bại: ${err.message}`
      );
    } finally {
      setDeleting(false);
    }
  }

  async function deleteSaved() {
    if (!selectedSavedId || busy) return;

    const id = selectedSavedId;

    const unit = savedUnits.find(
      (item) => item.id === id
    );

    if (
      !window.confirm(
        `XÓA HẲN căn #${id} và Polygon khỏi MySQL? Không thể hoàn tác.`
      )
    ) {
      return;
    }

    setDeleting(true);
    setError("");

    try {
      await api(
        `/api/agent/units/${id}`,
        {
          method: "DELETE",
        }
      );

      if (unit) {
        setDrafts((old) =>
          old.filter(
            (draft) => !samePolygon(draft, unit)
          )
        );
      }

      setSavedUnits((old) =>
        old.filter((item) => item.id !== id)
      );

      clearEditor();

      setSelectedMapId(null);
      setScreen("browse");

      await refreshDatabase();

      setNotice(
        `Đã xóa căn #${id} và Polygon khỏi MySQL.`
      );
    } catch (err) {
      setError(
        `Xóa căn thất bại: ${err.message}`
      );
    } finally {
      setDeleting(false);
    }
  }

  // ======================================
  // GIAO DIỆN CHÍNH
  // ======================================

  return (
    <PageLayout
      title={
        screen === "detail"
          ? `Chỉnh sửa ${activeSaved?.unitCode || `căn #${selectedSavedId}`}`
          : "Quản lý căn"
      }
      subtitle={
        screen === "detail"
          ? "Chỉnh sửa thông tin, giá, ảnh và phân khu theo từng mục."
          : "Danh sách căn theo từng phân khu và bản đồ tương tác."
      }
    >
      <div className="ai-root">
        {error && (
          <div className="error-box" role="alert">
            {error}
          </div>
        )}

        {notice && (
          <div className="notice-box" role="status">
            {notice}
          </div>
        )}

        {loading && (
          <div className="notice-box">
            Đang tải dữ liệu...
          </div>
        )}

        {screen === "browse" ? (
          <>
            {/* ================================
                MÀN HÌNH 1: QUẢN LÝ CĂN
            ================================= */}

            <div className="ai-headline">
              <div>
                <span className="ai-eyebrow">
                  KHO CĂN · PHÚ GIA ROYAL PARK
                </span>
                <h2>Danh sách căn theo phân khu</h2>
                <p>
                  Chọn phân khu, xem mặt bằng và
                  nhấn vào căn để chỉnh sửa.
                </p>
              </div>

              <div className="ai-headline-actions">
                <button
                  type="button"
                  className="btn btn-outline"
                  disabled={refreshing}
                  onClick={refreshDatabase}
                >
                  {refreshing
                    ? "Đang làm mới..."
                    : "↻ Làm mới"}
                </button>

                <button
                  type="button"
                  className={`ai-add-btn ${
                    addOpen ? "open" : ""
                  }`}
                  onClick={toggleAdd}
                  aria-expanded={addOpen}
                >
                  <span className="ai-plus">
                    {addOpen ? "−" : "+"}
                  </span>
                  {addOpen
                    ? "Đóng công cụ"
                    : "Thêm căn mới"}
                </button>
              </div>
            </div>

            {/* THỐNG KÊ NHỎ */}
            <div className="ai-mini-metrics">
              <div>
                <strong>{savedUnits.length}</strong>
                <span>Căn đã lưu MySQL</span>
              </div>
              <div>
                <strong>{pendingDrafts.length}</strong>
                <span>Căn chưa lưu</span>
              </div>
              <div>
                <strong>
                  {
                    savedUnits.filter(
                      (unit) =>
                        unit.saleStatus === "AVAILABLE"
                    ).length
                  }
                </strong>
                <span>Chưa bán</span>
              </div>
              <div>
                <strong>
                  {
                    savedUnits.filter(
                      (unit) =>
                        unit.saleStatus === "SOLD"
                    ).length
                  }
                </strong>
                <span>Đã bán</span>
              </div>
            </div>

            {/* ================================
                NÚT + MỞ KHUNG KHOANH CĂN
            ================================= */}

            {addOpen && (
              <section className="ai-create">
                <div className="ai-create-title">
                  <span className="ai-create-number">
                    +
                  </span>

                  <div>
                    <strong>Khoanh vùng căn mới</strong>
                    <p>
                      Nhập thông tin cơ bản, chọn
                      Khoanh căn rồi chấm các điểm
                      trên bản đồ phía dưới.
                    </p>
                  </div>
                </div>

                <div className="ai-create-fields">
                  <label className="ai-field">
                    <span>Phân khu</span>
                    <select
                      value={zoneCode}
                      onChange={(event) =>
                        setZoneCode(event.target.value)
                      }
                    >
                      {zones.map((zone) => (
                        <option
                          key={zone.code}
                          value={zone.code}
                        >
                          {zone.name}
                        </option>
                      ))}
                    </select>
                  </label>

                  <Field
                    label="Mã căn (có thể để trống)"
                    value={draftCode}
                    maxLength={50}
                    placeholder="Ví dụ: RUBY-015"
                    onChange={setDraftCode}
                  />

                  <label className="ai-field">
                    <span>Tình trạng căn</span>
                    <select
                      value={draftStatus}
                      onChange={(event) =>
                        setDraftStatus(event.target.value)
                      }
                    >
                      {STATUSES.map((status) => (
                        <option
                          key={status.value}
                          value={status.value}
                        >
                          {status.label}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                <div className="ai-create-actions">
                  <button
                    type="button"
                    className={`btn ${
                      tool === "pan"
                        ? "btn-primary"
                        : "btn-outline"
                    }`}
                    onClick={() => setTool("pan")}
                  >
                    ↔ Di chuyển bản đồ
                  </button>

                  <button
                    type="button"
                    className={`btn ${
                      tool === "draw"
                        ? "btn-primary"
                        : "btn-outline"
                    }`}
                    onClick={() => {
                      setPoints([]);
                      setSelectedDraftId(null);
                      setSelectedMapId(null);
                      setTool("draw");
                    }}
                  >
                    ✎ Khoanh căn
                  </button>

                  <span className="ai-point-count">
                    {points.length} điểm
                  </span>

                  <button
                    type="button"
                    className="btn btn-outline"
                    disabled={!points.length}
                    onClick={() =>
                      setPoints((old) =>
                        old.slice(0, -1)
                      )
                    }
                  >
                    Bỏ điểm cuối
                  </button>

                  <button
                    type="button"
                    className="btn btn-outline"
                    disabled={!points.length}
                    onClick={() => setPoints([])}
                  >
                    Hủy vùng
                  </button>

                  <button
                    type="button"
                    className="btn btn-primary"
                    disabled={
                      !map ||
                      points.length < 3
                    }
                    onClick={finishPolygon}
                  >
                    Hoàn tất vùng căn
                  </button>
                </div>

                <div className="ai-create-foot">
                  <button
                    type="button"
                    className="btn btn-outline"
                    disabled={!selectedDraftId}
                    onClick={updateDraft}
                  >
                    Cập nhật bản nháp
                  </button>

                  <button
                    type="button"
                    className="btn btn-primary"
                    disabled={
                      !map ||
                      savingDrafts ||
                      !pendingDrafts.length
                    }
                    onClick={saveDraftsToMysql}
                  >
                    {savingDrafts
                      ? "Đang lưu..."
                      : `Lưu ${pendingDrafts.length} căn vào MySQL`}
                  </button>

                  <button
                    type="button"
                    className="btn btn-outline"
                    disabled={
                      !map ||
                      !drafts.length
                    }
                    onClick={exportDrafts}
                  >
                    Xuất JSON
                  </button>

                  <button
                    type="button"
                    className="btn btn-outline"
                    onClick={() =>
                      importInputRef.current?.click()
                    }
                  >
                    Nhập JSON
                  </button>

                  <input
                    type="file"
                    hidden
                    ref={importInputRef}
                    accept=".json,application/json"
                    onChange={importDrafts}
                  />

                  {syncedCount > 0 && (
                    <span className="muted small">
                      {syncedCount} nháp đã khớp MySQL
                    </span>
                  )}
                </div>
              </section>
            )}

            {/* ================================
                CHỌN PHÂN KHU
            ================================= */}

            <div
              className="ai-zone-filter"
              role="group"
              aria-label="Chọn phân khu"
            >
              <button
                type="button"
                className={
                  selectedZone === "ALL"
                    ? "active"
                    : ""
                }
                onClick={() => chooseZone("ALL")}
              >
                Toàn bộ
                <small>{savedUnits.length}</small>
              </button>

              {zones.map((zone) => (
                <button
                  type="button"
                  key={zone.code}
                  className={
                    selectedZone === zone.code
                      ? "active"
                      : ""
                  }
                  onClick={() =>
                    chooseZone(zone.code)
                  }
                >
                  {zone.name}
                  <small>
                    {
                      savedUnits.filter(
                        (unit) =>
                          unit.zoneCode === zone.code
                      ).length
                    }
                  </small>
                </button>
              ))}
            </div>

            {/* BẢN ĐỒ LỚN */}
            <section className="ai-map-panel">
              <header className="ai-map-header">
                <div>
                  <strong>Mặt bằng dự án</strong>
                  <span>
                    {tool === "draw"
                      ? "Đang khoanh căn: chấm các điểm trên bản đồ"
                      : "Nhấn Polygon để mở căn hoặc chọn bên dưới"}
                  </span>
                </div>

                <span className="ai-map-mode">
                  {tool === "draw"
                    ? "● Đang khoanh"
                    : "Chế độ xem"}
                </span>
              </header>

              {map ? (
                <MapCanvas
                  imageUrl={map.imageUrl}
                  expectedWidth={map.imageWidth}
                  expectedHeight={map.imageHeight}
                  units={visibleMapUnits}
                  mode={tool}
                  points={points}
                  onAddPoint={addPoint}
                  onUnitClick={clickMapUnit}
                  selectedId={selectedMapId}
                  focusTarget={focusTarget}
                />
              ) : (
                <div className="ai-map-empty">
                  Chưa tải được mặt bằng.
                </div>
              )}
            </section>

            {/* ================================
                CÁC CĂN PHÂN NHÓM THEO PHÂN KHU
            ================================= */}

            <section className="ai-catalog">
              <div className="ai-catalog-header">
                <div>
                  <span className="ai-eyebrow">
                    QUẢN LÝ TỪNG CĂN
                  </span>
                  <h2>Các căn đã lưu</h2>
                </div>

                <label className="ai-catalog-search">
                  <span aria-hidden="true">⌕</span>
                  <input
                    type="search"
                    value={search}
                    placeholder="Tìm theo mã căn..."
                    aria-label="Tìm mã căn"
                    onChange={(event) =>
                      setSearch(event.target.value)
                    }
                  />
                </label>
              </div>

              {groups.map((group) => (
                <div
                  className="ai-zone-group"
                  key={group.code}
                >
                  <div className="ai-zone-group-head">
                    <div>
                      <span
                        className={`ai-zone-marker ${
                          group.code.toLowerCase()
                        }`}
                      />
                      <h3>
                        Phân khu {group.name}
                      </h3>
                    </div>

                    <span>
                      {group.saved.length} căn đã lưu
                      {" · "}
                      {group.pending.length} bản nháp
                    </span>
                  </div>

                  <div className="ai-cards">
                    {group.saved.map((unit) => (
                      <button
                        type="button"
                        key={`db-${unit.id}`}
                        className="ai-unit-card"
                        onClick={() =>
                          selectSaved(unit)
                        }
                      >
                        <span className="ai-card-icon">
                          ⌂
                        </span>

                        <span className="ai-card-body">
                          <strong>
                            {unit.unitCode ||
                              `Căn #${unit.id}`}
                          </strong>

                          <small>
                            <StatusBadge
                              status={unit.saleStatus}
                            />
                          </small>
                        </span>

                        <span className="ai-card-action">
                          Chỉnh sửa ↗
                        </span>
                      </button>
                    ))}

                    {group.pending.map((draft, index) => (
                      <div
                        className="ai-unit-card ai-draft-card"
                        key={`draft-${draft.id}`}
                      >
                        <span className="ai-card-icon">
                          ✎
                        </span>

                        <span className="ai-card-body">
                          <strong>
                            {draft.unitCode ||
                              `Bản nháp #${index + 1}`}
                          </strong>

                          <small>
                            <StatusBadge
                              status={draft.saleStatus}
                            />
                            {" · Chưa lưu"}
                          </small>
                        </span>

                        <div className="ai-draft-actions">
                          <button
                            type="button"
                            className="btn btn-outline"
                            onClick={() =>
                              selectDraft(draft)
                            }
                          >
                            Sửa
                          </button>

                          <button
                            type="button"
                            className="btn btn-danger"
                            onClick={() =>
                              deleteDraft(draft.id)
                            }
                          >
                            Xóa
                          </button>
                        </div>
                      </div>
                    ))}

                    {!group.saved.length &&
                      !group.pending.length && (
                        <p className="ai-zone-empty">
                          Chưa có căn trong phân khu này.
                        </p>
                      )}
                  </div>
                </div>
              ))}
            </section>
          </>
        ) : (
          <>
            {/* ================================
                MÀN HÌNH 2: CHỈNH SỬA CĂN RIÊNG
            ================================= */}

            <div className="ai-detail-navigation">
              <button
                type="button"
                className="ai-back"
                onClick={backToList}
              >
                ← Quay về danh sách căn
              </button>
            </div>

            <div className="ai-detail-intro">
              <div>
                <span className="ai-eyebrow">
                  HỒ SƠ BẤT ĐỘNG SẢN
                </span>

                <h2>
                  {activeSaved?.unitCode ||
                    `Căn #${selectedSavedId}`}
                </h2>

                <span className="ai-unit-meta">
                  {zones.find(
                    (zone) =>
                      zone.code === originalZone
                  )?.name || originalZone}
                  {" · "}
                  Polygon #{selectedSavedId}
                </span>
              </div>

              <StatusBadge
                status={
                  activeSaved?.saleStatus ||
                  details.saleStatus
                }
              />
            </div>

            <div className="ai-detail-layout">
              {/* BẢN ĐỒ RIÊNG CHO CĂN */}
              <section className="ai-unit-map">
                <div className="ai-map-header">
                  <div>
                    <strong>
                      Vị trí căn trên mặt bằng
                    </strong>
                    <span>
                      Polygon của căn được đánh dấu
                      và phóng tới vị trí đã lưu.
                    </span>
                  </div>
                </div>

                {map ? (
                  <MapCanvas
                    key={`detail-${selectedSavedId}`}
                    imageUrl={map.imageUrl}
                    expectedWidth={map.imageWidth}
                    expectedHeight={map.imageHeight}
                    units={visibleMapUnits}
                    mode="pan"
                    selectedId={`db-${selectedSavedId}`}
                    focusTarget={focusTarget}
                    onUnitClick={() => {}}
                  />
                ) : (
                  <div className="ai-map-empty">
                    Chưa có dữ liệu mặt bằng.
                  </div>
                )}

                <p className="ai-map-tip">
                  Vùng khoanh hiện tại được giữ nguyên
                  theo tọa độ đã lưu trong MySQL.
                </p>
              </section>

              {/* BÊN PHẢI: TAB CHỈNH SỬA */}
              <section className="ai-editor-panel">
                <div className="ai-editor-top">
                  <div>
                    <strong>
                      Chỉnh sửa thông tin căn
                    </strong>
                    <small>
                      ID #{selectedSavedId}
                      {" · "}
                      Chỉnh sửa theo từng nhóm
                    </small>
                  </div>

                  <button
                    type="button"
                    className="ai-editor-close"
                    aria-label="Đóng chỉnh sửa"
                    onClick={backToList}
                  >
                    ×
                  </button>
                </div>

                <div
                  className="ai-editor-tabs"
                  role="tablist"
                  aria-label="Các nhóm chỉnh sửa"
                >
                  {TABS.map((tab) => (
                    <button
                      key={tab.id}
                      type="button"
                      role="tab"
                      aria-selected={
                        activeTab === tab.id
                      }
                      className={
                        activeTab === tab.id
                          ? "active"
                          : ""
                      }
                      onClick={() =>
                        setActiveTab(tab.id)
                      }
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>

                <div className="ai-editor-body">
                  {detailsLoading ? (
                    <div className="ai-editor-placeholder">
                      Đang tải chi tiết căn...
                    </div>
                  ) : (
                    <>
                      {/* TAB THÔNG TIN */}
                      {activeTab === "info" && (
                        <form
                          className="ai-edit-form"
                          onSubmit={saveDetails}
                        >
                          <h3>Thông tin cơ bản</h3>

                          <Field
                            label="Mã căn"
                            value={details.unitCode}
                            maxLength={50}
                            onChange={(value) =>
                              changeDetail(
                                "unitCode",
                                value
                              )
                            }
                          />

                          <div className="ai-field-row">
                            <Field
                              label="Diện tích đất (m²)"
                              value={details.landArea}
                              inputMode="decimal"
                              onChange={(value) =>
                                changeDetail(
                                  "landArea",
                                  value
                                )
                              }
                            />

                            <Field
                              label="Hướng"
                              value={details.direction}
                              maxLength={100}
                              onChange={(value) =>
                                changeDetail(
                                  "direction",
                                  value
                                )
                              }
                            />
                          </div>

                          <Field
                            label="Diện tích sàn xây dựng (m²)"
                            value={
                              details.constructionFloorArea
                            }
                            inputMode="decimal"
                            onChange={(value) =>
                              changeDetail(
                                "constructionFloorArea",
                                value
                              )
                            }
                          />

                          <label className="ai-field">
                            <span>Kết cấu</span>
                            <textarea
                              rows={4}
                              value={
                                details.structureDescription
                              }
                              onChange={(event) =>
                                changeDetail(
                                  "structureDescription",
                                  event.target.value
                                )
                              }
                            />
                          </label>

                          <label className="ai-field">
                            <span>Tình trạng căn</span>
                            <select
                              value={
                                details.saleStatus
                              }
                              onChange={(event) =>
                                changeDetail(
                                  "saleStatus",
                                  event.target.value
                                )
                              }
                            >
                              {STATUSES.map((status) => (
                                <option
                                  key={status.value}
                                  value={status.value}
                                >
                                  {status.label}
                                </option>
                              ))}
                            </select>
                          </label>

                          <div className="ai-form-footer">
                            <button
                              type="button"
                              className="btn btn-outline"
                              disabled={
                                busy ||
                                !detailsDirty
                              }
                              onClick={() =>
                                setDetails({
                                  ...originalDetails,
                                })
                              }
                            >
                              Hủy thay đổi
                            </button>

                            <button
                              type="submit"
                              className="btn btn-primary"
                              disabled={
                                busy ||
                                !detailsDirty
                              }
                            >
                              {detailsSaving
                                ? "Đang lưu..."
                                : "Lưu thông tin"}
                            </button>
                          </div>
                        </form>
                      )}

                      {/* TAB GIÁ BÁN */}
                      {activeTab === "prices" && (
                        <form
                          className="ai-edit-form"
                          onSubmit={saveDetails}
                        >
                          <h3>
                            Giá và phương thức thanh toán
                          </h3>

                          <p className="ai-field-hint">
                            Nhập số VNĐ không có dấu
                            phân cách hàng nghìn.
                          </p>

                          {[
                            ["basePrice", "Giá gốc"],
                            [
                              "standardPaymentPrice",
                              "Thanh toán tiêu chuẩn",
                            ],
                            [
                              "early70Price",
                              "Thanh toán sớm 70%",
                            ],
                            [
                              "early95Price",
                              "Thanh toán sớm 95%",
                            ],
                          ].map(([key, label]) => (
                            <Field
                              key={key}
                              label={`${label} (VNĐ)`}
                              value={details[key]}
                              inputMode="decimal"
                              placeholder="3500000000"
                              onChange={(value) =>
                                changeDetail(
                                  key,
                                  value
                                )
                              }
                            />
                          ))}

                          <div className="ai-form-footer">
                            <button
                              type="button"
                              className="btn btn-outline"
                              disabled={
                                busy ||
                                !detailsDirty
                              }
                              onClick={() =>
                                setDetails({
                                  ...originalDetails,
                                })
                              }
                            >
                              Hủy thay đổi
                            </button>

                            <button
                              type="submit"
                              className="btn btn-primary"
                              disabled={
                                busy ||
                                !detailsDirty
                              }
                            >
                              Lưu giá bán
                            </button>
                          </div>
                        </form>
                      )}

                      {/* TAB HÌNH ẢNH */}
                      {activeTab === "photos" && (
                        <div className="ai-edit-form">
                          <h3>
                            Thư viện ảnh ({gallery.length}
                            /{MAX_IMAGES})
                          </h3>

                          {galleryError && (
                            <div className="error-box">
                              {galleryError}
                            </div>
                          )}

                          <div className="ai-photo-grid">
                            {gallery.map((image) => (
                              <div
                                className="ai-photo"
                                key={`${image.index}-${image.imageUrl}`}
                              >
                                <img
                                  src={photoUrl(
                                    image.imageUrl
                                  )}
                                  alt={`Ảnh căn ${
                                    image.index + 1
                                  }`}
                                  loading="lazy"
                                />

                                <button
                                  type="button"
                                  className="btn btn-danger"
                                  disabled={busy}
                                  onClick={() =>
                                    removePhoto(image)
                                  }
                                >
                                  {removingPhotoIndex ===
                                  image.index
                                    ? "Đang xóa..."
                                    : `Xóa ảnh ${
                                        image.index + 1
                                      }`}
                                </button>
                              </div>
                            ))}

                            {!gallery.length &&
                              !galleryError && (
                                <p className="muted small">
                                  Căn này chưa có ảnh.
                                </p>
                              )}
                          </div>

                          <label className="ai-field">
                            <span>
                              Thêm ảnh JPG/PNG
                              (tối đa 4 ảnh/lần)
                            </span>

                            <input
                              ref={photoInputRef}
                              type="file"
                              multiple
                              accept=".jpg,.jpeg,.png,image/jpeg,image/png"
                              disabled={busy}
                              onChange={choosePhotos}
                            />
                          </label>

                          {!!pendingPhotos.length && (
                            <div className="ai-preview-block">
                              <div className="ai-photo-grid">
                                {pendingPhotos.map((item) => (
                                  <div
                                    className="ai-photo"
                                    key={item.preview}
                                  >
                                    <img
                                      src={item.preview}
                                      alt={item.file.name}
                                    />
                                    <small>
                                      {item.file.name}
                                    </small>
                                  </div>
                                ))}
                              </div>

                              <div className="ai-form-footer">
                                <button
                                  type="button"
                                  className="btn btn-outline"
                                  disabled={busy}
                                  onClick={
                                    clearPhotoSelection
                                  }
                                >
                                  Bỏ ảnh
                                </button>

                                <button
                                  type="button"
                                  className="btn btn-primary"
                                  disabled={busy}
                                  onClick={uploadPhotos}
                                >
                                  {uploadingPhotos
                                    ? "Đang tải..."
                                    : `Tải ${pendingPhotos.length} ảnh lên`}
                                </button>
                              </div>
                            </div>
                          )}

                          <form
                            className="ai-cover-form"
                            onSubmit={saveDetails}
                          >
                            <Field
                              label="Đường dẫn ảnh đại diện"
                              value={details.imageUrl}
                              maxLength={1000}
                              onChange={(value) =>
                                changeDetail(
                                  "imageUrl",
                                  value
                                )
                              }
                            />

                            <button
                              type="submit"
                              className="btn btn-outline"
                              disabled={
                                busy ||
                                !detailsDirty
                              }
                            >
                              Lưu ảnh đại diện
                            </button>
                          </form>
                        </div>
                      )}

                      {/* TAB PHÂN KHU */}
                      {activeTab === "zone" && (
                        <div className="ai-edit-form">
                          <h3>
                            Phân khu của căn đã lưu
                          </h3>

                          <p className="ai-field-hint">
                            Chuyển căn sang Ruby,
                            Sapphire hoặc Crystal.
                            Polygon, giá và ảnh
                            được giữ nguyên.
                          </p>

                          <div className="ai-current-zone">
                            Phân khu hiện tại:{" "}
                            <strong>
                              {zones.find(
                                (zone) =>
                                  zone.code ===
                                  originalZone
                              )?.name || originalZone}
                            </strong>
                          </div>

                          <label className="ai-field">
                            <span>
                              Chuyển sang phân khu
                            </span>

                            <select
                              value={editingZone}
                              disabled={busy}
                              onChange={(event) =>
                                setEditingZone(
                                  event.target.value
                                )
                              }
                            >
                              {zones.map((zone) => (
                                <option
                                  key={zone.code}
                                  value={zone.code}
                                >
                                  {zone.name}
                                </option>
                              ))}
                            </select>
                          </label>

                          <button
                            type="button"
                            className="btn btn-primary"
                            disabled={
                              busy ||
                              !zoneDirty
                            }
                            onClick={saveUnitZone}
                          >
                            {savingZone
                              ? "Đang chuyển..."
                              : "Lưu đổi phân khu"}
                          </button>
                        </div>
                      )}

                      {/* TAB QUẢN LÝ DỮ LIỆU */}
                      {activeTab === "manage" && (
                        <div className="ai-edit-form">
                          <h3>Quản lý dữ liệu căn</h3>

                          <p className="ai-field-hint">
                            Hai thao tác này có tác
                            dụng khác nhau. Hãy
                            kiểm tra kỹ trước khi
                            xác nhận.
                          </p>

                          <div className="ai-danger-option">
                            <div>
                              <strong>
                                Xóa thông tin căn
                              </strong>
                              <p>
                                Giữ lại Polygon,
                                phân khu và ảnh.
                              </p>
                            </div>

                            <button
                              type="button"
                              className="btn btn-outline"
                              disabled={busy}
                              onClick={clearDetails}
                            >
                              Xóa thông tin
                            </button>
                          </div>

                          <div className="ai-danger-option">
                            <div>
                              <strong>
                                Xóa hẳn căn
                              </strong>
                              <p>
                                Xóa căn và Polygon
                                khỏi MySQL.
                                Không thể hoàn tác.
                              </p>
                            </div>

                            <button
                              type="button"
                              className="btn btn-danger"
                              disabled={busy}
                              onClick={deleteSaved}
                            >
                              Xóa hẳn căn
                            </button>
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>

                <div className="ai-editor-footer">
                  {detailsDirty
                    ? "● Có thay đổi thông tin chưa lưu"
                    : "Thông tin căn đã đồng bộ"}

                  {zoneDirty &&
                    " · Phân khu chưa lưu"}

                  {!!pendingPhotos.length &&
                    ` · ${pendingPhotos.length} ảnh đang chờ tải`}
                </div>
              </section>
            </div>
          </>
        )}
      </div>
    </PageLayout>
  );
}
