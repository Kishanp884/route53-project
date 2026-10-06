"use client";

import TagEditor, { TagEditorProps } from "@cloudscape-design/components/tag-editor";
import type { Tag } from "@/lib/types";

export type EditorTag = TagEditorProps.Tag;

export const toEditorTags = (tags: Tag[]): EditorTag[] =>
  tags.map((t) => ({ key: t.key, value: t.value, existing: true }));

export const fromEditorTags = (tags: readonly EditorTag[]): Tag[] =>
  tags.filter((t) => !t.markedForRemoval && t.key.trim()).map((t) => ({ key: t.key.trim(), value: t.value ?? "" }));

export default function ZoneTagEditor({
  tags,
  onChange,
}: {
  tags: readonly EditorTag[];
  onChange: (t: readonly EditorTag[]) => void;
}) {
  return (
    <TagEditor
      tags={tags}
      onChange={({ detail }) => onChange(detail.tags)}
      tagLimit={50}
      i18nStrings={{
        keyPlaceholder: "Enter key",
        valuePlaceholder: "Enter value",
        addButton: "Add tag",
        removeButton: "Remove",
        undoButton: "Undo",
        undoPrompt: "This tag will be removed upon saving changes",
        loading: "Loading tags that are associated with this resource",
        keyHeader: "Key",
        valueHeader: "Value - optional",
        optional: "optional",
        keySuggestion: "Custom tag key",
        valueSuggestion: "Custom tag value",
        emptyTags: "No tags associated with the resource.",
        tooManyKeysSuggestion: "You have more keys than can be displayed",
        tooManyValuesSuggestion: "You have more values than can be displayed",
        keysSuggestionLoading: "Loading tag keys",
        keysSuggestionError: "Tag keys could not be retrieved",
        valuesSuggestionLoading: "Loading tag values",
        valuesSuggestionError: "Tag values could not be retrieved",
        emptyKeyError: "You must specify a tag key",
        maxKeyCharLengthError: "The maximum number of characters you can use in a tag key is 128.",
        maxValueCharLengthError: "The maximum number of characters you can use in a tag value is 256.",
        duplicateKeyError: "You must specify a unique tag key.",
        invalidKeyError: "Invalid key. Keys can only contain Unicode letters, digits, white space and any of the following: _.:/=+@-",
        invalidValueError: "Invalid value. Values can only contain Unicode letters, digits, white space and any of the following: _.:/=+@-",
        awsPrefixError: "Cannot start with aws:",
        tagLimit: (available) => `You can add up to ${available} more tag${available === 1 ? "" : "s"}.`,
        tagLimitReached: (limit) => `You have reached the limit of ${limit} tags.`,
        tagLimitExceeded: (limit) => `You have exceeded the limit of ${limit} tags.`,
        enteredKeyLabel: (key) => `Use "${key}"`,
        enteredValueLabel: (value) => `Use "${value}"`,
      }}
    />
  );
}
