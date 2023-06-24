import Box from "@mui/material/Box"
import Chip from "@mui/material/Chip"
import IconButton from "@mui/material/IconButton"
import Typography from "@mui/material/Typography"
import { blue, grey } from "@mui/material/colors"
import { ComponentRenderItem, isNormalExit, isNormalRoom, NormalExit, NormalForm, NormalReference, NormalRoom } from "@tonylb/mtw-wml/dist/normalize/baseClasses"
import React, { FunctionComponent, useCallback, useEffect, useMemo, useState } from "react"
import { createEditor, Descendant, Editor, Transforms, Element as SlateElement } from "slate"
import { withHistory } from "slate-history"
import { Editable, ReactEditor, RenderElementProps, Slate, useSlate, withReact } from "slate-react"
import { ConditionalTree, ConditionalTreeNode, reduceItemsToTree } from "../conditionTree"
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
import { CustomExitBlock, isCustomBlock, isCustomExitBlock, isCustomParagraph } from "../baseClasses"
import { useDebouncedOnChange } from "../../../../hooks/useDebounce"
import { Button, TextField } from "@mui/material"
import { taggedMessageToString } from "@tonylb/mtw-interfaces/dist/messages"
import { objectFilterEntries, objectMap } from "../../../../lib/objects"
import useUpdatedSlate from "../../../../hooks/useUpdatedSlate"
import { useOnboardingCheckpoint } from "../../../Onboarding/useOnboarding"
import { UpdateNormalPayload } from "../../../../slices/personalAssets/reducers"
import duplicateExitTargets from "./duplicateExitTargets"
import withExitWrapping from "./wrapExit"
import { RoomExit } from "./baseClasses"
import exitTreeToSchema from "./exitTreeToSchema"
import IfElseTree from "../IfElseTree"
import { toSpliced } from "../../../../lib/lists"

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

const ExitTargetSelector: FunctionComponent<{ RoomId: string; target: string; inherited?: boolean; AssetId?: string; onChange: (event: SelectChangeEvent<string>) => void }> = ({ RoomId, target, inherited, AssetId, onChange }) => {
    const { rooms, readonly, importData } = useLibraryAsset()
    const roomNamesInScope: Record<string, ComponentRenderItem[]> = objectFilterEntries(
        (inherited && AssetId)
            ? Object.entries(importData(AssetId))
                .filter(([_, item]) => (isNormalRoom(item)))
                .map(([key, { appearances }]): [string, ComponentRenderItem[]] => ([key, (appearances as NormalRoom["appearances"])
                    .filter(({ contextStack }) => (!contextStack.find(({ tag }) => (tag === 'If'))))
                    .map(({ name = [] }) => name)
                    .reduce((previous, name) => ([ ...previous, ...name ]), [])]))
                .reduce((previous, [key, item]) => ({ ...previous, [key]: item }), {})
            : objectMap(rooms, ({ name }) => (name)),
        ([key]) => (key !== RoomId)
    )
    const onChangeHandler = useCallback((event: SelectChangeEvent<string>) => {
        if (!readonly) {
            onChange(event)
        }
    }, [onChange, readonly])
    return <FormControl sx={{ m: 1, minWidth: 120 }} size="small">
        <InputLabel id="select-small">Target</InputLabel>
        <Select
            sx={{ background: 'white' }}
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

const generateNormalChanges = ({ tree, RoomId, normalForm }: { tree: ConditionalTree<RoomExit>; RoomId: string; normalForm: NormalForm }) => {
    let changes: UpdateNormalPayload[] = []
    const deleteReferences = Object.values(normalForm)
        .filter(isNormalExit)
        .filter(({ to, from }) => (to === RoomId || from === RoomId))
        .reduce<NormalReference[]>((previous, { key, appearances = [] }) => ([
            ...previous,
            ...appearances.map((_, index) => ({ key, index, tag: 'Exit' as 'Exit' })).reverse()
        ]), [])
    if (deleteReferences.length) {
        changes = [
            ...changes,
            {
                type: 'delete',
                references: deleteReferences
            }
        ]
    }
    const exitSchemaByRoomId = exitTreeToSchema(tree)
    Object.keys(exitSchemaByRoomId).forEach((lookupRoomId) => {
        const roomLookup = normalForm[lookupRoomId]
        if (roomLookup && isNormalRoom(roomLookup)) {
            exitSchemaByRoomId[lookupRoomId].forEach((item) => {
                const firstUnconditionedAppearance = (roomLookup.appearances || []).findIndex(({ contextStack }) => (!contextStack.find(({ tag }) => (tag === 'If' || tag === 'Map'))))
                if (firstUnconditionedAppearance !== -1) {
                    const contextStack = roomLookup.appearances[firstUnconditionedAppearance].contextStack
                    changes = [
                        ...changes,
                        {
                            type: 'put',
                            item,
                            position: { contextStack: [...contextStack, { key: lookupRoomId, index: firstUnconditionedAppearance, tag: 'Room' }] }
                        }
                    ]
                }
            })
        }
    })
    return changes
}

const InheritedExits: FunctionComponent<{ importFrom: string; RoomId: string }> = ({ importFrom, RoomId }) => {
    const { importData } = useLibraryAsset()
    const importNormal = useMemo(() => (importData(importFrom)), [importData, importFrom])
    const inheritedExits = useMemo<Descendant[]>(() => {
        if (!importNormal) {
            return []
        }
        const relevantExits = Object.values(importNormal)
            //
            // TODO: Abstract the similar translation function in the main component, and use it here, so you're not repeating yourself
            //
            .filter(isNormalExit)
            .filter(({ to, from }) => (to === RoomId || from === RoomId))
            .reduce(reduceItemsToTree({
                compare: (A: string, B: string) => (A === B),
                normalForm: importNormal,
                transform: ({ key }: NormalExit) => (key)
            }), { items: [], conditionals: [] })
        return exitTreeToSlate(importNormal)(relevantExits)
    }, [importNormal, RoomId])
    const renderElement = useCallback(props => (<Element inherited RoomId={RoomId} { ...props } />), [RoomId])
    const renderLeaf = useCallback(props => <Leaf {...props} />, [])
    const editor = useUpdatedSlate({
        initializeEditor: () => withConditionals(withHistory(withReact(createEditor()))),
        value: inheritedExits,
        comparisonOutput: () => 'Test'
    })

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
    const path = ReactEditor.findPath(editor, element)
    const AssetId = useMemo(() => (rooms[RoomId].importFrom), [rooms, RoomId])
    const onDeleteHandler = useCallback(() => {
        Transforms.removeNodes(editor, { at: path })
        if (editor.children.length === 0) {
            Transforms.insertNodes(editor, {
                type: 'paragraph',
                children: [{ text: '' }]
            })
        }
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
    useOnboardingCheckpoint('addExit', { requireSequence: true, condition: (!inherited && (element.type === 'exit') && (element.from === RoomId) && children.find((item) => ('text' in item && item.text)))})
    useOnboardingCheckpoint('addExitBack', { requireSequence: true, condition: (!inherited && (element.type === 'exit') && (element.to === RoomId) && children.find((item) => ('text' in item && item.text)))})
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
                    RoomId={RoomId}
                    target={element.from}
                    inherited={inherited}
                    AssetId={AssetId}
                    onChange={(event) => { onTargetHandler({ to: RoomId, from: event.target.value })}}
                />
            const toElement = (element.to === RoomId)
                ? hereChip
                : <ExitTargetSelector
                    RoomId={RoomId}
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

type RoomExitComponentProps = RoomExit & {
    RoomId: string;
    onChange: (value: RoomExit) => void;
    onDelete: () => void;
    inherited?: boolean;
}

const RoomExitComponent: FunctionComponent<RoomExitComponentProps> = ({ RoomId, onChange, onDelete, inherited = false, from, to, name }) => {
    const { readonly, rooms } = useLibraryAsset()
    const AssetId = useMemo(() => (rooms[RoomId].importFrom), [rooms, RoomId])
    const onFlipHandler = useCallback(() => {
        if (!(readonly || inherited)) {
            onChange({
                key: `${to}#${from}`,
                from: to,
                to: from,
                name
            })
        }
    }, [readonly, inherited, onChange, from, to, name])
    const onTargetHandler = useCallback(({ to, from }: { to: string, from: string }) => {
        onChange({
            key: `${from}#${to}`,
            to,
            from,
            name
        })
    }, [name, onChange])
    const onNameChange = useCallback((event) => {
        onChange({
            key: `${from}#${to}`,
            from,
            to,
            name: event.target.value
        })
    }, [to, from, onChange])
    const hereChip = <Chip icon={<FlipIcon />} label="here" onClick={onFlipHandler} />
    const fromElement = (from === RoomId)
        ? hereChip
        : <ExitTargetSelector
            RoomId={RoomId}
            target={from}
            inherited={inherited}
            AssetId={AssetId}
            onChange={(event) => { onTargetHandler({ to: RoomId, from: event.target.value })}}
        />
    const toElement = (to === RoomId)
        ? hereChip
        : <ExitTargetSelector
            RoomId={RoomId}
            target={to}
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
        <Box sx={{ display: 'flex', marginRight: '0.5em' }} ><ExitIcon sx={{ fill: "grey" }} /></Box>
        <Box sx={{
            display: 'flex',
            minWidth: '12em'
        }}>
            <TextField
                sx={{ background: 'white' }}
                hiddenLabel
                size="small"
                required
                id="exit-name"
                value={name}
                onChange={onNameChange}
                disabled={readonly || inherited}
            />
        </Box>
        <Box sx={{ display: 'flex', flexGrow: 1, alignItems: "center" }}> from { fromElement } to { toElement }</Box>
        { !inherited && <Box sx={{ display: 'flex' }} ><IconButton onClick={onDelete} disabled={readonly}><DeleteIcon /></IconButton></Box> }
    </Box>
}

export const RoomExitEditor: FunctionComponent<RoomExitEditorProps> = ({ RoomId }) => {
    const { normalForm, updateNormal, readonly, components } = useLibraryAsset()
    const { importFrom } = useMemo(() => (components[RoomId]), [components, RoomId])
    const relevantExits = useMemo(() => (
        Object.values(normalForm)
            .filter(isNormalExit)
            .filter(({ to, from }) => (to === RoomId || from === RoomId))
            .reduce(reduceItemsToTree({
                compare: ({ key: keyA }: RoomExit, { key: keyB }: RoomExit) => (keyA === keyB),
                normalForm,
                transform: ({ key, to, from, name }: NormalExit): RoomExit => ({ key, to, from, name: name ?? '' })
            }), { items: [], conditionals: [] })
        ), [normalForm, RoomId])
    const [value, setValue] = useState(relevantExits)
    // const comparisonOutput = useCallback((nodes: Descendant[]) => (generateNormalChanges({ nodes, normalForm, RoomId })), [normalForm, RoomId])
    const onChangeHandler = useCallback((nodes: Descendant[]) => {
        //
        // TODO: Refactor generateNormalChanges to use ConditionTree<RoomExit> rather than Descendant[]
        //

        // const changes = generateNormalChanges({ nodes, normalForm, RoomId })
        // changes.forEach((change) => {
        //     updateNormal(change)
        // })
    }, [RoomId, normalForm, updateNormal])
    // useDebouncedOnChange({ value, delay: 1000, onChange: onChangeHandler })

    //
    // TODO: Replace Slate editor with RoomExitTree call
    //
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
            <IfElseTree
                items={value.items}
                conditionals={value.conditionals}
                onChange={setValue}
                render={(props) => (<RoomExitComponent {...props} RoomId={RoomId} />)}
                addItemIcon={<ExitIcon />}
                defaultItem={{ key: `${RoomId}#`, from: RoomId, to: '', name: '' }}
            />
        </Box>
    </Box>
}

export default RoomExitEditor
