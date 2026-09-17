import { createLeevaAdminClient } from '@leeva/shared/server';
import { getActiveTerms } from '@leeva/shared/services';
import QueroEntregarForm from './QueroEntregarForm';

export const dynamic = 'force-dynamic';

export default async function QueroEntregarPage() {
  const terms = await getActiveTerms(createLeevaAdminClient(), 'motoboy');
  return <QueroEntregarForm terms={terms} />;
}
