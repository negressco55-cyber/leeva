/**
 * E-mail transacional via Resend (https://resend.com) — REST direto (fetch),
 * sem SDK, pra não repetir o problema do web-push puxando dependência
 * Node-only pro bundle do cliente. Configurar RESEND_API_KEY (e opcionalmente
 * RESEND_FROM_EMAIL) nas env vars do projeto que aprova motoboys (apps/admin).
 * Sem a chave configurada, só loga e segue — nunca bloqueia quem chamou.
 */
const RESEND_API_URL = 'https://api.resend.com/emails';

export function isEmailConfigured(): boolean {
  return !!process.env.RESEND_API_KEY;
}

async function sendEmail(to: string, subject: string, html: string): Promise<void> {
  if (!isEmailConfigured()) {
    console.warn(`[mailer] RESEND_API_KEY não configurada — e-mail não enviado (${subject}) para ${to}`);
    return;
  }
  try {
    const res = await fetch(RESEND_API_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: process.env.RESEND_FROM_EMAIL ?? 'Leeva <onboarding@resend.dev>',
        to,
        subject,
        html,
      }),
    });
    if (!res.ok) {
      console.error('[mailer] falha ao enviar e-mail:', res.status, await res.text().catch(() => ''));
    }
  } catch (e) {
    console.error('[mailer] erro ao enviar e-mail:', e);
  }
}

/** Cadastro de motoboy aprovado — avisa que já pode ficar online. */
export async function sendDriverApprovedEmail(to: string, fullName: string): Promise<void> {
  await sendEmail(
    to,
    'Seu cadastro no Leeva foi aprovado',
    `<p>Oi, ${escapeHtml(fullName)}!</p>
     <p>Seu cadastro como entregador no Leeva foi aprovado. Você já pode abrir o app, ficar online e começar a receber ofertas de entrega.</p>`,
  );
}

/** Cadastro de motoboy reprovado — explica o motivo. */
export async function sendDriverRejectedEmail(to: string, fullName: string, reason: string): Promise<void> {
  await sendEmail(
    to,
    'Sobre o seu cadastro no Leeva',
    `<p>Oi, ${escapeHtml(fullName)}.</p>
     <p>Não conseguimos aprovar seu cadastro como entregador no Leeva.</p>
     <p><b>Motivo:</b> ${escapeHtml(reason)}</p>
     <p>Se quiser, você pode corrigir os documentos e tentar de novo.</p>`,
  );
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}
