import { NextRequest, NextResponse } from "next/server";
import { transcribeHandwriting } from "@/lib/ai/gemini";
import { transcribeWorkSchema } from "@/lib/validation";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const parsed = transcribeWorkSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  const { imageBase64, mimeType, problemPromptText } = parsed.data;

  const result = await transcribeHandwriting({ imageBase64, mimeType, problemPromptText });

  if (!result.attempted) {
    return NextResponse.json(
      { transcript: null, message: "Reading photos needs a Gemini API key — type your work instead, or add a key in .env." },
      { status: 200 }
    );
  }
  if (!result.transcript) {
    return NextResponse.json(
      { transcript: null, message: "Couldn't read that clearly — try a clearer photo, or type it instead." },
      { status: 200 }
    );
  }
  return NextResponse.json({ transcript: result.transcript, message: null });
}
