// api/chat.js
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { message } = req.body;
  const apiKey = process.env.GEMINI_API_KEY?.trim();

  if (!apiKey) {
    return res.status(500).json({ error: 'Gemini API key is missing in Vercel settings.' });
  }

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: message }] }]
        })
      }
    );

    const data = await response.json();

    // Agar Google API ne koi error bheja ho
    if (data.error) {
      return res.status(400).json({ error: `Google API Error: ${data.error.message || JSON.stringify(data.error)}` });
    }

    if (data.candidates && data.candidates[0]?.content?.parts[0]?.text) {
      const reply = data.candidates[0].content.parts[0].text;
      return res.status(200).json({ reply });
    } else {
      return res.status(500).json({ error: `Empty response: ${JSON.stringify(data)}` });
    }
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error while connecting to Google AI.' });
  }
}
