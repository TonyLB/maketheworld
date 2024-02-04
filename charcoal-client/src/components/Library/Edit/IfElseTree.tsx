import Box from "@mui/material/Box"
import Chip from "@mui/material/Chip"
import { blue } from "@mui/material/colors"
import React, { FunctionComponent, useCallback, ReactChild, ReactChildren, ReactElement } from "react"
import CodeEditor from "./CodeEditor"
import { LabelledIndentBox } from "./LabelledIndentBox"

import AddIcon from '@mui/icons-material/Add'
import ExitIcon from '@mui/icons-material/CallMade'

import { useLibraryAsset } from "./LibraryAsset"
import { Button, Stack } from "@mui/material"
import { GenericTree, GenericTreeNode, GenericTreeNodeFiltered, TreeId } from "@tonylb/mtw-wml/dist/tree/baseClasses"
import { SchemaConditionTag, SchemaTag, isSchemaCondition } from "@tonylb/mtw-wml/dist/schema/baseClasses"
import { deepEqual } from "../../../lib/objects"

const AddConditionalButton: FunctionComponent<{ onClick: () => void; label: string }> = ({ onClick, label }) => {
    const { readonly } = useLibraryAsset()
    const onClickHandler = useCallback(() => {
        if (!readonly) {
            onClick()
        }
    }, [onClick, readonly])
    return <Chip
        variant="filled"
        size="small"
        sx={{
            backgroundColor: blue[50],
            borderStyle: "solid",
            borderWidth: "1px",
            borderColor: blue[300],
            '&:hover': {
                backgroundColor: blue[100]
            }
        }}
        label={`+ ${label}`}
        onClick={onClickHandler}
        disabled={readonly}
    />
}

type RenderType = FunctionComponent<{
    parentId: string;
    node: GenericTreeNode<SchemaTag, TreeId>;
    onChange: (value: GenericTreeNode<SchemaTag, TreeId>) => void;
    onDelete: () => void;
}>

const AddItemButton: FunctionComponent<{ onClick: () => void, addItemIcon: ReactElement }> = ({ onClick, addItemIcon }) => {
    const { readonly } = useLibraryAsset()
    return <Button
        variant="outlined"
        disabled={readonly}
        onClick={onClick}
    >
        <AddIcon />{ addItemIcon }
    </Button>
}

type IfElseWrapBoxProps = {
    id: string;
    type: 'if' | 'elseIf' | 'else';
    source: string;
    previousConditions: SchemaConditionTag["conditions"];
    actions: ReactChild[] | ReactChildren;
}

const IfElseWrapBox: FunctionComponent<IfElseWrapBoxProps> = ({ type, source, previousConditions, id, actions, children }) => {
    const { updateSchema } = useLibraryAsset()
    return <LabelledIndentBox
        color={blue}
        label={
            type === 'else'
                ? 'Else'
                : <React.Fragment>
                    { type === 'if' ? 'If' : 'Else If' }
                    <Box
                        sx={{
                            display: 'inline-block',
                            borderRadius: '0.25em',
                            backgroundColor: blue[50],
                            paddingLeft: '0.25em',
                            paddingRight: '0.25em',
                            marginRight: '0.25em',
                            minWidth: '1.5em'
                        }}
                    >
                        <CodeEditor
                            source={source}
                            onChange={(source: string) => {
                                updateSchema({
                                    type: 'updateNode',
                                    id,
                                    item: { tag: 'If', conditions: [...previousConditions, { if: source }] }
                                })
                            }}
                        />
                    </Box>
                </React.Fragment>
        }
        actions={actions}
        onDelete={() => { updateSchema({ type: 'delete', id }) }}
    >
        { children }
    </LabelledIndentBox>
}

type IfElseTreeProps = {
    parentId: string;
    tree: GenericTree<SchemaTag, TreeId>;
    render: RenderType;
    defaultItem: GenericTreeNode<SchemaTag>;
    addItemIcon: ReactElement;
}

//
// TODO: Refactor IfElseTree to accept GenericTree<SchemaTag> instead of items/conditionals
//
export const IfElseTree = ({ parentId, tree, render, defaultItem, addItemIcon }: IfElseTreeProps): ReactElement => {
    const { updateSchema } = useLibraryAsset()
    const unconditionedItems = tree.filter(({ data }) => (!isSchemaCondition(data)))
    const conditionedItems = tree.filter((node): node is GenericTreeNodeFiltered<SchemaConditionTag, SchemaTag, TreeId> => (isSchemaCondition(node.data)))
    return <React.Fragment>
        {
            unconditionedItems.map((item, index) => (render({
                parentId,
                node: item,
                // key: `item${index}`,
                onChange: (value) => {
                    updateSchema({
                        type: 'replace',
                        id: item.id,
                        item: value
                    })
                },
                onDelete: () => {
                    updateSchema({
                        type: 'delete',
                        id: item.id
                    })
                }
            })))
        }
        {
            conditionedItems.reduce<{ output: ReactElement[], previousConditions: SchemaConditionTag["conditions"] }>(({ output, previousConditions }, subCondition, index) => {
                const { conditions } = subCondition.data
                const childrenRender = <IfElseTree
                    parentId={subCondition.id}
                    tree={subCondition.children}
                    render={render}
                    defaultItem={defaultItem}
                    addItemIcon={addItemIcon}
                />
                const extendsConditions = ((conditions.length === previousConditions.length) ||
                    (conditions.length === previousConditions.length + 1)) &&
                    deepEqual(conditions.slice(0, previousConditions.length), previousConditions)
                if (conditions.length > 1 && !extendsConditions) {
                    throw new Error('Condition tags misaligned in IfElseTree')
                }
                const type: 'if' | 'elseIf' | 'else' = extendsConditions ? conditions.length === previousConditions.length ? 'else' : 'elseIf' : 'if'
                //
                // TODO: When SchemaConditionTag is refactored to use Statements and FallThrough, add "+ ElseIf" and "+ Else" actions
                //
                return {
                    output: [
                        ...output,
                        <IfElseWrapBox
                            id={subCondition.id}
                            type={type}
                            source={type === 'if' ? conditions[0].if : type === 'elseIf' ? conditions.slice(-1)[0].if : ''}
                            previousConditions={previousConditions}
                            key={`condition${index}`}
                            actions={[]}
                        >
                            { childrenRender }
                        </IfElseWrapBox>
                    ],
                    previousConditions: []
                }
            }, { output: [], previousConditions: [] }).output
        }
        <Stack direction="row" spacing={2}>
            <AddItemButton
                addItemIcon={addItemIcon}
                onClick={() => {
                    updateSchema({
                        type: 'addChild',
                        id: parentId,
                        item: defaultItem
                    })
                }}
            />
            <AddConditionalButton
                label="If"
                onClick={() => {
                    updateSchema({
                        type: 'addChild',
                        id: parentId,
                        item: {
                            data: { tag: 'If', conditions: [{ if: '' }]},
                            children: []
                        }
                    })
                }}
            />

        </Stack>
    </React.Fragment>
}

export default IfElseTree
