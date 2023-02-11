import { FunctionComponent, useCallback, useMemo } from "react";
import { createEditor, Descendant } from "slate";
import { withHistory } from "slate-history";
import { Editable, Slate, withReact } from "slate-react";
import stringToSlate, { slateToString } from "./stringToSlate";

type CodeEditorProps = {
    source: string;
    onChange: (value: string) => void;
}

const Leaf = ({ attributes, children, leaf }: { attributes: any, children: any, leaf: any }) => {
    return (
        <span
            {...attributes}
            style={{ backgroundColor: leaf.error && '#ffeeba' }}
            spellCheck={false}
        >
            {children}
        </span>
    )
}

export const CodeEditor: FunctionComponent<CodeEditorProps> = ({ source, onChange }) => {
    const editor = useMemo(() => withHistory(withReact(createEditor())), [])
    const value = useMemo(() => (stringToSlate(source)), [source])
    const onChangeHandler = useCallback((nodes: Descendant[]) => {
        onChange(slateToString(nodes))
    }, [onChange])
    const renderLeaf = useCallback(props => (<Leaf { ...props } />), [])
    return <Slate editor={editor} value={value} onChange={onChangeHandler}>
        <Editable
            renderLeaf={renderLeaf}
        />
    </Slate>
}

export default CodeEditor
