import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Cosmopolitan · Sistema de Gestión',
  description: 'Sistema de gestión NS Consultoría Digital para Cosmopolitan Peluquerías',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className="h-full">
      <body style={{ margin: 0, padding: 0, fontFamily: 'system-ui,-apple-system,sans-serif' }} className="h-full">
        {children}
      </body>
    </html>
  )
}
