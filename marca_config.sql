-- =============================================
-- BASE DE CONOCIMIENTO DE MARKETING
-- Pegar en Supabase SQL Editor → Run
-- =============================================

-- Tabla para guardar la configuración de marca
CREATE TABLE IF NOT EXISTS marca_config (
  id INTEGER PRIMARY KEY DEFAULT 1,
  avatar TEXT DEFAULT '',
  tono TEXT DEFAULT '',
  propuesta TEXT DEFAULT '',
  redes TEXT DEFAULT 'Instagram, Facebook, TikTok',
  objetivos TEXT DEFAULT '',
  pdf_nombre TEXT DEFAULT '',
  pdf_url TEXT DEFAULT '',
  actualizado_en TIMESTAMP DEFAULT NOW()
);

-- Insertar fila inicial (siempre usamos id=1)
INSERT INTO marca_config (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

-- Bucket de Storage para los PDFs de marca
INSERT INTO storage.buckets (id, name, public)
VALUES ('marketing-docs', 'marketing-docs', true)
ON CONFLICT (id) DO NOTHING;

-- Política: solo usuarios autenticados pueden subir
CREATE POLICY "Authenticated users can upload"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'marketing-docs');

-- Política: acceso público para leer
CREATE POLICY "Public read access"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'marketing-docs');

-- Política: usuarios autenticados pueden borrar/actualizar
CREATE POLICY "Authenticated users can update"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'marketing-docs');
