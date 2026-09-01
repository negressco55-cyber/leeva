import { type NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';

import { Button } from '../../components/Button';
import { ScreenContainer } from '../../components/ScreenContainer';
import { TextField } from '../../components/TextField';
import { useAuth } from '../../context/AuthContext';
import type { AuthStackParamList } from '../../navigation/types';
import { theme } from '../../theme/theme';

type Props = NativeStackScreenProps<AuthStackParamList, 'Login'>;

export function LoginScreen({ navigation }: Props): React.JSX.Element {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(): Promise<void> {
    if (!email.trim() || !senha) {
      Alert.alert('Preencha os campos', 'Informe email e senha para entrar.');
      return;
    }

    setLoading(true);
    try {
      await login({ email: email.trim(), senha });
    } catch (error) {
      const mensagemBackend = (error as { response?: { data?: { error?: string } } })?.response?.data?.error;
      Alert.alert(
        'Não foi possível entrar',
        mensagemBackend ?? 'Confira seu email e senha e tente novamente.'
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <ScreenContainer scroll>
      <View style={styles.header}>
        <Text style={styles.logo}>Levva</Text>
        <Text style={styles.tagline}>Sua entrega, na hora certa.</Text>
      </View>

      <View style={styles.form}>
        <TextField
          label="Email"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          placeholder="voce@email.com"
        />
        <TextField
          label="Senha"
          value={senha}
          onChangeText={setSenha}
          secureTextEntry
          placeholder="Sua senha"
        />

        <Button label="Entrar" onPress={handleSubmit} loading={loading} style={styles.submitButton} />

        <Button
          label="Criar conta de motoboy"
          variant="outline"
          onPress={() => navigation.navigate('Cadastro')}
        />
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: {
    marginTop: theme.spacing.xxl,
    marginBottom: theme.spacing.xl,
    alignItems: 'center',
  },
  logo: {
    fontFamily: theme.fonts.heading,
    fontSize: 40,
    color: theme.colors.primary,
  },
  tagline: {
    fontFamily: theme.fonts.body,
    fontSize: 14,
    color: theme.colors.textSecondary,
    marginTop: theme.spacing.xs,
  },
  form: {
    flex: 1,
    justifyContent: 'center',
  },
  submitButton: {
    marginTop: theme.spacing.sm,
    marginBottom: theme.spacing.lg,
  },
});
