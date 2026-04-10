import { isLoggedInServerComponent } from '@/lib/auth';
import LogisticsApp from '@/components/logistics-app';
import LoginForm from '@/components/login-form';

export default async function HomePage() {
  const loggedIn = await isLoggedInServerComponent();
  return loggedIn ? <LogisticsApp /> : <LoginForm />;
}
