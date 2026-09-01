import React, { useCallback, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';

import { theme } from '../theme/theme';

interface Props {
  pickupLat: number;
  pickupLng: number;
  dropoffLat: number;
  dropoffLng: number;
  motoboyLat?: number | null;
  motoboyLng?: number | null;
  routeGeoJson?: number[][] | null;
  style?: StyleProp<ViewStyle>;
}

/**
 * Mapa vetorial moderno (MapLibre GL JS + OpenFreeMap) numa WebView.
 * Vetor = renderização por GPU: pan/zoom fluido, visual atual (parecido com
 * o Google Maps), sem chave de API e sem módulo nativo. A biblioteca é
 * carregada de um CDN pinado e fica em cache na WebView.
 *
 * Depois de montado, a posição do motoboy é atualizada por postMessage —
 * a WebView nunca recarrega. O componente é memoizado: só re-renderiza se
 * as coordenadas de coleta/entrega mudarem (a posição não conta).
 */
const MAPLIBRE_JS = 'https://cdn.jsdelivr.net/npm/maplibre-gl@4.7.1/dist/maplibre-gl.js';
const MAPLIBRE_CSS = 'https://cdn.jsdelivr.net/npm/maplibre-gl@4.7.1/dist/maplibre-gl.css';
const STYLE_URL = 'https://tiles.openfreemap.org/styles/bright';

function buildHtml(p: {
  pickupLat: number;
  pickupLng: number;
  dropoffLat: number;
  dropoffLng: number;
  motoboyLat: number | null;
  motoboyLng: number | null;
  routeGeoJson: number[][] | null;
}): string {
  const data = JSON.stringify(p);
  const { primary, success, accent, background } = theme.colors;
  return `<!DOCTYPE html><html><head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no"/>
<link href="${MAPLIBRE_CSS}" rel="stylesheet"/>
<style>
  html,body,#map{margin:0;padding:0;height:100%;width:100%;background:${background}}
  .pin{width:20px;height:20px;border-radius:50%;border:3px solid ${background};box-shadow:0 0 0 2px rgba(0,0,0,.25)}
  .pin.p{background:${accent}} .pin.d{background:${success}} .pin.m{background:${primary};width:16px;height:16px}
  .maplibregl-ctrl-attrib{font-size:9px}
</style></head><body>
<div id="map"></div>
<script src="${MAPLIBRE_JS}"></script>
<script>
  var D = ${data};
  var map = new maplibregl.Map({
    container:'map', style:'${STYLE_URL}',
    center:[(D.pickupLng+D.dropoffLng)/2,(D.pickupLat+D.dropoffLat)/2], zoom:12,
    attributionControl:{compact:true}
  });
  map.addControl(new maplibregl.NavigationControl({showCompass:false}),'bottom-right');
  map.dragRotate.disable(); map.touchZoomRotate.disableRotation();

  function mk(cls){ var el=document.createElement('div'); el.className='pin '+cls; return el; }
  var mCol, mDrop, mMoto;

  map.on('load', function(){
    mCol = new maplibregl.Marker({element:mk('p')}).setLngLat([D.pickupLng,D.pickupLat]).addTo(map);
    mDrop = new maplibregl.Marker({element:mk('d')}).setLngLat([D.dropoffLng,D.dropoffLat]).addTo(map);
    if (D.motoboyLat!=null) mMoto = new maplibregl.Marker({element:mk('m')}).setLngLat([D.motoboyLng,D.motoboyLat]).addTo(map);

    var line = (D.routeGeoJson && D.routeGeoJson.length>1)
      ? D.routeGeoJson
      : [[D.pickupLng,D.pickupLat],[D.dropoffLng,D.dropoffLat]];
    map.addSource('rota',{type:'geojson',data:{type:'Feature',geometry:{type:'LineString',coordinates:line}}});
    map.addLayer({id:'rota',type:'line',source:'rota',paint:{'line-color':'${primary}','line-width':4,'line-opacity':.85}});

    fitAll(line);
    post({tipo:'pronto'});
  });

  function fitAll(line){
    var b = new maplibregl.LngLatBounds();
    line.forEach(function(c){ b.extend(c); });
    if (mMoto) b.extend(mMoto.getLngLat());
    map.fitBounds(b,{padding:40,maxZoom:15,duration:0});
  }

  function setMoto(lat,lng){
    if (lat==null||lng==null) return;
    if (mMoto) mMoto.setLngLat([lng,lat]);
    else mMoto = new maplibregl.Marker({element:mk('m')}).setLngLat([lng,lat]).addTo(map);
  }
  function setRota(coords){
    var line = (coords && coords.length>1) ? coords : [[D.pickupLng,D.pickupLat],[D.dropoffLng,D.dropoffLat]];
    var s = map.getSource('rota');
    if (s) s.setData({type:'Feature',geometry:{type:'LineString',coordinates:line}});
  }
  function post(o){ if(window.ReactNativeWebView) window.ReactNativeWebView.postMessage(JSON.stringify(o)); }

  function onMsg(e){
    try {
      var m = JSON.parse(e.data);
      if (m.tipo==='moto') setMoto(m.lat,m.lng);
      else if (m.tipo==='rota') setRota(m.coords);
      else if (m.tipo==='fit') fitAll((D.routeGeoJson&&D.routeGeoJson.length>1)?D.routeGeoJson:[[D.pickupLng,D.pickupLat],[D.dropoffLng,D.dropoffLat]]);
    } catch(x){}
  }
  document.addEventListener('message',onMsg);
  window.addEventListener('message',onMsg);
</script>
</body></html>`;
}

function MapaEntregaBase({
  pickupLat,
  pickupLng,
  dropoffLat,
  dropoffLng,
  motoboyLat,
  motoboyLng,
  routeGeoJson,
  style,
}: Props): React.JSX.Element {
  const ref = useRef<WebView>(null);
  const readyRef = useRef(false);
  const queueRef = useRef<object[]>([]);
  const [loaded, setLoaded] = useState(false);

  const html = useMemo(
    () =>
      buildHtml({
        pickupLat,
        pickupLng,
        dropoffLat,
        dropoffLng,
        motoboyLat: motoboyLat ?? null,
        motoboyLng: motoboyLng ?? null,
        routeGeoJson: routeGeoJson ?? null,
      }),
    // só regenera se a rota mudar de verdade; posição vai por postMessage
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [pickupLat, pickupLng, dropoffLat, dropoffLng],
  );

  const send = useCallback((msg: object) => {
    if (readyRef.current) ref.current?.postMessage(JSON.stringify(msg));
    else queueRef.current.push(msg);
  }, []);

  // posição do motoboy → postMessage (sem re-render da WebView)
  const firstRef = useRef(true);
  React.useEffect(() => {
    if (firstRef.current) {
      firstRef.current = false;
      return;
    }
    if (motoboyLat != null && motoboyLng != null) send({ tipo: 'moto', lat: motoboyLat, lng: motoboyLng });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [motoboyLat, motoboyLng]);

  const onMessage = useCallback((e: WebViewMessageEvent) => {
    try {
      const m = JSON.parse(e.nativeEvent.data) as { tipo?: string };
      if (m.tipo === 'pronto') {
        readyRef.current = true;
        for (const q of queueRef.current) ref.current?.postMessage(JSON.stringify(q));
        queueRef.current = [];
      }
    } catch {
      /* ignora */
    }
  }, []);

  return (
    <View style={[styles.container, style]}>
      <WebView
        ref={ref}
        source={{ html }}
        originWhitelist={['*']}
        onMessage={onMessage}
        onLoadEnd={() => setLoaded(true)}
        style={styles.webview}
        javaScriptEnabled
        domStorageEnabled
        cacheEnabled
        androidLayerType="hardware"
        overScrollMode="never"
        nestedScrollEnabled
        setBuiltInZoomControls={false}
      />
      {!loaded && (
        <View style={styles.loading}>
          <ActivityIndicator color={theme.colors.primary} />
        </View>
      )}
    </View>
  );
}

function propsEqual(a: Props, b: Props): boolean {
  return (
    a.pickupLat === b.pickupLat &&
    a.pickupLng === b.pickupLng &&
    a.dropoffLat === b.dropoffLat &&
    a.dropoffLng === b.dropoffLng &&
    a.motoboyLat === b.motoboyLat &&
    a.motoboyLng === b.motoboyLng
  );
}

export const MapaEntrega = React.memo(MapaEntregaBase, propsEqual);

const styles = StyleSheet.create({
  container: { overflow: 'hidden', backgroundColor: theme.colors.surface },
  webview: { flex: 1, backgroundColor: 'transparent' },
  loading: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.surface,
  },
});
