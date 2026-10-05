import { UpgradeDashboard } from '../components/DreamDashboard';
import { publicMetadata } from '../lib/seo';

export const metadata = publicMetadata({ title: 'Upgrade', description: 'View Leakporns membership options.', path: '/upgrade' });

export default function UpgradePage() {
  return <UpgradeDashboard />;
}
