import { createLeevaAdminClient } from '@leeva/shared/server';
import { getActiveTerms } from '@leeva/shared/services';
import SignupForm from './SignupForm';

export const dynamic = 'force-dynamic';

export default async function SignupPage() {
  const terms = await getActiveTerms(createLeevaAdminClient(), 'restaurant');
  return <SignupForm terms={terms} />;
}
