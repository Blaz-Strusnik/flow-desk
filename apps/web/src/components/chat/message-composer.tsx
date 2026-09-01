"use client";

import { useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useChannelMembers } from "@/hooks/use-channel-members";

interface MessageComposerProps {
  channelId: string;
  onSend: (body: string) => void;
  onTyping: () => void;
}

export function MessageComposer({ channelId, onSend, onTyping }: MessageComposerProps) {
  const [value, setValue] = useState("");
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { data: members } = useChannelMembers(channelId);

  const suggestions = useMemo(() => {
    if (mentionQuery === null || !members) return [];
    return members
      .filter((m) => m.user.name.toLowerCase().startsWith(mentionQuery.toLowerCase()))
      .slice(0, 5);
  }, [mentionQuery, members]);

  const updateMentionState = (text: string, cursor: number) => {
    const upToCursor = text.slice(0, cursor);
    const match = /@(\w*)$/.exec(upToCursor);
    setMentionQuery(match ? match[1] : null);
  };

  const insertMention = (name: string) => {
    const el = textareaRef.current;
    if (!el) return;
    const cursor = el.selectionStart;
    const upToCursor = value.slice(0, cursor);
    const replaced = upToCursor.replace(/@(\w*)$/, `@${name.replace(/\s+/g, "")} `);
    const next = replaced + value.slice(cursor);
    setValue(next);
    setMentionQuery(null);
    requestAnimationFrame(() => el.focus());
  };

  const submit = () => {
    const trimmed = value.trim();
    if (!trimmed) return;
    onSend(trimmed);
    setValue("");
    setMentionQuery(null);
  };

  return (
    <div className="relative border-t p-3">
      {suggestions.length > 0 && (
        <div className="absolute bottom-full left-3 mb-1 w-56 rounded-md border bg-popover p-1 shadow-md">
          {suggestions.map((m) => (
            <button
              key={m.userId}
              type="button"
              className="block w-full rounded px-2 py-1 text-left text-sm hover:bg-accent"
              onClick={() => insertMention(m.user.name)}
            >
              {m.user.name}
            </button>
          ))}
        </div>
      )}
      <Textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => {
          setValue(e.target.value);
          updateMentionState(e.target.value, e.target.selectionStart);
          onTyping();
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            submit();
          }
        }}
        placeholder="Message... (@ to mention, **bold**, *italic*, `code`)"
        className="min-h-16"
      />
      <div className="mt-2 flex justify-end">
        <Button size="sm" onClick={submit} disabled={!value.trim()}>
          Send
        </Button>
      </div>
    </div>
  );
}
