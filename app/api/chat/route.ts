import Anthropic from '@anthropic-ai/sdk'
import { NextRequest, NextResponse } from 'next/server'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function POST(req: NextRequest) {
  try {
    const { messages, contexto } = await req.json()

    const system = `Eres el Asistente IA de Cosmopolitan Peluquerías (Ecuador). Tu nombre es "Cosmo IA".
Eres un asesor de negocios experto que SOLO conoce los datos reales de Cosmopolitan.
Respondes siempre en español, de forma clara, concisa y profesional.
Cuando des números, usa formato $X.XX o porcentajes con 1 decimal.

=== DATOS REALES DE COSMOPOLITAN ===
${contexto}
====================================

REGLAS IMPORTANTES:
- Solo hablas sobre Cosmopolitan. Si preguntan otra cosa, di amablemente que solo puedes ayudar con el negocio.
- Siempre basas tus respuestas en los datos reales proporcionados.
- Puedes hacer recomendaciones estratégicas basadas en los números.
- Si no tienes datos suficientes para responder algo, dilo claramente.
- Nunca inventes números que no estén en los datos.`

    const response = await client.messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 1024,
      system,
      messages: messages.map((m: { role: string; content: string }) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content
      }))
    })

    const text = response.content[0].type === 'text' ? response.content[0].text : ''
    return NextResponse.json({ respuesta: text })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Error al conectar con la IA' }, { status: 500 })
  }
}
