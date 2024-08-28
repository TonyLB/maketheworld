import Box from "@mui/material/Box"
import Chip from "@mui/material/Chip"
import Checkbox from "@mui/material/Checkbox"
import { blue } from "@mui/material/colors"
import React, { FunctionComponent, useCallback, ReactChild, ReactChildren, ReactElement, useMemo } from "react"
import CodeEditor from "./CodeEditor"
import { LabelledIndentBox } from "./LabelledIndentBox"

import AddIcon from '@mui/icons-material/Add'
import ExitIcon from '@mui/icons-material/CallMade'
import VisibilityIcon from '@mui/icons-material/Visibility'
import VisibilityOffOutlinedIcon from '@mui/icons-material/VisibilityOffOutlined'

import { useLibraryAsset } from "./LibraryAsset"
import { isSchemaCondition, isSchemaConditionFallthrough, isSchemaConditionStatement } from "@tonylb/mtw-wml/dist/schema/baseClasses"
import { EditSchema, useEditContext } from "./EditContext"
import { treeNodeTypeguard } from "@tonylb/mtw-wml/dist/tree/baseClasses"
import { maybeGenericIDFromTree } from "@tonylb/mtw-wml/dist/tree/genericIDTree"

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
    index: number;
    type: 'if' | 'elseIf' | 'else';
    source: string;
    actions: ReactChild[] | ReactChildren;
    onDelete: () => void;
    showSelected?: boolean;
    selected?: boolean;
    onSelect?: (index: number) => void;
    onUnselect?: () => void;
    onClick?: (id: string) => void;
}

const IfElseWrapBox: FunctionComponent<IfElseWrapBoxProps> = ({ type, source, id, index, actions, onDelete, showSelected = false, selected = false, onSelect = () => {}, onUnselect = () => {}, onClick, children }) => {
    const { field, onChange: contextOnChange, highlighted } = useEditContext()
    const onChange = useCallback((event) => {
        if (event.target.checked) {
            onSelect(index)
        }
        else {
            if (!highlighted) {
                onUnselect()
            }
        }
    }, [id, onSelect, onUnselect, highlighted])
    const onClickHandler = useCallback(() => {
        if (onClick) {
            onClick(id)
            onSelect(index)
        }
    }, [id, onClick, onSelect])
    return <LabelledIndentBox
        color={blue}
        highlighted={highlighted}
        onClick={onClickHandler}
        label={
            type === 'else'
                ? <React.Fragment>
                    { showSelected && <Checkbox
                        value={id}
                        checked={selected}
                        onChange={onChange}
                        inputProps={{ 'aria-label': 'Else selected' }}
                        icon={<VisibilityOffOutlinedIcon />}
                        checkedIcon={<VisibilityIcon />}
                    /> }
                    Else
                </React.Fragment>
                : <React.Fragment>
                    { showSelected && <Checkbox
                        value={id}
                        checked={selected}
                        onChange={onChange}
                        inputProps={{ 'aria-label': 'If selected' }}
                        icon={<VisibilityOffOutlinedIcon />}
                        checkedIcon={<VisibilityIcon />}
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
                                contextOnChange([{
                                    ...field,
                                    children: [
                                        ...field.children.slice(0, index),
                                        { ...field.children[index], data: { tag: 'Statement', if: source }, children: field.children[index].children },
                                        ...field.children.slice(index+1)
                                    ]
                                }])
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
    onClick?: (id: string) => void;
}

//
// IfElseTree assumes that the EditContext passed will have a single conditional top-level element,
// and renders the statements and fallthrough of its children
//
export const IfElseTree = ({ render: Render, showSelected = false, onClick }: IfElseTreeProps): ReactElement => {
    const { value, onChange } = useEditContext()
    const firstStatement = useMemo(() => (value[0].children[0]), [value])
    const otherStatements = useMemo(() => (value[0].children.slice(1)), [value])
    //
    // onSelect takes an index in the children of the current SchemaConditionTag field, clears select from all other
    // children, and sets select on that index
    //
    const onSelect = useCallback((index: number) => {
        const toSelectData = value[0].children[index]?.data
        if (toSelectData && (isSchemaConditionStatement(toSelectData) || isSchemaConditionFallthrough(toSelectData)) && toSelectData.selected) {
            return
        }
        onChange(maybeGenericIDFromTree([{
            ...value[0],
            children: value[0].children.map((child, compareIndex) => {
                if (!(treeNodeTypeguard(isSchemaConditionStatement)(child) || treeNodeTypeguard(isSchemaConditionFallthrough)(child))) {
                    return child
                }
                else {
                    return { ...child, data: { ...child.data, selected: compareIndex === index ? true : undefined }}
                }
            })
        }]))
    }, [value])
    const onUnselect = useCallback(() => {
        onChange(maybeGenericIDFromTree([{
            ...value[0],
            children: value[0].children.map((child) => {
                if (!treeNodeTypeguard(isSchemaConditionFallthrough)(child)) {
                    if (treeNodeTypeguard(isSchemaConditionStatement)(child)) {
                        return { ...child, data: { ...child.data, selected: undefined }}
                    }
                    return child
                }
                else {
                    return { ...child, data: { ...child.data, selected: true }}
                }
            })
        }]))
    }, [value])
    const addElseIf = useCallback((afterIndex: number) => (
        <AddItemButton
            key={`elseIf-${afterIndex}`}
            addItemIcon={<React.Fragment>elseIf</React.Fragment>}
            onClick={() => {
                onChange(maybeGenericIDFromTree([{
                    ...value[0],
                    children: [...value[0].children.slice(0, afterIndex + 1), { data: { tag: 'Statement', if: '' }, children: [{ data: { tag: 'String', value: '' }, children: [], id: '' }], id: '' }, ...value[0].children.slice(afterIndex + 1)],
                    id: ''
                }]))
            }}
        />), [value, onChange])
    const addElse = useMemo(
        () => (
            <AddItemButton
                key="else"
                addItemIcon={<React.Fragment>else</React.Fragment>}
                onClick={() => {
                    onChange(maybeGenericIDFromTree([{
                        ...value[0],
                        children: [...value[0].children, { data: { tag: 'Fallthrough' }, children: [{ data: { tag: 'String', value: '' }, children: [] }] }],
                        id: ''
                    }]))    
                }}
            />
        ),
        [value, onChange]
    )
    if (
        !(isSchemaCondition(value[0].data)) ||
        value[0].children.length === 0 ||
        !isSchemaConditionStatement(value[0].children[0].data) ||
        Boolean(value[0].children.find(({ data }) => (!(isSchemaConditionStatement(data) || isSchemaConditionFallthrough(data)))))
    ) {
        throw new Error('Invalid arguments in IfElseTree')
    }
    if (!isSchemaConditionStatement(firstStatement.data)) {
        throw new Error('Invalid arguments in IfElseTree')
    }
    return <React.Fragment>
        <IfElseWrapBox
            key="IfElseBox-0"
            id={''}
            index={0}
            onClick={onClick}
            type={'if'}
            source={firstStatement.data.if}
            onDelete={() => {
                if (otherStatements.length && isSchemaConditionStatement(otherStatements[0].data)) {
                    onChange(maybeGenericIDFromTree([{ ...value[0], children: value[0].children.slice(1) }]))
                }
                if (!otherStatements.length) {
                    onChange([])
                }
            }}
            actions={[
                addElseIf(0),
                ...(otherStatements.length === 0 ? [addElse] : [])
            ]}
            showSelected={showSelected}
            selected={firstStatement.data.selected}
            onSelect={onSelect}
            onUnselect={onUnselect}
        >
            {
                firstStatement.children.map((child, index) => (
                    <EditSchema
                        field={maybeGenericIDFromTree([child])[0]}
                        value={[child]}
                        onChange={(value) => {
                            onChange(maybeGenericIDFromTree([{
                                ...value[0],
                                children: [
                                    {
                                        ...firstStatement,
                                        children: [
                                            ...firstStatement.children.slice(0, index),
                                            ...value,
                                            ...firstStatement.children.slice(index + 1)
                                        ]
                                    },
                                    ...otherStatements
                                ]
                            }]))
                        }}
                    >
                        <Render />
                    </EditSchema>    
                ))
            }
        </IfElseWrapBox>
        { 
            otherStatements.map(({ data, children }, index) => {
                return isSchemaConditionStatement(data)
                    ? <IfElseWrapBox
                        key={`elseIfWrap-${index}`}
                        id={''}
                        index={index + 1}
                        onClick={onClick}
                        type={'elseIf'}
                        source={data.if}
                        onDelete={() => { onChange(maybeGenericIDFromTree([{ ...value[0], children: [...value[0].children.slice(0, index), ...value[0].children.slice(index+1)] }])) }}
                        actions={[
                            addElseIf(index + 1),
                            ...(index === otherStatements.length - 1 ? [addElse] : [])
                        ]}
                        showSelected={showSelected}
                        selected={data.selected}
                        onSelect={onSelect}
                        onUnselect={onUnselect}
                    >
                        {
                            children.map((child) => (
                                <EditSchema
                                    field={maybeGenericIDFromTree([child])[0]}
                                    value={[child]}
                                    //
                                    // TODO ISS4303: Refactor with EditSubListSchema
                                    //
                                    onChange={(value) => {
                                        onChange(maybeGenericIDFromTree([{ ...value[0], children: [...value[0].children.slice(0, index + 1), { data, children: value }, ...value[0].children.slice(index + 2)] }]))
                                    }}
                                >
                                    <Render />
                                </EditSchema>
                            ))
                        }
                    </IfElseWrapBox>
                    : isSchemaConditionFallthrough(data)
                        ? <IfElseWrapBox
                            key="elseWrap"
                            id={''}
                            index={index + 1}
                            onClick={onClick}
                            type={'else'}
                            source=''
                            onDelete={() => { onChange(maybeGenericIDFromTree([{ ...value[0], children: value[0].children.slice(0, -1) }])) }}
                            actions={[]}
                            showSelected={showSelected}
                            selected={data.selected}
                            onSelect={onSelect}
                        >
                            {
                                children.map((child) => (
                                    <EditSchema
                                        field={maybeGenericIDFromTree([child])[0]}
                                        value={[child]}
                                        //
                                        // TODO ISS4303: Refactor with EditSubListSchema
                                        //
                                        onChange={(value) => {
                                            onChange(maybeGenericIDFromTree([{ ...value[0], children: [...value[0].children.slice(0, -1), { data, children: value }]}]))
                                        }}
                                    >
                                        <Render />
                                    </EditSchema>
                                ))
                            }
                        </IfElseWrapBox>
                        : null
            })
        }
    </React.Fragment>
}

export default IfElseTree
