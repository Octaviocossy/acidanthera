import { describe, expect, it } from 'vitest';
import type { ChatItem } from '@/stores/chat-store';
import { CHAT_FILE_EXTENSION, CHAT_FILE_SCHEMA, type ChatFile, deriveChatTitle, isChatFilePath, parseChatFile, serializeChatFile } from './chat-file';

function meta(overrides: Partial<ChatFile['meta']> = {}): ChatFile['meta'] {
  return {
    schema: CHAT_FILE_SCHEMA,
    id: 'chat-1',
    title: 'A chat',
    model: 'sonnet-5',
    created: '2026-07-10T00:00:00.000Z',
    updated: '2026-07-10T00:05:00.000Z',
    ...overrides,
  };
}

describe('serializeChatFile / parseChatFile round-trip', () => {
  it('round-trips every item kind', () => {
    const items: ChatItem[] = [
      { kind: 'user_message', id: 'u-1', text: 'hello there' },
      { kind: 'agent_message', id: 'a-1', text: 'hi, how can I help?' },
      { kind: 'tool_call', id: 't-1', call: { callId: 't-1', toolName: 'read', args: { path: 'a.md' }, status: 'ok', result: 'contents' } },
      { kind: 'error', id: 'e-1', message: 'something broke' },
    ];
    const file: ChatFile = { meta: meta(), items };

    const parsed = parseChatFile(serializeChatFile(file));

    expect(parsed).toEqual({ ok: true, file });
  });

  it('round-trips an empty transcript', () => {
    const file: ChatFile = { meta: meta(), items: [] };
    const parsed = parseChatFile(serializeChatFile(file));
    expect(parsed).toEqual({ ok: true, file });
  });

  it('round-trips a message containing embedded code fences', () => {
    const items: ChatItem[] = [{ kind: 'user_message', id: 'u-1', text: 'here is code:\n```ts\nconst x = 1;\n```\nthanks' }];
    const file: ChatFile = { meta: meta(), items };

    const parsed = parseChatFile(serializeChatFile(file));

    expect(parsed).toEqual({ ok: true, file });
  });

  it('round-trips a tool_call whose JSON result contains inner ``` fences', () => {
    const items: ChatItem[] = [
      {
        kind: 'tool_call',
        id: 't-1',
        call: { callId: 't-1', toolName: 'read', args: {}, status: 'ok', result: 'body with ```nested``` fence' },
      },
    ];
    const file: ChatFile = { meta: meta(), items };

    const parsed = parseChatFile(serializeChatFile(file));

    expect(parsed).toEqual({ ok: true, file });
  });

  it('round-trips a title containing quotes and unicode', () => {
    const file: ChatFile = { meta: meta({ title: 'A "quoted" title — 日本語' }), items: [] };
    const parsed = parseChatFile(serializeChatFile(file));
    expect(parsed).toEqual({ ok: true, file });
  });
});

describe('parseChatFile', () => {
  it('fails when the frontmatter block is missing', () => {
    const result = parseChatFile('no frontmatter here');
    expect(result).toEqual({ ok: false, error: expect.any(String) });
  });

  it('fails when a tool_call block has no JSON fence', () => {
    const raw = `${serializeChatFile({ meta: meta(), items: [] })}\n<!-- orbit:chat kind="tool_call" id="t-1" -->\n\nno json here`;
    const result = parseChatFile(raw);
    expect(result.ok).toBe(false);
  });

  it('fails when a tool_call JSON fence is invalid JSON', () => {
    const raw = `${serializeChatFile({ meta: meta(), items: [] })}\n<!-- orbit:chat kind="tool_call" id="t-1" -->\n\n\`\`\`json\n{not valid\n\`\`\``;
    const result = parseChatFile(raw);
    expect(result.ok).toBe(false);
  });

  it('skips an unknown item kind for forward compatibility', () => {
    const raw = `${serializeChatFile({ meta: meta(), items: [] })}\n<!-- orbit:chat kind="future_kind" id="f-1" -->\n\nsome body`;
    const result = parseChatFile(raw);
    expect(result).toEqual({ ok: true, file: { meta: meta(), items: [] } });
  });

  it('defaults missing meta fields rather than failing', () => {
    const raw = '---\nschema: 1\n---\n';
    const result = parseChatFile(raw);
    expect(result).toEqual({
      ok: true,
      file: { meta: { schema: 1, id: '', title: '', model: '', created: '', updated: '' }, items: [] },
    });
  });

  it('tolerates hand-written plain-YAML scalars (unquoted values)', () => {
    const raw = '---\nschema: 1\nid: chat-1\ntitle: Hello World\nmodel: sonnet-5\ncreated: 2026-01-01\nupdated: 2026-01-02\n---\n';
    const result = parseChatFile(raw);
    expect(result).toEqual({
      ok: true,
      file: {
        meta: { schema: 1, id: 'chat-1', title: 'Hello World', model: 'sonnet-5', created: '2026-01-01', updated: '2026-01-02' },
        items: [],
      },
    });
  });
});

describe('isChatFilePath', () => {
  it('matches the .chat.md extension case-insensitively', () => {
    expect(isChatFilePath('/vault/.orbit/chats/chat-1.chat.md')).toBe(true);
    expect(isChatFilePath('/vault/.orbit/chats/CHAT-1.CHAT.MD')).toBe(true);
  });

  it('rejects a plain note or unrelated extension', () => {
    expect(isChatFilePath('/vault/note.md')).toBe(false);
    expect(isChatFilePath('/vault/chat.txt')).toBe(false);
  });

  it('uses the exported extension constant', () => {
    expect(CHAT_FILE_EXTENSION).toBe('.chat.md');
  });
});

describe('deriveChatTitle', () => {
  it('uses the first line of the first user message, truncated to 60 chars', () => {
    const items: ChatItem[] = [{ kind: 'user_message', id: 'u-1', text: `${'a'.repeat(70)}\nsecond line` }];
    const title = deriveChatTitle(items);
    expect(title).toBe(`${'a'.repeat(59)}…`);
  });

  it('ignores agent/tool/error items when finding the first user message', () => {
    const items: ChatItem[] = [
      { kind: 'agent_message', id: 'a-1', text: 'not this' },
      { kind: 'user_message', id: 'u-1', text: 'real question' },
    ];
    expect(deriveChatTitle(items)).toBe('real question');
  });

  it('falls back to "Untitled chat" when there is no user message', () => {
    expect(deriveChatTitle([])).toBe('Untitled chat');
    expect(deriveChatTitle([{ kind: 'agent_message', id: 'a-1', text: 'hi' }])).toBe('Untitled chat');
  });

  it('falls back to "Untitled chat" when the first user message is blank', () => {
    expect(deriveChatTitle([{ kind: 'user_message', id: 'u-1', text: '   \n  ' }])).toBe('Untitled chat');
  });
});
