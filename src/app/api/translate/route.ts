import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const { text } = await req.json();

  // Replace with OpenAI call
  const translated = `Translated Version:\n\n${text}`;

  return NextResponse.json({ translated });
}