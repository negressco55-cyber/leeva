import { type NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';

import { Button } from '../../components/Button';
import { ScreenContainer } from '../../components/ScreenContainer';
import { TextField } from '../../components/TextField';
import { useAuth } from '../../context/AuthContext';
import type { AuthStackParamList } from '../../navigation/types';
import { theme } from '../../theme/theme';

type Props = NativeStackScreenProps<AuthStackParamList, 'Cadastro'>;

interface FormState {
  nomeCompleto: string;
  cpf: string;
  cnh: string;
  placaVeiculo: string;
  email: string;
  telefone: string;
  senha: string;
}

const INITIAL_STATE: FormState = {
  nomeCompleto: '',
  cpf: '',
  cnh: '',
  placaVeiculo: '',
  email: '',
  telefone: '',
  senha: '',
};

export function RegisterScreen({ navigation }: Props): React.JSX.Element {
  const { register } = useAuth();
  const [form, setForm] = useState<FormState>(INITIAL_STATE);
  const [loading, setLoading] = useState(false);

  function setField<K extends keyof FormState>(key: K, value: FormState[K]): void {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(): Promise<void> {
    const camposObrigatorios: Array<keyof FormState> = [
      'nomeCompleto',
      'cpf',
      'cnh',
      'placaVeiculo',
      'email',
      'telefone',
      'senha',
    ];
    const faltando = camposObrigatorios.some((campo) => !form[campo].trim());

    if (faltando) {
      Alert.alert('Preencha todos os campos', 'Todos os dados são necessários para o cadastro.');
      return;
    }

    setLoading(true);
    try {
      await register({
        nomeCompleto: form.nomeCompleto.trim(),
        cpf: form.cpf.trim(),
        cnh: form.cnh.trim(),
        placaVeiculo: form.placaVeiculo.trim().toUpperCase(),
        email: form.email.trim(),
        telefone: form.telefone.trim(),
        senha: form.senha,
      });
      Alert.alert(
        'Cadastro enviado!',
        'Seu cadastro está em análise. Assim que for aprovado você poderá ficar disponível para corridas.'
      );
    } catch (error) {
      const mensagemBackend = (error as { response?: { data?: { error?: string } } })?.response?.data?.error;
      Alert.alert(
        'Não foi possível cadastrar',
        mensagemBackend ?? 'Confira os dados informados e tente novamente.'
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <ScreenContainer scroll>
      <View style={styles.header}>
        <Text style={styles.title}>Cadastro de motoboy</Text>
        <Text style={styles.subtitle}>Leva algumas informações e você já pode começar a aceitar corridas.</Text>
      </View>

      <TextField label="Nome completo" value={form.nomeCompleto} onChangeText={(v) => setField('nomeCompleto', v)} />
      <TextField label="CPF" value={form.cpf} onChangeText={(v) => setField('cpf', v)} keyboardType="numeric" />
      <TextField label="CNH" value={form.cnh} onChangeText={(v) => setField('cnh', v)} keyboardType="numeric" />
      <TextField
        label="Placa do veículo"
        value={form.placaVeiculo}
        onChangeText={(v) => setField('placaVeiculo', v)}
        autoCapitalize="characters"
        placeholder="ABC1D23"
      />
      <TextField
        label="Telefone"
        value={form.telefone}
        onChangeText={(v) => setField('telefone', v)}
        keyboardType="phone-pad"
        placeholder="(83) 90000-0000"
      />
      <TextField
        label="Email"
        value={form.email}
        onChangeText={(v) => setField('email', v)}
        autoCapitalize="none"
        keyboardType="email-address"
      />
      <TextField label="Senha" value={form.senha} onChangeText={(v) => setField('senha', v)} secureTextEntry />

      <Button label="Criar conta" onPress={handleSubmit} loading={loading} style={styles.submitButton} />
      <Button label="Já tenho conta" variant="outline" onPress={() => navigation.navigate('Login')} />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: {
    marginTop: theme.spacing.lg,
    marginBottom: theme.spacing.lg,
  },
  title: {
    fontFamily: theme.fonts.heading,
    fontSize: 26,
    color: theme.colors.text,
  },
  subtitle: {
    fontFamily: theme.fonts.body,
    fontSize: 14,
    color: theme.colors.textSecondary,
    marginTop: theme.spacing.xs,
  },
  submitButton: {
    marginTop: theme.spacing.sm,
    marginBottom: theme.spacing.md,
  },
});
