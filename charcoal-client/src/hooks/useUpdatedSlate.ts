import { useEffect, useRef, useState } from "react";
import { Descendant, Editor, Range, Transforms } from "slate"
import { deepEqual } from "../lib/objects";

type UseUpdatedSlateProps<T> = {
    initializeEditor: () => Editor;
    comparisonOutput: (value: Descendant[]) => T;
    value: Descendant[];
}

export const useUpdatedSlate = <T>({ initializeEditor, value, comparisonOutput }: UseUpdatedSlateProps<T>) => {
    const [editor] = useState(initializeEditor())
    const lastSyncedRef = useRef<T | undefined>(undefined)
    useEffect(() => {
        Editor.normalize(editor, { force: true })
    }, [editor])
    useEffect(() => {
        //
        // Sync external value via Transforms only (no editor.children =). Only sync when the
        // incoming value is different from what we last synced (external change). Otherwise we
        // would overwrite in-progress user edits when the parent's value is still stale (e.g. debounced save).
        //
        const incomingValue: Descendant[] = value.length ? value : [{ type: 'paragraph', children: [{ text: '' }] }]
        const incomingOutput = comparisonOutput(incomingValue)
        const isNewExternalValue = lastSyncedRef.current === undefined || !deepEqual(lastSyncedRef.current, incomingOutput)
        if (isNewExternalValue) {
            lastSyncedRef.current = incomingOutput
            const previousSelection = editor.selection ? { ...editor.selection } : null

            // Replace root content via Transforms so Slate's pipeline (history, selection, etc.) stays intact
            for (let i = editor.children.length - 1; i >= 0; i--) {
                Transforms.removeNodes(editor, { at: [i] })
            }
            Transforms.insertNodes(editor, incomingValue, { at: [0] })
            Editor.normalize(editor, { force: true })
            Transforms.select(editor, (previousSelection && Range.intersection(previousSelection, Editor.range(editor, []))) || { anchor: Editor.end(editor, []), focus: Editor.end(editor, []) })
        }
    }, [editor, value])
    return editor
}

export default useUpdatedSlate
