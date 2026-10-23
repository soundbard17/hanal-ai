// api/chat.js
export const config = {
  runtime: 'edge', // Edge runtime se response bina latency ke turant stream hota hai
};

export default async function handler(req) {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 });
  }

  try {
    const { message } = await req.json();
    const apiKey = (process.env.GEMINI_API_KEY || '').trim();

    if (!apiKey) {
      return new Response(JSON.stringify({ error: 'Gemini API key missing' }), { status: 500 });
    }

    const googleUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:streamGenerateContent?alt=sse&key=${apiKey}`;

    const geminiRes = await fetch(googleUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: message }] }]
      })
    });

    if (!geminiRes.ok) {
      const errText = await geminiRes.text();
      return new Response(JSON.stringify({ error: `Google API Error: ${errText}` }), { status: 400 });
    }

    // Transform stream: Google ke SSE data se text nikaal kar direct browser ko bhejte rehna
    const encoder = new TextEncoder();
    const decoder = new TextDecoder();

    const stream = new ReadableStream({
      async start(controller) {
        const reader = geminiRes.body.getReader();
        let buffer = '';

        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop(); // Adhura chunk save rakho

            for (const line of lines) {
              const trimmed = line.trim();
              if (trimmed.startsWith('data: ')) {
                const jsonStr = trimmed.replace('data: ', '').trim();
                if (jsonStr) {
                  try {
                    const parsed = JSON.parse(jsonStr);
                    const chunk = parsed.candidates?.[0]?.content?.parts?.[0]?.text || '';
                    if (chunk) {
                      controller.enqueue(encoder.encode(chunk));
                    }
                  } catch (e) {
                    // Ignore malformed partial chunks
                  }
                }
              }
            }
          }
        } catch (err) {
          controller.error(err);
        } finally {
          controller.close();
        }
      }
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      }
    });

  } catch (err) {
    return new Response(JSON.stringify({ error: 'Server error: ' + err.message }), { status: 500 });
  }
}
