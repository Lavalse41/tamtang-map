// import { getAnalytics } from "https://www.gstatic.com/firebasejs/11.4.0/firebase-analytics.js";
import { initMap } from "./map.js";
import { goToLocation } from "./map.js";
import { clearMap } from "./map.js";


//default state
$('#simplemap').show(); 
$('#map').hide();  
//$("#filter-select-wrapper").addClass("hide");

let centerPosData = {};

const searchInput = $("#search");
const weekSelectbox = $("#week-filter")
const priceSelectbox = $("#price-filter")
const typeSelectbox = $("#type-filter")
const cardWrapper = $("#outer-card-wrapper");
const searchBtn = $("#search-btn");
const backBtn = $("#back-btn span");

//function to calculate preg week filter
function calStartAfter(week) {
  if (week >= 1 && week <= 24) {
     return 9;
  } else if (week > 9 && week <= 24) {
     return 12;
  } else if (week > 12 && week <= 24) {
     return 24;
  } else {
     return null;
  }
}  
// function to fetch province list
const provinceList = await makeProvinceList();    
async function makeProvinceList() {
    try {
      const response = await fetch('http://tamtangtest.local/wp-json/custom/v1/province');
      const data = await response.json();

    const provinceNames = [...new Set(data.map(item => item.province))];

    console.log("provinceNames:", provinceNames);
    return provinceNames;
    } catch (error) {
    console.error("Error fetching province data:", error);
    throw error;
  }
};
// function to fetch center of province
async function getProvinceCenter(province) {
  // console.log("province: ", province);

  const url = new URL('http://tamtangtest.local/wp-json/custom/v1/center');
  url.searchParams.set("province", province);

  fetch(url)
  .then(res => res.json())
  // .then(data => console.log('infunction center: ', data));
}
// function to fetch data based on search
async function getData(province, week, type, foreignerMed) { 
  try {

     const url = new URL('http://tamtangtest.local/wp-json/custom/v1/place');
      if (province) url.searchParams.set("province", province);
      if (week) url.searchParams.set("week", week);
      if (type) url.searchParams.set("type", type);
      if (foreignerMed) url.searchParams.set("foreignerMed", foreignerMed);
      
      console.log("url: ", url);
    
      const response = await fetch(url);

      const data = await response.json();
      // console.log("infunction name: ", data); 
      return data;

    } catch (error) {
    console.error("Error fetching province data:", error);
    throw error;
  }
}
// function to fetch service data
async function getService(place_id) {
  try {
    const url = new URL('http://tamtangtest.local/wp-json/custom/v1/service');
      url.searchParams.set("place_id", place_id);

      const response = await fetch(url);
      const data = await response.json();
      return data;
  } catch (error) {
    console.error("Error fetching service data:", error);
    throw error;
  }
}
// function to handle search province  
export async function handleSearch(province) {

  console.log('handleSearch function called:');

  // 1.get searched province and filter values
  const searchedProvince = searchInput.val() || province;
  // const searchedProvince = "กรุงเทพมหานคร"; 
  const priceValue = priceSelectbox.val();
  const weekValue = weekSelectbox.val();
  const typeValue = typeSelectbox.val();
  const foreignerMedCheckbox = $("#foreigner-med-checkbox");
  const foreignerMed = foreignerMedCheckbox.is(":checked") ? "y" : "n";

  console.log('searchedProvince : ', searchedProvince);
  console.log('priceValue : ', priceValue);
  console.log('weekValue : ', weekValue);
  console.log('typeValue : ', typeValue);
  console.log('foreignerMed : ', foreignerMed);
   
  // 3.create empty card html
  let newCard = "";
  
  // 4.fetch data based on searched province and filter values
  if (searchedProvince !== "") {
    try {

      const provinceData = await getData(searchedProvince, weekValue, typeValue, foreignerMed); 
      console.log('provinceData : ', provinceData);

      centerPosData = await getProvinceCenter(searchedProvince);

      // generate google map
      if (provinceData.length !== 0) {
         $('#simplemap').hide()
         $('#map').show();  
        initMap(provinceData, centerPosData); 
      } else {
        console.log("province not found")
      }

      // generate card html
      for (const key in provinceData){
        if (provinceData.hasOwnProperty(key)){
          const nameThai = provinceData[key].name_th;
          const pregWeek = provinceData[key].preg_week;
          const type = provinceData[key].type;
          const placeId = provinceData[key].place_id;

          //let costNew = Number(cost);
          //costNew = costNew === 1 ? 'ราคาตามอายุครรภ์' : `${costNew.toLocaleString()} บาท`;

          newCard += `
            <div class="place-card-wrapper" data-key="${placeId}">
              <div id="place-wrapper">
                <h3>${nameThai} <span class="hide">${type}</span></h3>
                <div class="tag-container">
                  <span class="tag focus">ไม่เกิน ${pregWeek} สัปดาห์</span>
                  <span class="tag"></span>
                </div>
              </div>
              <div id="detail-link">
                <div class="row-wrapper"><span >ดูรายละเอียด</span><img class="icon" src="./asset/chevron-right.svg"></div>
                <hr>
              </div>
          </div>
          `;
        
        } else {
          console.log("data not found");
        }
      }
      cardWrapper.html(newCard);

      // $(".card").on("click", function() {
      //   const position = JSON.parse($(this).attr("data-position")); 
      //   goToLocation(position); 
      // });

      //reset search value
      // searchInput.val("");

    } catch (error) {
      console.error(error.message);
    }
  }
};

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

// function to handle place card click to see detail
cardWrapper.on("click", ".place-card-wrapper", async function(event) {
  console.log("see detail clicked");
  
  if ($("#detail-wrapper").css("margin-left") === '-890px') {
    $("#detail-wrapper").animate({"margin-left": '+=890px'},1000);
 }
 
  const card = $(this).closest(".place-card-wrapper");
  const key = card.data("key");
  console.log("key:", key);

  const placeUrl = new URL('http://tamtangtest.local/wp-json/custom/v1/data');
  url.searchParams.set("place_id", key); 
  let data;

  const serviceUrl = new URL('http://tamtangtest.local/wp-json/custom/v1/service')
  url2.searchParams.set("place_id", key);
  let service;

  try {
    const response = await fetch(placeUrl);
    data = await response.json();
    console.log("data:", data);
  } catch (error) {
    console.error("Error fetching data:", error);
  }

  try {
    const response = await fetch(serviceUrl);
    service = await response.json();
    console.log("service", service);
  } catch (error) {
    console.error("Error fetching service:", error);
  }

  //add Detail Info

  const detailContainer = $(".detail-container");

  let newDetail = "";
  let goodInfoHtml = "";
  let badInfoHtml = "";

  if (data.walk_in === 'y') { 
    goodInfoHtml += `
     <div class="row-wrapper">
        <div class="icon">
        <img class="bullet-icon" src="./asset/bullet.svg"></img>
        </div>
        <p>Walk in ได้</p>
     </div>
    `
  }
  if (data.refer_in_cap !== 'n') {
    goodInfoHtml += `
    <div class="row-wrapper">
        <div class="icon">
        <img class="bullet-icon" src="./asset/bullet.svg"></img>
        </div>
      <p>รับส่งต่อ${data.refer_in_cap}</p>
    </div>  
    `
  }

  if (data.under_age !== 'n') {
    badInfoHtml += `
    <div class="warning-container row-wrapper">
        <img class="icon" src="./asset/triangle.svg"></img>
        <div>อายุต่ำกว่า ${data.under_age} ปี ต้องมีผู้ปกครอง</div>
    </div>
    `
  }

  if (data.foreigner_med === 'n') {
    badInfoHtml += `
    <div class="warning-container row-wrapper">
        <img class="icon" src="./asset/triangle.svg"></img>
        <div>ไม่มีบริการสำหรับต่างชาติ</div>
    </div>    
    `
  }

  newDetail += `
      <div class="detail-title">
        <p class="title-th">
          ${data.name_th}
        </p>
        <p class="title-en">
          ${data.name_en}
        </p>
      </div>

      <div>
        <div class="preg-container" >
            <img class="icon" src="./asset/clock.svg"></img>
            <span>รับอายุครรภ์ ไม่เกิน ${data.preg_week} สัปดาห์</span>
        </div>

        <div class="bullet-container">
            <div class="row-wrapper">
              <img class="icon" src="./asset/calendar.svg"></img>
              <div>
                <p>เปิดทำการ ${data.open_day} เวลา ${data.open_from} - ${data.open_to} น.</p>
                <p>หยุด${data.closed_day}</p>
              </div>
            </div> 

            <div class="row-wrapper">
                <img class="icon" src="./asset/phone.svg"></img>
                <div>
                  <p>${data.tel}</p>
                  <p id="contact-note-margin">
                  *${data.tel_remark}
                  </p>
                </div>
            </div>

            <div class="row-wrapper">
                <img class="icon" src="./asset/line.svg"></img>
                <p>${data.line}</p>
            </div>
            <div class="row-wrapper">
                <img class="icon" src="./asset/letter.svg"></img>
                <p>${data.email}</p>
            </div>
          </div>

          <div id="cont-container">
            ${goodInfoHtml}
          </div>

          <div id="warning-wrapper"> 
            ${badInfoHtml}
          </div>
        </div>
        <div class="table-container">
            <p class="header">บริการยุติการตั้งครรภ์</p>
            <table>
            </table>
            <div id="money-aid-container">
              <p>หากไม่มีเงินเพียงพอในการจ่ายค่าบริการ สามารถติดต่อทำทางเพื่อขอรับความช่วยเหลือได้ค่ะ</p>
            </div> 
        </div>
        <div class="other-service-container">
          <p class="header">บริการอื่นๆ</p>
          <p>(กรุณาสอบถามราคาจากคลินิค)</p>
          <div id="cont-container">
          </div>
        </div>
        <div>
          <span><a href="www.google.com">ดูตำแหน่งบน Google Map</a></span>
        </div>
      </div>
    </div>
  `;

  detailContainer.html(newDetail);

  //add Service Info

  const detailService = $(".table-container table");
  
  let serviceThead = `<tr>
                <th class="method">ประเภท</td>
                <th class="price">ค่าบริการ</th>
              </tr>`;
  let newService = "";
  let newMed = "";
  let newMVA = "";

  if (service) {
  const medFound = service.some(item => item.sm_id === "2");
  const mvaFound = service.some(item => item.sm_id === "1");
  
  function loopMVA(service) {
    let allCost = "";

    //choose only 'MVA' method (sm_id = 1)
    service.filter(item => String(item.sm_id) === '1')
          .forEach(i => { 
          allCost += i.cost
          allCost += "<br>"
          });

    return allCost;
  }

  function findMed(service) {
    let med = "";
    //choose only 'Med' method (sm_id = 2)
    service.filter(item => String(item.sm_id) === '2')
    return med;
  }

  const mvaCost = loopMVA(service);
  const medCost = findMed(service);
  
    if (!medFound) {
      console.log("med not found :(")
      newMed += `
        <tr class="unavailable">
          <td scope="row">ยา</td>
          <td colspan="4">งดบริการชั่วคราว</td>
        </tr>
      `;
    } else {
      console.log("med found!")
     newMed += `
        <tr class="unavailable">
          <td scope="row">ยา</td>
          <td colspan="4">${medCost}</td>
        </tr>
      `;
    }

    if (!mvaFound) {
      console.log("mva not found :(")
      newMVA += `
        <tr class="unavailable">
          <td scope="row">ดูดสุญญากาศ</td>
          <td colspan="4">งดบริการชั่วคราว</td>
        </tr>
      `;
    } else {
      console.log("mva found :(");
      console.log(mvaCost);
    
    newMVA += `
        <tr class="">
          <td scope="row">ดูดสุญญากาศ</td>
          <td colspan="4">${mvaCost}</td>
        </tr>
      `;
    }
  }

  newService = serviceThead + newMed + newMVA;

  detailService.html(newService);

  //add Other Service Info

  const detailOtherService = $(".other-service-container #cont-container");
  let newOtherService = "";

  function loopOtherService(service) {
    console.log("show other service");
    let otherElement = "";

      service.filter(item => String(item.type) === 'other')
             .forEach(i => { 
              otherElement += 
              `<div class="row-wrapper">
                  <div class="icon">
                    <img class="bullet-icon" src="./asset/primary-bullet.svg"></img>
                  </div>
                  <p>${i.name}</p>
              </div>`
            });

    console.log(otherElement);

    return otherElement;
  }
  
  newOtherService = loopOtherService(service);

  // let newOtherService = "";
  // newOtherService = `<div class="row-wrapper">
  //                       <div class="icon">
  //                           <img class="bullet-icon" src="./asset/primary-bullet.svg"></img>
  //                       </div>
  //                       <p>อัลตราซาวด์</p>
  //                   </div>`;

  detailOtherService.html(newOtherService);

});

// ==== BUTTON ====

//filter btn
$(".filter-btn").on("click", function() {
  console.log("filter clicked");
});

// search btn 
searchBtn.on("click", handleSearch);

// back btn to name list
backBtn.on("click", ()=> {
    $("#detail-wrapper").animate({"margin-left": '-=890px'},1000);
    clearMap(centerPosData);
});

window.handleSearch = handleSearch;

