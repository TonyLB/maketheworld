import Box from "@mui/material/Box"
import Chip from "@mui/material/Chip"
import { blue } from "@mui/material/colors"
import React, { FunctionComponent, useCallback, ReactChild, ReactChildren, ReactElement, useMemo } from "react"
import CodeEditor from "./CodeEditor"
import { LabelledIndentBox } from "./LabelledIndentBox"

import AddIcon from '@mui/icons-material/Add'
import ExitIcon from '@mui/icons-material/CallMade'

import { useLibraryAsset } from "./LibraryAsset"
import { SchemaConditionFallthroughTag, SchemaConditionStatementTag, isSchemaCondition, isSchemaConditionFallthrough, isSchemaConditionStatement } from "@tonylb/mtw-wml/dist/schema/baseClasses"
import { EditSchema, useEditContext } from "./EditContext"
import { Radio } from "@mui/material"
import { treeNodeTypeguard } from "@tonylb/mtw-wml/dist/tree/baseClasses"

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
    showSelected?: boolean;
    selected?: boolean;
    onSelect?: (id: string) => void;
}

const IfElseWrapBox: FunctionComponent<IfElseWrapBoxProps> = ({ type, source, id, actions, onDelete, showSelected = false, selected = false, onSelect = () => {}, children }) => {
    const { updateSchema } = useLibraryAsset()
    const onChange = useCallback((event) => {
        if (event.target.value) {
            onSelect(id)
        }
    }, [id, onSelect])
    return <LabelledIndentBox
        color={blue}
        label={
            type === 'else'
                ? <React.Fragment>
                    { showSelected && <Radio
                        value={id}
                        checked={selected}
                        onChange={onChange}
                        inputProps={{ 'aria-label': 'Else selected' }}
                    /> }
                    Else
                </React.Fragment>
                : <React.Fragment>
                    { showSelected && <Radio
                        value={id}
                        checked={selected}
                        onChange={onChange}
                        inputProps={{ 'aria-label': 'If selected' }}
                    /> }
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
    showSelected?: boolean;
}

//
// IfElseTree assumes that the EditContext passed will have a single conditional top-level element,
// and renders the statements and fallthrough of its children
//
export const IfElseTree = ({ render: Render, showSelected = false }: IfElseTreeProps): ReactElement => {
    const { field } = useEditContext()
    const { updateSchema } = useLibraryAsset()
    const firstStatement = useMemo(() => (field.children[0]), [field])
    const otherStatements = useMemo(() => (field.children.slice(1)), [field])
    const onSelect = useCallback((id: string) => {
        const currentSelected = field.children
            .filter(treeNodeTypeguard((data): data is SchemaConditionStatementTag | SchemaConditionFallthroughTag => (isSchemaConditionStatement(data) || isSchemaConditionFallthrough(data))))
            .find(({ data }) => (data.selected))
        const toSelect = field.children
            .filter(treeNodeTypeguard((data): data is SchemaConditionStatementTag | SchemaConditionFallthroughTag => (isSchemaConditionStatement(data) || isSchemaConditionFallthrough(data))))
            .find((node) => (node.id === id))
        if (currentSelected?.id === toSelect?.id) {
            return
        }
        if (currentSelected) {
            updateSchema({ type: 'updateNode', id: currentSelected.id, item: { ...currentSelected.data, selected: false } })
        }
        if (toSelect) {
            updateSchema({ type: 'updateNode', id: toSelect.id, item: { ...toSelect.data, selected: true } })
        }
    }, [field])
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
        !(isSchemaCondition(field.data)) ||
        field.children.length === 0 ||
        !isSchemaConditionStatement(field.children[0].data) ||
        Boolean(field.children.find(({ data }) => (!(isSchemaConditionStatement(data) || isSchemaConditionFallthrough(data)))))
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
            showSelected={showSelected}
            selected={firstStatement.data.selected}
            onSelect={onSelect}
        >
            <EditSchema tag="Statement" field={firstStatement} parentId={field.id}>
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
                        showSelected={showSelected}
                        selected={data.selected}
                        onSelect={onSelect}
                    >
                        <EditSchema tag="Statement" field={{ data, children, id }} parentId={field.id}>
                            <Render />
                        </EditSchema>
                    </IfElseWrapBox>
                    : isSchemaConditionFallthrough(data)
                        ? <IfElseWrapBox
                            key={id}
                            id={id}
                            type={'else'}
                            source=''
                            onDelete={() => { updateSchema({ type: 'delete', id })}}
                            actions={[]}
                            showSelected={showSelected}
                            selected={data.selected}
                            onSelect={onSelect}
                        >
                            <EditSchema tag="Fallthrough" field={{ data, children, id }} parentId={field.id}>
                                <Render />
                            </EditSchema>
                        </IfElseWrapBox>
                        : null
            })
        }
    </React.Fragment>
}

export default IfElseTree
