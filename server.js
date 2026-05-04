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
  const systemPrompt = sp || `Sos un director de arte especializado en búsqueda de imágenes para redes sociales. 
Recibís keywords de búsqueda para bancos de imágenes (Shutterstock, Getty, Unsplash) y los mejorás.
REGLAS: 1. Siempre en inglés 2. NUNCA copiar la bajada 3. Combinar: Concepto + Acción + Contexto 4. Agregar estética 5. Prosa narrativa
Respondé SOLO con JSON: {"mejorados": ["keyword1",...,"keyword12"], "razon": "..."}`;

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
  const { prompt, ai } = req.body;
  const preferredAI = ai || 'gemini';

  const systemPrompt = `Sos un director de fotografía especializado en prompts para IA generativa.
Recibís un prompt en inglés y lo mejorás: de sopa de tags a PROSA NARRATIVA.
Fórmula: [Sujeto] + [Acción/Gesto] + [Entorno] + [Iluminación] + [Estilo]
ELIMINAR: 4k, 8k, hyperrealistic, professional photography, high detail
Respondé SOLO con el prompt mejorado en inglés, sin markdown.`;

  try {
    let result;
    if (preferredAI === 'gemini' && GEMINI_API_KEY) {
      result = await callGeminiText(systemPrompt, `Mejorá este prompt:\n\n${prompt}`);
    } else if (CLAUDE_API_KEY) {
      result = await callClaudeText(systemPrompt, `Mejorá este prompt:\n\n${prompt}`);
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
        system_instruction: { parts: { text: systemPrompt } },
        contents: { parts: [{ text: userMsg }] },
        generation_config: { max_output_tokens: 1000, response_mime_type: 'application/json' }
      })
    }
  );
  if (!response.ok) throw new Error(`Gemini error: ${response.status}`);
  const data = await response.json();
  const raw = data.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
  return JSON.parse(raw.replace(/```json|```/g, '').trim());
}

// Gemini — Text response
async function callGeminiText(systemPrompt, userMsg) {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        system_instruction: { parts: { text: systemPrompt } },
        contents: { parts: [{ text: userMsg }] },
        generation_config: { max_output_tokens: 800 }
      })
    }
  );
  if (!response.ok) throw new Error(`Gemini error: ${response.status}`);
  const data = await response.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
}

// ─── START SERVER ───
app.listen(PORT, () => {
  console.log(`
╔══════════════════════════════════════════════╗
║  PDP Visual Studio — API Proxy              ║
║  Puerto: ${PORT}                               ║
║  Claude: ${CLAUDE_API_KEY ? '✓ configurado' : '✗ falta CLAUDE_API_KEY'}          ║
║  Gemini: ${GEMINI_API_KEY ? '✓ configurado' : '✗ falta GEMINI_API_KEY'}          ║
╚══════════════════════════════════════════════╝
  `);
});
