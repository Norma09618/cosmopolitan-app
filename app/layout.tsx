import type { Metadata, Viewport } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Cosmopolitan · Sistema de Gestión',
  description: 'Sistema de gestión NS Consultoría Digital para Cosmopolitan Peluquerías',
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" style={{ height: '100%', overflow: 'hidden' }}>
      <body style={{ margin: 0, padding: 0, fontFamily: 'system-ui,-apple-system,sans-serif', height: '100%', overflow: 'hidden' }}>
        {children}
      </body>
    </html>
  )
}
