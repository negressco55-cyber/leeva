import React, { useCallback, useEffect, useRef, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { apiGet, apiSend } from '../api/client';
import { useTheme } from '../theme/ThemeContext';
import type { Theme } from '../theme/theme';

type Message = { id: string; senderType: 'restaurant' | 'motoboy'; body: string; createdAt: string };

/** Chat do pedido com o restaurante (polling de 5s enquanto aberto). */
export function DeliveryChat({ orderId }: { orderId: string }): React.JSX.Element {
  const t = useTheme();
  const styles = makeStyles(t);
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const listRef = useRef<FlatList<Message>>(null);

  const load = useCallback(async () => {
    try {
      const d = await apiGet<{ messages: Message[] }>(`/api/deliveries/${orderId}/messages`);
      setMessages(d.messages);
    } catch {
      /* próximo ciclo */
    }
  }, [orderId]);

  useEffect(() => {
    if (!open) return;
    void load();
    const iv = setInterval(() => void load(), 5000);
    return () => clearInterval(iv);
  }, [open, load]);

  async function send(): Promise<void> {
    const body = text.trim();
    if (!body || sending) return;
    setSending(true);
    setText('');
    try {
      await apiSend(`/api/deliveries/${orderId}/messages`, 'POST', { body });
      await load();
      listRef.current?.scrollToEnd({ animated: true });
    } catch {
      setText(body);
    } finally {
      setSending(false);
    }
  }

  if (!open) {
    return (
      <Pressable style={styles.openBtn} onPress={() => setOpen(true)}>
        <Text style={styles.openText}>💬 Chat com o restaurante</Text>
      </Pressable>
    );
  }

  return (
    <View style={styles.box}>
      <View style={styles.head}>
        <Text style={styles.title}>Chat com o restaurante</Text>
        <Pressable onPress={() => setOpen(false)}>
          <Text style={styles.close}>Fechar</Text>
        </Pressable>
      </View>
      <FlatList
        ref={listRef}
        data={messages}
        keyExtractor={(m) => m.id}
        style={styles.list}
        ListEmptyComponent={<Text style={styles.empty}>Nenhuma mensagem ainda.</Text>}
        onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
        renderItem={({ item }) => (
          <View style={[styles.bubble, item.senderType === 'motoboy' ? styles.mine : styles.theirs]}>
            <Text style={item.senderType === 'motoboy' ? styles.mineText : styles.theirsText}>{item.body}</Text>
          </View>
        )}
      />
      <View style={styles.inputRow}>
        <TextInput
          style={styles.input}
          value={text}
          onChangeText={setText}
          placeholder="Escreva uma mensagem…"
          placeholderTextColor={t.colors.textSecondary}
          onSubmitEditing={() => void send()}
        />
        <Pressable style={[styles.sendBtn, (!text.trim() || sending) && { opacity: 0.5 }]} onPress={() => void send()}>
          <Text style={styles.sendText}>Enviar</Text>
        </Pressable>
      </View>
    </View>
  );
}

function makeStyles(t: Theme) {
  return StyleSheet.create({
    openBtn: {
      borderWidth: 1.5,
      borderColor: t.colors.border,
      borderRadius: t.radius.md,
      paddingVertical: 14,
      alignItems: 'center',
    },
    openText: { fontFamily: t.fonts.bodySemiBold, fontSize: 15, color: t.colors.text },
    box: {
      backgroundColor: t.colors.surface,
      borderWidth: 1,
      borderColor: t.colors.border,
      borderRadius: t.radius.md,
      padding: t.spacing.md,
      gap: t.spacing.sm,
    },
    head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    title: { fontFamily: t.fonts.bodySemiBold, fontSize: 13, color: t.colors.textSecondary },
    close: { fontFamily: t.fonts.bodySemiBold, fontSize: 13, color: t.colors.primary },
    list: { maxHeight: 220 },
    empty: { fontFamily: t.fonts.body, fontSize: 13, color: t.colors.textSecondary, textAlign: 'center', paddingVertical: 12 },
    bubble: { borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8, marginVertical: 3, maxWidth: '82%' },
    mine: { alignSelf: 'flex-end', backgroundColor: t.colors.primary },
    theirs: { alignSelf: 'flex-start', backgroundColor: t.colors.surfaceAlt },
    mineText: { fontFamily: t.fonts.body, fontSize: 14, color: t.colors.onPrimary },
    theirsText: { fontFamily: t.fonts.body, fontSize: 14, color: t.colors.text },
    inputRow: { flexDirection: 'row', gap: t.spacing.sm },
    input: {
      flex: 1,
      borderWidth: 1,
      borderColor: t.colors.border,
      borderRadius: t.radius.sm,
      paddingHorizontal: 12,
      paddingVertical: 10,
      color: t.colors.text,
      fontFamily: t.fonts.body,
      backgroundColor: t.colors.background,
    },
    sendBtn: {
      backgroundColor: t.colors.primary,
      borderRadius: t.radius.sm,
      paddingHorizontal: 16,
      justifyContent: 'center',
    },
    sendText: { fontFamily: t.fonts.bodySemiBold, color: t.colors.onPrimary },
  });
}
