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
        // Since slate-react doesn't seem to catch up to reactive changes in the value of a Slate
        // object, we need to manually reset the value on a change. Only sync when the incoming value
        // is different from what we last synced (external change). Otherwise we would overwrite
        // in-progress user edits when the parent's value is still stale (e.g. debounced save).
        //
        const incomingValue: Descendant[] = value.length ? value : [{ type: 'paragraph', children: [{ text: '' }] }]
        const incomingOutput = comparisonOutput(incomingValue)
        const isNewExternalValue = lastSyncedRef.current === undefined || !deepEqual(lastSyncedRef.current, incomingOutput)
        if (isNewExternalValue) {
            lastSyncedRef.current = incomingOutput
            editor.children = incomingValue
            Editor.normalize(editor, { force: true })
            const previousSelection = editor.selection ? { ...editor.selection } : null
            Transforms.select(editor, (previousSelection && Range.intersection(previousSelection, Editor.range(editor, []))) || { anchor: Editor.end(editor, []), focus: Editor.end(editor, []) })
        }
    }, [editor, value])
    return editor
}

export default useUpdatedSlate
