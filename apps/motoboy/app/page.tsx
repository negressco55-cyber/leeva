import { redirect } from 'next/navigation';
import { isSupabaseConfigured } from '@leeva/shared';
import { createLeevaServerClient } from '@leeva/shared/server';
import SetupNotice from './SetupNotice';

export default async function Home() {
  if (!isSupabaseConfigured()) {
    return <SetupNotice />;
  }

  const supabase = await createLeevaServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  redirect(user ? '/status' : '/login');
}
