import React, { useState } from 'react';
import { Alert, Linking, StyleSheet, Text, View } from 'react-native';

import { Button } from '../../components/Button';
import { ScreenContainer } from '../../components/ScreenContainer';
import { TextField } from '../../components/TextField';
import { useAuth } from '../../context/AuthContext';
import { API_URL } from '../../lib/supabase';
import { theme } from '../../theme/theme';

export function LoginScreen(): React.JSX.Element {
  const { login, configured } = useAuth();
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(): Promise<void> {
    if (!email.trim() || !senha) {
      Alert.alert('Preencha os campos', 'Informe e-mail e senha.');
      return;
    }
    setLoading(true);
    try {
      await login(email, senha);
    } catch (e) {
      Alert.alert('Não foi possível entrar', (e as Error).message || 'Confira e-mail e senha.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <ScreenContainer scroll>
      <View style={styles.header}>
        <Text style={styles.logo}>Leeva</Text>
        <Text style={styles.tagline}>Entregas pra você fazer.</Text>
      </View>

      {!configured && (
        <Text style={styles.warn}>
          App sem configuração de servidor. Defina EXPO_PUBLIC_SUPABASE_URL e EXPO_PUBLIC_SUPABASE_ANON_KEY.
        </Text>
      )}

      <View style={styles.form}>
        <TextField
          label="E-mail"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          placeholder="voce@email.com"
        />
        <TextField label="Senha" value={senha} onChangeText={setSenha} secureTextEntry placeholder="Sua senha" />

        <Button label="Entrar" onPress={handleSubmit} loading={loading} style={styles.submit} />

        <Button
          label="Quero entregar pelo Leeva"
          variant="outline"
          onPress={() => void Linking.openURL(`${API_URL}/quero-entregar`)}
        />
        <Text style={styles.hint}>O cadastro de novo entregador é feito pelo site (envio de documentos).</Text>
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: { marginTop: theme.spacing.xxl, marginBottom: theme.spacing.xl, alignItems: 'center' },
  logo: { fontFamily: theme.fonts.heading, fontSize: 40, color: theme.colors.primary },
  tagline: { fontFamily: theme.fonts.body, fontSize: 14, color: theme.colors.textSecondary, marginTop: theme.spacing.xs },
  warn: { fontFamily: theme.fonts.body, fontSize: 13, color: theme.colors.danger, marginBottom: theme.spacing.md },
  form: { flex: 1, justifyContent: 'center' },
  submit: { marginTop: theme.spacing.sm, marginBottom: theme.spacing.md },
  hint: { fontFamily: theme.fonts.body, fontSize: 12, color: theme.colors.textSecondary, marginTop: theme.spacing.sm, textAlign: 'center' },
});
