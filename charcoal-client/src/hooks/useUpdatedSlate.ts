import { useEffect, useState } from "react";
import { Descendant, Editor, Range, Transforms } from "slate"
import { deepEqual } from "../lib/objects";

type UseUpdatedSlateProps<T> = {
    initializeEditor: () => Editor;
    comparisonOutput: (value: Descendant[]) => T;
    value: Descendant[];
}

export const useUpdatedSlate = <T>({ initializeEditor, value, comparisonOutput }: UseUpdatedSlateProps<T>) => {
    const [editor] = useState(initializeEditor())
    useEffect(() => {
        //
        // Since slate-react doesn't seem to catch up to reactive changes in the value of a Slate
        // object, we need to manually reset the value on a change
        //
        const incomingValue: Descendant[] = value.length ? value : [{ type: 'paragraph', children: [{ text: '' }] }]
        const diffDetected = !deepEqual(comparisonOutput(editor.children), comparisonOutput(incomingValue))
        if (diffDetected) {
            editor.children = incomingValue
            Editor.normalize(editor, { force: true })
            const previousSelection = editor.selection ? { ...editor.selection } : null
            Transforms.select(editor, (previousSelection && Range.intersection(previousSelection, Editor.range(editor, []))) || { anchor: Editor.end(editor, []), focus: Editor.end(editor, []) })
            console.log('Diff detected!')
        }
        else {
            console.log('No diff detected!')
        }
    }, [editor, value])
    return editor
}

export default useUpdatedSlate
