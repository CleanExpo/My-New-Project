import { NextRequest, NextResponse } from 'next/server';
import { featureFlags } from '@/config';

export const dynamic = 'force-dynamic';

const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://localhost:5051';

export async function POST(
  request: NextRequest,
  { params }: { params: { tool: string } }
) {
  // Check if AI orchestrator feature is enabled
  if (!featureFlags.isEnabled('aiOrchestrator')) {
    return NextResponse.json(
      { error: 'AI Orchestrator feature is not enabled' },
      { status: 403 }
    );
  }

  try {
    const body = await request.json();
    const { tool } = params;

    // Forward request to AI orchestrator service
    const response = await fetch(`${AI_SERVICE_URL}/tools/${tool}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const error = await response.text();
      return NextResponse.json(
        { error: `Tool execution error: ${error}` },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);

  } catch (error) {
    console.error('Tool execution error:', error);
    return NextResponse.json(
      { error: 'Failed to execute tool' },
      { status: 500 }
    );
  }
}