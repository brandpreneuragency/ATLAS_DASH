// src/stores/hermesStore.test.ts — fixture events from hermes/types.ts (Task 7).
import { describe, expect, it } from 'vitest';
import { reduceGatewayEvent, type HermesChatReducerState } from './hermesStore';
import type {
  HermesErrorEvent,
  HermesMessageCompleteEvent,
  HermesMessageDeltaEvent,
  HermesMessageStartEvent,
} from '../services/hermes/types';

const empty = (): HermesChatReducerState => ({ messages: [], pending: '' });

describe('reduceGatewayEvent', () => {
  it('appends streamed delta text to the pending assistant message', () => {
    const s0 = empty();
    const start: HermesMessageStartEvent = { type: 'message.start', session_id: 's1' };
    const sStart = reduceGatewayEvent(s0, start);

    const d1: HermesMessageDeltaEvent = {
      type: 'message.delta',
      session_id: 's1',
      payload: { text: 'Hel' },
    };
    const d2: HermesMessageDeltaEvent = {
      type: 'message.delta',
      session_id: 's1',
      payload: { text: 'lo' },
    };
    const s1 = reduceGatewayEvent(sStart, d1);
    const s2 = reduceGatewayEvent(s1, d2);
    expect(s2.pending.length).toBeGreaterThan(0);
    expect(s2.pending).toBe('Hello');
    expect(s2.messages).toHaveLength(0);
  });

  it('finalizes the pending message on completion event', () => {
    const s0 = reduceGatewayEvent(empty(), {
      type: 'message.delta',
      session_id: 's1',
      payload: { text: 'partial' },
    } satisfies HermesMessageDeltaEvent);

    const complete: HermesMessageCompleteEvent = {
      type: 'message.complete',
      session_id: 's1',
      payload: { text: 'final answer', rendered: 'final answer' },
    };
    const s1 = reduceGatewayEvent(s0, complete);
    expect(s1.pending).toBe('');
    expect(s1.messages).toHaveLength(1);
    expect(s1.messages[0].role).toBe('assistant');
    expect(s1.messages[0].content).toBe('final answer');
  });

  it('uses pending text when complete payload is empty', () => {
    const s0 = reduceGatewayEvent(empty(), {
      type: 'message.delta',
      payload: { text: 'streamed only' },
    } satisfies HermesMessageDeltaEvent);
    const s1 = reduceGatewayEvent(s0, {
      type: 'message.complete',
      payload: {},
    } satisfies HermesMessageCompleteEvent);
    expect(s1.messages[0]?.content).toBe('streamed only');
    expect(s1.pending).toBe('');
  });

  it('records error events as system bubbles', () => {
    const err: HermesErrorEvent = {
      type: 'error',
      payload: { message: 'gateway failed' },
    };
    const s1 = reduceGatewayEvent(empty(), err);
    expect(s1.messages).toHaveLength(1);
    expect(s1.messages[0].role).toBe('system');
    expect(s1.messages[0].content).toContain('gateway failed');
  });

  it('ignores unknown event types without throwing', () => {
    expect(() =>
      reduceGatewayEvent(empty(), { type: 'unknown' } as never),
    ).not.toThrow();
    const s1 = reduceGatewayEvent(empty(), { type: 'tool.start' } as never);
    expect(s1.messages).toHaveLength(0);
    expect(s1.pending).toBe('');
  });
});
