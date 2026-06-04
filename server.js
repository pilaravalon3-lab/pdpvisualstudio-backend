// ═══════════════════════════════════════════════════════
// PDP Visual Studio — Backend API Proxy
// Mantiene las API keys seguras en el servidor
// Deploy: Vercel, Railway, Render, o cualquier host Node.js
// ═══════════════════════════════════════════════════════

const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
try { require('dotenv').config(); } catch(e) {}

const app = express();
const PORT = process.env.PORT || 3000;

// ─── CORS: permitir solo tu dominio de GitHub Pages ───
const ALLOWED_ORIGINS = [
  'https://pilaravalon3-lab.github.io',
  'http://localhost:3000',
  'http://127.0.0.1:5500',
  'null'
];

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, curl, etc)
    if (!origin) return callback(null, true);
    // Allow any github.io subdomain
    if (origin.includes('github.io') || ALLOWED_ORIGINS.includes(origin)) {
      return callback(null, true);
    }
    callback(new Error('CORS blocked'));
  }
}));

app.use(express.json({ limit: '50kb' }));

// ─── RATE LIMITING: máx 60 requests por minuto por IP ───
const limiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  message: { error: 'Demasiadas requests. Esperá 1 minuto.' }
});
app.use('/api/', limiter);

// ─── API KEYS (variables de entorno — NUNCA hardcodeadas) ───
const CLAUDE_API_KEY = process.env.CLAUDE_API_KEY || '';
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';

// ─── HEALTH CHECK ───
app.get('/', (req, res) => {
  res.json({
    status: 'ok',
    service: 'PDP Visual Studio API Proxy',
    apis: {
      claude: CLAUDE_API_KEY ? 'configured' : 'missing',
      gemini: GEMINI_API_KEY ? 'configured' : 'missing'
    }
  });
});

// ═══════════════════════════════════════════════════════
// ENDPOINT: Mejorar Keywords
// POST /api/enhance-keywords
// ═══════════════════════════════════════════════════════
app.post('/api/enhance-keywords', async (req, res) => {
  const { keywords, concepto, copy, industry, format, mood, style, ai, systemPrompt: sp, userMsg: um } = req.body;
  const preferredAI = ai || 'gemini';

  // Accept either pre-built prompts from frontend or build from fields
  const systemPrompt = sp || `Sos un director de arte experto en búsqueda de imágenes para bancos de stock (Shutterstock, Getty, Unsplash, Freepik, iStock).

REGLA #1 — LONGITUD: Cada keyword debe tener entre 3 y 6 palabras MÁXIMO. NUNCA más de 6.
EJEMPLOS BUENOS (3-6 palabras):
- "warm light home interior"
- "candid family moment"
- "modern office natural light"
- "outdoor park golden hour"

EJEMPLOS MALOS (muy largos):
- "before and after moment transitional space 30 a professional" ❌
- "person walking outdoor at golden hour with warm tones lifestyle photography" ❌

REGLA #2 — IDIOMA: Siempre en inglés.

REGLA #3 — INTERPRETAR, NO COPIAR: Si la bajada dice "Acompañamos en cada etapa", NO escribas "accompany in each stage". Escribí "family support warm moment" o "caring hands together".

REGLA #4 — ESTRUCTURAS VÁLIDAS:
1. [acción] + [contexto]: "working in cafe"
2. [estilo] + [contexto]: "cinematic lighting office"  
3. [contexto] + [usuario]: "modern office professional"
4. [estilo puro]: "warm tones, candid lifestyle"

REGLA #5 — AGREGÁ ESTÉTICA: warm light, natural light, candid, lifestyle, cinematic, soft light, golden hour, editorial.

EVITAR: isolated product, overly staged, extreme close-up.

Respondé SOLO con JSON: {"mejorados": ["keyword1", ..., "keyword12"], "razon": "..."}`;

  const userMsg = um || `Concepto: "${concepto || ''} ${copy || ''}"
Industria: ${industry || ''} | Formato: ${format || ''} | Mood: ${mood || ''} | Estilo: ${style || ''}
Keywords: ${keywords || ''}
Generá 12 keywords mejorados.`;

  try {
    let result;
    if (preferredAI === 'gemini' && GEMINI_API_KEY) {
      result = await callGemini(systemPrompt, userMsg);
    } else if (CLAUDE_API_KEY) {
      result = await callClaude(systemPrompt, userMsg);
    } else {
      return res.status(500).json({ error: 'No API keys configured on server' });
    }
    res.json(result);
  } catch (err) {
    console.error('enhance-keywords error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ═══════════════════════════════════════════════════════
// ENDPOINT: Mejorar Prompts
// POST /api/enhance-prompt
// ═══════════════════════════════════════════════════════
app.post('/api/enhance-prompt', async (req, res) => {
  const { prompt, ai, systemPrompt: sp, userMsg: um } = req.body;
  const preferredAI = ai || 'gemini';

  const systemPrompt = sp || `Sos un director de fotografía especializado en prompts para IA generativa.
Recibís un prompt en inglés y lo mejorás: de sopa de tags a PROSA NARRATIVA.
Fórmula: [Sujeto] + [Acción/Gesto] + [Entorno] + [Iluminación] + [Estilo]
ELIMINAR: 4k, 8k, hyperrealistic, professional photography, high detail
Respondé SOLO con el prompt mejorado en inglés, sin markdown.`;

  const userContent = um || `Mejorá este prompt:\n\n${prompt}`;

  try {
    let result;
    if (preferredAI === 'gemini' && GEMINI_API_KEY) {
      result = await callGeminiText(systemPrompt, userContent);
    } else if (CLAUDE_API_KEY) {
      result = await callClaudeText(systemPrompt, userContent);
    } else {
      return res.status(500).json({ error: 'No API keys configured on server' });
    }
    res.json({ improved: result });
  } catch (err) {
    console.error('enhance-prompt error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ═══════════════════════════════════════════════════════
// ENDPOINT: Mejorar Diseños
// POST /api/enhance-designs
// ═══════════════════════════════════════════════════════
app.post('/api/enhance-designs', async (req, res) => {
  const { concepto, copy, format, colors, fonts, industry, ai, systemPrompt: sp, userMsg: um } = req.body;
  const preferredAI = ai || 'gemini';

  const systemPrompt = sp || `Sos un director de arte experto en diseño para redes sociales.
Sugerí 3 direcciones creativas para piezas de diseño (SVG) de un posteo de Instagram.
Cada dirección: nombre, layout, paleta, tipografia, elementos, mood.
Respondé SOLO con JSON: {"direcciones": [...]}`;

  const userMsg = um || `Concepto: "${concepto || ''}" Copy: "${copy || ''}" Formato: ${format || ''} Colores: ${colors || ''} Tipografías: ${fonts || ''} Industria: ${industry || ''}`;

  try {
    let result;
    if (preferredAI === 'gemini' && GEMINI_API_KEY) {
      result = await callGemini(systemPrompt, userMsg);
    } else if (CLAUDE_API_KEY) {
      result = await callClaude(systemPrompt, userMsg);
    } else {
      return res.status(500).json({ error: 'No API keys configured on server' });
    }
    res.json(result);
  } catch (err) {
    console.error('enhance-designs error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ═══════════════════════════════════════════════════════
// API WRAPPERS
// ═══════════════════════════════════════════════════════

// Claude — JSON response
async function callClaude(systemPrompt, userMsg) {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': CLAUDE_API_KEY,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1000,
      system: systemPrompt,
      messages: [{ role: 'user', content: userMsg }]
    })
  });
  if (!response.ok) throw new Error(`Claude error: ${response.status}`);
  const data = await response.json();
  const raw = data.content?.[0]?.text || '{}';
  return JSON.parse(raw.replace(/```json|```/g, '').trim());
}

// Claude — Text response
async function callClaudeText(systemPrompt, userMsg) {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': CLAUDE_API_KEY,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 800,
      system: systemPrompt,
      messages: [{ role: 'user', content: userMsg }]
    })
  });
  if (!response.ok) throw new Error(`Claude error: ${response.status}`);
  const data = await response.json();
  return data.content?.[0]?.text?.trim();
}

// Gemini — JSON response
async function callGemini(systemPrompt, userMsg) {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: systemPrompt }] },
        contents: [{ parts: [{ text: userMsg }] }],
        generation_config: { 
          max_output_tokens: 8192,
          response_mime_type: 'application/json',
          thinking_config: { thinking_budget: 0 }
        }
      })
    }
  );
  if (!response.ok) {
    const errBody = await response.text();
    console.error('Gemini raw error:', errBody);
    throw new Error(`Gemini error: ${response.status}`);
  }
  const data = await response.json();
  const raw = data.candidates?.[0]?.content?.parts?.filter(p => p.text)?.map(p => p.text)?.join('') || '{}';
  try {
    return JSON.parse(raw.replace(/```json|```/g, '').trim());
  } catch(e) {
    console.error('Gemini JSON parse error. Raw:', raw.substring(0, 500));
    // Try to extract JSON from partial response
    const match = raw.match(/\{[\s\S]*\}/);
    if (match) {
      try { return JSON.parse(match[0]); } catch {}
      // Try to repair truncated JSON by closing arrays/objects
      let repaired = match[0];
      const openBraces = (repaired.match(/\{/g) || []).length;
      const closeBraces = (repaired.match(/\}/g) || []).length;
      const openBrackets = (repaired.match(/\[/g) || []).length;
      const closeBrackets = (repaired.match(/\]/g) || []).length;
      // Remove last incomplete element
      repaired = repaired.replace(/,\s*[^,}\]]*$/, '');
      for (let i = 0; i < openBrackets - closeBrackets; i++) repaired += ']';
      for (let i = 0; i < openBraces - closeBraces; i++) repaired += '}';
      try { return JSON.parse(repaired); } catch {}
    }
    throw new Error('Gemini devolvió JSON inválido');
  }
}

// Gemini — Text response
async function callGeminiText(systemPrompt, userMsg) {

// Vision call for image analysis
async function callGeminiVision(systemPrompt, parts) {
  const apiKey = process.env.GEMINI_API_KEY;
  const model = 'gemini-2.5-flash';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
  
  // Build parts array for Gemini
  const contentParts = [];
  for (const part of parts) {
    if (part.type === 'text') {
      contentParts.push({ text: part.text });
    } else if (part.type === 'image' && part.data) {
      // Extract base64 data and mime type
      const match = part.data.match(/^data:(image\/\w+);base64,(.+)$/);
      if (match) {
        contentParts.push({
          inline_data: { mime_type: match[1], data: match[2] }
        });
      }
    }
  }
  
  const body = {
    system_instruction: { parts: [{ text: systemPrompt }] },
    contents: [{ parts: contentParts }],
    generationConfig: { temperature: 0.7, maxOutputTokens: 2048 }
  };
  
  const resp = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  
  if (!resp.ok) {
    const errText = await resp.text();
    throw new Error(`Gemini vision error ${resp.status}: ${errText.substring(0, 200)}`);
  }
  
  const data = await resp.json();
  const raw = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
  try {
    return JSON.parse(raw.replace(/```json|```/g, '').trim());
  } catch {
    return { raw };
  }
}
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: systemPrompt }] },
        contents: [{ parts: [{ text: userMsg }] }],
        generation_config: { 
          max_output_tokens: 2048,
          thinking_config: { thinking_budget: 0 }
        }
      })
    }
  );
  if (!response.ok) {
    const errBody = await response.text();
    console.error('Gemini text error:', errBody);
    throw new Error(`Gemini error: ${response.status}`);
  }
  const data = await response.json();
  const text = data.candidates?.[0]?.content?.parts?.filter(p => p.text)?.map(p => p.text)?.join('') || '';
  if (!text) {
    console.error('Gemini returned empty. Full response:', JSON.stringify(data).substring(0, 500));
    throw new Error('Gemini devolvió respuesta vacía');
  }
  return text.trim();
}

// ═══════════════════════════════════════════════════════
// ENDPOINT: Generar piezas SVG con IA
// POST /api/generate-svg
// ═══════════════════════════════════════════════════════
app.post('/api/generate-svg', async (req, res) => {
  const { concepto, copy, format, colors, fonts, industry, pilar, ai } = req.body;
  const preferredAI = ai || 'gemini';

  const systemPrompt = `Sos un diseñador gráfico experto en piezas para Instagram. Generás SVG editorial.

REGLAS ESTRICTAS:
1. Responder SOLO con JSON válido, sin markdown ni \`\`\`
2. Cada SVG: viewBox="0 0 1080 1080" (cuadrado) o "0 0 1080 1440" (vertical)
3. USAR SOLO los colores que te paso (no inventar otros)
4. font-family con las tipografías del usuario
5. SVG corto: máximo 800 caracteres por SVG, sin filtros complejos, sin defs anidadas
6. Cada pieza debe verse profesional y editorial, NO genérica
7. Incluir el concepto/copy en el diseño (puede estar abreviado)
8. Generar EXACTAMENTE 3 piezas distintas

ESTILOS DE PIEZAS:
- "Editorial": tipografía grande, negative space, jerarquía clara
- "Brutalist": contraste alto, formas geométricas, color blocking  
- "Minimal": simple, una idea, mucho aire

NO USAR: imágenes externas, links http, filters complejos, gradients muy elaborados.

Respondé con: {"piezas": [{"name": "Editorial", "svg": "<svg ...>...</svg>"}, ...]}`;

  const userMsg = `Concepto: "${concepto}"
Copy: "${copy}"
Formato: ${format}
Colores de marca: ${colors}
Tipografías: ${fonts}
Industria: ${industry}
Pilar: ${pilar}

Generá 3 piezas SVG distintas en estilo editorial, brutalista y minimal.`;

  try {
    let result;
    if (preferredAI === 'gemini' && GEMINI_API_KEY) {
      result = await callGemini(systemPrompt, userMsg);
    } else if (CLAUDE_API_KEY) {
      result = await callClaude(systemPrompt, userMsg);
    } else {
      return res.status(500).json({ error: 'No API keys configured' });
    }
    res.json(result);
  } catch (err) {
    console.error('generate-svg error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─── DESCRIBE IMAGE (for Asset Finder reverse search) ───
app.post('/api/describe-image', async (req, res) => {
  try {
    const { image, mimeType } = req.body;
    if (!image) return res.status(400).json({ error: 'No image provided' });
    if (!GEMINI_API_KEY) return res.status(500).json({ error: 'Gemini API key not configured' });

    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          generationConfig: { temperature: 0.3, maxOutputTokens: 200, thinking_config: { thinking_budget: 0 } },
          contents: [{
            parts: [
              { inlineData: { mimeType: mimeType || 'image/jpeg', data: image } },
              { text: 'Describe this image in 3-6 English keywords for stock photo search. Focus on: subject, action, setting, lighting, mood. Return ONLY the keywords separated by spaces, nothing else. Example: "woman laptop cafe warm natural light candid"' }
            ]
          }]
        })
      }
    );

    if (!geminiRes.ok) {
      const errText = await geminiRes.text();
      console.error('Gemini describe error:', errText);
      return res.status(500).json({ error: 'Gemini API error' });
    }

    const data = await geminiRes.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    // Clean up: remove quotes, punctuation, limit to 8 words
    const keywords = text.replace(/["'.,;:!?]/g, '').trim().split(/\s+/).slice(0, 8).join(' ');

    res.json({ keywords });
  } catch (err) {
    console.error('Describe image error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─── PINTEREST → PROMPT ───
app.post('/api/pinterest-prompt', async (req, res) => {
  try {
    const { image, mimeType, mode, modeInstruction, clientContext } = req.body;
    if (!image) return res.status(400).json({ error: 'No image' });
    if (!GEMINI_API_KEY) return res.status(500).json({ error: 'Gemini key missing' });

    const systemPrompt = `You are an expert art director and visual strategist for social media design.

Analyze this reference image in detail, then generate a prompt based on the requested mode.

FIRST, provide a brief analysis (2-3 sentences) describing: composition, lighting, color palette, mood, typography style if visible, and overall aesthetic.

SECOND, extract the 5 dominant colors as hex codes.

THIRD, generate the prompt according to this instruction: ${modeInstruction || 'Recreate faithfully'}
${clientContext || ''}

Respond in this exact JSON format (no markdown, no backticks):
{"analysis":"your analysis here","colors":["#hex1","#hex2","#hex3","#hex4","#hex5"],"prompt":"your detailed prompt here, written in English, suitable for image generation AI"}`;

    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          generationConfig: { temperature: 0.7, maxOutputTokens: 2048, thinking_config: { thinking_budget: 0 } },
          contents: [{
            parts: [
              { inlineData: { mimeType: mimeType || 'image/jpeg', data: image } },
              { text: systemPrompt }
            ]
          }]
        })
      }
    );

    if (!geminiRes.ok) {
      const errText = await geminiRes.text();
      console.error('Gemini pinterest error:', errText);
      return res.status(500).json({ error: 'Gemini API error' });
    }

    const data = await geminiRes.json();
    let text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    
    // Clean and parse JSON
    text = text.replace(/```json|```/g, '').trim();
    try {
      const parsed = JSON.parse(text);
      res.json(parsed);
    } catch {
      // Fallback: return raw text as prompt
      res.json({ analysis: '', colors: [], prompt: text });
    }
  } catch (err) {
    console.error('Pinterest prompt error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─── START SERVER ───
// ═══ GENERATE CAPTIONS ═══
app.post('/api/generate-captions', async (req, res) => {
  try {
    const { copy, client, tone, pilar } = req.body;
    if (!copy) return res.status(400).json({ error: 'Missing copy' });
    
    const systemPrompt = `Sos un community manager experto en Instagram para marcas argentinas. 
Generá 3 variantes de caption para un posteo de Instagram.

REGLAS:
- Escribí en español argentino (vos, usá, etc)
- Cada caption debe tener entre 2 y 5 líneas
- Incluí emojis relevantes pero sin abusar
- Variante 1: directa y concisa
- Variante 2: más storytelling / emocional
- Variante 3: con pregunta o CTA fuerte
- Agregá 15-20 hashtags relevantes al final (compartidos entre las 3)
- Tono: ${tone || 'profesional'}

Respondé SOLO en JSON con esta estructura exacta:
{
  "captions": [
    { "label": "Directa", "text": "..." },
    { "label": "Storytelling", "text": "..." },
    { "label": "CTA fuerte", "text": "..." }
  ],
  "hashtags": ["#tag1", "#tag2", "..."]
}`;
    
    const userMsg = `Cliente: ${client || 'Sin especificar'}
Pilar: ${pilar || 'General'}
Bajada del post: ${copy}`;
    
    const result = await callGemini(systemPrompt, userMsg);
    res.json(result);
  } catch (e) {
    console.error('generate-captions error:', e);
    res.status(500).json({ error: e.message });
  }
});

// ═══ STYLE MATCH ═══
app.post('/api/style-match', async (req, res) => {
  try {
    const { image1, image2 } = req.body;
    if (!image1 || !image2) return res.status(400).json({ error: 'Need 2 images' });
    
    const systemPrompt = `Sos un director de arte que analiza estilos visuales.
Compará las 2 imágenes y describí:
1. Qué elementos visuales comparten (luz, paleta, composición, mood)
2. Qué las diferencia
3. Un "estilo puente" que combine lo mejor de ambas
4. Keywords de búsqueda para encontrar imágenes con ese estilo combinado

Respondé SOLO en JSON:
{
  "shared": ["elemento1", "elemento2", ...],
  "differences": ["diff1", "diff2", ...],
  "bridge_style": "descripción del estilo puente",
  "keywords": ["kw1", "kw2", ...]
}`;

    const userMsg = [
      { type: 'text', text: 'Compará estas 2 imágenes:' },
      { type: 'image', data: image1 },
      { type: 'image', data: image2 }
    ];
    
    // Use vision endpoint
    const result = await callGeminiVision(systemPrompt, userMsg);
    res.json(result);
  } catch (e) {
    console.error('style-match error:', e);
    res.status(500).json({ error: e.message });
  }
});

app.listen(PORT, () => {
  console.log(`PDP Visual Studio API Proxy | Port: ${PORT} | Claude: ${CLAUDE_API_KEY ? 'OK' : 'missing'} | Gemini: ${GEMINI_API_KEY ? 'OK' : 'missing'}`);
});
