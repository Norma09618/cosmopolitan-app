import Anthropic from '@anthropic-ai/sdk'
import { NextRequest, NextResponse } from 'next/server'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const messages: Array<{ role: string; content: string }> = body.messages || []
    const contexto: string = body.contexto || ''

    // Solo mensajes user/assistant, empezando desde el primer user
    const filtered: Array<{ role: 'user' | 'assistant'; content: string }> = []
    let foundUser = false
    for (const m of messages) {
      if (m.role === 'user') foundUser = true
      if (foundUser && (m.role === 'user' || m.role === 'assistant')) {
        filtered.push({ role: m.role as 'user' | 'assistant', content: m.content })
      }
    }

    if (filtered.length === 0) {
      return NextResponse.json({ error: 'Sin mensajes válidos' }, { status: 400 })
    }

    const system = `Eres "Cosmo IA", el asistente de negocios de Cosmopolitan Peluquerías (Ecuador).
Eres un asesor experto que SOLO conoce los datos reales de Cosmopolitan.
Responde siempre en español, de forma clara y profesional.
Usa formato $X.XX para dinero y % para porcentajes.

=== DATOS REALES DE COSMOPOLITAN ===
${contexto}
====================================

REGLAS:
- Solo hablas sobre Cosmopolitan. Si preguntan otra cosa, dilo amablemente.
- Basa todas tus respuestas en los datos reales proporcionados.
- Puedes hacer recomendaciones estratégicas basadas en los números.
- Nunca inventes datos que no estén en el contexto.`

    const response = await client.messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 1024,
      system,
      messages: filtered,
    })

    const block = response.content[0]
    const text = block.type === 'text' ? block.text : ''
    return NextResponse.json({ respuesta: text })

  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Error desconocido'
    console.error('Chat error:', msg)
    return NextResponse.json({ error: 'Error al conectar con la IA: ' + msg }, { status: 500 })
  }
}
