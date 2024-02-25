import React, { FunctionComponent, useCallback, useMemo } from "react"
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
import { SchemaConditionFallthroughTag, SchemaConditionStatementTag, SchemaConditionTag, SchemaExitTag, SchemaRoomTag, SchemaTag, SchemaTaggedMessageLegalContents, isSchemaCondition, isSchemaConditionStatement, isSchemaExit, isSchemaOutputTag, isSchemaRoom, isSchemaTaggedMessageLegalContents } from "@tonylb/mtw-wml/dist/schema/baseClasses"
import { GenericTree, GenericTreeNode, GenericTreeNodeFiltered, TreeId } from "@tonylb/mtw-wml/dist/tree/baseClasses"
import { selectKeysByTag } from '@tonylb/mtw-wml/dist/normalize/selectors/keysByTag'
import { selectName, selectNameAsString } from '@tonylb/mtw-wml/dist/normalize/selectors/name'
import { schemaOutputToString } from '@tonylb/mtw-wml/dist/schema/utils/schemaOutput/schemaOutputToString'
import { treeTypeGuard } from "@tonylb/mtw-wml/dist/tree/filter"
import { select } from "slate"
import { updateSchema } from "../../../../slices/personalAssets"
import { genericIDFromTree } from "@tonylb/mtw-wml/dist/tree/genericIDTree"

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

type EditExitProps = {
    node: GenericTreeNodeFiltered<SchemaExitTag, SchemaTag, TreeId>;
    RoomId: string;
    addExit: (args: { from: string; to: string; name: string }) => void;
    inherited?: boolean;
}

const EditExit: FunctionComponent<EditExitProps> = ({ node, RoomId, inherited, addExit }) => {
    const { readonly, updateSchema } = useLibraryAsset()
    const { data, children, id } = node
    const name = selectNameAsString(children)
    useOnboardingCheckpoint('addExit', { requireSequence: true, condition: Boolean(!inherited && name)})
    useOnboardingCheckpoint('addExitBack', { requireSequence: true, condition: Boolean(!inherited && data.from !== RoomId && name)})
    const targetElement = <ExitTargetSelector
        target={data.to}
        RoomId={data.from}
        inherited={inherited}
        onChange={(event) => {
            updateSchema({ type: 'delete', id })
            addExit({ from: data.from, to: event.target.value, name: selectNameAsString(children) })
        }}
    />
    return <Box
        key={id}
        sx={{
            width: "calc(100% - 0.5em)",
            display: "inline-flex",
            flexDirection: "row",
            borderRadius: '0.5em',
            padding: '0.1em',
            margin: '0.25em',
            alignItems: "center"
        }}
    >
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
                onChange={(event) => { updateSchema({ type: 'replace', id, item: { data, children: [{ data: { tag: 'String', value: event.target.value }, children: [] }]} }) } }
                disabled={readonly || inherited}
            />
        </Box>
        <Box sx={{ display: 'flex', flexGrow: 1, alignItems: "center" }}>{ targetElement }</Box>
        { !inherited && <Box sx={{ display: 'flex' }} ><IconButton onClick={() => { updateSchema({ type: 'delete', id }) }} disabled={readonly}><DeleteIcon /></IconButton></Box> }
    </Box>
}


type RoomExitComponentProps = {
    RoomId: string;
    node: GenericTreeNode<SchemaTag, TreeId>;
    addExit: (node: GenericTreeNode<SchemaTag>) => void;
    inherited?: boolean;
}

//
// TODO: Refactor RoomExitComponent to receive If > Room > Exit for both incoming and outgoing
// exits, and to derive direction from comparing the Room element against passed RoomId
//
const RoomExitComponent: FunctionComponent<RoomExitComponentProps> = ({ RoomId, node, addExit, inherited = false }) => {
    if (isSchemaRoom(node.data)) {
        const from = node.data
        return <React.Fragment>
            {
                node.children.map(({ data, children, id }) => {
                    if (!isSchemaExit(data)) {
                        throw new Error('Invalid entry to RoomExitComponent')
                    }
                    return <EditExit
                        RoomId={from.key}
                        node={{ data, children, id }}
                        addExit={({ from: fromId, to, name }) => {
                            addExit({
                                data: from,
                                children: [{
                                    data: { tag: 'Exit', from: fromId, to, key: `${fromId}#${to}` },
                                    children: [{ data: { tag: 'String', value: name }, children: [] }]
                                }]
                            })
                        }}
                        inherited={inherited} />
                })
            }
        </React.Fragment>
    }
    else if (isSchemaCondition(node.data)) {
        return <React.Fragment>
            { node.children.map((conditionNode, index) => {
                return conditionNode.children.map((conditionContents) => {
                    return <RoomExitComponent
                        RoomId={RoomId}
                        node={conditionContents}
                        addExit={(node) => {
                            addExit({
                                data: { tag: 'If' },
                                children: node.children.map((siblingNode, siblingIndex) => ({
                                    data: siblingNode.data,
                                    children: siblingIndex === index
                                        ? [node]
                                        : []
                                }))
                            })
                        }}
                    />
                })
            })}
        </React.Fragment>
    }
    else {
        throw new Error('Invalid entry to RoomExitComponent')
    }
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
    const { schema, select, updateSchema } = useLibraryAsset()

    const exitTree = select({ selector: (tree) => {
        const tagTree = new SchemaTagTree(tree)
        return tagTree
            .reordered([{ connected: [{ match: 'If' }, { or: [{ match: 'Statement' }, { match: 'Fallthrough' }]}] }, { match: 'Room' }, { match: 'Exit' }])
            .filter({ match: 'Exit' })
            .prune({ not: { or: [{ connected: [{ match: 'If' }, { or: [{ match: 'Statement' }, { match: 'Fallthrough' }]}] }, { match: 'Room' },  { match: 'Exit' }, { after: { match: 'Exit' } }] }})
            .tree    
    }})

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
            { exitTree.map((node) => (
                <RoomExitComponent RoomId={RoomId} node={genericIDFromTree([node])[0]} addExit={(node) => { updateSchema({ type: 'addChild', id: schema[0].id, item: node })}} />
            ))}
            {/* <InheritedExits importFrom={importFrom} RoomId={RoomId} /> */}
            {/* <IfElseTree
                tree={outgoingExits}
                parentId={schema[0]?.id ?? ''}
                render={(props) => (<RoomExitComponent node={props.node} parentId={props.parentId} RoomId={RoomId} />)}
                addItemIcon={<ExitIcon />}
                defaultItem={{ data: { tag: 'Exit', key: `${RoomId}#`, from: RoomId, to: '' }, children: [] }}
            /> */}
            {/* { outgoingExits.map((node) => {
                if (isSchemaCondition(node.data)) {
                    return <IfElseTree
                        tree={treeTypeGuard({ tree: node.children, typeGuard: (subNode): subNode is SchemaConditionStatementTag | SchemaConditionFallthroughTag => (['Statement', 'Fallthrough'].includes(subNode.data.tag)) }) }
                        render={(props) => (<RoomExitComponent tree={props.} RoomId={RoomId} />)}
                }
                else {

                }
            })} */}
        </Box>
    </Box>
}

export default RoomExitEditor
