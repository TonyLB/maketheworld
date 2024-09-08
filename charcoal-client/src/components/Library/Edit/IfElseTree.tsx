import Box from "@mui/material/Box"
import Chip from "@mui/material/Chip"
import Checkbox from "@mui/material/Checkbox"
import { blue } from "@mui/material/colors"
import React, { FunctionComponent, useCallback, ReactChild, ReactChildren, ReactElement, useMemo } from "react"
import CodeEditor from "./CodeEditor"
import { LabelledIndentBox } from "./LabelledIndentBox"

import AddIcon from '@mui/icons-material/Add'
import VisibilityIcon from '@mui/icons-material/Visibility'
import VisibilityOffOutlinedIcon from '@mui/icons-material/VisibilityOffOutlined'

import { useLibraryAsset } from "./LibraryAsset"
import { isSchemaCondition, isSchemaConditionFallthrough, isSchemaConditionStatement, SchemaConditionFallthroughTag, SchemaConditionStatementTag, SchemaTag } from "@tonylb/mtw-wml/dist/schema/baseClasses"
import { EditChildren, EditSubListSchema, useEditContext, useEditNodeContext } from "./EditContext"
import { GenericTreeNodeFiltered, treeNodeTypeguard } from "@tonylb/mtw-wml/dist/tree/baseClasses"

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
    actions: ReactChild[] | ReactChildren;
    showSelected?: boolean;
    onSelect?: (index: number) => void;
    onUnselect?: () => void;
    onClick?: (id: string) => void;
}

const IfElseWrapBox: FunctionComponent<IfElseWrapBoxProps> = ({ id, index, actions, showSelected = false, onSelect = () => {}, onUnselect = () => {}, onClick, children }) => {
    const { data, children: contextChildren, onChange: contextOnChange, highlighted, onDelete } = useEditNodeContext()
    if (!(isSchemaConditionStatement(data) || isSchemaConditionFallthrough(data))) {
        throw new Error('Invalid schema tag in IfElseWrapBox')
    }
    const field: GenericTreeNodeFiltered<SchemaConditionStatementTag | SchemaConditionFallthroughTag, SchemaTag> = { data, children: contextChildren }
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
            isSchemaConditionFallthrough(data)
                ? <React.Fragment>
                    { showSelected && <Checkbox
                        checked={data.selected}
                        onChange={onChange}
                        inputProps={{ 'aria-label': 'Else selected' }}
                        icon={<VisibilityOffOutlinedIcon />}
                        checkedIcon={<VisibilityIcon />}
                    /> }
                    Else
                </React.Fragment>
                : <React.Fragment>
                    { showSelected && <Checkbox
                        checked={data.selected}
                        onChange={onChange}
                        inputProps={{ 'aria-label': 'If selected' }}
                        icon={<VisibilityOffOutlinedIcon />}
                        checkedIcon={<VisibilityIcon />}
                    /> }
                    { index === 0 ? 'If' : 'Else If' }
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
                            source={data.if}
                            onChange={(source: string) => {
                                contextOnChange({
                                    ...field,
                                    data: { ...data, if: source }
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

type IfElseTreeStatementsProps = {
    render: FunctionComponent<{}>;
    showSelected?: boolean;
    onClick?: (id: string) => void;
}

export const IfElseTreeStatements: FunctionComponent<IfElseTreeStatementsProps> = ({ render: Render, showSelected = false, onClick = () => {} }): ReactElement => {
    const { value, onChange } = useEditContext()
    const onSelect = useCallback((index: number) => {
        const toSelectData = value[index]?.data
        if (toSelectData && (isSchemaConditionStatement(toSelectData) || isSchemaConditionFallthrough(toSelectData)) && toSelectData.selected) {
            return
        }
        onChange(value.map((child, compareIndex) => {
                if (!(treeNodeTypeguard(isSchemaConditionStatement)(child) || treeNodeTypeguard(isSchemaConditionFallthrough)(child))) {
                    return child
                }
                else {
                    return { ...child, data: { ...child.data, selected: compareIndex === index ? true : undefined }}
                }
        }))
    }, [value])
    const onUnselect = useCallback(() => {
        onChange(value.map((child) => {
            if (!treeNodeTypeguard(isSchemaConditionFallthrough)(child)) {
                if (treeNodeTypeguard(isSchemaConditionStatement)(child)) {
                    return { ...child, data: { ...child.data, selected: undefined }}
                }
                return child
            }
            else {
                return { ...child, data: { ...child.data, selected: true }}
            }
        }))
    }, [value])
    const addElseIf = useCallback((afterIndex: number) => (
        <AddItemButton
            key={`elseIf-${afterIndex}`}
            addItemIcon={<React.Fragment>elseIf</React.Fragment>}
            onClick={() => {
                onChange([...value.slice(0, afterIndex + 1), { data: { tag: 'Statement', if: '' }, children: [{ data: { tag: 'String', value: '' }, children: [] }] }, ...value.slice(afterIndex + 1)])
            }}
        />), [value, onChange])
    const addElse = useMemo(
        () => (
            <AddItemButton
                key="else"
                addItemIcon={<React.Fragment>else</React.Fragment>}
                onClick={() => {
                    onChange([...value, { data: { tag: 'Fallthrough' }, children: [{ data: { tag: 'String', value: '' }, children: [] }] }])
                }}
            />
        ),
        [value, onChange]
    )
    if (value.find((node) => (!(treeNodeTypeguard(isSchemaConditionStatement)(node) || treeNodeTypeguard(isSchemaConditionFallthrough)(node))))) {
        return null
    }
    return <React.Fragment>
        { value.map((child, index) => (
            <EditSubListSchema index={index}>
                {
                    <IfElseWrapBox
                        key={`IfElseBox-${index}`}
                        id={''}
                        index={index}
                        onClick={onClick}
                        actions={treeNodeTypeguard(isSchemaConditionStatement)(child)
                            ? [
                                addElseIf(index),
                                ...(value.length - index === 1 ? [addElse] : [])
                            ]
                            : []
                        }
                        showSelected={showSelected}
                        onSelect={onSelect}
                        onUnselect={onUnselect}
                    >
                        <EditChildren><Render /></EditChildren>
                    </IfElseWrapBox>
                }
            </EditSubListSchema>
        ))}
    </React.Fragment>
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
export const IfElseTree = ({ render, showSelected = false, onClick }: IfElseTreeProps): ReactElement => {
    const { data, children } = useEditNodeContext()
    if (
        !(isSchemaCondition(data)) ||
        children.length === 0 ||
        !isSchemaConditionStatement(children[0].data) ||
        Boolean(children.find(({ data }) => (!(isSchemaConditionStatement(data) || isSchemaConditionFallthrough(data)))))
    ) {
        throw new Error('Invalid arguments in IfElseTree')
    }
    if (!isSchemaConditionStatement(children[0].data)) {
        throw new Error('Invalid arguments in IfElseTree')
    }
    return <EditChildren>
        <IfElseTreeStatements render={render} showSelected={showSelected} onClick={onClick} />
    </EditChildren>
}

export default IfElseTree
