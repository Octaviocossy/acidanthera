import { describe, expect, it } from 'vitest';
import type { ChatItem } from '@/stores/chat-store';
import { buildResumePrompt, countMessages, isConversationalMessage, truncateByMessageCount } from './chat-prompt';

function userMsg(text: string): ChatItem {
  return { kind: 'user_message', id: `u-${text}`, text };
}

function agentMsg(text: string): ChatItem {
  return { kind: 'agent_message', id: `a-${text}`, text };
}

function toolCall(): ChatItem {
  return { kind: 'tool_call', id: 't-1', call: { callId: 't-1', toolName: 'read', args: {}, status: 'ok' } };
}

function errorItem(): ChatItem {
  return { kind: 'error', id: 'e-1', message: 'boom' };
}

describe('isConversationalMessage', () => {
  it('accepts user and agent messages, rejects tool/error rows', () => {
    expect(isConversationalMessage(userMsg('hi'))).toBe(true);
    expect(isConversationalMessage(agentMsg('hi'))).toBe(true);
    expect(isConversationalMessage(toolCall())).toBe(false);
    expect(isConversationalMessage(errorItem())).toBe(false);
  });
});

describe('countMessages', () => {
  it('counts only conversational messages', () => {
    const items = [userMsg('a'), toolCall(), agentMsg('b'), errorItem()];
    expect(countMessages(items)).toBe(2);
  });

  it('returns 0 for an empty transcript', () => {
    expect(countMessages([])).toBe(0);
  });
});

describe('truncateByMessageCount', () => {
  it('keeps only the last N conversational messages, carrying trailing tool/error rows', () => {
    const items = [userMsg('1'), agentMsg('1'), userMsg('2'), toolCall(), agentMsg('2')];
    const result = truncateByMessageCount(items, 2);
    expect(result).toEqual([userMsg('2'), toolCall(), agentMsg('2')]);
  });

  it('returns a copy of the whole transcript when under the cap', () => {
    const items = [userMsg('1'), agentMsg('1')];
    const result = truncateByMessageCount(items, 10);
    expect(result).toEqual(items);
    expect(result).not.toBe(items);
  });

  it('returns an empty array when maxMessages is 0 or negative', () => {
    const items = [userMsg('1')];
    expect(truncateByMessageCount(items, 0)).toEqual([]);
    expect(truncateByMessageCount(items, -5)).toEqual([]);
  });

  it('floors a non-integer cap', () => {
    const items = [userMsg('1'), agentMsg('1'), userMsg('2')];
    expect(truncateByMessageCount(items, 1.9)).toEqual([userMsg('2')]);
  });
});

describe('buildResumePrompt', () => {
  it('returns the bare trimmed message when there is no prior conversational history', () => {
    expect(buildResumePrompt([], '  hello  ')).toBe('hello');
    expect(buildResumePrompt([toolCall(), errorItem()], 'hello')).toBe('hello');
  });

  it('replays prior turns with role labels, a divider, and the new message', () => {
    const history = [userMsg('first question'), agentMsg('first answer')];
    const prompt = buildResumePrompt(history, 'second question');

    expect(prompt).toContain('You: first question');
    expect(prompt).toContain('Assistant: first answer');
    expect(prompt).toContain('---');
    expect(prompt.endsWith('second question')).toBe(true);
  });

  it('honors a custom header and maxMessages override', () => {
    const history = [userMsg('old'), agentMsg('older'), userMsg('newest')];
    const prompt = buildResumePrompt(history, 'go', { header: 'CUSTOM', maxMessages: 1 });

    expect(prompt.startsWith('CUSTOM')).toBe(true);
    expect(prompt).not.toContain('old');
    expect(prompt).not.toContain('older');
    expect(prompt).toContain('You: newest');
  });
});
