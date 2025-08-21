import { NextRequest, NextResponse } from 'next/server';
import { runHealthCheck, type HealthScore } from '@/utils/health/scoring';

// Force dynamic rendering for runtime health checks
export const dynamic = 'force-dynamic';

export async function GET(_request: NextRequest) {
  try {
    // Run the health check
    const healthScore = await runHealthCheck();
    
    // Determine status code based on score
    const statusCode = healthScore.overall >= 70 ? 200 : 
                       healthScore.overall >= 50 ? 206 : 500;
    
    return NextResponse.json({
      success: true,
      health: healthScore,
      status: getHealthStatus(healthScore.overall),
      summary: generateSummary(healthScore)
    }, { status: statusCode });
  } catch (error) {
    console.error('Health check failed:', error);
    return NextResponse.json({
      success: false,
      error: 'Health check failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

function getHealthStatus(score: number) {
  if (score >= 90) return { emoji: '🟢', label: 'Excellent', color: 'green' };
  if (score >= 70) return { emoji: '🟡', label: 'Good', color: 'yellow' };
  if (score >= 50) return { emoji: '🟠', label: 'Fair', color: 'orange' };
  return { emoji: '🔴', label: 'Critical', color: 'red' };
}

function generateSummary(health: HealthScore) {
  const criticalIssues = health.issues.filter((i) => i.severity === 'critical');
  const majorIssues = health.issues.filter((i) => i.severity === 'major');
  
  return {
    overall: `Project health is ${getHealthStatus(health.overall).label.toLowerCase()} at ${health.overall}/100`,
    critical: criticalIssues.length,
    major: majorIssues.length,
    topIssue: health.issues[0]?.description || 'No issues found',
    recommendation: getTopRecommendation(health)
  };
}

function getTopRecommendation(health: HealthScore) {
  if (health.overall >= 90) {
    return 'Excellent work! Keep maintaining high standards.';
  }
  
  // Find lowest scoring category
  const categories = Object.entries(health.breakdown);
  const [lowestCategory] = categories.sort(([,a], [,b]) => (a as number) - (b as number));
  
  const recommendations: Record<string, string> = {
    maintainability: 'Focus on improving test coverage and reducing code complexity',
    reliability: 'Add error boundaries and improve error handling',
    performance: 'Optimize bundle size and improve load times',
    security: 'Update dependencies and scan for vulnerabilities',
    accessibility: 'Fix color contrast issues and improve keyboard navigation',
    dx: 'Improve documentation and developer tooling'
  };
  
  return recommendations[lowestCategory[0]] || 'Review health report for detailed recommendations';
}