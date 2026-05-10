import { type VercelConfig } from '@vercel/config/v1';

export const config: VercelConfig = {
  framework: 'nextjs',
  buildCommand: 'next build',

  headers: [
    {
      source: '/api/yt/stream/(.*)',
      headers: [
        { key: 'Cache-Control', value: 'no-store' },
        { key: 'Accept-Ranges', value: 'bytes' },
      ],
    },
    {
      source: '/api/(.*)',
      headers: [
        { key: 'Access-Control-Allow-Origin', value: '*' },
        { key: 'Access-Control-Allow-Methods', value: 'GET,POST,PUT,DELETE,OPTIONS' },
        { key: 'Access-Control-Allow-Headers', value: 'Content-Type, Authorization' },
      ],
    },
  ],
};

export default config;
