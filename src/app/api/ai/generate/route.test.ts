import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { NextRequest } from 'next/server';
import { POST } from './route';

// Mock fetch globally
global.fetch = jest.fn();

describe('/api/ai/generate', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset fetch mock
    (global.fetch as jest.Mock).mockReset();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should return mock response when AI service is unavailable', async () => {
    // Mock fetch to simulate service unavailable
    (global.fetch as jest.Mock).mockRejectedValue(new Error('Connection refused'));

    const request = new NextRequest('http://localhost:3000/api/ai/generate', {
      method: 'POST',
      body: JSON.stringify({
        prompt: 'Test prompt',
        template_name: 'base',
        variables: {}
      }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.response).toBe('AI service not running (mock)');
    expect(data.metadata.offline).toBe(true);
    expect(data.metadata.prompt).toBe('Test prompt');
  });

  it('should proxy to AI service when available', async () => {
    // Mock successful AI service response
    const mockServiceResponse = {
      success: true,
      response: 'Generated response from AI',
      metadata: { processing_time: 0.5 },
      confidence_score: 0.95
    };

    (global.fetch as jest.Mock).mockResolvedValue({
      status: 200,
      json: async () => mockServiceResponse
    });

    const request = new NextRequest('http://localhost:3000/api/ai/generate', {
      method: 'POST',
      body: JSON.stringify({
        prompt: 'Test prompt',
        template_name: 'base'
      }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.response).toBe('Generated response from AI');
    expect(data.metadata.processing_time).toBe(0.5);
    expect(data.confidence_score).toBe(0.95);
  });

  it('should handle timeout and return mock response', async () => {
    // Mock fetch to simulate timeout
    (global.fetch as jest.Mock).mockImplementation(() => 
      new Promise((_, reject) => {
        setTimeout(() => reject(new Error('AbortError')), 100);
      })
    );

    const request = new NextRequest('http://localhost:3000/api/ai/generate', {
      method: 'POST',
      body: JSON.stringify({
        prompt: 'Test timeout'
      }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.response).toBe('AI service not running (mock)');
    expect(data.metadata.offline).toBe(true);
  });

  it('should handle invalid request body', async () => {
    const request = new NextRequest('http://localhost:3000/api/ai/generate', {
      method: 'POST',
      body: 'invalid json',
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.success).toBe(false);
    expect(data.error).toBe('Invalid request');
    expect(data.metadata.offline).toBe(true);
  });

  it('should pass through AI service error status codes', async () => {
    // Mock AI service error response
    (global.fetch as jest.Mock).mockResolvedValue({
      status: 429,
      json: async () => ({
        success: false,
        error: 'Rate limit exceeded'
      })
    });

    const request = new NextRequest('http://localhost:3000/api/ai/generate', {
      method: 'POST',
      body: JSON.stringify({
        prompt: 'Test error handling'
      }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(429);
    expect(data.success).toBe(false);
    expect(data.error).toBe('Rate limit exceeded');
  });

  it('should use AI_SERVICE_URL environment variable when set', async () => {
    const customUrl = 'http://custom-ai-service:8080';
    process.env.AI_SERVICE_URL = customUrl;

    (global.fetch as jest.Mock).mockResolvedValue({
      status: 200,
      json: async () => ({ success: true })
    });

    const request = new NextRequest('http://localhost:3000/api/ai/generate', {
      method: 'POST',
      body: JSON.stringify({ prompt: 'Test' }),
    });

    await POST(request);

    expect(global.fetch).toHaveBeenCalledWith(
      `${customUrl}/generate`,
      expect.objectContaining({
        method: 'POST',
        headers: { 'content-type': 'application/json' }
      })
    );

    // Clean up
    delete process.env.AI_SERVICE_URL;
  });
});