// import { getAnalytics } from "https://www.gstatic.com/firebasejs/11.4.0/firebase-analytics.js";
import { initMap } from "./map.js";
import { goToLocation } from "./map.js";
import { clearMap } from "./map.js";

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

$('#simplemap').show(); 
$('#map').hide();  

let centerPosData = {};

const searchInput = $(".search")
const weekSelectbox = $("#week-filter")
const typeSelectbox = $("#type-filter")
const cardWrapper = $("#card-wrapper");
const searchBtn = $("#search-btn");
const backBtn = $("#back-btn span");
const provinceList = await makeProvinceList();

async function makeProvinceList() {
    try {
      const response = await fetch('http://tamtangtest.local/wp-json/custom/v1/centers');
      const data = await response.json();

    if (!Array.isArray(data)) {
      throw new Error("Invalid data format from API");
    }

    const provinceNames = [...new Set(data.map(center => center.province))];

    console.log("provinceNames:", provinceNames);
    return provinceNames;
    } catch (error) {
    console.error("Error fetching province data:", error);
    throw error;
  }
};

async function getProvinceCenter(province) {
  const centerPosition = await get(ref(database, `center/${province}`));

  if (centerPosition.exists()) {
    const data = centerPosition.val();
    console.log("centerPosition: ", data);
    return data;
  }
  throw new Error("Center data not exist");
}

async function getData(province, type, week) { 

  let searchedProvinceRef;

  try { 
    // console.log('week: ',week);
    // console.log('type: ',type);
    if (week === "") {
      searchedProvinceRef = ref(database, `location/${province}`); 
      
    } else {
      const parseWeek = parseInt(week);

      searchedProvinceRef = query(
        ref(database, `location/${province}`), 
        orderByChild("preg_week"), 
        endAt(parseWeek),
      );
    }

    const searchedProvinceData = await get(searchedProvinceRef);
   
    if (searchedProvinceData.exists()) {
      const data = searchedProvinceData.val();
    
      if (type !== "") {
        const filteredData = Object.values(data).filter(item => item.type === type);
        return filteredData;
      } else {
        return data;
      }

    } else {
      throw new Error("either province or center data not exist");
    }

  } catch (error) {
      throw new Error("Error fetching data:", error.message);
  }
};

// AUTOCOMPLETE PROVINCE
// $(".search").autocomplete({
//   source: provinceList,
//   minLength: 1,
//   select: function(event, ui) {
//     searchInput.val(ui.item.value);
//     searchBtn.click(); 
//     return false; 
//   }
// });


// HANDLE SEARCH PROVINCE 
export async function handleSearch(province) {

  const searchedProvince = province || searchInput.val().trim();
  const typeValue = typeSelectbox.val();
  const weekValue = weekSelectbox.val();  
  
  if (searchedProvince !== "") {
    try {

      const provinceData = await getData(searchedProvince, typeValue, weekValue); 
      centerPosData = await getProvinceCenter(searchedProvince);

      // console.log('centerDataAfterSearched: ', centerPosData);

      let newCard = "";

      for (const key in provinceData){
        if (provinceData.hasOwnProperty(key)){
          const nameEng = provinceData[key].name_en;
          const nameThai = provinceData[key].name_th;
          const pregWeek = provinceData[key].preg_week;
          const type = provinceData[key].type;
          const position = provinceData[key].position;

          const tagClass = type === "รัฐ" ? 'gov' : 'private';

          newCard += `
            <div class="card" data-position='${JSON.stringify(position)}'>
              <div class="row-wrapper space-btw">
                <div>
                  <p id="name">${nameThai} <span id="key" class="hide">${key}</span></p>
                  <p id="preg-week"><i class="fi fi-br-time-past" style="marginLeft:10px;"></i> ไม่เกิน ${pregWeek} สัปดาห์</p>
                </div>
                <div class="type-tag ${tagClass}">${type}</div>
              </div>
              <div class="see-detail-wrapper">
                <span class="see-detail">ดูรายละเอียด <i class="fa-solid fa-arrow-right"></i></span>
              </div>
            </div>
          `;
        
        } else {
          console.log("data not found");
        }
      }
      cardWrapper.html(newCard);

      $(".card").on("click", function() {
        const position = JSON.parse($(this).attr("data-position")); 
        goToLocation(position); 
      });

      $('#simplemap').hide();      
      $('#map').show(); 
      //input marker into map
      initMap(provinceData, centerPosData); 

      //reset search value
      // searchInput.val("");

    } catch (error) {
      console.error(error.message);
    }
  }
};

// HANDLE SEARCH BTN CLICK
searchBtn.on("click", handleSearch);

// SLIDE DETAIL
cardWrapper.on("click", ".see-detail", async function(event) {
  if ($("#detail-wrapper").css("margin-left") === '-890px') {
    $("#detail-wrapper").animate({"margin-left": '+=890px'},1000);
 }

  const card = $(this).closest(".card");
  const key = card.find("#key").text();
  // console.log("key: ", key);

  const placeDetail = ref(database, `detail/${key}`);
  
  const snapshot = await get(placeDetail);

  if (snapshot.exists()) {
    const data = snapshot.val();
    // console.log("data: ", data);

    const {name_th, name_en, preg_week, type, open_day, open_time, 
          closed_day, tel, refer_in_cap, under_age, foreigner_med, 
          condition, remark, map_url, img_url, service} = data;
    
    const detailImage =  `<img src="${img_url}" alt="${name_en}">`;

    const detailDesc = `<div class="detail-title">
  <p class="title-th">
    ${name_th}
  </p>
  <p class="title-en">
    ${name_en}
  </p>
</div>
<div class="bullet-container">
  <p>
    <i class="fi fi-br-time-past"></i>
    <span>รับอายุครรภ์ ไม่เกิน ${preg_week} สัปดาห์</span>
  </p>
  <p>
    <i class="fi fi-br-calendar"></i>
    <span>${open_day} เวลา ${open_time} น. ${closed_day}</span>
  </p>
  <p>
    <i class="fi fi-br-phone-call"></i>
    <span>${tel}<br>${remark}</span>
  </p>
  <p>
    <i class="fi fi-br-check"></i>
    <span>${refer_in_cap}</span>
  </p>
  <p>
    <i class="fi fi-br-check"></i>
    <span>อายุต่ำกว่า 15 ปี ${under_age}</span>
  </p>
  <p>
    <i class="fi fi-br-cross"></i>
    <span>${foreigner_med}</span>
  </p>
</div>`

const serviceData = data.service;

let newService;
{/* <i class="fi fi-br-check-circle"></i> */}

for (const key in serviceData){
  if (serviceData.hasOwnProperty(key)){
    const name = serviceData[key].name;
    const price = serviceData[key].price;
    const status = serviceData[key].status;
    
    if (status === "Inactive") {
        newService +=  `
        <tr class="unavailable">
          <td>${name}</td>
          <td colspan="4">งดบริการชั่วคราว</td>
        </tr>
      `
    } else {
        newService +=  `
        <tr>
          <td>${name}</td>
          <td>${price}</td>
        </tr>
      `
    }
  } 
}

const detailMethod = `<div><div><b>วิธียุติการตั้งครรภ์</b></div>
<table>
  <tr>
    <th class="method">วิธี</td>
    <th class="price">ค่าบริการ</th>
  </tr>
  ${newService}
</table></div>`

const detailMapUrl = `<div>
<span><a href=${map_url} target="_blank">ดูตำแหน่งบน Google Map</a></span>
</div>`

$(".detail-img").html(detailImage);
$(".detail-container").html(detailDesc + detailMethod + detailMapUrl);

  } else {
    console.log("data is not exist");
  }
});

// BACK TO NAME TLIST
backBtn.on("click", ()=> {
    $("#detail-wrapper").animate({"margin-left": '-=890px'},1000);
    clearMap(centerPosData);
});

