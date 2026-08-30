"use client";

import type { Cover, ScreenplayFormat } from "@/lib/types/screenplay";
import "./screenplay.css";

export interface CoverEditorProps {
  cover: Cover;
  format?: ScreenplayFormat;
  onChange: (cover: Cover) => void;
}

const FIELDS: Array<{
  key: keyof Cover;
  label: string;
  placeholder: string;
  title?: boolean;
}> = [
  { key: "title", label: "片名", placeholder: "剧本标题", title: true },
  { key: "author", label: "作者", placeholder: "姓名" },
  { key: "contact", label: "联系方式", placeholder: "邮箱或电话" },
  { key: "draftDate", label: "草稿日期", placeholder: "年-月-日" },
];

export function CoverEditor({
  cover,
  format = "hollywood",
  onChange,
}: CoverEditorProps) {
  return (
    <form
      className={`sp-cover-page sp-format-${format}`}
      aria-label="剧本封面"
      onSubmit={(event) => event.preventDefault()}
    >
      {FIELDS.map((field) => (
        <div key={field.key} className="sp-cover-field">
          <label htmlFor={`cover-${field.key}`}>{field.label}</label>
          <input
            id={`cover-${field.key}`}
            className={field.title ? "sp-cover-input sp-cover-title" : "sp-cover-input"}
            value={cover[field.key]}
            placeholder={field.placeholder}
            autoComplete="off"
            onChange={(event) =>
              onChange({ ...cover, [field.key]: event.target.value })
            }
          />
        </div>
      ))}
    </form>
  );
}
