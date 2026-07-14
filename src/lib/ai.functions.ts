import { createServerFn } from "@tanstack/react-start";
import { generateText } from "ai";
import { z } from "zod";

const TranslateInput = z.object({
  text: z.string().trim().min(1).max(2000),
  targetLang: z.string().trim().min(2).max(10),
});

export const translateText = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => TranslateInput.parse(input))
  .handler(async ({ data }) => {
    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("Missing LOVABLE_API_KEY");

    const { createLovableGateway } = await import("./ai-gateway.server");
    const gateway = createLovableGateway(key);

    const result = await generateText({
      model: gateway("google/gemini-2.5-flash"),
      messages: [
        {
          role: "system",
          content:
            "You are a translator. Translate the user's text to the requested BCP-47 target language. Preserve @mentions (like @ABC123), #hashtags and URLs exactly. Return ONLY the translated text, no quotes, no notes.",
        },
        {
          role: "user",
          content: `Target language: ${data.targetLang}\n\nText:\n${data.text}`,
        },
      ],
    });

    return { text: result.text.trim() };
  });
