import Box from "@mui/material/Box"
import { blue } from "@mui/material/colors"
import React, { FunctionComponent, useCallback, useMemo } from "react"
import { createEditor, Descendant, Transforms } from "slate"
import { withHistory } from "slate-history"
import { Editable, ReactEditor, RenderElementProps, Slate, useSlateStatic, withReact } from "slate-react"
import CodeEditor from "../CodeEditor"
import { ConditionalTree } from "../conditionTree"
import { SlateIndentBox } from "../LabelledIndentBox"
import { useLibraryAsset } from "../LibraryAsset"
import SlateIfElse from "../SlateIfElse"
import exitTreeToSlate from "./exitTreeToSlate"

type RoomExitEditorProps = {
    RoomId: string;
    tree: ConditionalTree<string>;
    onChange: (value: string) => void;
}

const Leaf = ({ attributes, children, leaf }: { attributes: any, children: any, leaf: any }) => {
    return (
        <span
            {...attributes}
            style={{ backgroundColor: leaf.error && '#ffeeba' }}
        >
            {children}
        </span>
    )
}

const Element: FunctionComponent<RenderElementProps> = ({ ...props }) => {
    const { attributes, children, element } = props
    switch(element.type) {
        case 'ifBase':
        case 'elseif':
        case 'else':
            return <SlateIfElse { ...props } />
        default: return (
            <p {...attributes}>
                {children}
            </p>
        )
    }
}
export const RoomExitEditor: FunctionComponent<RoomExitEditorProps> = ({ RoomId, tree, onChange }) => {
    const editor = useMemo(() => withHistory(withReact(createEditor())), [])
    const { normalForm } = useLibraryAsset()
    const value = useMemo(() => (exitTreeToSlate(normalForm)(tree)), [normalForm, tree])
    const onChangeHandler = useCallback((nodes: Descendant[]) => {
        // onChange(slateToString(nodes))
    }, [onChange])
    const renderLeaf = useCallback(props => (<Leaf { ...props } />), [])
    const renderElement = useCallback(props => (<Element RoomId={RoomId} { ...props } />), [RoomId])
    return <Slate editor={editor} value={value} onChange={onChangeHandler}>
        <Editable
            renderLeaf={renderLeaf}
        />
    </Slate>
}

export default RoomExitEditor
