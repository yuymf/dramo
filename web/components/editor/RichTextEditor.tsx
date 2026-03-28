/**
 * Rich text editor component powered by Tiptap
 */
"use client";
import { useEditor, EditorContent, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import { useEffect, useImperativeHandle, forwardRef, useRef } from "react";


interface RichTextEditorProps {
  content: string;
  onChange: (content: string) => void;
  placeholder?: string;
  editable?: boolean;
  editorId?: string;
  autoFocus?: boolean;
  onEditorReady?: (editor: Editor) => void;
}

export const RichTextEditor = forwardRef<Editor | null, RichTextEditorProps>(
  function RichTextEditor(
    {
      content,
      onChange,
      placeholder = "Start typing...",
      editable = true,
      editorId,
      autoFocus = false,
      onEditorReady,
    },
    ref
  ) {
    const rafRef = useRef<number | null>(null);

    const editor = useEditor({
      extensions: [
        StarterKit.configure({
          heading: {
            levels: [1, 2, 3],
          },
        }),
        Placeholder.configure({
          placeholder,
          emptyEditorClass: 'is-editor-empty',
        }),
      ],
      content,
      editable,
      immediatelyRender: false,
      editorProps: {
        // 处理粘贴的 HTML，清理外部样式
        transformPastedHTML(html) {
          // 移除所有 style 属性和 class 属性
          return html
            .replace(/\s*style="[^"]*"/gi, '')
            .replace(/\s*class="[^"]*"/gi, '')
            .replace(/<span[^>]*>/gi, '')
            .replace(/<\/span>/gi, '')
            .replace(/<font[^>]*>/gi, '')
            .replace(/<\/font>/gi, '');
        },
        // 处理粘贴的纯文本
        transformPastedText(text) {
          return text;
        },
      },
      onUpdate: ({ editor }) => {
        onChange(editor.getHTML());
      },
    });

    useImperativeHandle(ref, () => editor!, [editor]);

    useEffect(() => {
      if (editor && content !== editor.getHTML()) {
        editor.commands.setContent(content);
      }
    }, [content, editor]);

    useEffect(() => {
      if (editor && onEditorReady) {
        // 仅在获得焦点时告知父组件（避免跳转到错误的编辑器）
        const handleFocus = () => {
          if (rafRef.current) cancelAnimationFrame(rafRef.current);
          rafRef.current = requestAnimationFrame(() => {
            onEditorReady(editor);
          });
        };

        editor.on("focus", handleFocus);

        return () => {
          editor.off("focus", handleFocus);
          if (rafRef.current) cancelAnimationFrame(rafRef.current);
        };
      }
    }, [editor, onEditorReady]);

    useEffect(() => {
      if (editor && autoFocus) {
        editor.chain().focus().run();
      }
    }, [editor, autoFocus, content]);

    useEffect(() => {
      return () => {
        if (rafRef.current) cancelAnimationFrame(rafRef.current);
      };
    }, []);

    if (!editor) {
      return null;
    }

    return (
      <div id={editorId} className="border border-slate-200 rounded-lg overflow-hidden book-editor-container shadow-sm">
        <EditorContent
          editor={editor}
          className="book-editor prose prose-base max-w-none p-6 min-h-[180px] focus:outline-none"
        />
      </div>
    );
  }
);

