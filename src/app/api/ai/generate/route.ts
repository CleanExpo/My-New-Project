import { NextRequest, NextResponse } from "next/server";

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const url = process.env.AI_SERVICE_URL ?? "http://localhost:5051";
    
    // Attempt to connect to AI service with timeout
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000); // 5s timeout
    
    try {
      const r = await fetch(`${url}/generate`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      clearTimeout(timeout);
      
      const j = await r.json();
      return NextResponse.json(j, { status: r.status });
    } catch (fetchError) {
      // Service unavailable - return mock response
      clearTimeout(timeout);
      console.log("AI service unavailable, returning mock response");
      
      return NextResponse.json({
        success: true,
        response: "AI service not running (mock)",
        metadata: { 
          offline: true,
          timestamp: new Date().toISOString(),
          prompt: body.prompt || "No prompt provided"
        },
        confidence_score: null,
        reasoning_chain: null,
        localized_elements: null
      }, { status: 200 });
    }
  } catch (error) {
    // Request parsing error
    console.error("API route error:", error);
    return NextResponse.json({
      success: false,
      error: "Invalid request",
      metadata: { offline: true }
    }, { status: 400 });
  }
}