import Box from "@mui/material/Box"
import Chip from "@mui/material/Chip"
import { blue } from "@mui/material/colors"
import React, { FunctionComponent, useCallback, ReactChild, ReactChildren, ReactElement } from "react"
import CodeEditor from "./CodeEditor"
import { LabelledIndentBox } from "./LabelledIndentBox"

import AddIcon from '@mui/icons-material/Add'
import ExitIcon from '@mui/icons-material/CallMade'

import { useLibraryAsset } from "./LibraryAsset"
import { ConditionalTree, ConditionalTreeNode, ConditionalTreeSubNode } from "./conditionTree"
import { toSpliced } from "../../../lib/lists"
import { Button } from "@mui/material"

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

type RenderType<T extends object> = FunctionComponent<T & {
    onChange: (value: T) => void;
    onDelete: () => void;
}>

const AddItemButton: FunctionComponent<{ onClick: () => void }> = ({ onClick }) => {
    const { readonly } = useLibraryAsset()
    return <Button
        variant="outlined"
        disabled={readonly}
        onClick={onClick}
    >
        <AddIcon /><ExitIcon />
    </Button>
}

type IfElseWrapBoxProps<T extends object> = ConditionalTreeSubNode<T> & {
    type: 'if' | 'elseIf' | 'else';
    actions: ReactChild[] | ReactChildren;
    onChange: (value: ConditionalTreeSubNode<T>) => void;
    render: RenderType<T>;
}

const IfElseWrapBox = <T extends object>({ type, source, key, node, onChange, render, actions }: IfElseWrapBoxProps<T>) => (
    <LabelledIndentBox
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
                                onChange({
                                    key,
                                    node,
                                    source
                                })
                            }}
                        />
                    </Box>
                </React.Fragment>
        }
        actions={actions}
    >
        <IfElseTree
            {...node}
            onChange={(value: ConditionalTree<T>) => { onChange({ source, key, node: value }) }}
            render={render}
        />
    </LabelledIndentBox>
)

type IfElseSupplementalProps<T extends object> = {
    onChange: (value: ConditionalTreeNode<T>) => void;
    render: RenderType<T>;
}

type IfElseProps<T extends object> = ConditionalTreeNode<T> & IfElseSupplementalProps<T>

export const IfElse = <T extends object>({ if: primary, elseIfs, else: elseItem, onChange, render }: IfElseProps<T>): ReactElement => {
    const IfElseWrapLocal = IfElseWrapBox<T>
    const actionFactory = useCallback((index: number) => ([
        <AddConditionalButton
            label="Else If"
            onClick={() => {
                onChange({
                    if: primary,
                    elseIfs: toSpliced(
                        elseIfs,
                        index,
                        0,
                        {
                            key: '',
                            source: '',
                            node: {
                                items: [],
                                conditionals: []
                            }
                        }
                    ),
                    else: elseItem
                })
            }}
        />,
        ...((typeof elseItem !== 'undefined') ? [] : [
            <AddConditionalButton
                label="Else"
                onClick={() => {
                    onChange({
                        if: primary,
                        elseIfs,
                        else: {
                            key: '',
                            node: {
                                items: [],
                                conditionals: []
                            }
                        }
                    })
                }}
            />
        ])
    ]), [primary, elseIfs, elseItem, onChange])
    return <React.Fragment>
        <IfElseWrapLocal
            type='if'
            { ...primary }
            onChange={(value) => {
                onChange({
                    if: value,
                    elseIfs,
                    else: elseItem
                })
            }}
            render={render}
            actions={actionFactory(0)}
        />
        {
            elseIfs.map((elseIf, index) => (
                <IfElseWrapLocal
                    type='elseIf'
                    { ...elseIf }
                    onChange={(value) => {
                        onChange({
                            if: primary,
                            elseIfs: toSpliced(elseIfs, index, 1, value),
                            else: elseItem
                        })
                    }}
                    render={render}
                    actions={actionFactory(index + 1)}
                />
            ))
        }
        {
            elseItem && <IfElseWrapLocal
                type='else'
                { ...elseItem }
                source=''
                onChange={(value) => {
                    onChange({
                        if: primary,
                        elseIfs,
                        else: value
                    })
                }}
                render={render}
                actions={[]}
            />
        }
    </React.Fragment>
}

type IfElseTreeProps<T extends object> = ConditionalTree<T> & {
    onChange: (value: ConditionalTree<T>) => void;
    render: RenderType<T>;
}

export const IfElseTree = <T extends object>({ items, conditionals, onChange, render }: IfElseTreeProps<T>): ReactElement => {
    return <React.Fragment>
        {
            items.map((item, index) => (render({
                ...item,
                key: `item${index}`,
                onChange: (value) => {
                    onChange({
                        items: toSpliced(items, index, 1, value),
                        conditionals
                    })
                },
                onDelete: () => {
                    onChange({
                        items: toSpliced(items, index, 1),
                        conditionals
                    })
                }
            })))
        }
        {
            conditionals.map((subCondition, index) => (
                <IfElse
                    {...subCondition}
                    key={`condition${index}`}
                    render={render}
                    onChange={(value) => {
                        onChange({
                            items,
                            conditionals: toSpliced(conditionals, index, 1, value)
                        })
                    }}
                />
            ))
        }
    </React.Fragment>
}

export default IfElseTree
