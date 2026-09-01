import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';

import { theme } from '../theme/theme';

interface MapaCorridaProps {
  latColeta: number;
  lngColeta: number;
  latEntrega: number;
  lngEntrega: number;
  /** Posição atual do próprio motoboy — some (undefined/null) até o GPS ter uma primeira leitura. */
  motoboyLat?: number | null;
  motoboyLng?: number | null;
  /** Rota real seguindo rua (OSRM), vinda do backend. `null`/ausente cai no fallback de linha reta. */
  rotaGeometria?: Array<[number, number]> | null;
  style?: StyleProp<ViewStyle>;
}

interface DadosMapa {
  latColeta: number;
  lngColeta: number;
  latEntrega: number;
  lngEntrega: number;
  motoboyLat: number | null;
  motoboyLng: number | null;
  rotaGeometria: Array<[number, number]> | null;
}

/**
 * Gera o HTML vanilla-JS (sem React, roda dentro da WebView) com Leaflet +
 * tiles OSM — visualmente equivalente ao MapTracking.tsx do web-empresa,
 * mas sem depender de react-native-maps/Google Maps SDK nativo (ver Fase 5
 * do plano de mapa: WebView é só uma lib JS, sem API key nem plugin nativo).
 *
 * Os dados iniciais vão interpolados direto no HTML (mais simples e mais
 * rápido que esperar um postMessage após o carregamento). Atualizações
 * depois disso (nova posição do motoboy chegando via socket) usam
 * postMessage, sem recarregar a WebView inteira.
 */
function gerarHtmlMapa(dados: DadosMapa): string {
  const dadosJson = JSON.stringify(dados);
  const corLaranja = theme.colors.primary;
  const corVerde = theme.colors.success;
  const corAmarelo = theme.colors.accent;

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <style>
    html, body, #mapa { height: 100%; width: 100%; margin: 0; padding: 0; background: ${theme.colors.surface}; }
  </style>
</head>
<body>
  <div id="mapa"></div>
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <script>
    var dados = ${dadosJson};
    var map = L.map('mapa', { zoomControl: false, attributionControl: true });
    L.control.zoom({ position: 'bottomleft' }).addTo(map);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap'
    }).addTo(map);

    // Mesmo padrão visual do MapTracking.tsx (web-empresa/web-motoboy): círculo
    // sólido colorido com borda escura e halo, sem emoji.
    function criarIcone(cor) {
      return L.divIcon({
        html: '<div style="width:30px;height:30px;border-radius:9999px;background:' + cor + ';border:3px solid #17181C;box-shadow:0 0 0 2px ' + cor + ';"></div>',
        className: '',
        iconSize: [30, 30],
        iconAnchor: [15, 15]
      });
    }

    var marcadorColeta = L.marker([dados.latColeta, dados.lngColeta], {
      icon: criarIcone('${corAmarelo}')
    }).addTo(map).bindPopup('Coleta');

    var marcadorEntrega = L.marker([dados.latEntrega, dados.lngEntrega], {
      icon: criarIcone('${corVerde}')
    }).addTo(map).bindPopup('Entrega');

    var marcadorMotoboy = null;
    function atualizarPosicaoMotoboy(lat, lng) {
      if (lat == null || lng == null) return;
      if (marcadorMotoboy) {
        marcadorMotoboy.setLatLng([lat, lng]);
      } else {
        marcadorMotoboy = L.marker([lat, lng], {
          icon: criarIcone('${corLaranja}')
        }).addTo(map).bindPopup('Você');
      }
    }
    atualizarPosicaoMotoboy(dados.motoboyLat, dados.motoboyLng);

    var linhaRota = null;
    function atualizarRota(pontos) {
      var tracado = (pontos && pontos.length > 0)
        ? pontos
        : [[dados.latColeta, dados.lngColeta], [dados.latEntrega, dados.lngEntrega]];
      if (linhaRota) {
        linhaRota.setLatLngs(tracado);
      } else {
        linhaRota = L.polyline(tracado, { color: '${corLaranja}', weight: 4, opacity: 0.85 }).addTo(map);
      }
      return tracado;
    }
    var tracadoAtual = atualizarRota(dados.rotaGeometria);

    function ajustarBounds() {
      var pontos = tracadoAtual.slice();
      if (marcadorMotoboy) pontos.push(marcadorMotoboy.getLatLng());
      map.fitBounds(pontos, { padding: [24, 24] });
    }
    ajustarBounds();

    // Android dispara em document, iOS em window — tratando os dois pra
    // garantir compatibilidade (mesma mensagem chega pelos dois em alguns
    // devices, mas o processamento é idempotente).
    function processarMensagem(evento) {
      try {
        var msg = JSON.parse(evento.data);
        if (msg.tipo === 'atualizarPosicaoMotoboy') {
          atualizarPosicaoMotoboy(msg.lat, msg.lng);
        } else if (msg.tipo === 'atualizarRota') {
          tracadoAtual = atualizarRota(msg.pontos);
        }
      } catch (e) {
        // Mensagem inválida — ignora.
      }
    }
    document.addEventListener('message', processarMensagem);
    window.addEventListener('message', processarMensagem);

    if (window.ReactNativeWebView) {
      window.ReactNativeWebView.postMessage(JSON.stringify({ tipo: 'pronto' }));
    }
  </script>
</body>
</html>`;
}

export function MapaCorrida({
  latColeta,
  lngColeta,
  latEntrega,
  lngEntrega,
  motoboyLat,
  motoboyLng,
  rotaGeometria,
  style,
}: MapaCorridaProps): React.JSX.Element {
  const webViewRef = useRef<WebView>(null);
  const prontoRef = useRef(false);
  const pendingRef = useRef<{ tipo: string; [key: string]: unknown } | null>(null);
  const montadoRef = useRef(false);
  const [carregado, setCarregado] = useState(false);

  // Gerado uma única vez por corrida (deps só nas coordenadas de coleta/entrega,
  // que não mudam durante a corrida) — motoboyLat/motoboyLng/rotaGeometria vão
  // como valor inicial, mas atualizações depois disso usam postMessage em vez
  // de regenerar o HTML (o que recarregaria a WebView inteira).
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const html = useMemo(
    () =>
      gerarHtmlMapa({
        latColeta,
        lngColeta,
        latEntrega,
        lngEntrega,
        motoboyLat: motoboyLat ?? null,
        motoboyLng: motoboyLng ?? null,
        rotaGeometria: rotaGeometria ?? null,
      }),
    [latColeta, lngColeta, latEntrega, lngEntrega]
  );

  function enviarOuEnfileirar(mensagem: { tipo: string; [key: string]: unknown }): void {
    if (prontoRef.current) {
      webViewRef.current?.postMessage(JSON.stringify(mensagem));
    } else {
      pendingRef.current = mensagem;
    }
  }

  useEffect(() => {
    if (!montadoRef.current) {
      // Primeira renderização já foi embutida no HTML inicial — não reenviar.
      montadoRef.current = true;
      return;
    }
    if (motoboyLat == null || motoboyLng == null) return;
    enviarOuEnfileirar({ tipo: 'atualizarPosicaoMotoboy', lat: motoboyLat, lng: motoboyLng });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [motoboyLat, motoboyLng]);

  useEffect(() => {
    if (!montadoRef.current) return;
    enviarOuEnfileirar({ tipo: 'atualizarRota', pontos: rotaGeometria ?? null });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rotaGeometria]);

  function handleMessage(event: WebViewMessageEvent): void {
    try {
      const msg = JSON.parse(event.nativeEvent.data) as { tipo?: string };
      if (msg.tipo === 'pronto') {
        prontoRef.current = true;
        if (pendingRef.current) {
          webViewRef.current?.postMessage(JSON.stringify(pendingRef.current));
          pendingRef.current = null;
        }
      }
    } catch {
      // Mensagem inválida vinda da WebView — ignora.
    }
  }

  return (
    <View style={[styles.container, style]}>
      <WebView
        ref={webViewRef}
        source={{ html }}
        originWhitelist={['*']}
        onMessage={handleMessage}
        onLoadEnd={() => setCarregado(true)}
        style={styles.webview}
        javaScriptEnabled
        domStorageEnabled
      />
      {!carregado && (
        <View style={styles.overlayCarregando}>
          <ActivityIndicator color={theme.colors.primary} />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
    backgroundColor: theme.colors.surface,
  },
  webview: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  overlayCarregando: {
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
