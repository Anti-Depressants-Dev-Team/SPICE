import type { Metadata } from 'next';

import RuntimeHome from '@/app/runtime-home';
import { getRuntimeTarget } from '@/lib/runtime-target';

export const dynamic = 'force-static';

export const metadata: Metadata = getRuntimeTarget() === 'vercel'
  ? {
      title: 'SPICE Local Runtime Portal',
      description: 'The Vercel-hosted control plane for SPICE auth, sync, metadata, installs, and local runtime updates.',
    }
  : {
    title: 'SPICE Music - Local PC Runtime',
    description: 'The local SPICE Music runtime for search, streaming, playlists, and Spice Connect.',
  };

export default function Home() {
  return <RuntimeHome />;
}
