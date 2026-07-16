// src/stores/hermesStore.test.ts — fixture events from hermes/types.ts (Task 7/10).
import { describe, expect, it } from 'vitest';
import {
  eventBelongsToActiveChat,
  reduceApprovalEvent,
  reduceGatewayEvent,
  removeApprovalById,
  type HermesChatReducerState,
  type PendingApproval,
} from './hermesStore';
import type {
  HermesApprovalRequestEvent,
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

describe('eventBelongsToActiveChat', () => {
  it('matches live gateway session ids', () => {
    expect(
      eventBelongsToActiveChat(
        { type: 'message.delta', session_id: '04f7477b' },
        '04f7477b',
        '20260716_224218_bd1d59',
      ),
    ).toBe(true);
  });

  it('matches stored REST ids', () => {
    expect(
      eventBelongsToActiveChat(
        { type: 'message.complete', session_id: '20260716_224218_bd1d59' },
        '04f7477b',
        '20260716_224218_bd1d59',
      ),
    ).toBe(true);
  });

  it('rejects events for other sessions', () => {
    expect(
      eventBelongsToActiveChat(
        { type: 'message.delta', session_id: 'other' },
        '04f7477b',
        '20260716_224218_bd1d59',
      ),
    ).toBe(false);
  });

  it('accepts events without session_id', () => {
    expect(eventBelongsToActiveChat({ type: 'gateway.ready' }, null, null)).toBe(true);
  });
});

describe('reduceApprovalEvent', () => {
  const approvalFixture = (sessionId: string, command: string): HermesApprovalRequestEvent => ({
    type: 'approval.request',
    session_id: sessionId,
    payload: {
      command,
      description: 'dangerous command',
      allow_permanent: true,
      smart_denied: false,
    },
  });

  it('adds one entry for approval.request', () => {
    const next = reduceApprovalEvent([], approvalFixture('sess-1', 'rm -rf /tmp/x'));
    expect(next).toHaveLength(1);
    expect(next[0].id).toBe('sess-1');
    expect(next[0].sessionId).toBe('sess-1');
    expect(next[0].command).toBe('rm -rf /tmp/x');
    expect(next[0].risk).toBe('dangerous command');
  });

  it('does not double-add duplicate request ids (same session)', () => {
    const a = reduceApprovalEvent([], approvalFixture('sess-1', 'rm a'));
    const b = reduceApprovalEvent(a, approvalFixture('sess-1', 'rm b'));
    expect(b).toHaveLength(1);
    expect(b[0].command).toBe('rm b');
  });

  it('removes the session approval on message.complete', () => {
    const a = reduceApprovalEvent([], approvalFixture('sess-1', 'rm -rf /'));
    const b = reduceApprovalEvent(a, {
      type: 'message.complete',
      session_id: 'sess-1',
      payload: { text: 'done' },
    } satisfies HermesMessageCompleteEvent);
    expect(b).toHaveLength(0);
  });

  it('removes the session approval on error', () => {
    const a = reduceApprovalEvent([], approvalFixture('sess-1', 'rm -rf /'));
    const b = reduceApprovalEvent(a, {
      type: 'error',
      session_id: 'sess-1',
      payload: { message: 'failed' },
    } satisfies HermesErrorEvent);
    expect(b).toHaveLength(0);
  });

  it('removeApprovalById drops the entry (respondApproval success path)', () => {
    const list: PendingApproval[] = [
      {
        id: 'sess-1',
        sessionId: 'sess-1',
        command: 'rm x',
        risk: 'dangerous command',
        requestedAt: 1,
      },
    ];
    expect(removeApprovalById(list, 'sess-1')).toHaveLength(0);
  });
});
