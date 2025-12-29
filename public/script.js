// import { getAnalytics } from "https://www.gstatic.com/firebasejs/11.4.0/firebase-analytics.js";
import { initMap } from "./map.js";
import { goToLocation } from "./map.js";
import { clearMap } from "./map.js";


//default state
$('#simplemap').show(); 
$('#map').hide();  
//$("#filter-select-wrapper").addClass("hide");

// Please change to Production name later
const API_BASE_URL = 'http://localhost:10008';

const searchInput = $("#search");
const weekSelectbox = $("#week-filter")
const priceSelectbox = $("#price-filter")
const typeSelectbox = $("#type-filter")

const placeCardWrapper = $("#outer-card-wrapper");
const notiCardWrapper = $("#noti-wrapper");
const statusCardWrapper = notiCardWrapper; // ใช้ notiCardWrapper สำหรับแสดง status

const searchBtn = $("#search-btn");
// const backBtn = $("#back-btn span");

let centerAndStatusData = {};

// function to fetch province list
const provinceList = await makeProvinceList();    
async function makeProvinceList() {
    try {
      const response = await fetch(`${API_BASE_URL}/wp-json/custom/v1/province`);
      const data = await response.json();

    const provinceNames = [...new Set(data.map(item => item.province))];

    console.log("provinceNames:", provinceNames);
    return provinceNames;
    } catch (error) {
    console.error("Error fetching province data:", error);
    throw error;
  }
};

// function to fetch center of province and status
async function getProvinceCenterStatus(province) {
  try {
    //console.log("province: ", province);

    const url = new URL(`${API_BASE_URL}/wp-json/custom/v1/center`);
    url.searchParams.set("province", province);

    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();

    return data;
  } catch (error) {
    console.error('Error fetching province center:', error);
    throw error;
  }
}

// function to fetch place data based on search
async function getData(province, week, type, foreignerMed, cost_type) {
  const url = new URL(`${API_BASE_URL}/wp-json/custom/v1/place`);

  if (province) url.searchParams.set("province", province);
  if (week) url.searchParams.set("week", week);          // lt12/gt12/gt20
  if (type) url.searchParams.set("type", type);          // gov/private
  if (cost_type) url.searchParams.set("cost_type", cost_type); // free/paid
  if (foreignerMed) url.searchParams.set("foreignerMed", foreignerMed);

  console.log("url:", url.toString());
  const response = await fetch(url);
  return await response.json();
}


// function to fetch service data
async function getService(place_id) {
  try {
    const url = new URL(`${API_BASE_URL}/wp-json/custom/v1/service`);
      url.searchParams.set("place_id", place_id);

      const response = await fetch(url);
      const data = await response.json();
      return data;
  } catch (error) {
    console.error("Error fetching service data:", error);
    throw error;
  }
}

// autocomplete for search input
$("#search").autocomplete({
  source: provinceList,
  minLength: 1,
  select: function(event, ui) {
    searchInput.val(ui.item.value);
    searchBtn.click();
    return false; 
  }
});

// search btn 
searchBtn.on("click", handleSearch);

// function to handle search province  
export async function handleSearch(province) {
  let searchedProvince;

  // Differentiate between map click (string) and form event (object)
  if (typeof province === 'string') {
    searchedProvince = province;
    searchInput.val(searchedProvince);
  } else {
    if (province) province.preventDefault();
    searchedProvince = searchInput.val();
  }

  // ถ้าไม่กรอกจังหวัด
  if (!searchedProvince || searchedProvince.trim() === '') {
    const newStatusCard = `
      <div class="block__item block__item-unavailable">
        <div class="block__title">ไม่พบสถานบริการ<span class="d-inline-block">ที่คุณต้องการ</span></div>
        <div class="block__detail">
          <p class="text-center">กรุณากรอกจังหวัดเพื่อค้นหาสถานบริการ</p>
        </div>
      </div>
    `;
    statusCardWrapper.html(newStatusCard);
    placeCardWrapper.html("");
    return;
  }

  searchedProvince = searchedProvince.trim();

  // --- week filter (lt12/gt12/gt20) ---
  const weekValueRaw = weekSelectbox.val();
  let weekValue = null;
  if (weekValueRaw === '9') weekValue = 'lt12';
  else if (weekValueRaw === '12') weekValue = 'gt12';
  else if (weekValueRaw === '20') weekValue = 'gt20';

  // --- price filter ---
  const priceValueRaw = priceSelectbox.val();
  const priceValue = (priceValueRaw === 'all') ? null : priceValueRaw; // free|paid|null

  // --- type filter ---
  const typeValueRaw = typeSelectbox.val();
  const typeValue = (typeValueRaw === 'all') ? null : typeValueRaw; // gov|private|null

  // --- foreigner checkbox ---
  const foreignerMed = $("#foreigner-med-checkbox").is(":checked") ? "y" : null;

  console.log("Search Val:", searchedProvince);

  let newCard = "";
  let newStatusCard = "";

  try {
    // ✅ 1) ดึง center/status ก่อนเสมอ
    let provinceInDb = true;

    try {
      centerAndStatusData = await getProvinceCenterStatus(searchedProvince);
    } catch (e) {
      provinceInDb = false;
      centerAndStatusData = [];
    }

    if (!Array.isArray(centerAndStatusData) || centerAndStatusData.length === 0) {
      provinceInDb = false;
      centerAndStatusData = [];
    }

    console.log("centerAndStatusData:", centerAndStatusData);

    const provinceName = provinceInDb ? (centerAndStatusData?.[0]?.province || searchedProvince) : searchedProvince;
    const provinceStatusRaw = provinceInDb ? (centerAndStatusData?.[0]?.status || '') : 'not_have';
    const provinceStatus = String(provinceStatusRaw).trim(); // กัน whitespace

    const provinceStatusTextMap = {
      has_gov_and_private: 'มีทั้งสถานบริการรัฐและเอกชน',
      has_private: 'มีเฉพาะสถานบริการเอกชน',
      has_gov: 'มีเฉพาะสถานบริการของรัฐ',
      has_gov_hidden: 'มีสถานบริการของรัฐที่ไม่เปิดเผยข้อมูล',
      not_have: 'ยังไม่มีสถานบริการ'
    };

    // ✅ ถ้าจังหวัดไม่อยู่ในฐาน: บังคับเป็น not_have เสมอ และใช้ข้อความเดียว
    const normalizedStatus = provinceInDb ? provinceStatus : 'not_have';
    const provinceStatusText = provinceStatusTextMap[normalizedStatus] || 'ยังไม่มีสถานบริการ';

    // ✅ detail message แยกตามสถานะ
    let detailHtml = '';

    if (normalizedStatus === 'not_have' || normalizedStatus === '') {
      detailHtml = `
        <p class="text-center">ไม่เป็นไรนะ เรามีคำแนะนำให้</p>
        <ul>
          <li>ค้นหาในจังหวัดอื่นที่ใกล้เคียง</li>
          <li><a href="#0" target="_blank">ปรึกษาทำทาง</a> เพื่อขอรับยาทางไปรษณีย์</li>
        </ul>
      `;
    } else if (normalizedStatus === 'has_gov_hidden') {
      detailHtml = `
        <p class="text-center">
          ติดต่อทำทางเพื่อขอรับยาทางไปรษณีย์
          <span class="d-inline-block">หรือสอบถามทางเลือกเพิ่มเติม</span>
        </p>
      `;
    } else {
      detailHtml = `
        <p class="text-center">
          หากไม่พบสถานบริการที่สนใจ
          <span class="d-inline-block">สามารถ<a href="#0" target="_blank">ติดต่อทำทาง</a></span>
          <span class="d-inline-block">เพื่อขอรับยา</span>
          <span class="d-inline-block">ทางไปรษณีย์</span>
          <span class="d-inline-block">หรือสอบถามเพิ่มเติมได้นะ</span>
        </p>
      `;
    }

    // ✅ สร้าง status card จากสถานะ
    if (normalizedStatus === 'not_have' || normalizedStatus === '') {
      newStatusCard = `
        <div class="block__item block__item-unavailable">
          <div class="block__title">${provinceName} ${provinceStatusText}</div>
          <div class="block__detail">
            ${detailHtml}
          </div>
        </div>
      `;
    } else {
      newStatusCard = `
        <div class="block__item">
          <div class="block__title">${provinceName} ${provinceStatusText}</div>
          <div class="block__detail">
            ${detailHtml}
          </div>
        </div>
      `;
    }

    // ✅ 2) ดึง place ตาม filter
    const provinceData = await getData(searchedProvince, weekValue, typeValue, foreignerMed, priceValue);
    console.log('provinceData : ', provinceData);

    // ✅ 3) map: แสดงเฉพาะเมื่อมีสถานที่
    if (provinceData && provinceData.length > 0) {
      $('#simplemap').hide();
      $('#map').show();
      initMap(provinceData, centerAndStatusData);
    } else {
      $('#simplemap').show();
      $('#map').hide();

      const hasNarrowFilterOn =
        (typeValueRaw !== 'all') ||
        (priceValueRaw !== 'all') ||
        (foreignerMed === 'y') ||
        (weekValueRaw !== '9'); // 9 = default "ต่ำกว่า 12"

      // ✅ โชว์ก้อนล่างเฉพาะเมื่อ:
      // - จังหวัดอยู่ในฐาน (provinceInDb)
      // - และจังหวัดมีสถานบริการอยู่จริง (ไม่ใช่ not_have)
      const hasSomeServiceInProvince = provinceInDb && (normalizedStatus !== 'not_have');

      if (hasSomeServiceInProvince && hasNarrowFilterOn) {
        newStatusCard += `
          <div class="block__item block__item-unavailable">
            <div class="block__title">ไม่พบสถานบริการจากเงื่อนไขที่เลือก</div>
            <div class="block__detail">
              <p class="text-center">ลองนำฟิลเตอร์บางอันออก แล้วค้นหาใหม่อีกครั้ง</p>
            </div>
          </div>
        `;
      }
    }

    // ✅ 4) สร้าง place cards
    if (provinceData && provinceData.length > 0) {
      for (const key in provinceData) {
        if (provinceData.hasOwnProperty(key)) {
          const nameThai = provinceData[key].name_th;
          const pregWeek = provinceData[key].preg_week;
          const placeId = provinceData[key].place_id;
          const cost_type = provinceData[key].cost_type; // free/paid
          const foreigner_med = provinceData[key].foreigner_med; // y/n

          // let priceText = '';
          // if (cost_type === 'free') priceText = 'ใช้สิทธิประกันสังคมได้';
          // else if (cost_type === 'paid') priceText = 'ใช้สิทธิประกันสังคมไม่ได้';
          const costTypeTagHtml = (String(cost_type).trim() === 'paid') ? `<div class="card__tag warning"><img class="card__tag-icon" src="./asset/triangle.svg" alt="">ใช้สิทธิ์ประกันสังคม / บัตรทองไม่ได้</div>` : '';

          const foreignerTagHtml = (String(foreigner_med).trim() === 'y') ? `<div class="card__tag">มีบริการสำหรับต่างชาติ</div>` : '';

          newCard += `
            <div class="card card--place" data-key="${placeId}">
              <div class="card__body">
                <div class="card__title">${nameThai}</div>
                <div class="card__tag-group">
                  <div class="card__tag">ไม่เกิน ${pregWeek} สัปดาห์</div>
                  ${foreignerTagHtml}
                  ${costTypeTagHtml}
                </div>
              </div>
              <div class="card__footer">
                <button class="btn btn--icon" id="detail-link">
                  <span class="btn__title">ดูรายละเอียด</span>
                  <img class="btn__icon" src="./asset/chevron-right.svg" alt="">
                </button>
              </div>
            </div>
          `;
        }
      }
    }

    // ✅ 5) render
    statusCardWrapper.html(newStatusCard);
    placeCardWrapper.html(newCard);

  } catch (error) {
    console.error(error);

    const errCard = `
      <div class="block__item block__item-unavailable">
        <div class="block__title">เกิดข้อผิดพลาดในการค้นหา</div>
        <div class="block__detail">
          <p class="text-center">${error?.message || 'Unknown error'}</p>
        </div>
      </div>
    `;
    statusCardWrapper.html(errCard);
    placeCardWrapper.html("");
    $('#simplemap').show();
    $('#map').hide();
  }
}

/* Popover */
const popoverTriggerList = document.querySelectorAll('[data-bs-toggle="popover"]')
const popoverList = [...popoverTriggerList].map(popoverTriggerEl => {
  // Extend the default allow list to include data attributes for modals
  const myAllowList = {
    ...bootstrap.Popover.Default.allowList,
    a: [...bootstrap.Popover.Default.allowList.a, 'data-bs-toggle', 'data-bs-target']
  };

  return new bootstrap.Popover(popoverTriggerEl, {
    allowList: myAllowList
  });
});
document.querySelectorAll('.popover-dismiss').forEach(popoverNode => {
  new bootstrap.Popover(popoverNode, { trigger: 'focus' });
});


/* Preg Calculator */
if ($('#pregCalModal').length) {
  
  var today = new Date();
  var dd = today.getDate();
  var mm = today.getMonth() + 1; //January is 0
  var yyyy = today.getFullYear();

  if (dd < 10) { dd = '0' + dd; }

  if (mm < 10) { mm = '0' + mm; } 
        
  today = yyyy + '-' + mm + '-' + dd;
  $("#start").attr("max", today);
  $("#end").attr("value", today);
    
  function calculatePreg() {
    const startVal = $("#start").val();
    const endVal = $("#end").val();

    // ❌ ถ้ายังเลือกไม่ครบ อย่าคำนวณ
    if (!startVal || !endVal) {
      $("#preg-res").html("");
      return;
    }

    const start = new Date(startVal);
    const end = new Date(endVal);

    // ❌ กัน Invalid Date
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      $("#preg-res").html("");
      return;
    }

    const diffTime = Math.abs(end - start);
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    const weeks = Math.floor(diffDays / 7);
    const days = diffDays % 7;

    $("#preg-res").html(`${weeks} สัปดาห์ ${days} วัน`);
  }
  $("#start").on("change", calculatePreg);
  $("#end").on("change", calculatePreg);

  //reset date
  // $('#resetButton').on('click', function(){
  //   $("#start").val("");
  //   $("#end").val(today);
  //   $("#preg-res").html("");
  // });
}

// helper: escape กัน XSS / ข้อมูลแปลก ๆ
function esc(str) {
  return String(str ?? '').replace(/[&<>"']/g, (m) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[m]));
}

function buildPlaceContactHtml(data) {
  const pregWeek = data?.preg_week ? `รับอายุครรภ์ ไม่เกิน ${esc(data.preg_week)} สัปดาห์` : '';
  const openDay  = esc(data?.open_day || '');
  const openFrom = esc(data?.open_from || '');
  const openTo   = esc(data?.open_to || '');
  const closedDay = esc(data?.closed_day || '');

  // เวลาเปิดทำการ (ประกอบประโยคแบบยืดหยุ่น)
  let openLine1 = '';
  if (openDay || openFrom || openTo) {
    openLine1 = `เปิดทำการ ${openDay}${(openFrom && openTo) ? ` เวลา ${openFrom} - ${openTo} น.` : ''}`;
  }

  // closed day
  let openLine2 = closedDay ? `${closedDay}` : '';

  // tel / line / email
  const tel   = esc(data?.tel || '');
  const line  = esc(data?.line || '');
  const email = esc(data?.email || '');

  // ถ้าไม่มีอะไรเลย ก็คืนข้อความว่าง
  const hasAny =
    pregWeek || openLine1 || openLine2 || tel || line || email;

  if (!hasAny) {
    return `<div class="media"><div class="media__item"><div class="media__detail"><p>-</p></div></div></div>`;
  }

  return `
    <div class="media media--place-contact">

      ${pregWeek ? `
      <div class="media__item media__item-highlight">
        <img class="media__icon" src="./asset/calendar.svg" alt="">
        <div class="media__detail">
          <p>${pregWeek}</p>
        </div>
      </div>` : ''}

      ${(openLine1 || openLine2) ? `
      <div class="media__item">
        <img class="media__icon" src="./asset/clock.svg" alt="">
        <div class="media__detail">
          ${openLine1 ? `<p>${openLine1}</p>` : ''}
          ${openLine2 ? `<p>${openLine2}</p>` : ''}
        </div>
      </div>` : ''}

      ${tel ? `
      <div class="media__item">
        <img class="media__icon" src="./asset/phone.svg" alt="">
        <div class="media__detail">
          <p>${tel}</p>
        </div>
      </div>` : ''}

      ${line ? `
      <div class="media__item">
        <img class="media__icon" src="./asset/line.svg" alt="">
        <div class="media__detail">
          <p>${line}</p>
        </div>
      </div>` : ''}

      ${email ? `
      <div class="media__item">
        <img class="media__icon" src="./asset/letter.svg" alt="">
        <div class="media__detail">
          <p>${email}</p>
        </div>
      </div>` : ''}

    </div>
  `;
}

function buildNoticeHtml(data) {
  const normalItems = [];
  const warnItems = [];

  /* 1) walk_in */
  if (String(data?.walk_in).trim() === 'y') {
    normalItems.push(`
      <div class="media__item media__item-accept">
        <img class="media__icon" src="./asset/circle-check.svg" alt="">
        <div class="media__title">Walk in ได้</div>
      </div>
    `);
  }

  /* 2) refer_in_cap */
  const referInCap = String(data?.refer_in_cap ?? '').trim();
  if (referInCap !== '') {
    normalItems.push(`
      <div class="media__item media__item-accept">
        <img class="media__icon" src="./asset/circle-check.svg" alt="">
        <div class="media__title">${esc(referInCap)}</div>
      </div>
    `);
  }

  /* 3) under_age */
  const underAge = String(data?.under_age ?? '').trim();
  if (underAge !== '' && underAge !== 'n') {
    warnItems.push(`
      <div class="media__item media__item-warn">
        <img class="media__icon" src="./asset/triangle.svg" alt="">
        <div class="media__title">อายุต่ำกว่า ${esc(underAge)} ปี ต้องมีผู้ปกครอง</div>
      </div>
    `);
  }

  /* 4) foreigner_med */
  const foreigner = String(data?.foreigner_med ?? '').trim();
  if (foreigner === 'y') {
    normalItems.push(`
      <div class="media__item">
        <img class="media__icon" src="./asset/circle-check.svg" alt="">
        <div class="media__title">มีบริการสำหรับต่างชาติ</div>
      </div>
    `);
  } else if (foreigner === 'n') {
    warnItems.push(`
      <div class="media__item media__item-warn">
        <img class="media__icon" src="./asset/triangle.svg" alt="">
        <div class="media__title">ไม่มีบริการสำหรับต่างชาติ</div>
      </div>
    `);
  }

  /* 5) เงื่อนไขการรับบริการ */
  const conditionAll = String(data?.condition_all ?? '').trim();

  if (conditionAll !== 'y') {
    const conditionOpinion = String(data?.condition_opinion ?? '').trim();

    if (conditionOpinion === 'y') {
      warnItems.push(`
        <div class="media__item media__item-warn">
          <img class="media__icon" src="./asset/triangle.svg" alt="">
          <div class="media__title">รับเฉพาะกรณีที่ผ่านการพิจารณา</div>
        </div>
      `);
    } else {
      const parts = [];
      if (String(data?.condition_rape).trim() === 'y') parts.push('ข่มขืน');
      if (String(data?.condition_fetus).trim() === 'y') parts.push('ตัวอ่อนพิการ');
      if (String(data?.condition_teenage).trim() === 'y') parts.push('วัยรุ่น');

      if (parts.length > 0) {
        warnItems.push(`
          <div class="media__item media__item-warn">
            <img class="media__icon" src="./asset/triangle.svg" alt="">
            <div class="media__title">รับเฉพาะกรณี${esc(parts.join(', '))}</div>
          </div>
        `);
      }
    }
  }

  // ❌ ไม่มีอะไรเลย → ไม่ต้อง render
  if (normalItems.length === 0 && warnItems.length === 0) return '';

  // ✅ เรียง: ธรรมดา → warn
  return `
    <div class="media media--notice">
      ${normalItems.join('')}
      ${warnItems.join('')}
    </div>
  `;
}

// ===== Service Helpers =====
function normalizePriceType(v) {
  const s = String(v ?? '').toLowerCase().trim();
  if (['foreigner','foreign','expat','en','nonthai','non_thai'].includes(s)) return 'foreigner';
  return 'thai';
}

function isY(v) {
  return String(v ?? '').toLowerCase().trim() === 'y';
}

// เลือก label "ประเภท" จาก join (wp_service_m)
function getMethodLabel(row) {
  return (
    row?.sm_name_th ||
    row?.sm_name ||
    row?.method_name_th ||
    row?.method_name ||
    row?.name_th ||
    row?.name ||
    `sm_id ${row?.sm_id ?? ''}`
  );
}

// กรองเฉพาะ service_status = normal (ไม่เอา other)
function isNormalService(row) {
  // บางที field อาจมาจาก wp_service_m หรือ wp_service
  const v = String(
    row?.service_status ??
    row?.m_service_status ??
    row?.sm_service_status ??
    row?.service_type ??    // กันพัง
    ''
  ).toLowerCase().trim();

  return v === 'normal';
}

// tr class inactive ถ้า status ของ service เป็น inactive
function isInactive(row) {
  const v = String(row?.status ?? row?.service_status_flag ?? '').toLowerCase().trim();
  return v === 'inactive';
}

// group rows -> { thai: Map(sm_id -> {label, costs[], inactive}), foreigner: Map(...) }
function groupServiceRows(rows) {
  const grouped = { thai: new Map(), foreigner: new Map() };

  (rows || []).forEach((row) => {
    if (!isNormalService(row)) return;

    const priceType = normalizePriceType(row?.type);
    const smId = String(row?.sm_id ?? '');
    if (!smId) return;

    const label = getMethodLabel(row);

    const bucket = grouped[priceType];
    if (!bucket.has(smId)) {
      bucket.set(smId, { label, costs: [], inactive: false });
    }
    const obj = bucket.get(smId);

    // ✅ inactive จาก wp_service.status
    if (isInactive(row)) obj.inactive = true;

    const costLine = String(row?.cost ?? '').trim();
    if (costLine) obj.costs.push(costLine);
  });

  // ถ้าไม่มี cost และไม่ inactive → ใส่ default
  for (const map of [grouped.thai, grouped.foreigner]) {
    for (const [, v] of map.entries()) {
      if (!v.inactive && (!v.costs || v.costs.length === 0)) {
        v.costs = ['ไม่มีข้อมูลค่าบริการ'];
      }
    }
  }

  return grouped;
}

function buildServiceTableBody(map) {
  const rows = Array.from(map.values());

  if (rows.length === 0) {
    return `
      <tr>
        <td colspan="2">ไม่พบข้อมูลบริการ</td>
      </tr>
    `;
  }

  return rows.map((r) => {
    const isRowInactive = !!r.inactive;

    let costHtml = '';
    if (isRowInactive) {
      costHtml = 'งดบริการชั่วคราว';
    } else {
      const costs = Array.isArray(r.costs) ? r.costs.filter(x => String(x ?? '').trim() !== '') : [];
      costHtml = costs.length ? costs.map(c => esc(c)).join('<br>') : 'ไม่มีข้อมูลค่าบริการ';
    }

    return `
      <tr class="${isRowInactive ? 'inactive' : ''}">
        <td>${esc(r.label)}</td>
        <td>${costHtml}</td>
      </tr>
    `;
  }).join('');
}

function buildServiceSection(placeData, serviceRows) {
  const grouped = groupServiceRows(serviceRows);

  const hasForeignerTab = isY(placeData?.has_foreigner_price) && grouped.foreigner.size > 0;

  // ✅ ถ้า has_foreigner_price = n/ว่าง → ตารางเดียว (ราคาไทย)
  if (!hasForeignerTab) {
    return `
      <div class="offcanvas__service">
        <div class="offcanvas__subtitle">บริการยุติการตั้งครรภ์</div>
        <div class="table-responsive">
          <table class="table table--service">
            <thead>
              <tr>
                <th>ประเภท</th>
                <th>ค่าบริการ</th>
              </tr>
            </thead>
            <tbody>
              ${buildServiceTableBody(grouped.thai)}
            </tbody>
          </table>
        </div>
      </div>
    `;
  }

  // ✅ ถ้า has_foreigner_price = y → มีแท็บ ไทย/ต่างชาติ
  return `
    <div class="offcanvas__service">
      <div class="offcanvas__subtitle">บริการยุติการตั้งครรภ์</div>

      <ul class="nav nav--service nav-tabs" id="serviceTab" role="tablist">
        <li class="nav-item" role="presentation">
          <button class="nav-link active" id="service-thai"
            data-bs-toggle="tab" data-bs-target="#service-thai-pane"
            type="button" role="tab" aria-controls="service-thai-pane" aria-selected="true">
            ราคาคนไทย
          </button>
        </li>
        <li class="nav-item" role="presentation">
          <button class="nav-link" id="service-foreigner"
            data-bs-toggle="tab" data-bs-target="#service-foreigner-pane"
            type="button" role="tab" aria-controls="service-foreigner-pane" aria-selected="false">
            ราคาคนต่างชาติ
          </button>
        </li>
      </ul>

      <div class="tab-content tab-content--service" id="serviceTabContent">
        <div class="tab-pane fade show active" id="service-thai-pane" role="tabpanel" aria-labelledby="service-thai" tabindex="0">
          <div class="table-responsive">
            <table class="table table--service">
              <thead>
                <tr><th>ประเภท</th><th>ค่าบริการ</th></tr>
              </thead>
              <tbody>
                ${buildServiceTableBody(grouped.thai)}
              </tbody>
            </table>
          </div>
        </div>

        <div class="tab-pane fade" id="service-foreigner-pane" role="tabpanel" aria-labelledby="service-foreigner" tabindex="0">
          <div class="table-responsive">
            <table class="table table--service">
              <thead>
                <tr><th>ประเภท</th><th>ค่าบริการ</th></tr>
              </thead>
              <tbody>
                ${buildServiceTableBody(grouped.foreigner)}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  `;
}

function splitNoteToList(note) {
  if (!note) return [];

  return note
    .split(/,\s*-/)              // ตัดตรง ", -"
    .map((item, index) => {
      // หัวข้อแรกอาจไม่มี "-"
      const text = index === 0
        ? item
        : '-' + item;

      return text.replace(/^-/, '').trim();
    })
    .filter(Boolean);
}

function buildNoteSection(data) {
  const rawNote = String(data?.note ?? '').trim();
  if (!rawNote) return '';

  const items = splitNoteToList(rawNote);

  if (items.length === 0) return '';

  return `
    <div class="offcanvas__note">
      <div class="offcanvas__subtitle">หมายเหตุ</div>
      <ul>
        ${items.map(t => `<li>${esc(t)}</li>`).join('')}
      </ul>
    </div>
  `;
}

function buildHighlightSection() {
  return `
    <div class="offcanvas__highlight">
        หากไม่มีเงินเพียงพอในการจ่ายค่าบริการ
        สามารถ<a href="#0" target="_blank">ติดต่อทำทาง</a>
        เพื่อขอรับความช่วยเหลือได้ค่ะ
    </div>
  `;
}

function isOtherService(row) {
  const v = String(
    row?.service_type ??
    row?.sm_service_type ??
    row?.m_service_type ??
    row?.service_status ??      // เผื่อฝั่ง DB ใช้ชื่อ field สลับกัน
    row?.sm_service_status ??
    ''
  ).toLowerCase().trim();

  return v === 'other';
}

function getOtherServiceLabel(row) {
  return (
    row?.sm_name_th ||
    row?.sm_name ||
    row?.name_th ||
    row?.name ||
    'บริการอื่นๆ'
  );
}

function normalizeCostForOther(costRaw) {
  const c = String(costRaw ?? '').trim();
  if (!c || c === '-' ) return ''; // ไม่โชว์ราคา
  return c;
}

function buildOtherServiceSection(serviceRows) {
  const rows = Array.isArray(serviceRows) ? serviceRows : [];

  // group by service_id (กันข้อมูลซ้ำจากการ join)
  const map = new Map(); // service_id -> { label, costs[] }

  rows.forEach((row) => {
    if (!isOtherService(row)) return;

    const serviceId = String(row?.service_id ?? row?.sid ?? '').trim() || `${row?.sm_id ?? ''}_${getOtherServiceLabel(row)}`;
    const label = getOtherServiceLabel(row);

    if (!map.has(serviceId)) {
      map.set(serviceId, { label, costs: [] });
    }

    const cost = normalizeCostForOther(row?.cost);
    if (cost) {
      // กันซ้ำ
      const obj = map.get(serviceId);
      if (!obj.costs.includes(cost)) obj.costs.push(cost);
    }
  });

  if (map.size === 0) return ''; // ไม่มี other → ไม่ต้องโชว์

  const lis = Array.from(map.values()).map(item => {
    if (!item.costs.length) {
      return `<li>${esc(item.label)}</li>`;
    }

    // ถ้ามีหลาย cost ให้คั่นด้วย " / "
    const costText = item.costs.map(c => esc(c)).join(' / ');

    // ถ้าข้อมูล cost มีคำว่า "บาท" อยู่แล้ว ไม่ต้องเติมซ้ำ
    const addBaht = !/บาท/.test(costText);
    return `<li>${esc(item.label)} ${costText}${addBaht ? ' บาท' : ''}</li>`;
  }).join('');

  return `
    <div class="offcanvas__other-service">
      <div class="offcanvas__subtitle">บริการอื่นๆ</div>
      <p class="mb-2">(กรุณาสอบถามราคาจากคลินิก)</p>
      <ul>
        ${lis}
      </ul>
    </div>
  `;
}


// ✅ Click place card -> close main offcanvas + open detail offcanvas + load data + service + render result
$(document).on('click', '.card.card--place #detail-link', async function (e) {
  e.preventDefault();

  const placeId = $(this).closest('.card.card--place').data('key');
  if (!placeId) return;

  // ✅ ปิด offcanvasMain ก่อน
  const mainEl = document.getElementById('offcanvasMain');
  if (mainEl) {
    const mainInstance = bootstrap.Offcanvas.getInstance(mainEl);
    if (mainInstance) mainInstance.hide();
  }

  // ✅ เปิด offcanvasDetail
  const detailEl = document.getElementById('offcanvasDetail');
  const detailInstance = bootstrap.Offcanvas.getOrCreateInstance(detailEl);
  detailInstance.show();

  const $detail = $('#offcanvasDetail');
  const $header = $detail.find('.offcanvas__header');
  const $result = $detail.find('.offcanvas__result');

  // loading state
  $header.html(`<h2 class="offcanvas__title-th">กำลังโหลด...</h2>`);
  $result.html(`<p>กำลังโหลดข้อมูล...</p>`);

  const placeUrl = new URL(`${API_BASE_URL}/wp-json/custom/v1/data`);
  placeUrl.searchParams.set('place_id', placeId);

  const serviceUrl = new URL(`${API_BASE_URL}/wp-json/custom/v1/service`);
  serviceUrl.searchParams.set('place_id', placeId);

  try {
    // ✅ ดึงพร้อมกัน
    const [placeRes, serviceRes] = await Promise.all([
      fetch(placeUrl),
      fetch(serviceUrl),
    ]);

    const data = await placeRes.json();
    const services = await serviceRes.json(); // มาจาก join: wp_service + wp_service_m + wp_cost

    const mapUrl = data?.map_url || data?.google_map_url || data?.gmaps_url || data?.map || '#0';

    // header
    $header.html(`
      <h2 class="offcanvas__title-th">${esc(data?.name_th || '-')}</h2>
      <h2 class="offcanvas__title-en">${esc(data?.name_en || '')}</h2>
      <div class="offcanvas__map">
        <a class="btn btn--primary-outline offcanvas__map-link" href="${esc(mapUrl)}" target="_blank" rel="noopener">
          <img class="btn__icon" src="./asset/location.svg" alt="">
          <span class="btn__title">ดูตำแหน่งบน Google Map</span>
        </a>
      </div>
    `);

    // result: contact + notice + service
    const contactHtml = buildPlaceContactHtml(data);
    const noticeHtml  = buildNoticeHtml(data);
    const serviceHtml = buildServiceSection(data, Array.isArray(services) ? services : []);
    const noteHtml = buildNoteSection(data);
    const highlightHtml = buildHighlightSection();
    const otherServiceHtml = buildOtherServiceSection(services);
    
    $result.html(`
      ${contactHtml}
      ${noticeHtml}
      ${serviceHtml}
      ${noteHtml}
      ${highlightHtml}
      ${otherServiceHtml}
    `);

  } catch (err) {
    console.error(err);
    $header.html(`<h2 class="offcanvas__title-th">เกิดข้อผิดพลาดในการโหลดข้อมูล</h2>`);
    $result.html(`<p>ลองใหม่อีกครั้ง</p>`);
  }
});


function disableOffcanvasMainOnMobile() {
  const el = document.getElementById('offcanvasMain');
  if (!el) return;

  if (window.innerWidth < 575) {
    el.classList.remove('show');
    el.style.display = 'none';
  } else {
    el.style.display = '';
  }
}

disableOffcanvasMainOnMobile();
window.addEventListener('resize', disableOffcanvasMainOnMobile);




// function to handle place card click to see detail
// placeCardWrapper.on("click", ".place-card-wrapper", async function(event) {
//   console.log("see detail clicked");
  
//   if ($("#detail-wrapper").css("margin-left") === '-890px') {
//     $("#detail-wrapper").animate({"margin-left": '+=890px'},1000);
//  }
 
//   const card = $(this).closest(".place-card-wrapper");
//   const key = card.data("key");
//   console.log("key:", key);

//   const placeUrl = new URL(`${API_BASE_URL}/wp-json/custom/v1/data`);
//   placeUrl.searchParams.set("place_id", key); 
//   let data;

//   const serviceUrl = new URL(`${API_BASE_URL}/wp-json/custom/v1/service`);
//   serviceUrl.searchParams.set("place_id", key);
//   let service;

//   try {
//     const response = await fetch(placeUrl);
//     data = await response.json();
//     console.log("data:", data);
//   } catch (error) {
//     console.error("Error fetching data:", error);
//   }

//   try {
//     const response = await fetch(serviceUrl);
//     service = await response.json();
//     console.log("service", service);
//   } catch (error) {
//     console.error("Error fetching service:", error);
//   }

//   //add Detail Info

//   const detailContainer = $(".offcanvas-body");

//   let newDetail = "";
//   let goodInfoHtml = "";
//   let badInfoHtml = "";

//   if (data.walk_in === 'y') { 
//     goodInfoHtml += `
//      <div class="row-wrapper">
//         <div class="icon">
//         <img class="bullet-icon" src="./asset/bullet.svg"></img>
//         </div>
//         <p>Walk in ได้</p>
//      </div>
//     `
//   }
//   if (data.refer_in_cap !== 'n') {
//     goodInfoHtml += `
//     <div class="row-wrapper">
//         <div class="icon">
//         <img class="bullet-icon" src="./asset/bullet.svg"></img>
//         </div>
//       <p>รับส่งต่อ${data.refer_in_cap}</p>
//     </div>  
//     `
//   }

//   if (data.under_age !== 'n') {
//     badInfoHtml += `
//     <div class="warning-container row-wrapper">
//         <img class="icon" src="./asset/triangle.svg"></img>
//         <div>อายุต่ำกว่า ${data.under_age} ปี ต้องมีผู้ปกครอง</div>
//     </div>
//     `
//   }

//   if (data.foreigner_med === 'n') {
//     badInfoHtml += `
//     <div class="warning-container row-wrapper">
//         <img class="icon" src="./asset/triangle.svg"></img>
//         <div>ไม่มีบริการสำหรับต่างชาติ</div>
//     </div>    
//     `
//   }

//   newDetail += `
//       <div class="detail-title">
//         <p class="title-th">
//           ${data.name_th}
//         </p>
//         <p class="title-en">
//           ${data.name_en}
//         </p>
//       </div>

//       <div>
//         <div class="preg-container" >
//             <img class="icon" src="./asset/clock.svg"></img>
//             <span>รับอายุครรภ์ ไม่เกิน ${data.preg_week} สัปดาห์</span>
//         </div>

//         <div class="bullet-container">
//             <div class="row-wrapper">
//               <img class="icon" src="./asset/calendar.svg"></img>
//               <div>
//                 <p>เปิดทำการ ${data.open_day} เวลา ${data.open_from} - ${data.open_to} น.</p>
//                 <p>หยุด${data.closed_day}</p>
//               </div>
//             </div> 

//             <div class="row-wrapper">
//                 <img class="icon" src="./asset/phone.svg"></img>
//                 <div>
//                   <p>${data.tel}</p>
//                   <p id="contact-note-margin">
//                   *${data.tel_remark}
//                   </p>
//                 </div>
//             </div>

//             <div class="row-wrapper">
//                 <img class="icon" src="./asset/line.svg"></img>
//                 <p>${data.line}</p>
//             </div>
//             <div class="row-wrapper">
//                 <img class="icon" src="./asset/letter.svg"></img>
//                 <p>${data.email}</p>
//             </div>
//           </div>

//           <div id="cont-container">
//             ${goodInfoHtml}
//           </div>

//           <div id="warning-wrapper"> 
//             ${badInfoHtml}
//           </div>
//         </div>
//         <div class="table-container">
//             <p class="header">บริการยุติการตั้งครรภ์</p>
//             <table>
//             </table>
//             <div id="money-aid-container">
//               <p>หากไม่มีเงินเพียงพอในการจ่ายค่าบริการ สามารถติดต่อทำทางเพื่อขอรับความช่วยเหลือได้ค่ะ</p>
//             </div> 
//         </div>
//         <div class="other-service-container">
//           <p class="header">บริการอื่นๆ</p>
//           <p>(กรุณาสอบถามราคาจากคลินิค)</p>
//           <div id="cont-container">
//           </div>
//         </div>
//         <div>
//           <span><a href="www.google.com">ดูตำแหน่งบน Google Map</a></span>
//         </div>
//       </div>
//     </div>
//   `;

//   detailContainer.html(newDetail);

//   //add Service Info

//   const detailService = $(".table-container table");
  
//   let serviceThead = `<tr>
//                 <th class="method">ประเภท</td>
//                 <th class="price">ค่าบริการ</th>
//               </tr>`;
//   let newService = "";
//   let newMed = "";
//   let newMVA = "";

//   if (service) {
//   const medFound = service.some(item => item.sm_id === "2");
//   const mvaFound = service.some(item => item.sm_id === "1");
  
//   function loopMVA(service) {
//     let allCost = "";

//     //choose only 'MVA' method (sm_id = 1)
//     service.filter(item => String(item.sm_id) === '1')
//           .forEach(i => { 
//           allCost += i.cost
//           allCost += "<br>"
//           });

//     return allCost;
//   }

//   function findMed(service) {
//     let med = "";
//     //choose only 'Med' method (sm_id = 2)
//     service.filter(item => String(item.sm_id) === '2')
//     return med;
//   }

//   const mvaCost = loopMVA(service);
//   const medCost = findMed(service);
  
//     if (!medFound) {
//       console.log("med not found :(")
//       newMed += `
//         <tr class="unavailable">
//           <td scope="row">ยา</td>
//           <td colspan="4">งดบริการชั่วคราว</td>
//         </tr>
//       `;
//     } else {
//       console.log("med found!")
//      newMed += `
//         <tr class="unavailable">
//           <td scope="row">ยา</td>
//           <td colspan="4">${medCost}</td>
//         </tr>
//       `;
//     }

//     if (!mvaFound) {
//       console.log("mva not found :(")
//       newMVA += `
//         <tr class="unavailable">
//           <td scope="row">ดูดสุญญากาศ</td>
//           <td colspan="4">งดบริการชั่วคราว</td>
//         </tr>
//       `;
//     } else {
//       console.log("mva found :(");
//       console.log(mvaCost);
    
//     newMVA += `
//         <tr class="">
//           <td scope="row">ดูดสุญญากาศ</td>
//           <td colspan="4">${mvaCost}</td>
//         </tr>
//       `;
//     }
//   }

//   newService = serviceThead + newMed + newMVA;

//   detailService.html(newService);

//   //add Other Service Info

//   const detailOtherService = $(".other-service-container #cont-container");
//   let newOtherService = "";

//   function loopOtherService(service) {
//     console.log("show other service");
//     let otherElement = "";

//       service.filter(item => String(item.type) === 'other')
//              .forEach(i => { 
//               otherElement += 
//               `<div class="row-wrapper">
//                   <div class="icon">
//                     <img class="bullet-icon" src="./asset/primary-bullet.svg"></img>
//                   </div>
//                   <p>${i.name}</p>
//               </div>`
//             });

//     console.log(otherElement);

//     return otherElement;
//   }
  
//   newOtherService = loopOtherService(service);

//   // let newOtherService = "";
//   // newOtherService = `<div class="row-wrapper">
//   //                       <div class="icon">
//   //                           <img class="bullet-icon" src="./asset/primary-bullet.svg"></img>
//   //                       </div>
//   //                       <p>อัลตราซาวด์</p>
//   //                   </div>`;

//   detailOtherService.html(newOtherService);

// });

// ==== BUTTON ====

//filter btn
// $(".filter-btn").on("click", function() {
//   console.log("filter clicked");
// });



// back btn to name list
// backBtn.on("click", ()=> {
//     $("#detail-wrapper").animate({"margin-left": '-=890px'},1000);
//     clearMap(centerAndStatusData);
// });

window.handleSearch = handleSearch;
