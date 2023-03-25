import Box from "@mui/material/Box"
import Chip from "@mui/material/Chip"
import IconButton from "@mui/material/IconButton"
import Typography from "@mui/material/Typography"
import { blue } from "@mui/material/colors"
import { isNormalExit, isNormalRoom, NormalExit, NormalReference } from "@tonylb/mtw-wml/dist/normalize/baseClasses"
import React, { FunctionComponent, useCallback, useEffect, useMemo, useState } from "react"
import { createEditor, Descendant, Editor, Node, Path, Transforms } from "slate"
import { withHistory } from "slate-history"
import { Editable, ReactEditor, RenderElementProps, Slate, useSlate, withReact } from "slate-react"
import { reduceItemsToTree } from "../conditionTree"
import { useLibraryAsset } from "../LibraryAsset"
import SlateIfElse, { AddIfButton } from "../SlateIfElse"
import exitTreeToSlate from "./exitTreeToSlate"
import AddIcon from '@mui/icons-material/Add'
import ExitIcon from '@mui/icons-material/CallMade'
import DeleteIcon from '@mui/icons-material/Delete'
import FlipIcon from '@mui/icons-material/Loop'
import Select, { SelectChangeEvent } from "@mui/material/Select"
import MenuItem from "@mui/material/MenuItem"
import FormControl from "@mui/material/FormControl"
import InputLabel from "@mui/material/InputLabel"
import Toolbar from "@mui/material/Toolbar/Toolbar"
import withConditionals from "../DescriptionEditor/conditionals"
import slateToExitSchema from "./slateToExitTree"
import { CustomExitBlock, isCustomBlock } from "../baseClasses"
import { useDebouncedOnChange } from "../../../../hooks/useDebounce"
import { Button } from "@mui/material"
import { taggedMessageToString } from "@tonylb/mtw-interfaces/dist/messages"

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
    const { rooms, readonly } = useLibraryAsset()
    const onChangeHandler = useCallback((event: SelectChangeEvent<string>) => {
        if (!readonly) {
            onChange(event)
        }
    }, [onChange, readonly])
    return <FormControl sx={{ m: 1, minWidth: 120 }} size="small">
        <InputLabel id="select-small">Target</InputLabel>
        <Select
            labelId="select-small"
            id="select-small"
            value={target}
            label="Target"
            onChange={onChangeHandler}
            disabled={readonly}
        >
            {
                Object.entries(rooms).map(([key, { name }]) => {
                    return <MenuItem key={key} value={key}>{ taggedMessageToString(name) }</MenuItem>
                })
            }
        </Select>
    </FormControl>
}

const Element: FunctionComponent<RenderElementProps & { RoomId: string }> = ({ RoomId, ...props }) => {
    const editor = useSlate()
    const { readonly } = useLibraryAsset()
    const { attributes, children, element } = props
    const path = useMemo(() => (ReactEditor.findPath(editor, element)), [editor, element])
    const onDeleteHandler = useCallback(() => {
        Transforms.removeNodes(editor, { at: path })
    }, [editor, path])
    const onFlipHandler = useCallback(() => {
        if (!readonly && element.type === 'exit') {
            Transforms.setNodes(editor, { to: element.from, from: element.to }, { at: path })
        }
    }, [element, editor, path, readonly])
    const onTargetHandler = useCallback(({ to, from }: { to: string; from: string }) => {
        if (element.type === 'exit') {
            Transforms.setNodes(editor, { to, from }, { at: path })
        }
    }, [element, editor, path])
    switch(element.type) {
        case 'ifBase':
        case 'elseif':
        case 'else':
            return <SlateIfElse defaultBlock={{
                type: 'exit',
                key: `${RoomId}#`,
                from: RoomId,
                to: '',
                children: [{ text: '' }]
            }} { ...props } />
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
                    paddingRight: '0.25em',
                }} { ...attributes } spellCheck={false} >{children}</Box>
                <Box contentEditable={false} sx={{ display: 'flex', flexGrow: 1, alignItems: "center" }} > from { fromElement } to { toElement }</Box>
                <Box contentEditable={false} sx={{ display: 'flex' }} ><IconButton onClick={onDeleteHandler} disabled={readonly}><DeleteIcon /></IconButton></Box>
            </Box>
        default: return (
            <p {...attributes}>
                {children}
            </p>
        )
    }
}

const wrapExitBlock = (editor: Editor, RoomId: string) => {
    const block: CustomExitBlock = {
        type: 'exit',
        key: `${RoomId}#`,
        from: RoomId,
        to: '',
        children: [{ text: '' }]
    }
    Transforms.insertNodes(editor, block)
}

const AddExitButton: FunctionComponent<{ RoomId: string; }> = ({ RoomId }) => {
    const editor = useSlate()
    const { readonly } = useLibraryAsset()
    const { selection } = editor
    const onClick = useCallback(() => {
        wrapExitBlock(editor, RoomId)
    }, [editor])
    return <Button
        variant="outlined"
        disabled={readonly || !selection}
        onClick={onClick}
    >
        <AddIcon /><ExitIcon />
    </Button>
}

export const RoomExitEditor: FunctionComponent<RoomExitEditorProps> = ({ RoomId }) => {
    const editor = useMemo(() => withConditionals(withHistory(withReact(createEditor()))), [])
    const { normalForm, updateNormal, readonly } = useLibraryAsset()
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
    const defaultValue = useMemo(() => (exitTreeToSlate(normalForm)(relevantExits)), [normalForm, relevantExits])
    const [value, setValue] = useState(defaultValue)
    useEffect(() => {
        editor.children = defaultValue
        Editor.normalize(editor, { force: true })
    }, [editor, defaultValue])
    const onChangeHandler = useCallback((nodes: Descendant[]) => {
        const deleteReferences = Object.values(normalForm)
            .filter(isNormalExit)
            .filter(({ to, from }) => (to === RoomId || from === RoomId))
            .reduce<NormalReference[]>((previous, { key, appearances = [] }) => ([
                ...previous,
                ...appearances.map((_, index) => ({ key, index, tag: 'Exit' as 'Exit' })).reverse()
            ]), [])
        if (deleteReferences.length) {
            updateNormal({
                type: 'delete',
                references: deleteReferences
            })
        }
        const exitSchemaByRoomId = slateToExitSchema(nodes.filter(isCustomBlock))
        Object.keys(exitSchemaByRoomId).forEach((lookupRoomId) => {
            const roomLookup = normalForm[lookupRoomId]
            if (roomLookup && isNormalRoom(roomLookup)) {
                exitSchemaByRoomId[lookupRoomId].forEach((item) => {
                    //
                    // TODO: Refactor slateToExitSchema to return separate node lists that need to be added into
                    // the various rooms *from which* exits originate, then apply them appropriately
                    // to those different rooms.
                    //
                    const firstUnconditionedAppearance = (roomLookup.appearances || []).findIndex(({ contextStack }) => (!contextStack.find(({ tag }) => (tag === 'If' || tag === 'Map'))))
                    if (firstUnconditionedAppearance !== -1) {
                        const contextStack = roomLookup.appearances[firstUnconditionedAppearance].contextStack
                        updateNormal({
                            type: 'put',
                            item,
                            position: { contextStack: [...contextStack, { key: lookupRoomId, index: firstUnconditionedAppearance, tag: 'Room' }] }
                        })    
                    }
                })
            }
        })
    }, [RoomId, normalForm, updateNormal])
    useDebouncedOnChange({ value, delay: 1000, onChange: onChangeHandler })
    const renderLeaf = useCallback(props => (<Leaf { ...props } />), [])
    const renderElement = useCallback(props => (<Element RoomId={RoomId} { ...props } />), [RoomId])
    return <Box sx={{
        display: 'flex',
        flexDirection: 'row',
        marginTop: '0.5em',
        marginLeft: '0.5em'
    }}>
        <Box sx={{
            display: 'flex',
            width: '2em',
            minHeight: '5em',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: blue[50],
            borderTopColor: blue[500],
            borderTopStyle: 'solid',
            borderBottomColor: blue[500],
            borderBottomStyle: 'solid',
            marginRight: '0.5em'
        }}>
            <Typography
                sx={{ transform: 'rotate(-90deg)' }}
                variant="h5"
            >
                Exits
            </Typography>
        </Box>
        <Box sx={{
            display: 'flex',
            flexDirection: 'column',
            flexGrow: 1,
        }}>
            <Slate editor={editor} value={value} onChange={setValue}>
                <Editable
                    renderElement={renderElement}
                    renderLeaf={renderLeaf}
                    readOnly={readonly}
                />
                <Toolbar variant="dense" disableGutters sx={{ marginTop: '-0.375em' }}>
                    <AddExitButton RoomId={RoomId} />
                    <AddIfButton defaultBlock={{
                        type: 'exit',
                        key: `${RoomId}#`,
                        from: RoomId,
                        to: '',
                        children: [{ text: '' }]
                    }} />
                </Toolbar>
            </Slate>
        </Box>
    </Box>
}

export default RoomExitEditor
