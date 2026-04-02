
const map = L.map('map').setView([13.36, 100.99], 10);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: '&copy; OpenStreetMap'
}).addTo(map);


L.control.scale({ position: 'bottomright', metric: true, imperial: false }).addTo(map);

let markerLayer, heatLayer, routingControl;
let allFeatures = [];
let refPoint = null;
let refMarker = null;
let setRefMode = false;


function getColor(suit_class) {
  return suit_class === 'Low'    ? '#d7191c'
       : suit_class === 'Medium' ? '#fdae61'
       : suit_class === 'High'   ? '#1a9641'
       : '#888';
}

function updateStats() {
  let low=0, med=0, high=0;
  allFeatures.forEach(f => {
    const cls = f.properties.suit_class;
    if (cls === 'Low') low++;
    else if (cls === 'Medium') med++;
    else if (cls === 'High') high++;
  });
  document.getElementById('count-low').textContent = low;
  document.getElementById('count-med').textContent = med;
  document.getElementById('count-high').textContent = high;
  document.getElementById('count-all').textContent = allFeatures.length;
}


let isHeat = false;
document.getElementById('toggleHeat').onclick = () => {
  if (!isHeat) {
    map.removeLayer(markerLayer);
    map.addLayer(heatLayer);
    document.getElementById('toggleHeat').innerText = 'Swap to marker map';
  } else {
    map.removeLayer(heatLayer);
    map.addLayer(markerLayer);
    document.getElementById('toggleHeat').innerText = 'Swap to heat map';
  }
  isHeat = !isHeat;
};


document.getElementById('setRefBtn').onclick = () => {
  setRefMode = true;
  map.getContainer().style.cursor = 'crosshair';
};


map.on('click', e => {
  if (!setRefMode) return;
  refPoint = e.latlng;
  if (refMarker) map.removeLayer(refMarker);
  refMarker = L.marker(refPoint, {
    icon: L.icon({ iconUrl: 'https://cdn-icons-png.flaticon.com/512/64/64113.png', iconSize: [30,30] })
  }).addTo(map).bindPopup('ตำแหน่งอ้างอิง').openPopup();


  document.getElementById('coords').innerHTML = `
    <h6 class="small mb-1">Coordinates</h6>
    <div>Ref: ${refPoint.lat.toFixed(5)}, ${refPoint.lng.toFixed(5)}</div>
  `;
  document.getElementById('summary').innerHTML = '';
  setRefMode = false;
  map.getContainer().style.cursor = '';
});


fetch('./data/cilp_with_traffic.geojson')
  .then(r => r.json())
  .then(data => {
    allFeatures = data.features;
    updateStats();

 
    markerLayer = L.geoJSON(data, {
      pointToLayer: (f, latlng) => L.circleMarker(latlng, {
        radius: 8,
        fillColor: getColor(f.properties.suit_class),
        color: '#333', weight: 1, fillOpacity: 0.9
      }),
      onEachFeature: (f, lyr) => lyr.on('click', () => {
        showDetails(f.properties, lyr.getLatLng());
        if (refPoint) routeToTarget(refPoint, lyr.getLatLng());
      })
    });


    const heatData = data.features.map(f => [
      f.geometry.coordinates[1],
      f.geometry.coordinates[0],
      Number(f.properties.score) || 0
    ]);
    heatLayer = L.heatLayer(heatData, {
      radius: 30,
      blur: 15,
      maxZoom: 13,
      minOpacity: 0.5,
      gradient: {
        0.0: 'blue',       
        0.4: 'lime',       
        0.7: 'yellow',     
        0.9: 'orange',
        1.0: 'red'         
      }
    });


    markerLayer.addTo(map);
  })
  .catch(console.error);


function showDetails(props, latlng) {
  const raw = props.score ?? props.suitability ?? props.suitabilit ?? null;
  const num = Number(raw);
  const display = (raw != null && !isNaN(num)) ? num.toFixed(2) : '-';

  document.getElementById('details').innerHTML = `
    <b>ID:</b> ${props.TARGET_FID}<br>
    <b>Suitability:</b> ${display}<br>
    <b>Class:</b> ${props.suit_class}
    <br><span class="text-secondary">(คลิกปั๊มเพื่อดูระยะทาง)</span>
  `;

  document.getElementById('coords').innerHTML = `
    <h6 class="small mb-1">Coordinates</h6>
    <div>Ref: ${refPoint.lat.toFixed(5)}, ${refPoint.lng.toFixed(5)}</div>
    <div>Pump: ${latlng.lat.toFixed(5)}, ${latlng.lng.toFixed(5)}</div>
  `;

  document.getElementById('summary').innerHTML = '';
}


function routeToTarget(ref, target) {
  if (routingControl) map.removeControl(routingControl);
  routingControl = L.Routing.control({
    waypoints: [ref, target],
    router: L.Routing.osrmv1(),
    addWaypoints: false,
    routeWhileDragging: false,
    draggableWaypoints: false,
    fitSelectedRoutes: true,
    show: false,
    lineOptions: { styles: [{ color: '#1976D2', weight: 5 }] }
  }).addTo(map);

  routingControl.on('routesfound', e => {
    const r = e.routes[0];
    document.getElementById('summary').innerHTML = `ระยะทาง ${Math.round(r.summary.totalDistance)} m`;
  });
}
