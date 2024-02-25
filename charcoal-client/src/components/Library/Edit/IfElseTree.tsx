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
import { GenericTree, GenericTreeFiltered, GenericTreeNode, GenericTreeNodeFiltered, TreeId } from "@tonylb/mtw-wml/dist/tree/baseClasses"
import { SchemaConditionFallthroughTag, SchemaConditionStatementTag, SchemaConditionTag, SchemaTag, isSchemaCondition, isSchemaConditionStatement } from "@tonylb/mtw-wml/dist/schema/baseClasses"
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
    tree: GenericTree<SchemaTag, TreeId>;
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
    actions: ReactChild[] | ReactChildren;
}

const IfElseWrapBox: FunctionComponent<IfElseWrapBoxProps> = ({ type, source, id, actions, children }) => {
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
                                    item: { tag: 'Statement', if: source }
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
    tree: GenericTreeFiltered<SchemaConditionStatementTag | SchemaConditionFallthroughTag, SchemaTag, TreeId>;
    render: RenderType;
}

export const IfElseTree = ({ tree, render }: IfElseTreeProps): ReactElement => {
    if (tree.length === 0 || !(isSchemaConditionStatement(tree[0].data))) {
        throw new Error('Invalid arguments in IfElseTree')
    }
    return <React.Fragment>
        <IfElseWrapBox
            key={tree[0].id}
            id={tree[0].id}
            type={'if'}
            source={tree[0].data.if}
            actions={[]}
        >
            { render({ tree: tree[0].children }) }
        </IfElseWrapBox>
        { 
            tree.map(({ data, children, id }) => {
                const childrenRender = render({ tree: children })
                return isSchemaConditionStatement(data)
                    ? <IfElseWrapBox
                        key={id}
                        id={id}
                        type={'elseIf'}
                        source={data.if}
                        actions={[]}
                    >
                        { childrenRender }
                    </IfElseWrapBox>
                    : <IfElseWrapBox
                        key={id}
                        id={id}
                        type={'else'}
                        source=''
                        actions={[]}
                    >
                        { childrenRender }
                    </IfElseWrapBox>
            })
        }
    </React.Fragment>
}

export default IfElseTree
