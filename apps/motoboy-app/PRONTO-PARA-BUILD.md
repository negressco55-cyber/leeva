# Pronto para build — o que rodar quando você voltar com o token da Expo

---

## ✅ Build gerado em 01/09/2026 (perfil `preview`)

**APK pronto pra instalar no seu Android:**

**https://expo.dev/artifacts/eas/5V5aVb_6NxpUbkAUNCa0ZkgFRDeo0URObuFIse4Vel0.apk**

- Build ID: `0a60cb60-25a5-4d24-b0ca-0f55bece8bff`
- Projeto EAS: `@leeva-jp/leeva` · versão 1.0.0 (versionCode 1)
- Página do build (com QR code): https://expo.dev/accounts/leeva-jp/projects/leeva/builds/0a60cb60-25a5-4d24-b0ca-0f55bece8bff
- Feito a partir do commit `4325332`.

**Como instalar:** abra o link acima **no navegador do próprio celular Android**,
baixe o `.apk`, toque na notificação de download. O Android vai pedir pra
"permitir instalar apps desta fonte" → ative → **Instalar**. O ícone verde
"Leeva Motoboy" aparece na tela. (Detalhes e o que testar: seção 5, mais abaixo.)

> ⚠️ Push ainda NÃO funciona neste APK — falta o Firebase (`FIREBASE-SETUP.md`).
> O resto (login, ficar online, mapa, GPS em segundo plano) funciona.

---


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

## 1. Projeto já está ligado ✅

O Project ID **`5c851aad-66e2-4c2c-8f3f-c2fd80b620d9`** já está gravado em
`app.config.js`. **Não precisa rodar `eas init`.** Se rodar, ele só vai
confirmar que já está ligado.

## 2. A chave do Supabase (uma vez só)

O build precisa da chave **anon** do Supabase (é a chave pública, feita pra
ficar no app — não é a `service_role`). Pegue em: painel do Supabase →
**Project Settings → API** → campo **`anon` `public`** → copiar.

Aí registre ela no EAS (fica guardada, encriptada, no seu projeto Expo):

```bash
eas env:create --name EXPO_PUBLIC_SUPABASE_ANON_KEY --value "COLE_A_CHAVE_AQUI" --environment preview --visibility sensitive
```

> Repita trocando `--environment preview` por `production` e por `development`
> se for usar esses perfis também. Pra ver o que já cadastrou: `eas env:list`.

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

## 5. Gerar o APK de teste (perfil `preview`)

```bash
eas build --profile preview --platform android
```

- Pergunta "Generate a new Android Keystore?" → responda **Y** (o EAS cria e
  guarda a assinatura pra você).
- O build roda na nuvem da Expo (~10–20 min). Pode fechar o terminal — o
  progresso também fica em https://expo.dev (seu projeto → Builds).

### Como baixar e instalar o APK no seu Android

1. **Quando o build terminar**, o terminal mostra:
   - um **link** (ex.: `https://expo.dev/artifacts/eas/xxxx.apk`) e
   - um **QR code**.
2. **No próprio celular Android**, abra a câmera e aponte pro QR code (ou abra
   o link `expo.dev/accounts/.../projects/leeva-motoboy/builds` e toque no
   build mais recente → **Install**).
3. O navegador do celular baixa o arquivo `.apk`. Toque na notificação de
   download quando terminar (ou abra em **Downloads**).
4. O Android vai avisar: **"Por segurança, seu telefone não pode instalar apps
   desconhecidos desta fonte"** → toque em **Configurações** → ative
   **"Permitir desta fonte"** (para o Chrome ou o app de arquivos) → volte.
5. Toque em **Instalar**. Pronto — o ícone "Leeva Motoboy" (verde) aparece na
   tela.
6. Da próxima vez que gerar um APK novo, é só baixar e instalar por cima —
   ele atualiza o app.

> Esse APK é o que você manda pros motoboys testarem (link direto ou
> WhatsApp). Não precisa de Play Store pra isso.

### O que testar no celular

- [ ] Login (use uma conta de motoboy real; `alan@leeva.dev` / `leeva123`
      serve pra ver as telas)
- [ ] Ficar **online** (pede permissão de localização — aceite "Ao usar o app")
- [ ] O mapa carrega na tela de entrega
- [ ] Com uma entrega ativa: trave a tela / abra outro app por 1–2 min e
      confirme que a **notificação fixa "entrega em andamento"** aparece e a
      localização continua atualizando no painel do restaurante
- [ ] Fechar o app com entrega ativa e reabrir → volta pro fluxo da entrega
- [ ] Notificação push: **só funciona depois do Firebase** (`FIREBASE-SETUP.md`)

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
| Chave Supabase | `eas env:create --name EXPO_PUBLIC_SUPABASE_ANON_KEY --value "..." --environment preview --visibility sensitive` | a chave anon |
| Ver no celular | `npx expo start` + Expo Go | só o celular |
| **APK de teste** | `eas build --profile preview -p android` | conta Expo |
| Push no APK | `FIREBASE-SETUP.md` + `eas credentials` | conta Google (grátis) |
| Play Store | `eas build --profile production` + `eas submit` | conta Google Play (US$ 25) |

O Project ID já está ligado (`app.config.js`) — `eas init` não é necessário.

---

## Se algo der errado

- **"Invalid UUID appId" / "project not configured"** → não deveria acontecer,
  o Project ID já está no `app.config.js`. Se aparecer, rode `eas init` e
  confirme o projeto `leeva-motoboy`.
- **Build reclama de `EXPO_PUBLIC_SUPABASE_ANON_KEY`** → você pulou o
  `eas env:create` (passo 2). Rode-o e refaça o build.
- **Push não chega no APK** → falta o `google-services.json` (passo 3) ou a
  chave FCM no `eas credentials` (fim do `FIREBASE-SETUP.md`).
- **App abre e fecha na hora** → quase sempre é a chave anon faltando/errada.
- **Mapa em branco** → o CDN do MapLibre demora na 1ª vez; espere ~3s. Se
  nunca carregar, o celular está sem internet.
- **GPS em segundo plano não continua** → confira nos ajustes do Android que a
  permissão de localização está em **"Permitir o tempo todo"** (não só "ao usar").
