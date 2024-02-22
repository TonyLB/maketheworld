import { FunctionComponent, useCallback, useMemo } from "react"
import Box from "@mui/material/Box"
import IconButton from "@mui/material/IconButton"
import Typography from "@mui/material/Typography"
import { blue } from "@mui/material/colors"
import { SchemaTagTree } from '@tonylb/mtw-wml/dist/tagTree/schema'
import { useLibraryAsset } from "../LibraryAsset"
import ExitIcon from '@mui/icons-material/CallMade'
import DeleteIcon from '@mui/icons-material/Delete'
import Select, { SelectChangeEvent } from "@mui/material/Select"
import MenuItem from "@mui/material/MenuItem"
import FormControl from "@mui/material/FormControl"
import InputLabel from "@mui/material/InputLabel"
import { TextField } from "@mui/material"
import { useOnboardingCheckpoint } from "../../../Onboarding/useOnboarding"
import IfElseTree from "../IfElseTree"
import { SchemaConditionTag, SchemaExitTag, SchemaRoomTag, SchemaTag, SchemaTaggedMessageLegalContents, isSchemaExit, isSchemaOutputTag, isSchemaRoom, isSchemaTaggedMessageLegalContents } from "@tonylb/mtw-wml/dist/schema/baseClasses"
import { GenericTree, GenericTreeNode, TreeId } from "@tonylb/mtw-wml/dist/tree/baseClasses"
import { selectKeysByTag } from '@tonylb/mtw-wml/dist/normalize/selectors/keysByTag'
import { selectName } from '@tonylb/mtw-wml/dist/normalize/selectors/name'
import { schemaOutputToString } from '@tonylb/mtw-wml/dist/schema/utils/schemaOutput/schemaOutputToString'
import { treeTypeGuard } from "@tonylb/mtw-wml/dist/tree/filter"

type RoomExitEditorProps = {
    RoomId: string;
    onChange: (value: string) => void;
}

const ExitTargetSelector: FunctionComponent<{ RoomId: string; target: string; inherited?: boolean; onChange: (event: SelectChangeEvent<string>) => void }> = ({ RoomId, target, inherited, onChange }) => {
    const { readonly, select } = useLibraryAsset()
    const roomKeys = select({ selector: selectKeysByTag('Room') })
    const roomNamesInScope: Record<string, string> = Object.assign({},
        ...roomKeys
            .filter((key) => (key !== RoomId))
            .map((key) => ({
                [key]: schemaOutputToString(select({ key, selector: selectName }))
            }))
    )
    const onChangeHandler = useCallback((event: SelectChangeEvent<string>) => {
        if (!readonly) {
            onChange(event)
        }
    }, [onChange, readonly])
    //
    // Sometimes targets are transitionally not legal (particularly when React is resorting its
    // component tree after a room rename), so render something that won't throw an ephemeral error
    //
    if (!(target in roomNamesInScope)) {
        return null
    }
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
                    return <MenuItem key={key} value={key}>{ name }</MenuItem>
                })
            }
        </Select>
    </FormControl>
}

type RoomExitComponentProps = {
    RoomId: string;
    parentId: string; // The location in which different incoming exits should be added ... either top-level, or nested in a condition
    node: GenericTreeNode<SchemaTag, TreeId>;
    inherited?: boolean;
}

//
// TODO: Refactor RoomExitComponent to receive EITHER an Exit (no children) for outgoing
// exits, or a Room with a single Exit as child for incoming exits.
//
const RoomExitComponent: FunctionComponent<RoomExitComponentProps> = ({ RoomId, parentId, node, inherited = false }) => {
    const { readonly, updateSchema } = useLibraryAsset()
    const isSchemaRoomOrExit = (item: SchemaTag): item is SchemaRoomTag | SchemaExitTag | SchemaTaggedMessageLegalContents => (['Room', 'Exit'].includes(item.tag) || isSchemaTaggedMessageLegalContents(item))
    const filteredNodes = treeTypeGuard({ tree: [node], typeGuard: isSchemaRoomOrExit })
    const { data, children, id } = filteredNodes?.[0] ?? { data: { tag: 'String', value: '' }, children: [], id: '' }
    const direction = isSchemaRoom(data) ? 'incoming' : 'outgoing'
    //
    // Derive target to display ... either source of incoming exit, or target of outgoing
    //
    const target = useMemo(() => {
        switch(direction) {
            case 'incoming':
                if (!isSchemaRoom(data)) {
                    throw new Error('Tag mismatch in RoomExitComponent')
                }
                return data.key
            case 'outgoing':
                if (!isSchemaExit(data)) {
                    throw new Error('Tag mismatch in RoomExitComponent')
                }
                return data.to
        }
    }, [data, direction])
    const name = useMemo(() => {
        switch(direction) {
            case 'incoming':
                const child = children[0]
                if (!isSchemaExit(child.data)) {
                    throw new Error('Tag mismatch in RoomExitComponent')
                }
                return schemaOutputToString(treeTypeGuard({ tree: child.children, typeGuard: isSchemaOutputTag }))
            case 'outgoing':
                if (!isSchemaExit(data)) {
                    throw new Error('Tag mismatch in RoomExitComponent')
                }
                return schemaOutputToString(treeTypeGuard({ tree: child.children, typeGuard: isSchemaOutputTag }))
        }
    }, [data, children, direction])
    useOnboardingCheckpoint('addExit', { requireSequence: true, condition: Boolean(!inherited && name)})
    useOnboardingCheckpoint('addExitBack', { requireSequence: true, condition: Boolean(!inherited && (direction === 'incoming') && name)})
    const onTargetChange = useCallback((target: string) => {
        if (direction === 'incoming') {
            updateSchema({
                type: 'delete',
                id: filteredNodes[0].id
            })
            updateSchema({
                type: 'addChild',
                id: parentId,
                item: {
                    data: { tag: 'Room', key: target },
                    children: [{ data: { tag: 'Exit', key: `${target}#${RoomId}`, to: RoomId, from: target }, children: [{ data: { tag: 'String', value: name }, children: [] }] }]
                }
            })
        }
        else {
            const { data } = filteredNodes[0]
            if (!isSchemaExit(data)) {
                throw new Error('Tag mismatch in RoomExitComponent')
            }
            updateSchema({
                type: 'updateNode',
                id: node.id,
                item: {
                    ...data,
                    to: target
                }
            })
        }
    }, [filteredNodes, name, parentId, RoomId, direction])
    const onNameChange = useCallback((name: string) => {
        if (direction === 'incoming') {
            const child = children[0]
            const { data, id } = child
            if (!isSchemaExit(data)) {
                throw new Error('Tag mismatch in RoomExitComponent')
            }
            updateSchema({
                type: 'replace',
                id,
                item: {
                    data,
                    children: [{ data: { tag: 'String', value: name }, children: [] }]
                }
            })
        }
        else {
            if (!isSchemaExit(data)) {
                throw new Error('Tag mismatch in RoomExitComponent')
            }
            updateSchema({
                type: 'replace',
                id,
                item: {
                    data,
                    children: [{ data: { tag: 'String', value: name }, children: [] }]
                }
            })
        }
    }, [data, id, children, direction])
    const onDelete = useCallback(() => {
        updateSchema({
            type: 'delete',
            id
        })
    }, [id, updateSchema])
    if (!filteredNodes.length) {
        return null
    }
    const targetElement = <ExitTargetSelector
        target={target}
        RoomId={RoomId}
        inherited={inherited}
        onChange={(event) => { onTargetChange(event.target.value) }}
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
                onChange={(event) => { onNameChange(event.target.value) }}
                disabled={readonly || inherited}
            />
        </Box>
        <Box sx={{ display: 'flex', flexGrow: 1, alignItems: "center" }}>{ targetElement }</Box>
        { !inherited && <Box sx={{ display: 'flex' }} ><IconButton onClick={onDelete} disabled={readonly}><DeleteIcon /></IconButton></Box> }
    </Box>
}

const useOutgoingExitTree = (RoomId: string) => {
    const { schema } = useLibraryAsset()
    return useMemo(() => {
        const tagTree = new SchemaTagTree(schema)
        const relevantExits = tagTree
            .filter({ match: ({ data: tag }) => (isSchemaRoom(tag) && (tag.key === RoomId)) })
            .prune({ not: { or: [{ match: 'If' }, { match: 'Exit' }] } })
            .reordered([{ connected: [{ match: 'If' }, { or: [{ match: 'Statement' }, { match: 'Fallthrough' }]}] }, { match: 'Exit' }])
        return relevantExits.tree as GenericTree<SchemaConditionTag | SchemaExitTag, TreeId>
    }, [schema, RoomId])
}

const useIncomingExitTree = (RoomId: string) => {
    const { schema } = useLibraryAsset()
    return useMemo(() => {
        const tagTree = new SchemaTagTree(schema)
        const relevantExits = tagTree
            .filter({ match: ({ data: tag }) => (isSchemaExit(tag) && tag.to === RoomId) })
            .prune({ not: { or: [{ match: 'If' }, { match: 'Room' }, { match: 'Exit' }] } })
            .reordered([{ connected: [{ match: 'If' }, { or: [{ match: 'Statement' }, { match: 'Fallthrough' }]}] }, { match: 'Room' }, { match: 'Exit' }])
        return relevantExits.tree as GenericTree<SchemaConditionTag | SchemaRoomTag | SchemaExitTag, TreeId>
    }, [schema, RoomId])
}

// const InheritedExits: FunctionComponent<{ importFrom: string; RoomId: string }> = ({ importFrom, RoomId }) => {
//     const { importData } = useLibraryAsset()
//     const importNormal = useMemo(() => (importData(importFrom)), [importData, importFrom])
//     const inheritedExits = useExitTree(importNormal, RoomId)

//     if (inheritedExits.conditionals.length + inheritedExits.items.length === 0) {
//         return null
//     }

//     return <IfElseTree
//         items={inheritedExits.items}
//         conditionals={inheritedExits.conditionals}
//         onChange={() => {}}
//         render={(props) => (<RoomExitComponent {...props} RoomId={RoomId} />)}
//         addItemIcon={<ExitIcon />}
//         defaultItem={{ key: `${RoomId}#`, from: RoomId, to: '', name: '' }}
//     />
// }

export const RoomExitEditor: FunctionComponent<RoomExitEditorProps> = ({ RoomId }) => {
    const { schema, components } = useLibraryAsset()
    const { importFrom } = useMemo(() => (components[RoomId]), [components, RoomId])
    //
    // TODO: Rework RoomExitEditor with outgoing and incoming exit trees
    //
    const outgoingExits = useOutgoingExitTree(RoomId)
    const incomingExits = useIncomingExitTree(RoomId)

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
            {/* <InheritedExits importFrom={importFrom} RoomId={RoomId} /> */}
            <IfElseTree
                tree={outgoingExits}
                parentId={schema[0]?.id ?? ''}
                render={(props) => (<RoomExitComponent node={props.node} parentId={props.parentId} RoomId={RoomId} />)}
                addItemIcon={<ExitIcon />}
                defaultItem={{ data: { tag: 'Exit', key: `${RoomId}#`, from: RoomId, to: '' }, children: [] }}
            />
        </Box>
    </Box>
}

export default RoomExitEditor
