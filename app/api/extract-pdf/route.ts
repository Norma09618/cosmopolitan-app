import Anthropic from '@anthropic-ai/sdk'
import { NextRequest, NextResponse } from 'next/server'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

// Anthropic soporta hasta 5 documentos por request
const MAX_DOCS_PER_REQUEST = 5

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    // Acepta un solo PDF (string) o múltiples (array)
    const pdfs: string[] = Array.isArray(body.pdfs) ? body.pdfs : [body.pdf].filter(Boolean)

    if (pdfs.length === 0) {
      return NextResponse.json({ error: 'No se recibieron PDFs' }, { status: 400 })
    }

    // Si hay más de 5, procesamos en lotes y sintetizamos al final
    if (pdfs.length <= MAX_DOCS_PER_REQUEST) {
      // Procesar todos juntos en un solo request
      const extracted = await extractFromPdfs(pdfs)
      return NextResponse.json({ data: extracted })
    } else {
      // Procesar en lotes de 5 y luego sintetizar
      const resultados: string[] = []
      for (let i = 0; i < pdfs.length; i += MAX_DOCS_PER_REQUEST) {
        const lote = pdfs.slice(i, i + MAX_DOCS_PER_REQUEST)
        const parcial = await extractFromPdfs(lote, true)
        resultados.push(JSON.stringify(parcial))
      }
      // Sintetizar todos los resultados parciales
      const final = await sintetizar(resultados)
      return NextResponse.json({ data: final })
    }

  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Error desconocido'
    console.error('Extract PDF error:', msg)
    return NextResponse.json({ error: 'Error al procesar los PDFs: ' + msg }, { status: 500 })
  }
}

async function extractFromPdfs(pdfs: string[], parcial = false): Promise<Record<string, string>> {
  const docBlocks = pdfs.map(pdf => ({
    type: 'document' as const,
    source: {
      type: 'base64' as const,
      media_type: 'application/pdf' as const,
      data: pdf,
    },
  }))

  const prompt = parcial
    ? `Analiza estos ${pdfs.length} documentos de marca y extrae toda la información relevante sobre: cliente ideal, tono de voz, propuesta de valor, objetivos de marketing y redes sociales. Responde ÚNICAMENTE con JSON válido:
{
  "avatar": "...",
  "tono": "...",
  "propuesta": "...",
  "objetivos": "...",
  "redes": "..."
}`
    : `Analiza estos ${pdfs.length} documentos de marca, briefings y materiales de Cosmopolitan Peluquerías. Sintetiza toda la información y extrae un perfil completo y detallado. Responde ÚNICAMENTE con JSON válido, sin texto adicional:
{
  "avatar": "descripción completa del cliente ideal: perfil demográfico, psicográfico, comportamiento de compra, dolores y deseos",
  "tono": "tono de voz de la marca: cómo habla, qué transmite, ejemplos de estilo comunicacional",
  "propuesta": "propuesta de valor única y diferenciadores clave frente a la competencia",
  "objetivos": "objetivos de marketing concretos y medibles",
  "redes": "redes sociales activas y estrategia por canal"
}`

  const response = await client.beta.messages.create({
    model: 'claude-opus-4-5',
    max_tokens: 1500,
    betas: ['pdfs-2024-09-25'],
    messages: [{
      role: 'user',
      content: [
        ...docBlocks,
        { type: 'text' as const, text: prompt },
      ],
    }],
  })

  const text = response.content[0].type === 'text' ? response.content[0].text : ''
  const jsonMatch = text.match(/\{[\s\S]*\}/)
  if (!jsonMatch) throw new Error('No se pudo extraer información estructurada')
  return JSON.parse(jsonMatch[0])
}

async function sintetizar(resultadosParciales: string[]): Promise<Record<string, string>> {
  const response = await client.messages.create({
    model: 'claude-opus-4-5',
    max_tokens: 1500,
    messages: [{
      role: 'user',
      content: `Tienes los siguientes resultados parciales extraídos de múltiples documentos de marca. Sintetízalos en un único perfil completo y coherente. Responde ÚNICAMENTE con JSON válido:

${resultadosParciales.map((r, i) => `--- Lote ${i + 1} ---\n${r}`).join('\n\n')}

Responde con este JSON:
{
  "avatar": "perfil sintetizado del cliente ideal",
  "tono": "tono de voz sintetizado",
  "propuesta": "propuesta de valor sintetizada",
  "objetivos": "objetivos sintetizados",
  "redes": "redes sintetizadas"
}`,
    }],
  })

  const text = response.content[0].type === 'text' ? response.content[0].text : ''
  const jsonMatch = text.match(/\{[\s\S]*\}/)
  if (!jsonMatch) throw new Error('No se pudo sintetizar la información')
  return JSON.parse(jsonMatch[0])
}
