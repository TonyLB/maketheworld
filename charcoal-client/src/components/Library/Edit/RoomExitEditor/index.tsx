import Box from "@mui/material/Box"
import Chip from "@mui/material/Chip"
import IconButton from "@mui/material/IconButton"
import Typography from "@mui/material/Typography"
import { blue, grey } from "@mui/material/colors"
import { ComponentRenderItem, isNormalExit, isNormalRoom, NormalExit, NormalReference, NormalRoom } from "@tonylb/mtw-wml/dist/normalize/baseClasses"
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
import { CustomBlock, CustomExitBlock, isCustomBlock } from "../baseClasses"
import { useDebouncedOnChange } from "../../../../hooks/useDebounce"
import { Button } from "@mui/material"
import { taggedMessageToString } from "@tonylb/mtw-interfaces/dist/messages"
import { objectMap } from "../../../../lib/objects"

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

const ExitTargetSelector: FunctionComponent<{ target: string; inherited?: boolean; AssetId?: string; onChange: (event: SelectChangeEvent<string>) => void }> = ({ target, inherited, AssetId, onChange }) => {
    const { rooms, readonly, importData } = useLibraryAsset()
    const roomNamesInScope: Record<string, ComponentRenderItem[]> = AssetId
        ? Object.entries(importData(AssetId))
            .filter(([_, item]) => (isNormalRoom(item)))
            .map(([key, { appearances }]): [string, ComponentRenderItem[]] => ([key, (appearances as NormalRoom["appearances"])
                .filter(({ contextStack }) => (!contextStack.find(({ tag }) => (tag === 'If'))))
                .map(({ name = [] }) => name)
                .reduce((previous, name) => ([ ...previous, ...name ]), [])]))
            .reduce((previous, [key, item]) => ({ ...previous, [key]: item }), {})
        : objectMap(rooms, ({ name }) => (name))
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
            disabled={readonly || inherited}
        >
            {
                Object.entries(roomNamesInScope).map(([key, name]) => {
                    return <MenuItem key={key} value={key}>{ taggedMessageToString(name) }</MenuItem>
                })
            }
        </Select>
    </FormControl>
}

const InheritedExits: FunctionComponent<{ importFrom: string; RoomId: string }> = ({ importFrom, RoomId }) => {

    //
    // TODO: Add "inherited" property to Element, and use it to remove delete button, deactivate swap button, and read-only selects
    //
    const { importData } = useLibraryAsset()
    const importNormal = useMemo(() => (importData(importFrom)), [importData, importFrom])
    const inheritedExits = useMemo<Descendant[]>(() => {
        if (!importNormal) {
            return []
        }
        const relevantExits = Object.values(importNormal)
            .filter(isNormalExit)
            .filter(({ to, from }) => (to === RoomId || from === RoomId))
            .reduce(reduceItemsToTree({
                compare: (A: string, B: string) => (A === B),
                normalForm: importNormal,
                transform: ({ key }: NormalExit) => (key)
            }), { items: [], conditionals: [] })
        return exitTreeToSlate(importNormal)(relevantExits)
    }, [importNormal, RoomId])
    const editor = useMemo(() => withConditionals(withHistory(withReact(createEditor()))), [])
    const renderElement = useCallback(props => (<Element inherited RoomId={RoomId} { ...props } />), [RoomId])
    const renderLeaf = useCallback(props => <Leaf {...props} />, [])
    useEffect(() => {
        //
        // Since slate-react doesn't seem to catch up to reactive changes in the value of a Slate
        // object, we need to manually reset the value on a change
        //
        editor.children = inheritedExits
        Editor.normalize(editor, { force: true })
    }, [editor, inheritedExits])

    if ((inheritedExits || []).length === 0) {
        return null
    }

    return <Box sx={{ position: "relative", width: "calc(100% - 0.1em)", display: 'inline-block' }}>
        <Box
            sx={{
                borderRadius: "0em 1em 1em 0em",
                borderStyle: 'solid',
                borderColor: grey[500],
                background: grey[100],
                display: 'inline',
                paddingRight: '0.25em',
                position: 'absolute',
                top: 0,
                left: 0
            }}
        >
            Inherited
        </Box>
        <Box
            sx={{
                borderRadius: '0em 1em 1em 0em',
                borderStyle: 'solid',
                borderColor: grey[500],
                background: grey[50],
                paddingRight: '0.5em',
                paddingLeft: '0.25em',
                paddingTop: "0.5em",
                marginTop: '1em',
            }}
        >
            <Slate editor={editor} value={inheritedExits}>
                <Editable
                    readOnly
                    renderElement={renderElement}
                    renderLeaf={renderLeaf}
                />
            </Slate>
        </Box>
    </Box>
}

const Element: FunctionComponent<RenderElementProps & { RoomId: string; inherited?: boolean }> = ({ RoomId, inherited, ...props }) => {
    const editor = useSlate()
    const { readonly, rooms } = useLibraryAsset()
    const { attributes, children, element } = props
    const path = useMemo(() => (ReactEditor.findPath(editor, element)), [editor, element])
    const AssetId = useMemo(() => (rooms[RoomId].importFrom), [rooms, RoomId])
    const onDeleteHandler = useCallback(() => {
        Transforms.removeNodes(editor, { at: path })
    }, [editor, path])
    const onFlipHandler = useCallback(() => {
        if (!(readonly || inherited) && element.type === 'exit') {
            Transforms.setNodes(editor, { to: element.from, from: element.to }, { at: path })
        }
    }, [element, editor, path, readonly, inherited])
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
                    inherited={inherited}
                    AssetId={AssetId}
                    onChange={(event) => { onTargetHandler({ to: RoomId, from: event.target.value })}}
                />
            const toElement = (element.to === RoomId)
                ? hereChip
                : <ExitTargetSelector
                    target={element.to}
                    inherited={inherited}
                    AssetId={AssetId}
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
                { !inherited && <Box contentEditable={false} sx={{ display: 'flex' }} ><IconButton onClick={onDeleteHandler} disabled={readonly}><DeleteIcon /></IconButton></Box> }
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
    const onClick = useCallback(() => {
        wrapExitBlock(editor, RoomId)
    }, [editor])
    return <Button
        variant="outlined"
        disabled={readonly}
        onClick={onClick}
    >
        <AddIcon /><ExitIcon />
    </Button>
}

export const RoomExitEditor: FunctionComponent<RoomExitEditorProps> = ({ RoomId }) => {
    const editor = useMemo(() => withConditionals(withHistory(withReact(createEditor()))), [])
    const { normalForm, updateNormal, readonly, components } = useLibraryAsset()
    const { importFrom } = useMemo(() => (components[RoomId]), [components, RoomId])
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
            <InheritedExits importFrom={importFrom} RoomId={RoomId} />
            <Slate editor={editor} value={value} onChange={setValue}>
                <Editable
                    renderElement={renderElement}
                    renderLeaf={renderLeaf}
                    readOnly={readonly || !value.find((item) => (isCustomBlock(item) && ["ifBase", "elseIf", "else", "exit"].includes(item.type))) }
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
