# Leeva Motoboy — app nativo (Android/iOS)

App nativo do entregador, feito com **Expo / React Native**. Conversa com o
**mesmo backend** dos apps web: Supabase (login + tempo real) e as rotas
`/api/*` do painel do motoboy (`apps/motoboy`, hospedado na Vercel).

Não faz parte do workspace npm do monorepo (as dependências de React Native
não convivem bem com as dos apps web) — tem o próprio `node_modules` e o
próprio `package-lock.json`.

## O que ele faz

- Login com e-mail/senha (conta Supabase, a mesma do app web).
- Gate de aprovação + termos de uso (igual ao PWA).
- Ficar disponível / indisponível, com GPS em primeiro plano enviando a
  posição durante a entrega.
- Receber ofertas de entrega em tempo real (Supabase Realtime), aceitar/recusar.
- Fluxo da entrega: a caminho da coleta → coletado → em entrega → entregue.
- Ofertas agrupadas (rota com várias paradas) com valor por parada.
- Ganhos (histórico), perfil, chave Pix (visualização).
- Notificações push nativas via **Expo Push** (token guardado em
  `push_subscriptions` com `kind='expo'`).

## Rodar em desenvolvimento

```bash
cd apps/motoboy-app
npm install
cp .env.example .env    # preencha EXPO_PUBLIC_SUPABASE_ANON_KEY
npx expo start          # abra no Expo Go (Android) ou num emulador
```

`EXPO_PUBLIC_API_URL` já aponta pro `https://leeva-motoboy.vercel.app` por
padrão — o app usa a API que já está no ar.

## Gerar o APK / publicar

Precisa de uma conta Expo (grátis) e do EAS:

```bash
npm i -g eas-cli
eas login
eas build:configure          # cria eas.json, preenche extra.eas.projectId no app.json
eas build -p android --profile preview     # gera um APK pra instalar direto
eas build -p android --profile production  # gera o AAB pra Play Store
```

Para o push nativo funcionar no build standalone (fora do Expo Go), o EAS
pede o `google-services.json` do Firebase (FCM) — o assistente do
`eas build` guia nisso.

## Configuração no backend

As rotas `/api/*` do `apps/motoboy` aceitam `Authorization: Bearer <token>`
(o access token do Supabase) além do cookie de sessão — ver
`apps/motoboy/lib/context.ts` (`getMotoboyContextFromReq`).
