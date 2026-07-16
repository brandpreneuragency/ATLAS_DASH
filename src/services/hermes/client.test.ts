import { describe, expect, it } from 'vitest';
import { parseGatewayFrame, wsUrlFor } from './client';

describe('wsUrlFor', () => {
  it('builds a same-origin ws url from a relative path', () => {
    expect(wsUrlFor('/hermes/api/ws', 'https://tabs.brandpreneur.net/')).toBe(
      'wss://tabs.brandpreneur.net/hermes/api/ws',
    );
  });
  it('uses ws for http origins', () => {
    expect(wsUrlFor('/hermes/api/events', 'http://localhost:5173/')).toBe(
      'ws://localhost:5173/hermes/api/events',
    );
  });
});

describe('parseGatewayFrame', () => {
  it('unwraps JSON-RPC event envelopes from /api/ws', () => {
    const ev = parseGatewayFrame(
      JSON.stringify({
        method: 'event',
        params: {
          type: 'message.delta',
          session_id: 's1',
          payload: { text: 'hi' },
        },
      }),
    );
    expect(ev).toEqual({
      type: 'message.delta',
      session_id: 's1',
      payload: { text: 'hi' },
    });
  });

  it('passes through bare gateway events from /api/events', () => {
    const ev = parseGatewayFrame(
      JSON.stringify({ type: 'approval.request', payload: { command: 'rm -rf /' } }),
    );
    expect(ev?.type).toBe('approval.request');
  });

  it('returns null for non-event JSON-RPC responses', () => {
    expect(parseGatewayFrame(JSON.stringify({ jsonrpc: '2.0', id: 1, result: {} }))).toBeNull();
  });

  it('returns null for non-JSON', () => {
    expect(parseGatewayFrame('not-json')).toBeNull();
  });
});
