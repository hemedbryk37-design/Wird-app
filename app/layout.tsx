import { Analytics } from '@vercel/analytics/next'
import type { Metadata, Viewport } from 'next'
import { Amiri, IBM_Plex_Sans_Arabic } from 'next/font/google'
import { AppServices } from '@/components/app-services'
import './globals.css'

const arabic = IBM_Plex_Sans_Arabic({
  subsets: ['arabic'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-arabic',
})

const poetry = Amiri({
  subsets: ['arabic'],
  weight: ['400', '700'],
  variable: '--font-amiri',
})

export const metadata: Metadata = {
  title: 'إعداد خطة متابعة جديدة',
  description: 'خطط لحفظ أو قراءة كتاب أو متن بتوزيع يومي ثابت أو على أيام محددة من الأسبوع، مع حساب تاريخ الختم.',
  generator: 'v0.app',
  applicationName: 'متابعة الورد',
  appleWebApp: { capable: true, title: 'الورد', statusBarStyle: 'default' },
  icons: {
    icon: [
      {
        url: '/icon-light-32x32.png',
        media: '(prefers-color-scheme: light)',
      },
      {
        url: '/icon-dark-32x32.png',
        media: '(prefers-color-scheme: dark)',
      },
      {
        url: '/icon.svg',
        type: 'image/svg+xml',
      },
    ],
    apple: '/apple-icon.png',
  },
}

export const viewport: Viewport = {
  colorScheme: 'light',
  themeColor: '#f7f3ea',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="ar" dir="rtl" className={`light ${arabic.variable} ${poetry.variable}`}>
      <body className="font-sans antialiased">
        {children}
        <AppServices />
        {process.env.NODE_ENV === 'production' && <Analytics />}
      </body>
    </html>
  )
}
