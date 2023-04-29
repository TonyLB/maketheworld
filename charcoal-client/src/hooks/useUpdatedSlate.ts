import { useEffect, useState } from "react";
import { Descendant, Editor, Range, Transforms } from "slate"

type UseUpdatedSlateProps = {
    initializeEditor: () => Editor;
    value: Descendant[];
}

export const useUpdatedSlate = ({ initializeEditor, value }: UseUpdatedSlateProps) => {
    const [editor] = useState(initializeEditor())
    useEffect(() => {
        //
        // Since slate-react doesn't seem to catch up to reactive changes in the value of a Slate
        // object, we need to manually reset the value on a change
        //
        editor.children = value.length ? value : [{ type: 'paragraph', children: [{ text: '' }] }]
        Editor.normalize(editor, { force: true })
        const previousSelection = editor.selection ? { ...editor.selection } : null
        Transforms.select(editor, (previousSelection && Range.intersection(previousSelection, Editor.range(editor, []))) || { anchor: Editor.end(editor, []), focus: Editor.end(editor, []) })
        
    }, [editor, value])
    return editor
}

export default useUpdatedSlate
