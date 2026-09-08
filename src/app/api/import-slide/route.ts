import { NextResponse } from 'next/server';

// Converts one rasterized deck page into a Presenta slide by asking Gemini's
// vision model to look at the page image and map its content onto our
// existing layout/style/fields schema — this is the whole "import" trick:
// we don't reconstruct arbitrary layouts, we fit content into the layouts
// Presenta already knows how to render.

const LAYOUTS = ['blank', 'title-only', 'title-content', 'title-stats', 'two-content', 'title-slide', 'merge-diagram', 'stat-hero'];
const STYLES = ['standard', 'section-starter', 'company', 'design'];

const RESPONSE_SCHEMA = {
  type: 'OBJECT',
  properties: {
    layout: { type: 'STRING', enum: LAYOUTS },
    style: { type: 'STRING', enum: STYLES },
    kickerEyebrow: { type: 'STRING' },
    kickerLabel: { type: 'STRING' },
    title: { type: 'STRING' },
    body: { type: 'STRING' },
    leftColumn: { type: 'STRING' },
    rightColumn: { type: 'STRING' },
    subtitle: { type: 'STRING' },
    stats: {
      type: 'ARRAY',
      items: { type: 'OBJECT', properties: { value: { type: 'STRING' }, label: { type: 'STRING' } }, required: ['value', 'label'] },
    },
    items: {
      type: 'ARRAY',
      items: { type: 'OBJECT', properties: { label: { type: 'STRING' } }, required: ['label'] },
    },
    result: { type: 'STRING' },
    statValue: { type: 'STRING' },
    statLabel: { type: 'STRING' },
    caption: { type: 'STRING' },
  },
  required: ['layout', 'style'],
};

const PROMPT = `You are converting one page of an uploaded presentation (PDF/PPTX export) into a structured slide for a presentation tool called Presenta.

Look at the page image and:
1. Pick the ONE layout from this list that best matches the page's structure: ${LAYOUTS.join(', ')}.
   - "title-slide": a cover/section page with a big title and subtitle, little else.
   - "title-content": a title with one paragraph of body text.
   - "title-stats": a title with 2-4 numeric callouts (stats).
   - "two-content": a title with two side-by-side text columns.
   - "merge-diagram": a title with a short list of input items funneling into one result/outcome.
   - "stat-hero": one huge number/stat as the main focus, with a caption.
   - "title-only": just a title/kicker, minimal other content.
   - "blank": no meaningful text content (an image-only or decorative page).
2. Pick ONE style from: ${STYLES.join(', ')} — "section-starter" for a divider/section-break page, "company" for an about/overview page with stats, "design" for an image-forward page, "standard" otherwise.
3. Extract the actual visible text into the matching fields. Keep it concise — summarize long paragraphs rather than transcribing verbatim. Do not invent content that isn't on the page. Only populate fields relevant to the chosen layout.`;

export async function POST(request: Request) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'GEMINI_API_KEY is not configured on the server.' }, { status: 500 });
  }

  const { imageBase64 } = await request.json();
  if (!imageBase64) {
    return NextResponse.json({ error: 'imageBase64 is required.' }, { status: 400 });
  }

  const requestBody = JSON.stringify({
    contents: [
      {
        parts: [{ text: PROMPT }, { inline_data: { mime_type: 'image/png', data: imageBase64 } }],
      },
    ],
    generationConfig: {
      responseMimeType: 'application/json',
      responseSchema: RESPONSE_SCHEMA,
    },
  });

  // Gemini's free tier intermittently returns 503 "model is experiencing high
  // demand" — Google's own error message says this is transient, so retry
  // with backoff instead of failing the whole page immediately.
  let geminiRes: Response | null = null;
  let lastErrText = '';
  for (let attempt = 0; attempt < 4; attempt++) {
    if (attempt > 0) await new Promise((r) => setTimeout(r, 1000 * 2 ** (attempt - 1)));
    geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=${apiKey}`,
      { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: requestBody }
    );
    if (geminiRes.ok) break;
    lastErrText = await geminiRes.text();
    if (geminiRes.status !== 503) break;
  }

  if (!geminiRes || !geminiRes.ok) {
    console.error('Gemini import request failed:', geminiRes?.status, lastErrText);
    return NextResponse.json({ error: `Gemini request failed (${geminiRes?.status})` }, { status: 502 });
  }

  const data = await geminiRes.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) {
    console.error('Gemini import: no text in response', JSON.stringify(data).slice(0, 500));
    return NextResponse.json({ error: 'Gemini returned no content.' }, { status: 502 });
  }

  try {
    const parsed = JSON.parse(text);
    return NextResponse.json(parsed);
  } catch (err) {
    console.error('Gemini import: failed to parse JSON', text.slice(0, 500), err);
    return NextResponse.json({ error: 'Could not parse Gemini response as JSON.' }, { status: 502 });
  }
}
