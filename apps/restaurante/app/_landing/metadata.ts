import type { Metadata } from 'next';

const description =
  'Você cria a entrega e o Leeva chama o motoboy mais perto, acompanha a rota e avisa o cliente. Sem mensalidade: você paga só as entregas que fizer, pelo valor da distância. João Pessoa.';

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
