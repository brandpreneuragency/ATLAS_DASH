import { describe, it, expect } from 'vitest';
import {
  ASSISTANT_MIN_PX,
  CONTEXT_MAX_PX,
  CONTEXT_MIN_PX,
  PRIMARY_MIN_PX,
  applyAssistantKeyboardDelta,
  applyContextKeyboardDelta,
  assistantGrowSign,
  clampAssistantWidthPx,
  clampContextWidthPx,
  pxToVw,
  vwToPx,
} from './layoutGeometry';

describe('clampAssistantWidthPx', () => {
  it('enforces assistant minimum', () => {
    expect(clampAssistantWidthPx(100, 1200, 6)).toBe(ASSISTANT_MIN_PX);
  });

  it('caps against shell - primaryMin - handle', () => {
    // 1000 - 140 - 6 = 854
    expect(clampAssistantWidthPx(900, 1000, 6)).toBe(854);
  });

  it('leaves mid-range values unchanged', () => {
    expect(clampAssistantWidthPx(400, 1200, 6)).toBe(400);
  });

  it('never yields below assistant min even when shell is tight', () => {
    const shell = ASSISTANT_MIN_PX + PRIMARY_MIN_PX;
    expect(clampAssistantWidthPx(500, shell, 6)).toBe(ASSISTANT_MIN_PX);
  });
});

describe('clampContextWidthPx', () => {
  it('enforces 260–420 range without primary constraint', () => {
    expect(clampContextWidthPx(100)).toBe(CONTEXT_MIN_PX);
    expect(clampContextWidthPx(500)).toBe(CONTEXT_MAX_PX);
    expect(clampContextWidthPx(300)).toBe(300);
  });

  it('protects center min inside primary', () => {
    // primary 500, handle 6, center 140 → max context 354, but token max 420
    expect(clampContextWidthPx(400, 500, 6)).toBe(354);
  });

  it('does not exceed token max even when primary is wide', () => {
    expect(clampContextWidthPx(500, 2000, 6)).toBe(CONTEXT_MAX_PX);
  });
});

describe('vw conversion', () => {
  it('round-trips', () => {
    const px = vwToPx(33, 1920);
    expect(pxToVw(px, 1920)).toBeCloseTo(33, 5);
  });
});

describe('keyboard deltas', () => {
  it('assistant grows with ArrowLeft when on the right (not swapped)', () => {
    expect(assistantGrowSign(false)).toBe(-1);
    expect(applyAssistantKeyboardDelta(400, 'ArrowLeft', false, 16)).toBe(416);
    expect(applyAssistantKeyboardDelta(400, 'ArrowRight', false, 16)).toBe(384);
  });

  it('assistant grows with ArrowRight when on the left (swapped)', () => {
    expect(assistantGrowSign(true)).toBe(1);
    expect(applyAssistantKeyboardDelta(400, 'ArrowRight', true, 16)).toBe(416);
    expect(applyAssistantKeyboardDelta(400, 'ArrowLeft', true, 16)).toBe(384);
  });

  it('context grows with ArrowRight', () => {
    expect(applyContextKeyboardDelta(300, 'ArrowRight', 16)).toBe(316);
    expect(applyContextKeyboardDelta(300, 'ArrowLeft', 16)).toBe(284);
  });
});
