'use strict';
// AgroDecide: interfaz visual con datos reales del backend.
const $ = (id) => document.getElementById(id);
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const fmt = (value, unit='', digits=1) => Number.isFinite(Number(value)) && value !== null && value !== ''
  ? `${Number(value).toLocaleString('es-CO',{maximumFractionDigits:digits})}${unit}` : 'Sin datos';
const clamp = (n, min, max) => Math.min(max, Math.max(min, Number(n) || 0));
const labels = {maiz:'Maíz',frijol:'Frijol',yuca:'Yuca',arroz:'Arroz',platano:'Plátano',papa:'Papa'};
const factorLabels = {temperatura:'Temperatura',lluvia:'Lluvia',ph:'pH',textura:'Textura',rotacion:'Rotación'};
const state = {map:null,layer:null,marker:null,radius:null,data:null,selected:'maiz',loading:false,basemap:'street'};

function status(message, variant='ok') {
  const target = $('status');
  target.className = `status-area ${variant==='ok'?'':variant}`;
  target.innerHTML = `<span class="status-dot"></span><span>${esc(message)}</span>`;
}
function dayName(iso) { try { return new Date(`${iso}T12:00:00`).toLocaleDateString('es-CO',{weekday:'short',day:'numeric'}); } catch {return iso;} }
function setNavigation() {
  document.querySelectorAll('[data-nav]').forEach(link=>link.addEventListener('click',()=>{
    document.querySelectorAll('[data-nav]').forEach(l=>l.classList.remove('active'));
    link.classList.add('active');
    $('sidebar').classList.remove('open');
    $('menuToggle').setAttribute('aria-expanded','false');
  }));
  $('menuToggle').addEventListener('click',()=>{
    const open = $('sidebar').classList.toggle('open');
    $('menuToggle').setAttribute('aria-expanded',String(open));
  });
  $('helpButton').addEventListener('click',()=>$('helpDialog').showModal());
  $('closeHelp').addEventListener('click',()=>$('helpDialog').close());
}
function makeTileLayer(mode) {
  if (mode==='satellite') {
    return L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',{
      maxZoom:18,
      attribution:'Imagery © Esri, Maxar, Earthstar Geographics, GIS User Community'
    });
  }
  return L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{
    maxZoom:19,
    attribution:'© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> contributors'
  });
}
function initMap(){
  if (!window.L) {
    $('map').innerHTML = '<div class="map-fallback">El mapa necesita Internet para cargar Leaflet. Puedes usar las coordenadas del formulario.</div>';
    $('satelliteBtn').disabled=true;
    $('streetBtn').disabled=true;
    return;
  }
  const lat=Number($('latitud').value), lon=Number($('longitud').value);
  state.map=L.map('map',{scrollWheelZoom:false,zoomControl:true}).setView([lat,lon],11);
  switchTiles('street');
  state.marker=L.circleMarker([lat,lon],{radius:10,color:'#fff',weight:3,fillColor:'#15a765',fillOpacity:1}).addTo(state.map);
  state.marker.bindPopup('<strong>Punto de análisis agrícola</strong><br>La ubicación no define los límites de un terreno.');
  state.radius=L.circle([lat,lon],{radius:450,color:'#b5ee9c',weight:2,dashArray:'5,5',fillColor:'#3abb66',fillOpacity:.10}).addTo(state.map);
  state.map.on('click',(event)=>{
    const {lat,lng}=event.latlng;
    $('latitud').value=lat.toFixed(5);
    $('longitud').value=lng.toFixed(5);
    updateMapPosition(false);
    status('Ubicación cambiada en el mapa. Pulsa «Analizar terreno» para consultar el nuevo punto.');
  });
  $('centerMap').addEventListener('click',()=>updateMapPosition(true));
  $('streetBtn').addEventListener('click',()=>switchTiles('street'));
  $('satelliteBtn').addEventListener('click',()=>switchTiles('satellite'));
  $('latitud').addEventListener('change',()=>updateMapPosition(true));
  $('longitud').addEventListener('change',()=>updateMapPosition(true));
  setTimeout(()=>state.map.invalidateSize(),150);
}
function switchTiles(mode){
  if(!state.map) return;
  if(state.layer) state.map.removeLayer(state.layer);
  state.layer=makeTileLayer(mode).addTo(state.map);
  state.basemap=mode;
  $('streetBtn').classList.toggle('active',mode==='street');
  $('satelliteBtn').classList.toggle('active',mode==='satellite');
}
function updateMapPosition(move) {
  const lat=Number($('latitud').value),lon=Number($('longitud').value);
  if(!Number.isFinite(lat)||!Number.isFinite(lon)||Math.abs(lat)>90||Math.abs(lon)>180) return;
  $('mapCoords').textContent=`${Math.abs(lat).toFixed(4)}° ${lat>=0?'N':'S'}, ${Math.abs(lon).toFixed(4)}° ${lon>=0?'E':'O'}`;
  if (state.marker) state.marker.setLatLng([lat,lon]);
  if (state.radius) state.radius.setLatLng([lat,lon]);
  if (state.map && move) state.map.setView([lat,lon],12);
}
function setGeolocation(){
  $('geolocateButton').addEventListener('click',()=>{
    if(!navigator.geolocation){status('Tu navegador no ofrece geolocalización; usa coordenadas.', 'error');return;}
    status('Solicitando permiso para leer la ubicación del dispositivo…','loading');
    navigator.geolocation.getCurrentPosition(({coords})=>{
      $('latitud').value=coords.latitude.toFixed(5);
      $('longitud').value=coords.longitude.toFixed(5);
      updateMapPosition(true);
      status('Ubicación recibida. Presiona «Analizar terreno» para obtener el pronóstico.');
    },()=>status('No fue posible obtener tu ubicación. Puedes introducir las coordenadas manualmente.','error'),{
      enableHighAccuracy:false,timeout:12000,maximumAge:120000
    });
  });
}
function getPayload() {
  const lat=Number($('latitud').value),lon=Number($('longitud').value);
  if($('latitud').value===''||$('longitud').value===''||!Number.isFinite(lat)||!Number.isFinite(lon)||Math.abs(lat)>90||Math.abs(lon)>180) throw new Error('Introduce coordenadas válidas: latitud -90 a 90 y longitud -180 a 180.');
  const phVal=$('ph').value.trim();
  const ph=phVal===''?null:Number(phVal);
  if(ph!==null&&(!Number.isFinite(ph)||ph<0||ph>14)) throw new Error('El pH debe estar entre 0 y 14.');
  return {latitud:lat,longitud:lon,ph,textura:$('textura').value||null,anterior:$('anterior').value||null,dias:Number($('horizonte').value)};
}
async function analyze(e){
  if(e) e.preventDefault();
  if(state.loading) return;
  let payload;
  try{payload=getPayload();}catch(error){status(error.message,'error');return;}
  state.loading=true;
  $('submit').disabled=true;
  $('submit').textContent='Consultando fuentes…';
  status('Obteniendo datos meteorológicos reales y el histórico de NASA POWER…','loading');
  try{
    const response=await fetch('/api/analizar',{
      method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)
    });
    const result=await response.json();
    if(!response.ok) throw new Error(typeof result.detail==='string'?result.detail:'No se pudo completar la consulta.');
    state.data=result;
    state.selected=$('objetivo').value;
    updateMapPosition(true);
    render(result);
    $('downloadButton').disabled=false;
    const stamp=new Date().toLocaleTimeString('es-CO',{hour:'2-digit',minute:'2-digit'});
    status(`Análisis actualizado a las ${stamp}. Pronóstico de ${payload.dias} días. ${result.historico_nasa?'NASA POWER disponible.':'NASA POWER no disponible; consulta el aviso de fuentes.'}`);
  }catch(error){
    status(`No fue posible obtener datos reales: ${error.message}`,'error');
  }finally{
    state.loading=false;
    $('submit').disabled=false;
    $('submit').textContent='✦ Analizar terreno';
  }
}
function selectedResult(){return state.data?.recomendaciones.find(r=>r.cultivo===state.selected)||null;}
function grade(value){return value>=80?'Idoneidad alta':value>=60?'Idoneidad media':'Idoneidad baja';}
function render(data){
  const c=data.pronostico.actual||{};
  $('metricTemp').textContent=fmt(c.temperature_2m,' °C');
  $('metricHumidity').textContent=fmt(c.relative_humidity_2m,' %',0);
  $('metricRain').textContent=fmt(c.precipitation,' mm');
  $('metricWind').textContent=fmt(c.wind_speed_10m,' km/h');
  $('forecastHorizon').textContent=`${data.horizonte_dias} días`;
  renderCrops(data);
  renderSelected();
  renderWeather(data);
  renderRotation(data);
  renderSources(data);
}
function renderCrops(data){
  $('cropGrid').innerHTML=data.recomendaciones.map((c,index)=>{
    const score=clamp(c.indice,0,100);
    return `<button type="button" class="crop-card ${state.selected===c.cultivo?'selected':''}" data-crop="${esc(c.cultivo)}" aria-pressed="${state.selected===c.cultivo}">
      <div class="crop-emoji" aria-hidden="true">${esc(c.emoji)}</div>
      <strong>${esc(c.nombre)}</strong><small>${index===0?'Mejor puntuación actual':'Índice orientativo'}</small>
      <div class="crop-score">${score}<i> / 100</i></div>
      <div class="crop-progress"><span style="width:${score}%"></span></div><span class="crop-grade">${grade(score)}</span></button>`;
  }).join('');
  document.querySelectorAll('[data-crop]').forEach(button=>button.addEventListener('click',()=>{
    state.selected=button.dataset.crop;
    $('objetivo').value=state.selected;
    renderCrops(state.data);
    renderSelected();
  }));
}
function renderSelected(){
  const chosen=selectedResult();
  if(!chosen) return;
  const score=clamp(chosen.indice,0,100);
  $('scoreRing').style.setProperty('--score',String(score));
  $('scoreNumber').textContent=score;
  $('scoreCrop').textContent=chosen.nombre;
  $('scoreNote').textContent=`${grade(score)} · cobertura ${chosen.cobertura}/100 del modelo`;
  let factorText=Object.entries(chosen.factores).map(([name,val])=>`${factorLabels[name]||name}: ${val}/100`).join(' · ');
  const best=state.data.recomendaciones[0];
  const compare=best.cultivo!==chosen.cultivo?` El cultivo mejor puntuado en esta consulta es ${best.nombre} (${best.indice}/100).`:'';
  $('chosenExplanation').textContent=`${chosen.nombre}: ${score}/100. Se evaluaron los factores disponibles (${factorText}).${compare} Los resultados pueden cambiar al agregar datos del suelo. No se ha validado el modelo con cosechas reales.`;
  $('factorPills').innerHTML=Object.entries(chosen.factores).map(([name,val])=>`<span class="factor-pill">${esc(factorLabels[name]||name)}: ${clamp(val,0,100)}/100</span>`).join('')+`<span class="factor-pill">Cobertura: ${chosen.cobertura}%</span>`;
}
function weatherIcon(code) {
  if(code===0) return '☀️';
  if([1,2].includes(code)) return '🌤️';
  if([3,45,48].includes(code)) return '☁️';
  if([51,53,55,56,57,61,63,65,66,67,80,81,82].includes(code)) return '🌧️';
  if([95,96,99].includes(code)) return '⛈️';
  return '🌦️';
}
function chartSvg(valuesA,valuesB,labels,type){
  const W=720,H=222,left=39,right=13,top=21,bottom=35;
  const innerW=W-left-right,innerH=H-top-bottom;
  const all=[...valuesA,...(valuesB||[])].filter(v=>Number.isFinite(v));
  if(!all.length) return '<div class="chart-empty">La fuente no devolvió datos para esta gráfica.</div>';
  let lower=Math.min(...all),upper=Math.max(...all);
  if(type==='rain') lower=0;
  else {lower=Math.floor((lower-2)/5)*5;upper=Math.ceil((upper+2)/5)*5;}
  if(upper<=lower) upper=lower+5;
  const x=i=>left+(i+.5)*innerW/labels.length;
  const y=n=>top+innerH-(n-lower)/(upper-lower)*innerH;
  let svg=`<svg class="chart-svg" viewBox="0 0 ${W} ${H}" role="img" aria-label="${type==='rain'?'Gráfico de lluvia pronosticada':'Gráfico de temperatura pronosticada'}">`;
  for(let row=0;row<=4;row++){
    const val=lower+(upper-lower)*row/4;
    const yy=y(val);
    svg+=`<line class="chart-grid-line" x1="${left}" y1="${yy}" x2="${W-right}" y2="${yy}"/><text x="${left-9}" y="${yy+3}" text-anchor="end">${val.toFixed(type==='rain'?0:0)}</text>`;
  }
  const every=Math.ceil(labels.length/8);
  labels.forEach((day,i)=>{if(i%every===0||i===labels.length-1) svg+=`<text x="${x(i)}" y="${H-10}" text-anchor="middle">${esc(dayName(day))}</text>`;});
  if(type==='rain'){
    const w=Math.min(45,innerW/labels.length*.62);
    valuesA.forEach((v,i)=>{
      if(!Number.isFinite(v))return;
      const yy=y(v);
      svg+=`<rect x="${x(i)-w/2}" y="${yy}" width="${w}" height="${Math.max(0,top+innerH-yy)}" rx="4" fill="#4cadd2" opacity=".9"><title>${esc(labels[i])}: ${v} mm</title></rect>`;
    });
  } else {
    for (const [series,color] of [[valuesA,'#e7a35c'],[valuesB,'#52b6a1']]){
      const segments=[];
      series.forEach((v,i)=>{
        if(Number.isFinite(v)) segments.push(`${segments.length?'L':'M'} ${x(i)} ${y(v)}`);
      });
      svg+=`<path d="${segments.join(' ')}" fill="none" stroke="${color}" stroke-width="3.2" stroke-linejoin="round" stroke-linecap="round"/>`;
      series.forEach((v,i)=>{if(Number.isFinite(v))svg+=`<circle cx="${x(i)}" cy="${y(v)}" r="4" fill="${color}" stroke="white" stroke-width="1.5"><title>${esc(labels[i])}: ${v} °C</title></circle>`;});
    }
  }
  return svg+'</svg>';
}
function renderWeather(data){
  const days=data.pronostico.dias.slice(0,data.horizonte_dias);
  const tempsMax=days.map(d=>d.temp_max===null?null:Number(d.temp_max));
  const tempsMin=days.map(d=>d.temp_min===null?null:Number(d.temp_min));
  const rain=days.map(d=>d.lluvia_mm===null?null:Number(d.lluvia_mm));
  const dates=days.map(d=>d.fecha);
  $('temperatureChart').innerHTML=chartSvg(tempsMax,tempsMin,dates,'temp');
  $('rainChart').innerHTML=chartSvg(rain,null,dates,'rain');
  $('forecastDays').innerHTML=days.map(d=>`<div class="day-card">
    <strong>${esc(dayName(d.fecha))}</strong><div class="day-icon" aria-hidden="true">${weatherIcon(d.codigo_tiempo)}</div>
    <div class="day-temps">${esc(fmt(d.temp_max,'°',0))} / ${esc(fmt(d.temp_min,'°',0))}</div>
    <div class="day-rain">☂ ${esc(fmt(d.lluvia_mm,' mm'))}</div>
    <div class="day-rain">Prob. ${esc(fmt(d.prob_lluvia,' %',0))}</div>
  </div>`).join('');
}
function renderRotation(data){
  const prior=data.suelo.anterior;
  if(!prior){$('rotationText').textContent='No se indicó el cultivo anterior. Agrégalo para incluir el componente de rotación en el índice.';return;}
  const selected=selectedResult();
  const part=selected?.factores.rotacion;
  $('rotationText').textContent=`Cultivo anterior informado: ${labels[prior]||prior}. Para el cultivo seleccionado (${selected?.nombre||'sin definir'}), el criterio experimental de rotación aporta una puntuación de ${part===undefined?'sin datos':part+'/100'}. No equivale a una recomendación validada de secuencia agrícola.`;
}
function renderSources(data){
  const n=data.historico_nasa;
  const stamp=data.pronostico.consultado_utc || data.generado_utc;
  const historical=n?`NASA POWER: periodo ${n.desde} a ${n.hasta}, media ${fmt(n.temp_media_c,' °C')} y lluvia acumulada ${fmt(n.lluvia_total_mm,' mm')}.`:`NASA POWER: ${data.aviso_nasa||'Sin datos'}`;
  $('sourceDetails').innerHTML=`<strong>Datos y límites:</strong> Open-Meteo: pronóstico de ${data.horizonte_dias} días (consulta UTC: ${esc(stamp)}). ${esc(historical)}<br><strong>Motor de cálculo:</strong> ${esc(data.metodologia)}<br><strong>Mapa:</strong> permite localizar el punto; no mide los límites, el pH ni la humedad real del suelo.`;
}
function downloadResults(){
  if(!state.data)return;
  const report={proyecto:'AgroDecide',tipo:'Análisis agrícola experimental',cultivo_seleccionado:state.selected,...state.data};
  const blob=new Blob([JSON.stringify(report,null,2)],{type:'application/json;charset=utf-8'});
  const url=URL.createObjectURL(blob);
  const a=document.createElement('a');a.href=url;a.download=`agrodecide_${new Date().toISOString().slice(0,10)}.json`;
  document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
function init(){
  $('todayLabel').textContent=new Date().toLocaleDateString('es-CO',{day:'numeric',month:'short',year:'numeric'});
  setNavigation();
  initMap();
  setGeolocation();
  $('form').addEventListener('submit',analyze);
  $('objetivo').addEventListener('change',()=>{
    state.selected=$('objetivo').value;
    if(state.data){renderCrops(state.data);renderSelected();renderRotation(state.data);}
  });
  $('downloadButton').addEventListener('click',downloadResults);
  $('horizonte').addEventListener('change',()=>{
    if(state.data) status('Cambiaste el periodo: pulsa «Analizar terreno» para recalcularlo.');
  });
  // Carga inicial con las coordenadas de ejemplo; nunca se muestran datos ficticios.
  analyze();
}
document.addEventListener('DOMContentLoaded',init);
