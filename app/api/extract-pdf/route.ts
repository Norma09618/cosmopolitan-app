import Anthropic from '@anthropic-ai/sdk'
import { NextRequest, NextResponse } from 'next/server'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()

    // MODO 1: extraer de un solo PDF (base64)
    if (body.pdf) {
      const extracted = await extraerUnPdf(body.pdf)
      return NextResponse.json({ data: extracted })
    }

    // MODO 2: sintetizar múltiples resultados parciales (solo texto, sin PDFs)
    if (body.sintetizar && Array.isArray(body.sintetizar)) {
      const final = await sintetizar(body.sintetizar)
      return NextResponse.json({ data: final })
    }

    return NextResponse.json({ error: 'Parámetros inválidos' }, { status: 400 })

  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Error desconocido'
    console.error('Extract PDF error:', msg)
    return NextResponse.json({ error: 'Error: ' + msg }, { status: 500 })
  }
}

async function extraerUnPdf(pdfBase64: string): Promise<Record<string, string>> {
  const response = await client.beta.messages.create({
    model: 'claude-opus-4-5',
    max_tokens: 1000,
    betas: ['pdfs-2024-09-25'],
    messages: [{
      role: 'user',
      content: [
        {
          type: 'document' as const,
          source: {
            type: 'base64' as const,
            media_type: 'application/pdf' as const,
            data: pdfBase64,
          },
        },
        {
          type: 'text' as const,
          text: `Analiza este documento y extrae información de marca. Responde SOLO con JSON válido:
{
  "avatar": "cliente ideal: edad, género, ubicación, intereses, comportamiento",
  "tono": "tono de voz de la marca",
  "propuesta": "propuesta de valor única",
  "objetivos": "objetivos de marketing",
  "redes": "redes sociales mencionadas o vacío si no hay"
}`,
        },
      ],
    }],
  })

  const text = response.content[0].type === 'text' ? response.content[0].text : ''
  const match = text.match(/\{[\s\S]*\}/)
  if (!match) throw new Error('No se pudo extraer información del documento')
  return JSON.parse(match[0])
}

async function sintetizar(parciales: string[]): Promise<Record<string, string>> {
  const response = await client.messages.create({
    model: 'claude-opus-4-5',
    max_tokens: 1200,
    messages: [{
      role: 'user',
      content: `Tienes información de marca extraída de ${parciales.length} documentos diferentes. Sintetiza todo en un perfil único, completo y coherente. Responde SOLO con JSON válido:

${parciales.map((p, i) => `=== Documento ${i + 1} ===\n${p}`).join('\n\n')}

Responde con este JSON sintetizado:
{
  "avatar": "perfil completo del cliente ideal combinando toda la información",
  "tono": "tono de voz sintetizado y coherente",
  "propuesta": "propuesta de valor más completa",
  "objetivos": "objetivos de marketing combinados",
  "redes": "todas las redes mencionadas"
}`,
    }],
  })

  const text = response.content[0].type === 'text' ? response.content[0].text : ''
  const match = text.match(/\{[\s\S]*\}/)
  if (!match) throw new Error('No se pudo sintetizar la información')
  return JSON.parse(match[0])
}
