import Anthropic from '@anthropic-ai/sdk'
import { NextRequest, NextResponse } from 'next/server'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const pdfBase64: string = body.pdf

    if (!pdfBase64) {
      return NextResponse.json({ error: 'PDF no recibido' }, { status: 400 })
    }

    const response = await client.beta.messages.create({
      model: 'claude-opus-4-5',
      max_tokens: 1200,
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
            text: `Analiza este documento de marca o briefing y extrae la siguiente información.
Responde ÚNICAMENTE con un JSON válido, sin texto adicional antes ni después:

{
  "avatar": "descripción detallada del cliente ideal (edad, género, ubicación, intereses, comportamiento de compra)",
  "tono": "tono de voz de la marca (ej: profesional y cálido, divertido y cercano, elegante y aspiracional)",
  "propuesta": "propuesta de valor única de la marca (qué la diferencia de la competencia)",
  "objetivos": "objetivos de marketing principales (ej: aumentar clientes, fidelizar, posicionarse en redes)",
  "redes": "redes sociales mencionadas en el documento, o 'Instagram, Facebook, TikTok' si no se especifican"
}

Si algún campo no está explícito en el documento, infiere algo coherente con el contexto. Sé específico y útil.`,
          },
        ],
      }],
    })

    const text = response.content[0].type === 'text' ? response.content[0].text : ''
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      return NextResponse.json({ error: 'No se pudo extraer información estructurada del PDF' }, { status: 422 })
    }

    const extracted = JSON.parse(jsonMatch[0])
    return NextResponse.json({ data: extracted })

  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Error desconocido'
    console.error('Extract PDF error:', msg)
    return NextResponse.json({ error: 'Error al procesar el PDF: ' + msg }, { status: 500 })
  }
}
