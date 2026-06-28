import type { Metadata } from 'next';

import InstallGuide from '../install-guide';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Install SPICE Local',
  description: 'Download and set up the SPICE local Windows runtime with Vercel and Neon configuration notes.',
};

export default function InstallPage() {
  return <InstallGuide />;
}
