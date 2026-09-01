import { type NativeStackScreenProps } from '@react-navigation/native-stack';
import React from 'react';
import { Linking, StyleSheet, Text, View } from 'react-native';

import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { MapaCorrida } from '../../components/MapaCorrida';
import { ScreenContainer } from '../../components/ScreenContainer';
import { StatusBadge } from '../../components/StatusBadge';
import { useRide } from '../../context/RideContext';
import type { AppStackParamList } from '../../navigation/types';
import { theme } from '../../theme/theme';
import type { OrderStatus } from '../../types';

type Props = NativeStackScreenProps<AppStackParamList, 'Entrega'>;

const ACAO: Partial<Record<OrderStatus, string>> = {
  assigned: 'Cheguei — coletar o pedido',
  picked_up: 'Sair para a entrega',
  in_route: 'Confirmar entrega',
};

const brl = (n: number) => `R$ ${n.toFixed(2).replace('.', ',')}`;

export function EntregaScreen({ navigation }: Props): React.JSX.Element {
  const { activeDelivery, advancing, advanceActive, position } = useRide();

  if (!activeDelivery) {
    return (
      <ScreenContainer>
        <Text style={styles.empty}>Nenhuma entrega em andamento.</Text>
        <Button label="Voltar" onPress={() => navigation.goBack()} style={{ marginTop: theme.spacing.lg }} />
      </ScreenContainer>
    );
  }

  const d = activeDelivery;
  const naColeta = d.status === 'assigned';
  const alvo = naColeta
    ? { lat: d.pickupLat, lng: d.pickupLng, endereco: d.pickupAddress ?? d.pickupName }
    : { lat: d.dropoffLat, lng: d.dropoffLng, endereco: d.dropoffAddress };
  const acaoLabel = ACAO[d.status];
  const entregue = d.status === 'delivered';
  const collectFromCustomer = d.paymentStatus !== 'paid' && d.paymentMethod !== 'online';

  function abrirMapa(): void {
    if (alvo.lat == null || alvo.lng == null) return;
    void Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${alvo.lat},${alvo.lng}`);
  }

  return (
    <ScreenContainer scroll>
      <Text style={styles.title}>{entregue ? 'Entrega concluída' : 'Entrega em andamento'}</Text>
      <StatusBadge status={d.status} />

      <Card style={styles.valorCard}>
        <Text style={styles.valorLabel}>Você recebe por esta entrega</Text>
        <Text style={styles.valor}>{d.payout != null ? brl(d.payout) : '—'}</Text>
      </Card>

      {collectFromCustomer && (
        <Card style={[styles.card, { borderColor: theme.colors.accent }]}>
          <Text style={styles.label}>Receber do cliente na entrega</Text>
          <Text style={styles.endereco}>{brl(d.orderAmount)}</Text>
        </Card>
      )}

      <Card style={styles.card}>
        <Text style={styles.label}>Coleta</Text>
        <Text style={styles.endereco}>{d.pickupName}</Text>
        {d.pickupAddress ? <Text style={styles.dest}>{d.pickupAddress}</Text> : null}
      </Card>

      <Card style={styles.card}>
        <Text style={styles.label}>Entrega</Text>
        <Text style={styles.endereco}>{d.dropoffAddress}</Text>
        <Text style={styles.dest}>
          {d.customerName}
          {d.customerPhone ? ` · ${d.customerPhone}` : ''}
        </Text>
      </Card>

      {d.notes ? (
        <Card style={styles.card}>
          <Text style={styles.label}>Observações</Text>
          <Text style={styles.endereco}>{d.notes}</Text>
        </Card>
      ) : null}

      {d.pickupLat != null && d.dropoffLat != null && (
        <MapaCorrida
          latColeta={d.pickupLat}
          lngColeta={d.pickupLng as number}
          latEntrega={d.dropoffLat}
          lngEntrega={d.dropoffLng as number}
          motoboyLat={position?.latitude}
          motoboyLng={position?.longitude}
          style={styles.mapa}
        />
      )}

      <View style={styles.actions}>
        {!entregue && alvo.lat != null && (
          <Button label={`Abrir no mapa (${naColeta ? 'coleta' : 'entrega'})`} variant="outline" onPress={abrirMapa} />
        )}
        {!entregue && acaoLabel && (
          <Button label={acaoLabel} onPress={() => void advanceActive()} loading={advancing} />
        )}
        {entregue && <Button label="Concluir" onPress={() => navigation.goBack()} />}
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  title: { fontFamily: theme.fonts.heading, fontSize: 24, color: theme.colors.text, marginBottom: theme.spacing.sm },
  valorCard: { marginTop: theme.spacing.md, marginBottom: theme.spacing.md, alignItems: 'center' },
  valorLabel: { fontFamily: theme.fonts.body, fontSize: 13, color: theme.colors.textSecondary },
  valor: { fontFamily: theme.fonts.heading, fontSize: 32, color: theme.colors.success, marginTop: 4 },
  card: { marginBottom: theme.spacing.md },
  label: { fontFamily: theme.fonts.bodySemiBold, fontSize: 12, color: theme.colors.accent, marginBottom: 4 },
  endereco: { fontFamily: theme.fonts.body, fontSize: 15, color: theme.colors.text, lineHeight: 20 },
  dest: { fontFamily: theme.fonts.body, fontSize: 13, color: theme.colors.textSecondary, marginTop: 6 },
  mapa: { height: 240, borderRadius: theme.radius.lg, borderWidth: 1, borderColor: theme.colors.border, marginBottom: theme.spacing.md },
  actions: { marginTop: theme.spacing.sm, gap: theme.spacing.md },
  empty: { fontFamily: theme.fonts.body, color: theme.colors.textSecondary, textAlign: 'center', marginTop: theme.spacing.xxl },
});
