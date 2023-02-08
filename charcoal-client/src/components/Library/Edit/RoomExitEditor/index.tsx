import Box from "@mui/material/Box"
import { blue } from "@mui/material/colors"
import { isNormalExit, NormalExit } from "@tonylb/mtw-wml/dist/normalize/baseClasses"
import React, { FunctionComponent, useCallback, useMemo } from "react"
import { createEditor, Descendant } from "slate"
import { withHistory } from "slate-history"
import { Editable, RenderElementProps, Slate, withReact } from "slate-react"
import { reduceItemsToTree } from "../conditionTree"
import { useLibraryAsset } from "../LibraryAsset"
import SlateIfElse from "../SlateIfElse"
import exitTreeToSlate from "./exitTreeToSlate"

type RoomExitEditorProps = {
    RoomId: string;
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

const Element: FunctionComponent<RenderElementProps & { RoomId: string }> = ({ RoomId, ...props }) => {
    const { attributes, children, element } = props
    switch(element.type) {
        case 'ifBase':
        case 'elseif':
        case 'else':
            return <SlateIfElse { ...props } />
        case 'exit':
            return <Box sx={{ width: "100%", display: "inline-flex", flexDirection: "row" }} { ...attributes }>
                <Box contentEditable={false} sx={{ display: 'inline-block' }}>Exit [</Box>
                {children}
                <Box contentEditable={false} sx={{ display: 'inline-block' }}>] from { element.from } to { element.to }</Box>
            </Box>
        default: return (
            <p {...attributes}>
                {children}
            </p>
        )
    }
}
export const RoomExitEditor: FunctionComponent<RoomExitEditorProps> = ({ RoomId, onChange }) => {
    const editor = useMemo(() => withHistory(withReact(createEditor())), [])
    const { normalForm } = useLibraryAsset()
    const relevantExits = useMemo(() => (
        Object.values(normalForm)
            .filter(isNormalExit)
            .filter(({ to, from }) => (to === RoomId || from === RoomId))
            .reduce(reduceItemsToTree({
                compare: (A: string, B: string) => (A === B),
                normalForm,
                transform: ({ key }: NormalExit) => (key)
            }), { items: [], conditionals: [] })
        ), [normalForm, RoomId])
    const value = useMemo(() => (exitTreeToSlate(normalForm)(relevantExits)), [normalForm, relevantExits])
    const onChangeHandler = useCallback((nodes: Descendant[]) => {
        // onChange(slateToString(nodes))
    }, [onChange])
    const renderLeaf = useCallback(props => (<Leaf { ...props } />), [])
    const renderElement = useCallback(props => (<Element RoomId={RoomId} { ...props } />), [RoomId])
    return <Slate editor={editor} value={value} onChange={onChangeHandler}>
        <Editable
            renderElement={renderElement}
            renderLeaf={renderLeaf}
        />
    </Slate>
}

export default RoomExitEditor
