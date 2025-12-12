import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const url = searchParams.get("url");

  if (!url) {
    return NextResponse.json({ error: "Missing URL" }, { status: 400 });
  }

  const api = `https://www.youtube.com/oembed?url=${url}&format=json`;

  try {
    const res = await fetch(api, { next: { revalidate: 0 } });

    if (!res.ok) {
      return NextResponse.json({ error: "YouTube returned error" }, { status: res.status });
    }

    const data = await res.json();
    return NextResponse.json(data);

  } catch (error) {
    return NextResponse.json({ error: "Failed to fetch metadata" }, { status: 500 });
  }
}
