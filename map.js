let map;

async function initMap() {

    const position1 = { lat: 13.7262642, lng: 100.5409093 };
    const position2 = { lat: 13.7300927, lng: 100.5324355 };

    const { Map } = await google.maps.importLibrary("maps");
    const { AdvancedMarkerElement } = await google.maps.importLibrary("marker");

    map = new Map(document.getElementById("map"), {
        center: position1,
        zoom: 8,
        mapId: "DEMO_MAP_ID"
    });

    const marker1 = new AdvancedMarkerElement({
        map: map,
        position: position1,
        title: "Doc Club",
      });
    
    // marker.addListener("click", () => {
    //     alert("Marker clicked");
    // })

    const marker2 = new AdvancedMarkerElement({
        map: map,
        position: position2,
        title: "Patpong Market",
      });

}

// initMap();