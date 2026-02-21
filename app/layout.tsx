import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Vespa Admin',
  description: 'Vespa Search Engine Admin UI',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <body>{children}</body>
    </html>
  )
}
