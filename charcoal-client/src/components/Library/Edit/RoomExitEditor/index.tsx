import React, { FunctionComponent, useCallback, useMemo } from "react"
import Box from "@mui/material/Box"
import IconButton from "@mui/material/IconButton"
import { grey } from "@mui/material/colors"
import { useLibraryAsset } from "../LibraryAsset"
import ExitIcon from '@mui/icons-material/CallMade'
import DeleteIcon from '@mui/icons-material/Delete'
import Select, { SelectChangeEvent } from "@mui/material/Select"
import MenuItem from "@mui/material/MenuItem"
import FormControl from "@mui/material/FormControl"
import InputLabel from "@mui/material/InputLabel"
import { TextField } from "@mui/material"
import { useOnboardingCheckpoint } from "../../../Onboarding/useOnboarding"
import { SchemaExitTag, SchemaTag, isSchemaCondition, isSchemaExit, isSchemaOutputTag } from "@tonylb/mtw-wml/dist/schema/baseClasses"
import { GenericTreeNode, GenericTreeNodeFiltered, TreeId, treeNodeTypeguard } from "@tonylb/mtw-wml/dist/tree/baseClasses"
import { schemaOutputToString } from '@tonylb/mtw-wml/dist/schema/utils/schemaOutput/schemaOutputToString'
import { treeTypeGuard } from "@tonylb/mtw-wml/dist/tree/filter"
import { maybeGenericIDFromTree } from "@tonylb/mtw-wml/dist/tree/genericIDTree"
import { isStandardRoom } from "@tonylb/mtw-wml/dist/standardize/baseClasses"
import SidebarTitle from "../SidebarTitle"
import AddRoomExit from "../AddRoomExit"
import { ignoreWrapped } from "@tonylb/mtw-wml/dist/schema/utils"

type RoomExitEditorProps = {
    RoomId: string;
    onChange: (value: string) => void;
}

const ExitTargetSelector: FunctionComponent<{ RoomId: string; target: string; inherited?: boolean; onChange: (event: SelectChangeEvent<string>) => void }> = ({ RoomId, target, inherited, onChange }) => {
    const { readonly, standardForm: baseStandardForm, inheritedStandardForm } = useLibraryAsset()
    const standardForm = useMemo(() => (inherited ? inheritedStandardForm : baseStandardForm), [baseStandardForm, inherited, inheritedStandardForm])
    
    const roomNamesInScope = useMemo<Record<string, string>>(() => {
        const roomKeys = Object.values(standardForm.byId).filter(isStandardRoom).map(({ key }) => (key))
        const roomNamesInScope = Object.assign({},
            ...roomKeys
                .map((key) => {
                    if (key === RoomId) {
                        return []
                    }
                    const component = standardForm.byId[key]
                    if (!(component && isStandardRoom(component))) {
                        return []
                    }
                    return [{ [key]: schemaOutputToString(ignoreWrapped(component.shortName)?.children ?? []) || key }]
                }).flat(1)
        )
        return roomNamesInScope
    }, [RoomId, standardForm])
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
            value={target in roomNamesInScope ? target : ''}
            label="Target"
            onChange={onChangeHandler}
            disabled={readonly || inherited}
        >
            <MenuItem key='#empty' value=''></MenuItem>
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
    inherited?: boolean;
    index: number;
}

const EditExit: FunctionComponent<EditExitProps> = ({ node, RoomId, inherited, index }) => {
    const { readonly, standardForm: baseStandardForm, inheritedStandardForm, updateSchema, updateStandard } = useLibraryAsset()
    const { data, children, id } = node

    const nameTree = useMemo(() => (treeTypeGuard({ tree: children, typeGuard: isSchemaOutputTag })), [children])
    const name = useMemo(() => (schemaOutputToString(nameTree)), [nameTree])
    const standardForm = useMemo(() => (inherited ? inheritedStandardForm : baseStandardForm), [baseStandardForm, inherited, inheritedStandardForm])
    const targetName = useMemo(() => {
        if (!data.to) {
            return ''
        }
        const targetComponent = standardForm.byId[data.to]
        if (!(targetComponent && isStandardRoom(targetComponent))) {
            return ''
        }
        return schemaOutputToString(ignoreWrapped(targetComponent.shortName)?.children ?? []) ?? targetComponent.key
    }, [data, inherited, standardForm, inheritedStandardForm, inherited])
    useOnboardingCheckpoint('addExit', { requireSequence: true, condition: Boolean(!inherited && name)})
    useOnboardingCheckpoint('addExitBack', { requireSequence: true, condition: Boolean(!inherited && data.from !== RoomId && name)})
    const targetElement = <ExitTargetSelector
        target={data.to}
        RoomId={data.from}
        inherited={inherited}
        onChange={(event) => {
            updateStandard({
                type: 'spliceList',
                componentKey: RoomId,
                itemKey: 'exits',
                at: index,
                replace: 1,
                items: [{ data: { tag: 'Exit', key: `${RoomId}:${event.target.value}`, from: RoomId, to: event.target.value }, children: nameTree }]
            })
            updateSchema({ type: 'replace', id, item: { data: { tag: 'Exit', key: `${RoomId}:${event.target.value}`, from: RoomId, to: event.target.value }, children: nameTree, id } })
        }}
    />
    return <Box
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
                id={ nameTree[0]?.id ?? "exit-name"}
                value={name}
                onChange={(event) => { updateSchema({ type: 'replace', id, item: { data, id, children: [{ data: { tag: 'String', value: event.target.value }, children: [], id: nameTree[0]?.id }]} }) } }
                disabled={readonly || inherited}
                placeholder={targetName}
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
    index: number;
}

//
// TODO: Refactor RoomExitComponent to receive If > Room > Exit for both incoming and outgoing
// exits, and to derive direction from comparing the Room element against passed RoomId
//
const RoomExitComponent: FunctionComponent<RoomExitComponentProps> = ({ RoomId, node, addExit, inherited = false, index }) => {
    if (treeNodeTypeguard(isSchemaExit)(node)) {
        return <EditExit
            key={node.id}
            RoomId={RoomId}
            node={node}
            inherited={inherited}
            index={index}
        />
    }
    //
    // TODO: ISS-4294: Nest EditSchema to handle Exit list updates, so that conditioned exits can be edited properly
    //
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
                        index={index}
                    />
                })
            })}
        </React.Fragment>
    }
    else {
        throw new Error('Invalid entry to RoomExitComponent')
    }
}

export const RoomExitEditor: FunctionComponent<RoomExitEditorProps> = ({ RoomId }) => {
    const { standardForm, inheritedStandardForm, updateSchema } = useLibraryAsset()

    const roomComponent = useMemo(() => (standardForm.byId[RoomId]), [standardForm, RoomId])
    const exitTree = useMemo(() => {
        if (!(roomComponent && isStandardRoom(roomComponent))) {
            return []
        }
        return roomComponent.exits
    }, [roomComponent])

    const inheritedComponent = useMemo(() => (inheritedStandardForm.byId[RoomId]), [inheritedStandardForm, RoomId])
    const inheritedExitTree = useMemo(() => {
        if (!(inheritedComponent && isStandardRoom(inheritedComponent))) {
            return []
        }
        return inheritedComponent.exits
    }, [inheritedComponent])

    return <SidebarTitle title="Exits" minHeight="5em">
        {
            inheritedExitTree.length
                ? <Box sx={{
                        padding: '0.5em',
                        background: grey[100],
                        width: '100%'
                    }}>{
                        inheritedExitTree.map((node) => (
                            <RoomExitComponent inherited index={0} key={node.id ?? ''} RoomId={RoomId} node={maybeGenericIDFromTree([node])[0]} addExit={(node) => { if (roomComponent) { updateSchema({ type: 'addChild', id: roomComponent?.id, item: node }) } }} />
                        ))
                    }</Box>
                : null
        }
        { exitTree.map((node, index) => (
            <RoomExitComponent index={index} key={node.id ?? ''} RoomId={RoomId} node={maybeGenericIDFromTree([node])[0]} addExit={(node) => { if (roomComponent) { updateSchema({ type: 'addChild', id: roomComponent?.id, item: node }) } }} />
        ))}
        {/* 
            TODO: Replace naive list of exits with one that properly handles conditional items.
         */}
        {/* <IfElseTree
            tree={outgoingExits}
            parentId={schema[0]?.id ?? ''}
            render={(props) => (<RoomExitComponent node={props.node} parentId={props.parentId} RoomId={RoomId} />)}
            addItemIcon={<ExitIcon />}
            defaultItem={{ data: { tag: 'Exit', key: `${RoomId}#`, from: RoomId, to: '' }, children: [] }}
        /> */}
        {/* { exitTree.map((node) => {
            if (isSchemaCondition(node.data)) {
                return <IfElseTree
                    tree={treeTypeGuard({ tree: node.children, typeGuard: (subNode): subNode is SchemaConditionStatementTag | SchemaConditionFallthroughTag => (['Statement', 'Fallthrough'].includes(subNode.data.tag)) }) }
                    render={(props) => (<RoomExitComponent tree={props.} RoomId={RoomId} />)}
            }
            else {
                return <RoomExitComponent key={node.id ?? ''} RoomId={RoomId} node={maybeGenericIDFromTree([node])[0]} addExit={(node) => { if (roomComponent) { updateSchema({ type: 'addChild', id: roomComponent?.id, item: node }) } }} />
            }
        }) } */}
        <AddRoomExit RoomId={RoomId} />
    </SidebarTitle>
}

export default RoomExitEditor
