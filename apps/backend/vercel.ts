import { type VercelConfig } from '@vercel/config/v1';

export const config: VercelConfig = {
  framework: 'nextjs',
  buildCommand: 'SPICE_RUNTIME_TARGET=vercel next build',
  regions: ['fra1'],

  rewrites: [
    {
      source: '/',
      destination: '/install',
      has: [{ type: 'host', value: 'install.spice-app.xyz' }],
    },
  ],

  headers: [
    {
      source: '/api/local/(.*)/stream/(.*)',
      headers: [
        { key: 'Cache-Control', value: 'no-store' },
        { key: 'Accept-Ranges', value: 'bytes' },
      ],
    },
  ],
};

export default config;
