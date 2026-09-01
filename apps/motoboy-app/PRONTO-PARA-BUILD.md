# Pronto para build — o que rodar quando você voltar com o token da Expo

Tudo que não dependia de login já está feito (ícone, GPS em segundo plano,
`eas.json`, `app.config.js`). Isto aqui é a sequência de comandos pra você
rodar. Todos são na pasta **`apps/motoboy-app`**.

```bash
cd apps/motoboy-app
```

---

## 0. Uma vez só: instalar o EAS CLI e logar

```bash
npm install -g eas-cli
eas login
```

(usa seu e-mail/senha da conta Expo — https://expo.dev)

---

## 1. Ligar o projeto na Expo

```bash
eas init
```

Ele cria/associa um "projeto EAS" e mostra um **Project ID** (parecido com
`a1b2c3d4-....`). **Copie esse ID** e faça UMA das duas coisas:

- **Opção A (simples):** abra `app.config.js` e troque a linha
  `projectId: process.env.EAS_PROJECT_ID || ''`
  por `projectId: 'a1b2c3d4-....'` (o seu ID).
- **Opção B:** deixe como está e sempre rode os comandos com
  `EAS_PROJECT_ID=a1b2c3d4-.... eas build ...`

## 2. Variáveis de ambiente

Crie o arquivo `.env` (não vai pro git):

```bash
cp .env.example .env
```

Abra `.env` e preencha só a linha `EXPO_PUBLIC_SUPABASE_ANON_KEY=` — a chave
**anon** do Supabase (Project Settings → API → `anon` `public`). As outras já
vêm preenchidas. O EAS lê esse `.env` automaticamente no build.

## 3. Firebase (pra push funcionar no APK)

Siga o **`FIREBASE-SETUP.md`** — cria o projeto Firebase, baixa o
`google-services.json` e põe na pasta `apps/motoboy-app/`. O app detecta
sozinho. (Dá pra pular agora e fazer depois; sem isso o app funciona, só o
push nativo que não.)

---

## 4. TESTAR no seu celular ANTES de gerar o APK final

A forma mais rápida de ver o app rodando no seu Android:

```bash
npx expo start
```

- Instale o app **Expo Go** na Play Store do seu celular.
- Abra o Expo Go → **Scan QR code** → aponte pro QR que apareceu no terminal.
- O app abre. Teste: login (`motoboy@leeva.dev` / `leeva123` serve pra ver),
  ficar online, e o mapa.

> ⚠️ **No Expo Go o app é mais lento** (modo desenvolvimento) e **o GPS em
> segundo plano e o push nativo NÃO funcionam** — isso é normal, só funciona
> no build de verdade. O Expo Go serve pra ver as telas e o fluxo.

### Testar já como app instalado (dev build)

Se quiser testar o GPS em segundo plano e o push sem publicar nada:

```bash
eas build --profile development --platform android
```

Isso gera um APK de desenvolvimento (~15 min, na nuvem da Expo). Quando
terminar, o terminal mostra um link — abra no celular e instale. Depois:

```bash
npx expo start --dev-client
```

e abra esse app instalado (não o Expo Go).

---

## 5. Gerar o APK pra distribuir (instalar direto, sem loja)

```bash
eas build --profile preview --platform android
```

~15 min. No fim, um link com o **APK**. Baixe no celular e instale (o Android
vai pedir pra permitir "instalar de fontes desconhecidas" — normal).

Esse APK é o que você manda pros motoboys testarem antes da Play Store.

---

## 6. Gerar o pacote pra Play Store (quando for publicar)

```bash
eas build --profile production --platform android
```

Gera um **`.aab`** (Android App Bundle). Pra subir na Play Store você precisa
de uma **conta de desenvolvedor Google** (US$ 25, pagamento único). Depois:

```bash
eas submit --profile production --platform android
```

(ou subir o `.aab` manualmente no Play Console).

---

## Checklist rápido

| Passo | Comando | Precisa de |
|---|---|---|
| Logar | `eas login` | conta Expo (grátis) |
| Ligar projeto | `eas init` | — |
| Ver no celular | `npx expo start` + Expo Go | só o celular |
| APK de teste | `eas build --profile preview -p android` | conta Expo |
| Push no APK | `FIREBASE-SETUP.md` + `eas credentials` | conta Google (grátis) |
| Play Store | `eas build --profile production` + `eas submit` | conta Google Play (US$ 25) |

---

## Se algo der errado

- **"Invalid UUID appId"** no build → você não fez o passo 1 (`eas init`) ou
  não colou o Project ID no `app.config.js`.
- **Push não chega no APK** → falta o `google-services.json` (passo 3) ou a
  chave FCM no `eas credentials` (fim do `FIREBASE-SETUP.md`).
- **App abre e fecha** → provavelmente o `.env` sem a `EXPO_PUBLIC_SUPABASE_ANON_KEY`.
- **Mapa em branco** → o CDN do MapLibre demora na 1ª vez; espere ~3s. Se
  nunca carregar, o celular está sem internet.
