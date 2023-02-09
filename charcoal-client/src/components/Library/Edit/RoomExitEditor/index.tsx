import Box from "@mui/material/Box"
import Chip from "@mui/material/Chip"
import IconButton from "@mui/material/IconButton"
import { blue } from "@mui/material/colors"
import { isNormalExit, NormalExit } from "@tonylb/mtw-wml/dist/normalize/baseClasses"
import React, { FunctionComponent, useCallback, useMemo } from "react"
import { createEditor, Descendant, Node, Transforms } from "slate"
import { withHistory } from "slate-history"
import { Editable, ReactEditor, RenderElementProps, Slate, useSlate, withReact } from "slate-react"
import { reduceItemsToTree } from "../conditionTree"
import { useLibraryAsset } from "../LibraryAsset"
import SlateIfElse, { AddIfButton } from "../SlateIfElse"
import exitTreeToSlate from "./exitTreeToSlate"
import ExitIcon from '@mui/icons-material/CallMade'
import DeleteIcon from '@mui/icons-material/Delete'
import FlipIcon from '@mui/icons-material/Loop'
import Select, { SelectChangeEvent } from "@mui/material/Select"
import MenuItem from "@mui/material/MenuItem"
import FormControl from "@mui/material/FormControl"
import InputLabel from "@mui/material/InputLabel"
import Toolbar from "@mui/material/Toolbar/Toolbar"

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

const ExitTargetSelector: FunctionComponent<{ target: string; onChange: (event: SelectChangeEvent<string>) => void }> = ({ target, onChange }) => {
    const { rooms } = useLibraryAsset()
    return <FormControl sx={{ m: 1, minWidth: 120 }} size="small">
        <InputLabel id="select-small">Target</InputLabel>
        <Select
            labelId="select-small"
            id="select-small"
            value={target}
            label="Target"
            onChange={onChange}
        >
            {
                Object.entries(rooms).map(([key, { name }]) => (
                    <MenuItem value={key}>{ name }</MenuItem>
                ))
            }
        </Select>
    </FormControl>
}

const Element: FunctionComponent<RenderElementProps & { RoomId: string }> = ({ RoomId, ...props }) => {
    const editor = useSlate()
    const { attributes, children, element } = props
    const path = useMemo(() => (ReactEditor.findPath(editor, element)), [editor, element])
    const onDeleteHandler = useCallback(() => {
        Transforms.removeNodes(editor, { at: path })
    }, [editor, path])
    const onFlipHandler = useCallback(() => {
        if (element.type === 'exit') {
            Transforms.setNodes(editor, { to: element.from, from: element.to }, { at: path })
        }
    }, [element, editor, path])
    const onTargetHandler = useCallback(({ to, from }: { to: string; from: string }) => {
        if (element.type === 'exit') {
            Transforms.setNodes(editor, { to, from }, { at: path })
        }
    }, [element, editor, path])
    switch(element.type) {
        case 'ifBase':
        case 'elseif':
        case 'else':
            return <SlateIfElse { ...props } />
        case 'exit':
            const hereChip = <Chip icon={<FlipIcon />} label="here" onClick={onFlipHandler} />
            const fromElement = (element.from === RoomId)
                ? hereChip
                : <ExitTargetSelector
                    target={element.from}
                    onChange={(event) => { onTargetHandler({ to: RoomId, from: event.target.value })}}
                />
            const toElement = (element.to === RoomId)
                ? hereChip
                : <ExitTargetSelector
                    target={element.to}
                    onChange={(event) => { onTargetHandler({ from: RoomId, to: event.target.value })}}
                />
            return <Box sx={{
                width: "calc(100% - 0.5em)",
                display: "inline-flex",
                flexDirection: "row",
                borderRadius: '0.5em',
                padding: '0.1em',
                margin: '0.25em',
                alignItems: "center"
            }}>
                <Box contentEditable={false} sx={{ display: 'flex', marginRight: '0.5em' }} ><ExitIcon sx={{ fill: "grey" }} /></Box>
                <Box sx={{
                    display: 'flex',
                    minWidth: '12em',
                    borderRadius: '0.25em',
                    borderStyle: "solid",
                    borderWidth: '0.5px',
                    borderColor: 'grey',
                    backgroundColor: "white",
                    padding: '0.1em',
                    paddingLeft: '0.25em',
                    paddingRight: '0.25em'
                }} { ...attributes }>{children}</Box>
                <Box contentEditable={false} sx={{ display: 'flex', flexGrow: 1 }} > from { fromElement } to { toElement }</Box>
                <Box contentEditable={false} sx={{ display: 'flex' }} ><IconButton onClick={onDeleteHandler}><DeleteIcon /></IconButton></Box>
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
        <Toolbar variant="dense" disableGutters sx={{ marginTop: '-0.375em' }}>
            <AddIfButton defaultBlock={{
                type: 'exit',
                key: `${RoomId}#`,
                from: RoomId,
                to: '',
                children: [{ text: '' }]
            }} />
        </Toolbar>
        <Editable
            renderElement={renderElement}
            renderLeaf={renderLeaf}
        />
    </Slate>
}

export default RoomExitEditor
