import { isLoggedInServerComponent } from '@/lib/auth';
import ClientHome from '@/components/client-home';

export default async function HomePage() {
  const loggedIn = await isLoggedInServerComponent();
  return <ClientHome loggedIn={loggedIn} />;
}
