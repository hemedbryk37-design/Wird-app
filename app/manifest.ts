import type { MetadataRoute } from 'next'

export const dynamic = 'force-static'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'متابعة الورد',
    short_name: 'الورد',
    description: 'خطط لحفظ المتون وقراءة الكتب بورد يومي، وتابع إنجازك حتى بدون إنترنت.',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    dir: 'rtl',
    lang: 'ar',
    background_color: '#f7f3ea',
    theme_color: '#14563f',
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  }
}
