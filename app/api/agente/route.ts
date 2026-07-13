import Anthropic from '@anthropic-ai/sdk'
import { NextRequest, NextResponse } from 'next/server'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const rol: string = body.rol || 'Asistente'
    const instruccion: string = body.instruccion || ''
    const contexto: string = body.contexto || ''

    const brandName = process.env.NEXT_PUBLIC_BRAND_NAME || 'COSMOPOLITAN'
    const system = `Eres el ${rol} de ${brandName} (Ecuador).
Responde siempre en español, de forma clara, estructurada y profesional.
Usa formato $X.XX para dinero y % para porcentajes.
Basa tu análisis únicamente en los datos reales proporcionados.
IMPORTANTE: El nombre del negocio es ${brandName}. No menciones ningún otro nombre de empresa.

=== DATOS DEL NEGOCIO ===
${contexto}
=========================`

    const response = await client.messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 1500,
      system,
      messages: [{ role: 'user', content: instruccion }],
    })

    const block = response.content[0]
    const texto = block.type === 'text' ? block.text : ''
    return NextResponse.json({ respuesta: texto })

  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Error desconocido'
    console.error('Agente error:', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
