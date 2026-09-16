import { isSupabaseConfigured } from '@leeva/shared';
import { createLeevaServerClient } from '@leeva/shared/server';
import SetupNotice from './SetupNotice';
import HomeRedirect from './HomeRedirect';

export default async function Home() {
  if (!isSupabaseConfigured()) {
    return <SetupNotice />;
  }

  const supabase = await createLeevaServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return <HomeRedirect loggedIn={!!user} />;
}
