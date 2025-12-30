let map;
let provinceMarkers = [];
let selectedMarker = null;
let placeMarkers = [];

function clearProvinceMarkers() {
  provinceMarkers.forEach(m => (m.map = null));
  provinceMarkers = [];
}
function clearPlaceMarkers() {
  placeMarkers.forEach(m => (m.map = null));
  placeMarkers = [];
}
function clearSelectedMarker() {
  if (selectedMarker) {
    selectedMarker.map = null;
    selectedMarker = null;
  }
}

function normalizeLatLng(obj) {
  if (!obj) return null;
  const lat = Number(obj.lat ?? obj.latitude ?? obj.center_lat ?? obj.province_lat);
  const lng = Number(obj.lng ?? obj.longitude ?? obj.center_lng ?? obj.province_lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return { lat, lng };
}

function pickProvinceName(obj) {
  return String(obj?.province ?? obj?.province_name ?? obj?.name ?? '').trim();
}

// ✅ map status -> class
function getProvinceKindByStatus(row) {
  const status = String(row?.status ?? '').trim();

  // ไม่ปัก
  if (!status || status === 'not_have') return 'none';

  // ไม่เปิดเผยข้อมูล
  if (status === 'has_gov_hidden') return 'hidden';

  // เปิดเผยข้อมูล (has_gov / has_private / has_gov_and_private)
  return 'visible';
}

function buildProvinceMarkerEl(name, kind = 'visible', isSelected = false) {
  const el = document.createElement('div');
  el.className = `province-marker province-marker--${kind} ${isSelected ? 'is-selected' : ''}`;

  // ✅ icon
  const img = document.createElement('img');
  img.className = 'province-marker__icon';
  img.src = './asset/map-location-center.svg';
  img.alt = name || 'จังหวัด';

  // ✅ label hover
  const label = document.createElement('div');
  label.className = 'province-marker__label';
  label.textContent = name || 'จังหวัด';

  el.appendChild(img);
  el.appendChild(label);
  return el;
}

async function ensureMap() {
  const { Map } = await google.maps.importLibrary("maps");
  const centerDefault = { lat: 13.7271822, lng: 100.5349397 };

  if (!map) {
    map = new Map(document.getElementById("map"), {
      center: centerDefault,
      zoom: 6,
      mapId: "DEMO_MAP_ID",
    });
  }
  return map;
}

// ✅ โหมด 1: Overview
export async function initOverviewMap(centerList, onProvinceClick) {
  const { AdvancedMarkerElement } = await google.maps.importLibrary("marker");
  await ensureMap();

  clearPlaceMarkers();
  clearSelectedMarker();
  clearProvinceMarkers();

  const list = Array.isArray(centerList) ? centerList : [];

  // ปักเฉพาะจังหวัดที่มีสถานบริการ (visible/hidden) และมี lat/lng
  const filtered = list.filter(row => {
    const kind = getProvinceKindByStatus(row);
    return kind !== 'none' && !!normalizeLatLng(row);
  });

  if (!filtered.length) return;

  map.setZoom(6);
  map.setCenter({ lat: 13.7271822, lng: 100.5349397 });

  filtered.forEach((row) => {
    const ll = normalizeLatLng(row);
    const provinceName = pickProvinceName(row);
    const kind = getProvinceKindByStatus(row); // visible | hidden

    const el = buildProvinceMarkerEl(provinceName, kind, false);

    el.addEventListener('click', () => {
      if (typeof onProvinceClick === 'function') onProvinceClick(provinceName);
    });

    const marker = new AdvancedMarkerElement({
      map,
      position: ll,
      title: provinceName,
      content: el,
    });

    provinceMarkers.push(marker);
  });
}

// ✅ โหมด 2: Province view
export async function initProvinceMap(places, centerRow) {
  const { AdvancedMarkerElement } = await google.maps.importLibrary("marker");
  await ensureMap();

  clearPlaceMarkers();
  clearSelectedMarker();
  clearProvinceMarkers(); // ซ่อน overview markers

  const row = Array.isArray(centerRow) ? centerRow[0] : centerRow;
  const centerLL = normalizeLatLng(row);
  const provinceName = pickProvinceName(row);

  const kind = getProvinceKindByStatus(row); // visible | hidden | none

  if (centerLL) {
    map.setCenter(centerLL);
    map.setZoom(11);

    // ✅ หมุดจังหวัดที่เลือก (ใช้ kind เดิม)
    const selEl = buildProvinceMarkerEl(provinceName || 'จังหวัด', (kind === 'none' ? 'visible' : kind), true);

    selectedMarker = new AdvancedMarkerElement({
      map,
      position: centerLL,
      title: provinceName || 'จังหวัด',
      content: selEl,
    });
  }

  const arr = Array.isArray(places) ? places : [];
  arr.forEach((p) => {
    const lat = Number(p.lat);
    const lng = Number(p.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;

    const placeId = p.place_id; // ✅ ใช้ key ที่คุณมีใน data

    const marker = new AdvancedMarkerElement({
      map,
      position: { lat, lng },
      title: p.name_th || '',
    });

    // ✅ คลิกพินย่อย -> เปิด offcanvasDetail ของที่นั้น
    if (placeId) {
      marker.addListener('click', () => {
        if (typeof window.openPlaceDetail === 'function') {
          window.openPlaceDetail(placeId);
        }
      });
    }

    placeMarkers.push(marker);
  });
}

export function goToLocation(location) {
  const ll = normalizeLatLng(location);
  if (map && ll) {
    map.setZoom(16);
    map.panTo(ll);
  }
}

export function resetToThailandView() {
  if (!map) return;
  clearPlaceMarkers();
  clearSelectedMarker();
  map.setZoom(6);
  map.setCenter({ lat: 13.7271822, lng: 100.5349397 });
}
