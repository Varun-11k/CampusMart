const AI_ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent'

async function generateContent({ instructions, input, maxOutputTokens, json = false }) {
    const apiKey = process.env.GEMINI_API_KEY
    if (!apiKey) throw new Error('Gemini API key is not configured')

    const response = await fetch(AI_ENDPOINT, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'x-goog-api-key': apiKey,
        },
        signal: AbortSignal.timeout(15000),
        body: JSON.stringify({
            systemInstruction: { parts: [{ text: instructions }] },
            contents: [{ role: 'user', parts: [{ text: input }] }],
            generationConfig: {
                maxOutputTokens,
                ...(json ? { responseMimeType: 'application/json' } : {}),
            },
        }),
    })

    return response
}

function extractText(payload) {
    return (payload?.candidates?.[0]?.content?.parts || [])
        .map((part) => typeof part.text === 'string' ? part.text : '')
        .join('\n')
        .trim()
}

module.exports = { generateContent, extractText }
