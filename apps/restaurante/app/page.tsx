import type { Metadata } from 'next';
import { isSupabaseConfigured } from '@leeva/shared';
import { createLeevaServerClient } from '@leeva/shared/server';
import SetupNotice from './SetupNotice';
import HomeRedirect from './HomeRedirect';
import Landing from './_landing/Landing';
import { landingMetadata } from './_landing/metadata';

export const metadata: Metadata = landingMetadata;

export default async function Home() {
  if (!isSupabaseConfigured()) {
    return <SetupNotice />;
  }

  const supabase = await createLeevaServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // logado → painel; visitante → página de apresentação do Leeva
  if (user) return <HomeRedirect loggedIn />;
  return (
    <>
      <HomeRedirect loggedIn={false} stayWhenLoggedOut />
      <Landing />
    </>
  );
}
