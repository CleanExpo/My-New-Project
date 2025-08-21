import { NextRequest, NextResponse } from 'next/server';
import { featureFlags } from '@/config/flags';

// Force dynamic rendering for runtime health checks
export const dynamic = 'force-dynamic';

const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://localhost:5051';

export async function GET(_request: NextRequest) {
  // Check if AI orchestrator feature is enabled
  if (!featureFlags.isEnabled('aiOrchestrator')) {
    return NextResponse.json(
      { 
        status: 'disabled',
        message: 'AI Orchestrator feature is not enabled' 
      },
      { status: 200 }
    );
  }

  try {
    // Check AI service health
    const response = await fetch(`${AI_SERVICE_URL}/health`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      return NextResponse.json(
        { 
          status: 'unhealthy',
          error: `AI service returned status ${response.status}` 
        },
        { status: 503 }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);

  } catch (error) {
    console.error('AI health check error:', error);
    return NextResponse.json(
      { 
        status: 'unreachable',
        error: 'Failed to connect to AI service' 
      },
      { status: 503 }
    );
  }
}