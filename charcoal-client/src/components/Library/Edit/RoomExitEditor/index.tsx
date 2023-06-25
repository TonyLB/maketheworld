import Box from "@mui/material/Box"
import Chip from "@mui/material/Chip"
import IconButton from "@mui/material/IconButton"
import Typography from "@mui/material/Typography"
import { blue, grey } from "@mui/material/colors"
import { ComponentRenderItem, isNormalExit, isNormalRoom, NormalExit, NormalForm, NormalReference, NormalRoom } from "@tonylb/mtw-wml/dist/normalize/baseClasses"
import React, { FunctionComponent, useCallback, useEffect, useMemo, useState } from "react"
import { createEditor, Descendant, Transforms } from "slate"
import { ConditionalTree, reduceItemsToTree } from "../conditionTree"
import { useLibraryAsset } from "../LibraryAsset"
import ExitIcon from '@mui/icons-material/CallMade'
import DeleteIcon from '@mui/icons-material/Delete'
import FlipIcon from '@mui/icons-material/Loop'
import Select, { SelectChangeEvent } from "@mui/material/Select"
import MenuItem from "@mui/material/MenuItem"
import FormControl from "@mui/material/FormControl"
import InputLabel from "@mui/material/InputLabel"
import { useDebouncedOnChange } from "../../../../hooks/useDebounce"
import { Button, TextField } from "@mui/material"
import { taggedMessageToString } from "@tonylb/mtw-interfaces/dist/messages"
import { objectFilterEntries, objectMap } from "../../../../lib/objects"
import { useOnboardingCheckpoint } from "../../../Onboarding/useOnboarding"
import { UpdateNormalPayload } from "../../../../slices/personalAssets/reducers"
import duplicateExitTargets from "./duplicateExitTargets"
import { RoomExit } from "./baseClasses"
import exitTreeToSchema from "./exitTreeToSchema"
import IfElseTree from "../IfElseTree"
import { toSpliced } from "../../../../lib/lists"

type RoomExitEditorProps = {
    RoomId: string;
    onChange: (value: string) => void;
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

type RoomExitComponentProps = RoomExit & {
    RoomId: string;
    onChange: (value: RoomExit) => void;
    onDelete: () => void;
    inherited?: boolean;
}

const RoomExitComponent: FunctionComponent<RoomExitComponentProps> = ({ RoomId, onChange, onDelete, inherited = false, from, to, name }) => {
    const { readonly, rooms } = useLibraryAsset()
    useOnboardingCheckpoint('addExit', { requireSequence: true, condition: Boolean(!inherited && (from === RoomId) && name)})
    useOnboardingCheckpoint('addExitBack', { requireSequence: true, condition: Boolean(!inherited && (to === RoomId) && name)})
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

const useExitTree = (normalForm: NormalForm, RoomId: string) => {
    return useMemo(() => {
        return Object.values(normalForm || {})
            .filter(isNormalExit)
            .filter(({ to, from }) => (to === RoomId || from === RoomId))
            .reduce(reduceItemsToTree({
                compare: ({ key: keyA }: RoomExit, { key: keyB }: RoomExit) => (keyA === keyB),
                normalForm,
                transform: ({ key, to, from, name }: NormalExit): RoomExit => ({ key, to, from, name: name ?? '' })
            }), { items: [], conditionals: [] })
    }, [normalForm, RoomId])
}

const InheritedExits: FunctionComponent<{ importFrom: string; RoomId: string }> = ({ importFrom, RoomId }) => {
    const { importData } = useLibraryAsset()
    const importNormal = useMemo(() => (importData(importFrom)), [importData, importFrom])
    const inheritedExits = useExitTree(importNormal, RoomId)

    if (inheritedExits.conditionals.length + inheritedExits.items.length === 0) {
        return null
    }

    return <IfElseTree
        items={inheritedExits.items}
        conditionals={inheritedExits.conditionals}
        onChange={() => {}}
        render={(props) => (<RoomExitComponent {...props} RoomId={RoomId} />)}
        addItemIcon={<ExitIcon />}
        defaultItem={{ key: `${RoomId}#`, from: RoomId, to: '', name: '' }}
    />
}
export const RoomExitEditor: FunctionComponent<RoomExitEditorProps> = ({ RoomId }) => {
    const { normalForm, updateNormal, readonly, components } = useLibraryAsset()
    const { importFrom } = useMemo(() => (components[RoomId]), [components, RoomId])
    const relevantExits = useExitTree(normalForm, RoomId)
    const [value, setValue] = useState(relevantExits)
    const onChangeHandler = useCallback((tree: ConditionalTree<RoomExit>) => {
        const changes = generateNormalChanges({ tree, normalForm, RoomId })
        changes.forEach((change) => {
            updateNormal(change)
        })
    }, [RoomId, normalForm, updateNormal])
    useDebouncedOnChange({ value, delay: 1000, onChange: onChangeHandler })
    // const comparisonOutput = useCallback((tree: ConditionalTree<RoomExit>) => (generateNormalChanges({ tree, normalForm, RoomId })), [normalForm, RoomId])
    //
    // TODO: Create a useEffect hook to update the state to match relevantExits when relevantExits changes in a way that has a differential between
    // the current state and the state coming in from the normalForm
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
