import Box from "@mui/material/Box"
import Chip from "@mui/material/Chip"
import { blue } from "@mui/material/colors"
import React, { FunctionComponent, useCallback, ReactChild, ReactChildren, ReactElement, useMemo } from "react"
import CodeEditor from "./CodeEditor"
import { LabelledIndentBox } from "./LabelledIndentBox"

import AddIcon from '@mui/icons-material/Add'
import ExitIcon from '@mui/icons-material/CallMade'

import { useLibraryAsset } from "./LibraryAsset"
import { isSchemaCondition, isSchemaConditionFallthrough, isSchemaConditionStatement } from "@tonylb/mtw-wml/dist/schema/baseClasses"
import { EditSchema, useEditContext } from "./EditContext"

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

const AddItemButton: FunctionComponent<{ onClick: () => void, addItemIcon: ReactElement }> = ({ onClick, addItemIcon }) => {
    const { readonly } = useLibraryAsset()
    return <Chip
        sx={{
            "&&:hover": {
                background: blue[200]
            },
            background: blue[50],
            borderColor: blue[500],
            borderWidth: '2px',
            borderStyle: "solid"
        }}
        size="small"
        disabled={readonly}
        onClick={onClick}
        icon={<AddIcon />}
        label={addItemIcon}
    />
}

type IfElseWrapBoxProps = {
    id: string;
    type: 'if' | 'elseIf' | 'else';
    source: string;
    actions: ReactChild[] | ReactChildren;
    onDelete: () => void;
}

const IfElseWrapBox: FunctionComponent<IfElseWrapBoxProps> = ({ type, source, id, actions, onDelete, children }) => {
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
        onDelete={onDelete}
    >
        { children }
    </LabelledIndentBox>
}

type IfElseTreeProps = {
    render: FunctionComponent<{}>;
}

//
// IfElseTree assumes that the EditContext passed will have a single conditional top-level element,
// and renders the statements and fallthrough of its children
//
export const IfElseTree = ({ render: Render }: IfElseTreeProps): ReactElement => {
    const { field } = useEditContext()
    const { updateSchema } = useLibraryAsset()
    const firstStatement = useMemo(() => (field.value[0]), [field])
    const otherStatements = useMemo(() => (field.value.slice(1)), [field])
    const addElseIf = useCallback((afterId: string) => (
        <AddItemButton
            key="elseIf"
            addItemIcon={<React.Fragment>elseIf</React.Fragment>}
            onClick={() => {
                updateSchema({ type: 'addChild', id: field.id, afterId, item: { data: { tag: 'Statement', if: '' }, children: [{ data: { tag: 'String', value: '' }, children: [] }]
            } })}}
        />), [field, firstStatement, updateSchema])
    const addElse = useMemo(() => (<AddItemButton key="else" addItemIcon={<React.Fragment>else</React.Fragment>} onClick={() => { updateSchema({ type: 'addChild', id: field.id, item: { data: { tag: 'Fallthrough' }, children: [{ data: { tag: 'String', value: '' }, children: [] }] }})}} />), [field, otherStatements, updateSchema])
    if (
        !(isSchemaCondition(field.value[0].data)) ||
        field.value[0].children.length === 0 ||
        !isSchemaConditionStatement(field.value[0].children[0].data) ||
        Boolean(field.value[0].children.find(({ data }) => (!(isSchemaConditionStatement(data) || isSchemaConditionFallthrough(data)))))
    ) {
        throw new Error('Invalid arguments in IfElseTree')
    }
    if (!isSchemaConditionStatement(firstStatement.data)) {
        throw new Error('Invalid arguments in IfElseTree')
    }
    return <React.Fragment>
        <IfElseWrapBox
            key={firstStatement.id}
            id={firstStatement.id}
            type={'if'}
            source={firstStatement.data.if}
            onDelete={() => {
                if (otherStatements.length && isSchemaConditionStatement(otherStatements[0].data)) {
                    updateSchema({ type: 'delete', id: firstStatement.id })
                }
            }}
            actions={[
                addElseIf(firstStatement.id),
                ...(otherStatements.length === 0 ? [addElse] : [])
            ]}
        >
            <EditSchema tag="Statement" field={{ id: firstStatement.id, value: firstStatement.children }} parentId={field.id}>
                <Render />
            </EditSchema>
        </IfElseWrapBox>
        { 
            otherStatements.map(({ data, children, id }, index) => {
                return isSchemaConditionStatement(data)
                    ? <IfElseWrapBox
                        key={id}
                        id={id}
                        type={'elseIf'}
                        source={data.if}
                        onDelete={() => { updateSchema({ type: 'delete', id })}}
                        actions={[
                            addElseIf(id),
                            ...(index === otherStatements.length - 1 ? [addElse] : [])
                        ]}
                    >
                        <EditSchema tag="Statement" field={{ value: children, id }} parentId={field.id}>
                            <Render />
                        </EditSchema>
                    </IfElseWrapBox>
                    : <IfElseWrapBox
                        key={id}
                        id={id}
                        type={'else'}
                        source=''
                        onDelete={() => { updateSchema({ type: 'delete', id })}}
                        actions={[]}
                    >
                        <EditSchema tag="Fallthrough" field={{ value: children, id }} parentId={field.id}>
                            <Render />
                        </EditSchema>
                    </IfElseWrapBox>
            })
        }
    </React.Fragment>
}

export default IfElseTree
