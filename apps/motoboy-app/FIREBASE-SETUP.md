# Firebase (FCM) — passo a passo pra ligar as notificações no APK

**Por que isso é necessário:** dentro do Expo Go as notificações já funcionam
pra teste. Mas no APK/AAB de verdade (o que você instala no celular ou publica
na Play Store), o Android exige o **Firebase Cloud Messaging (FCM)** pra
entregar push. É de graça e leva ~10 minutos.

Você precisa fazer isso — eu não consigo criar a conta no seu lugar. Mas o
código já está **100% preparado**: assim que você colocar o arquivo no lugar
certo, o app reconhece sozinho, sem mais nenhuma mudança.

---

## 1. Criar o projeto no Firebase

1. Entre em **https://console.firebase.google.com/** com sua conta Google.
2. Clique em **"Criar um projeto"** (ou "Add project").
3. Nome do projeto: **Leeva** (ou o que quiser). Avançar.
4. Google Analytics: pode **desativar** (não precisa). Criar projeto.
5. Espera terminar → **Continuar**.

> É tudo no plano gratuito (**Spark**). Push por FCM não tem custo.

## 2. Registrar o app Android

1. No painel do projeto, clique no ícone do **Android** (um robozinho) em
   "Adicione um app para começar".
2. **Nome do pacote Android** (campo obrigatório) — copie exatamente:

   ```
   br.com.leeva.motoboy
   ```

   > Tem que ser idêntico ao que está em `app.config.js` (`android.package`).
   > Se digitar diferente, o push não funciona.

3. Apelido do app: pode deixar em branco ou pôr "Leeva Motoboy".
4. "Certificado SHA-1": **pode pular** por enquanto (só é preciso pra login
   Google/Dynamic Links, que não usamos). Clique em **Registrar app**.

## 3. Baixar o `google-services.json`

1. A tela seguinte tem um botão **"Fazer download do google-services.json"**.
   Baixe o arquivo.
2. **Coloque o arquivo aqui**, exatamente nesta pasta:

   ```
   apps/motoboy-app/google-services.json
   ```

   (na raiz do app nativo, do lado do `app.config.js` e do `package.json`)

3. Pode fechar o resto do assistente do Firebase ("Adicionar SDK", "Próximas
   etapas") — **não precisa mexer em código**, o Expo cuida disso.

## 4. Conferir se o app reconheceu

Na pasta `apps/motoboy-app`, rode:

```bash
npx expo config --type introspect | grep -i googleServicesFile
```

Se aparecer `googleServicesFile: './google-services.json'`, está tudo certo. ✅

O `app.config.js` faz essa detecção automática:

```js
const hasAndroidFirebase = fs.existsSync(path.join(__dirname, 'google-services.json'));
// ...
...(hasAndroidFirebase ? { googleServicesFile: './google-services.json' } : {})
```

## 5. Ligar o FCM no Expo (uma vez, quando for buildar)

O Expo precisa da chave do FCM pra enviar push em seu nome. Depois de fazer
login na Expo (ver `PRONTO-PARA-BUILD.md`):

1. No **Firebase Console** → ⚙️ **Configurações do projeto** → aba **Cloud
   Messaging**.
2. Em **"Firebase Cloud Messaging API (V1)"**, clique nos 3 pontinhos →
   **"Gerenciar contas de serviço"** → isso abre o Google Cloud.
3. Ache a conta de serviço `firebase-adminsdk-...`, clique nela →
   aba **Chaves** → **Adicionar chave** → **Criar nova chave** → **JSON** →
   baixa um arquivo `.json`.
4. De volta na pasta do app:

   ```bash
   eas credentials
   ```

   escolha **Android** → **Push Notifications: Manage your FCM V1 service
   account key** → **Set up a FCM V1 service account key** → aponte pro
   `.json` que você baixou.

Pronto. A partir daí o push nativo funciona no APK e no AAB.

---

## Resumo do que fica salvo onde

| Arquivo | Onde vai | Some no git? |
|---|---|---|
| `google-services.json` | `apps/motoboy-app/` | **Sim** (já está no `.gitignore`) |
| Chave JSON da conta de serviço FCM | você guarda; sobe pro EAS via `eas credentials` | **Sim**, nunca commitar |

O `.gitignore` do app já ignora `google-services.json`,
`GoogleService-Info.plist` e `*.json` de credenciais — então não tem risco de
subir isso pro GitHub sem querer.

## E o iOS?

Mesma ideia, mas com `GoogleService-Info.plist` (iOS) na mesma pasta — o
`app.config.js` também detecta esse. Só faz sentido quando você tiver conta
Apple Developer (US$ 99/ano) pra distribuir no iPhone. Por ora, foque no
Android.
