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

          let priceText = '';
          if (cost_type === 'free') priceText = 'ฟรี';
          else if (cost_type === 'paid') priceText = 'มีค่าบริการ';

          const foreignerTagHtml =
            (String(foreigner_med).trim() === 'y')
              ? `<span class="card__tag foreigner">มีบริการสำหรับต่างชาติ</span>`
              : '';

          newCard += `
            <div class="card card--place" data-key="${placeId}">
              <div class="card__body">
                <div class="card__title">${nameThai}</div>
                <div class="card__tag-group">
                  <span class="card__tag week">ไม่เกิน ${pregWeek} สัปดาห์</span>
                  <span class="card__tag price">${priceText}</span>
                  ${foreignerTagHtml}
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
const popoverList = [...popoverTriggerList].map(popoverTriggerEl => new bootstrap.Popover(popoverTriggerEl))



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

//   const detailContainer = $(".detail-container");

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
