# Verificação de identidade do entregador (selfie + documento)

Pedido: *"será necessário fazer a facial e precisa bater de acordo com o
documento."*

Isto é uma **feature nova, grande e que depende de um serviço pago** — não dá
pra montar sozinho numa sessão noturna (mexe no cadastro, guarda dado
biométrico, precisa de conta num fornecedor). Este documento é o plano
completo: o que é, qual fornecedor usar, quanto custa, o que **você** precisa
fazer, e onde o código encaixa.

---

## 1. O que é

Quando um entregador se cadastra, antes de ser aprovado ele faz:

1. **Foto do documento** (CNH ou RG) — *isto já existe* (`motoboys.personal_doc_path`).
2. **Selfie com prova de vida ("liveness")** — o app pede pra ele virar o
   rosto / piscar / aproximar, pra garantir que é uma pessoa real ali na hora,
   não uma foto de foto.
3. **Comparação 1:1** — o sistema compara o rosto da selfie com o rosto do
   documento e devolve um **score de similaridade** (ex.: 0–100). Acima de um
   limite (ex.: 85) → passa. Abaixo → revisão manual ou recusa.

Resultado: entra no fluxo de aprovação que já existe (`approval_status`).

**Por que:** impede conta com documento de terceiro, conta "alugada", e o
motoboy que some e passa a conta pra outro. É o padrão de todo app de entrega.

---

## 2. Qual serviço usar

Eu não consigo "detectar isso" sozinho — quem faz é um serviço especializado.
Três caminhos, do mais simples ao mais completo:

### Opção A — iFood/99-style turnkey: **idwall** ou **CAF (Combate à Fraude)** ou **Unico Check**

Fornecedores brasileiros de KYC. Você manda a foto do documento + a selfie, e
eles devolvem: OCR do documento, "documento é válido?", "rosto bate?",
"liveness passou?", e cruzamento com bases (CPF na Receita, antecedentes).

- **Prós:** completo, SDK pronto pra React Native, suporte em português,
  aceita CNH/RG, já pensado pra gig economy.
- **Contras:** contrato / mensalidade + preço por consulta (geralmente
  **R$ 1,50 – R$ 4,00 por verificação**, com mínimo mensal). Precisa falar
  com comercial.
- **Quando:** quando tiver volume real de cadastros (dezenas/mês).

### Opção B — construir com **AWS Rekognition** (recomendado pra começar)

A AWS tem duas peças que resolvem exatamente isto:

- **Face Liveness** — SDK no app faz a prova de vida (o "gire o rosto").
- **CompareFaces** — compara selfie × foto do documento, devolve `Similarity`.

- **Prós:** **sem contrato, sem mínimo** — paga por uso. Liveness ~US$ 0,015
  por checagem; CompareFaces ~US$ 0,001. Um cadastro custa **menos de R$ 0,10**.
  SDK oficial pra React Native (`amazon-rekognition-streaming` / Amplify).
- **Contras:** você monta o fluxo (o app chama o liveness, o backend chama o
  CompareFaces, você define o limite de score). Não faz OCR do documento nem
  cruza com a Receita — só o "o rosto bate".
- **Quando:** agora / MVP. É o melhor custo-benefício pra começar.

### Opção C — **SERPRO Datavalid** (governo)

Compara a selfie direto com a foto oficial da CNH/RG na base do governo. É a
verificação mais forte que existe no Brasil.

- **Prós:** bate com a base oficial, não com a foto que o próprio motoboy
  mandou.
- **Contras:** contratação via SERPRO (burocrático), preço por consulta,
  integração mais chata. Vale quando o Leeva estiver maior.

### Recomendação

**Comece pela Opção B (AWS Rekognition).** Sem compromisso financeiro, custo
por cadastro irrisório, e cobre o essencial ("é uma pessoa viva e o rosto bate
com o documento"). Migra pra idwall/CAF (Opção A) quando o volume justificar o
contrato e você quiser OCR + antecedentes junto.

---

## 3. LGPD — isto é dado sensível

Rosto é **dado pessoal sensível** (Art. 5º, II da LGPD). Regras:

- **Consentimento explícito e separado** — uma tela no cadastro: *"Autorizo o
  Leeva a usar minha selfie e meu documento para verificar minha identidade."*
  Com data/hora do aceite gravada.
- **Minimização** — não guarde o vídeo do liveness. Guarde só: o **score**, a
  **decisão** (aprovado/reprovado/revisar), o **id da consulta** no fornecedor,
  e a data. A selfie aprovada pode virar a foto de perfil (com aviso).
- **Retenção** — defina por quanto tempo guarda (ex.: enquanto a conta existir
  + 5 anos por obrigação fiscal/trabalhista).
- **Finalidade única** — só verificação de identidade. Nunca reconhecimento
  facial pra outra coisa.

Recomendo uma linha no futuro contrato do entregador e uma política de
privacidade citando o fornecedor (AWS / idwall).

---

## 4. O que VOCÊ precisa fazer

1. Escolher o fornecedor (recomendo AWS Rekognition pra começar).
2. **AWS:** criar conta, habilitar Rekognition na região `us-east-1` ou
   `sa-east-1`, gerar um par de chaves (Access Key / Secret) com permissão só
   de `rekognition:CompareFaces` e `rekognition:*Liveness*`. Me passar as
   chaves pra eu pôr como variável de ambiente (nunca no código).
   **idwall/CAF:** falar com o comercial, assinar, pegar o API token.
3. Decidir o **limite de score** que aprova automático (sugestão: ≥ 90 aprova,
   80–90 vai pra revisão manual no painel admin, < 80 recusa).
4. Escrever o texto do consentimento (posso rascunhar).

Depois disso eu implemento (estimo ~1 sessão de trabalho).

---

## 5. Onde o código encaixa (já está meio preparado)

| Peça | Estado hoje | O que falta |
|---|---|---|
| Upload do documento | ✅ `motoboys.personal_doc_path` | nada |
| Fluxo de aprovação | ✅ `approval_status` + painel admin | gate no resultado da verificação |
| Passo de selfie no cadastro | ❌ | tela nova em `apps/motoboy/app/quero-entregar` (e no app nativo) com o SDK de liveness |
| Guardar o resultado | ❌ | migration: tabela `identity_verifications` (abaixo) |
| Chamar o fornecedor | ❌ | rota `POST /api/identity/verify` (backend chama AWS/idwall, grava o score, atualiza `approval_status`) |
| Foto de perfil | ⏳ coluna `avatar_url` criada na migration `0030` (ainda não aplicada) | preencher com a selfie aprovada |

### Migration que vai ser necessária (não aplicar ainda)

```sql
create table identity_verifications (
  id uuid primary key default gen_random_uuid(),
  motoboy_id uuid not null references motoboys(id) on delete cascade,
  provider text not null,              -- 'aws_rekognition' | 'idwall' | ...
  provider_ref text,                   -- id da consulta no fornecedor
  liveness_passed boolean,
  face_match_score numeric,            -- 0..100
  decision text not null,              -- 'approved' | 'review' | 'rejected'
  consent_at timestamptz not null,
  created_at timestamptz not null default now()
);
alter table identity_verifications enable row level security;
-- só service_role escreve; admin lê. Motoboy não lê o próprio score.
```

---

## 6. Por que não fiz agora

- Depende de conta paga num fornecedor (mesma regra do Firebase / Sentry:
  documento o passo a passo, não executo).
- Guarda dado biométrico → exige as decisões de LGPD acima, que são suas.
- É um passo novo no cadastro + tabela nova + integração externa → é "grande
  demais pra decidir sozinho" pelas regras da sessão.

O placeholder da foto de perfil (iniciais no círculo) já está no app —
`Avatar` no PWA e no nativo. Quando a verificação entrar, a selfie aprovada
vira essa foto.
