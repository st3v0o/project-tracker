import { Router, type IRouter } from "express";
import { openai } from "@workspace/integrations-openai-ai-server";
import { Buffer } from "node:buffer";

const router: IRouter = Router();

const SYSTEM_PROMPT = `You are a project management assistant. The user will provide a voice transcription describing a work request.

Extract the following ticket fields and respond ONLY with a valid JSON object (no markdown, no code blocks):

{
  "title": "short descriptive title of the work request (max 80 chars)",
  "description": "detailed description of what is being requested",
  "submitter": "name of the person making the request (null if not mentioned)",
  "state": "US state name if mentioned (e.g. Virginia, North Carolina, Texas) — null if not found",
  "category": "best matching category from: Power Automate, ArcGIS, CRM, Dashboard, Database, Excel, SharePoint, Teams, Power BI, Python, JavaScript, General IT, Other",
  "confidence": "brief note like 'high' or 'low - no state mentioned'"
}

Rules:
- title: create a concise action-oriented title
- description: capture all relevant details from the transcription
- submitter: look for any name mentioned as the requester
- state: only include a US state if clearly mentioned; otherwise null
- category: infer from the work being requested
- Always return all fields; use null for fields you cannot determine
- Return ONLY the JSON — no other text`;

router.post("/tickets/parse-voice", async (req, res) => {
  try {
    const { audioBase64, mimeType } = req.body as { audioBase64?: string; mimeType?: string };

    if (!audioBase64 || typeof audioBase64 !== "string" || audioBase64.length === 0) {
      res.status(400).json({ error: "audioBase64 is required" });
      return;
    }

    // Determine file extension from mimeType
    const ext = mimeType?.includes("webm")
      ? "webm"
      : mimeType?.includes("mp3")
        ? "mp3"
        : mimeType?.includes("wav")
          ? "wav"
          : mimeType?.includes("ogg")
            ? "ogg"
            : "m4a";

    // Decode base64 to buffer, then to a File (Node 20+ global)
    const audioBuffer = Buffer.from(audioBase64, "base64");
    const audioFile = new File([audioBuffer], `audio.${ext}`, {
      type: mimeType ?? `audio/${ext}`,
    });

    // Transcribe with Whisper
    const transcription = await openai.audio.transcriptions.create({
      file: audioFile,
      model: "whisper-1",
    });

    const transcript = transcription.text?.trim();
    if (!transcript) {
      res.status(400).json({ error: "No speech detected in the audio" });
      return;
    }

    req.log.info({ transcript }, "Voice transcription completed");

    // Extract ticket fields from transcript with GPT
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      max_completion_tokens: 512,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content: `Voice transcription:\n\n"${transcript}"\n\nPlease extract the ticket fields.`,
        },
      ],
    });

    const content = response.choices[0]?.message?.content ?? "{}";

    let extracted: {
      title?: string | null;
      description?: string | null;
      submitter?: string | null;
      state?: string | null;
      category?: string | null;
      confidence?: string | null;
    };

    try {
      extracted = JSON.parse(content);
    } catch {
      req.log.error({ content }, "Failed to parse OpenAI JSON response");
      res.status(500).json({ error: "Failed to parse AI response" });
      return;
    }

    res.json({
      title: extracted.title ?? null,
      description: extracted.description ?? null,
      submitter: extracted.submitter ?? null,
      state: extracted.state ?? null,
      category: extracted.category ?? null,
      confidence: `Voice: ${extracted.confidence ?? "parsed"}`,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to parse ticket voice");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
