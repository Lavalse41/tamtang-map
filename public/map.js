let map;

export async function initMap(provinceData, centerPosition) { 
    console.log("provinceData gm: ", provinceData);
    console.log("gm init");

    const { Map } = await google.maps.importLibrary("maps");
    const { AdvancedMarkerElement } = await google.maps.importLibrary("marker");

    const centerDefault = {
        "lat": 13.7271822,
        "lng": 100.5349397
    }

    map = new Map(document.getElementById("map"), {
        center: centerDefault,
        zoom: 7,
        mapId: "DEMO_MAP_ID"
    });

    // ไม่เจอค่า
    if (centerPosition) {
        map.setCenter(centerPosition);
        map.setZoom(12);
    }
    
    if (provinceData) {
      console.log("provinceData gm inside: ", provinceData);

      Object.values(provinceData).forEach((place) => {
      const formatLat = Number(place.lat);
      const formatLng = Number(place.lng);
    
      const marker = new AdvancedMarkerElement({
          map: map,
          position: {"lat": formatLat, "lng": formatLng},
          title: place.name_th, 
      });

     });
    }
}

export function goToLocation(location) {
    // console.log("location:", location);
    if (map && location) {
      map.setZoom(16);
      map.panTo(location);
    } else {
      console.warn("Map not ready or location missing");
    }
  }

export function clearMap(centerPosition) {
    if (map) {
        map.setZoom(12);
        map.panTo(centerPosition);
    }
}

initMap();
