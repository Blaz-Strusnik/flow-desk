"use client";

import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { useEffect } from "react";
import { cn } from "@/lib/utils";

interface TiptapEditorProps {
  content: string;
  onBlurSave: (html: string) => void;
  placeholder?: string;
}

export function TiptapEditor({ content, onBlurSave, placeholder }: TiptapEditorProps) {
  const editor = useEditor({
    extensions: [StarterKit],
    content,
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class: cn(
          "prose prose-sm dark:prose-invert max-w-none min-h-24 rounded-md border border-input bg-transparent px-3 py-2 text-sm",
          "focus:outline-none focus:ring-1 focus:ring-ring"
        ),
        "data-placeholder": placeholder ?? "Add a more detailed description...",
      },
    },
    onBlur: ({ editor }) => onBlurSave(editor.getHTML()),
  });

  useEffect(() => {
    if (editor && content !== editor.getHTML()) {
      editor.commands.setContent(content, { emitUpdate: false });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [content]);

  return <EditorContent editor={editor} />;
}
