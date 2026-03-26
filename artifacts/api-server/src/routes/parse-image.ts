import { Router, type IRouter } from "express";
import { openai } from "@workspace/integrations-openai-ai-server";
import { ParseTicketImageBody } from "@workspace/api-zod";

const router: IRouter = Router();

const SYSTEM_PROMPT = `You are a project management assistant. The user will show you a screenshot of a request or conversation (email, Teams message, chat, etc.).

Extract the following ticket fields from the image and respond ONLY with a valid JSON object (no markdown, no code blocks):

{
  "title": "short descriptive title of the work request (max 80 chars)",
  "description": "detailed description of what is being requested",
  "submitter": "name of the person making the request (null if not found)",
  "state": "US state name if mentioned (e.g. Virginia, North Carolina, Texas) — null if not found",
  "category": "best matching category from: Power Automate, ArcGIS, CRM, Dashboard, Data Analysis, SharePoint, Power BI, Other",
  "confidence": "brief note like 'high' or 'low - no state found' to indicate how confident you are"
}

Rules:
- title: create a concise action-oriented title even if none is explicitly given
- description: capture all relevant details from the message/screenshot
- submitter: look for a sender name, signature, or "from" field
- state: only include a US state if clearly mentioned; otherwise null
- category: infer from the work being requested (dashboards→Dashboard, maps/GIS→ArcGIS, automation→Power Automate, etc.)
- Always return all fields; use null for fields you cannot determine
- Return ONLY the JSON — no other text`;

router.post("/tickets/parse-image", async (req, res) => {
  try {
    const parsed = ParseTicketImageBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "imageBase64 is required" });
      return;
    }

    const { imageBase64, mimeType } = parsed.data;

    // Strip data URI prefix if present, get clean base64
    const base64Data = imageBase64.includes(",")
      ? imageBase64.split(",")[1]
      : imageBase64;

    const imageMimeType = mimeType ?? "image/png";
    const dataUrl = `data:${imageMimeType};base64,${base64Data}`;

    const response = await openai.chat.completions.create({
      model: "gpt-5.2",
      max_completion_tokens: 1024,
      messages: [
        {
          role: "system",
          content: SYSTEM_PROMPT,
        },
        {
          role: "user",
          content: [
            {
              type: "image_url",
              image_url: { url: dataUrl, detail: "high" },
            },
            {
              type: "text",
              text: "Please extract the ticket fields from this screenshot.",
            },
          ],
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
      confidence: extracted.confidence ?? null,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to parse ticket image");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
