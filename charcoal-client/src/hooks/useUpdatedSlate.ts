import { useEffect, useState } from "react";
import { Descendant, Editor } from "slate"

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
        editor.children = value
        Editor.normalize(editor, { force: true })
    }, [editor, value])
    return editor
}

export default useUpdatedSlate
