import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import { Toolbar } from "@astryxdesign/core/Toolbar";
import { ToggleButton } from "@astryxdesign/core/ToggleButton";
import { IconButton } from "@astryxdesign/core/IconButton";
import { Divider } from "@astryxdesign/core/Divider";
import { VStack } from "@astryxdesign/core/VStack";
import { HStack } from "@astryxdesign/core/HStack";
import {
  Bold,
  Italic,
  Underline as UnderlineIcon,
  Strikethrough,
  Heading1,
  Heading2,
  Heading3,
  List as ListIcon,
  ListOrdered,
  Quote,
  Code,
  Link as LinkIcon,
  Minus,
} from "lucide-react";
import { useEffect, useCallback } from "react";

type RichTextEditorProps = {
  content: string;
  onChange: (html: string) => void;
  editable?: boolean;
  placeholder?: string;
};

export default function RichTextEditor({
  content,
  onChange,
  editable = true,
  placeholder = "Start writing...",
}: RichTextEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
      }),
      Underline,
      Link.configure({
        openOnClick: !editable,
      }),
      Placeholder.configure({ placeholder }),
    ],
    content,
    editable,
    onUpdate: ({ editor: e }) => {
      onChange(e.getHTML());
    },
  });

  // Sync editable prop
  useEffect(() => {
    if (editor && editor.isEditable !== editable) {
      editor.setEditable(editable);
    }
  }, [editor, editable]);

  // Sync content from outside (e.g. switching notes)
  useEffect(() => {
    if (editor && content !== editor.getHTML()) {
      editor.commands.setContent(content, { emitUpdate: false });
    }
  }, [editor, content]);

  const setLink = useCallback(() => {
    if (!editor) return;
    const previousUrl = editor.getAttributes("link").href as string | undefined;
    const url = window.prompt("URL", previousUrl ?? "https://");
    if (url === null) return;
    if (url === "") {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
      return;
    }
    editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
  }, [editor]);

  if (!editor) return null;

  return (
    <VStack gap={0}>
      {editable && (
        <Toolbar
          label="Formatting"
          size="sm"
          startContent={
            <HStack gap={0.5} align="center" wrap="wrap">
              <ToggleButton label="Bold" isIconOnly icon={<Bold />} isPressed={editor.isActive("bold")} onPressedChange={() => editor.chain().focus().toggleBold().run()} />
              <ToggleButton label="Italic" isIconOnly icon={<Italic />} isPressed={editor.isActive("italic")} onPressedChange={() => editor.chain().focus().toggleItalic().run()} />
              <ToggleButton label="Underline" isIconOnly icon={<UnderlineIcon />} isPressed={editor.isActive("underline")} onPressedChange={() => editor.chain().focus().toggleUnderline().run()} />
              <ToggleButton label="Strikethrough" isIconOnly icon={<Strikethrough />} isPressed={editor.isActive("strike")} onPressedChange={() => editor.chain().focus().toggleStrike().run()} />
              <Divider orientation="vertical" />
              <ToggleButton label="Heading 1" isIconOnly icon={<Heading1 />} isPressed={editor.isActive("heading", { level: 1 })} onPressedChange={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} />
              <ToggleButton label="Heading 2" isIconOnly icon={<Heading2 />} isPressed={editor.isActive("heading", { level: 2 })} onPressedChange={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} />
              <ToggleButton label="Heading 3" isIconOnly icon={<Heading3 />} isPressed={editor.isActive("heading", { level: 3 })} onPressedChange={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} />
              <Divider orientation="vertical" />
              <ToggleButton label="Bullet list" isIconOnly icon={<ListIcon />} isPressed={editor.isActive("bulletList")} onPressedChange={() => editor.chain().focus().toggleBulletList().run()} />
              <ToggleButton label="Ordered list" isIconOnly icon={<ListOrdered />} isPressed={editor.isActive("orderedList")} onPressedChange={() => editor.chain().focus().toggleOrderedList().run()} />
              <Divider orientation="vertical" />
              <ToggleButton label="Blockquote" isIconOnly icon={<Quote />} isPressed={editor.isActive("blockquote")} onPressedChange={() => editor.chain().focus().toggleBlockquote().run()} />
              <ToggleButton label="Inline code" isIconOnly icon={<Code />} isPressed={editor.isActive("code")} onPressedChange={() => editor.chain().focus().toggleCode().run()} />
              <ToggleButton label="Link" isIconOnly icon={<LinkIcon />} isPressed={editor.isActive("link")} onPressedChange={() => setLink()} />
              <IconButton label="Horizontal rule" tooltip="Horizontal rule" variant="ghost" size="sm" icon={<Minus />} onClick={() => editor.chain().focus().setHorizontalRule().run()} />
            </HStack>
          }
        />
      )}
      {editable && <Divider />}
      <VStack padding={3} minHeight={editable ? 300 : undefined} isScrollable>
        <EditorContent editor={editor} />
      </VStack>
    </VStack>
  );
}
