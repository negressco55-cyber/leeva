import type { Metadata } from 'next';

const description =
  'Você cria a entrega e o Leeva chama o motoboy mais perto, acompanha a rota e avisa o cliente. Sem mensalidade: R$ 1,00 do Leeva por entrega + o valor do entregador. João Pessoa.';

export const landingMetadata: Metadata = {
  title: 'Leeva | Entregas para o seu comércio em João Pessoa',
  description,
  openGraph: {
    title: 'Leeva | Entregas para o seu comércio',
    description,
    locale: 'pt_BR',
    type: 'website',
  },
};
