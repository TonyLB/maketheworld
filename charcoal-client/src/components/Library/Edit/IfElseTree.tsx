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
import { Button, Stack } from "@mui/material"

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

type IfElseWrapBoxProps<T extends object> = Omit<ConditionalTreeSubNode<T>, 'key'> & {
    nodeKey: string;
    type: 'if' | 'elseIf' | 'else';
    actions: ReactChild[] | ReactChildren;
    onChange: (value: ConditionalTreeSubNode<T>) => void;
    onDelete?: () => void;
    render: RenderType<T>;
    defaultItem: T;
    addItemIcon: ReactElement;
}

const IfElseWrapBox = <T extends object>({ type, source, node, nodeKey, onChange, onDelete, render, actions, defaultItem, addItemIcon }: IfElseWrapBoxProps<T>) => (
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
                                    key: nodeKey,
                                    node,
                                    source
                                })
                            }}
                        />
                    </Box>
                </React.Fragment>
        }
        actions={actions}
        onDelete={onDelete}
    >
        <IfElseTree
            items={node.items}
            conditionals={node.conditionals}
            onChange={(value: ConditionalTree<T>) => { onChange({ source, key: nodeKey, node: value }) }}
            render={render}
            defaultItem={defaultItem}
            addItemIcon={addItemIcon}
        />
    </LabelledIndentBox>
)

type IfElseSupplementalProps<T extends object> = {
    onChange: (value: ConditionalTreeNode<T>) => void;
    onDelete: () => void;
    render: RenderType<T>;
    defaultItem: T;
    addItemIcon: ReactElement;
}

type IfElseProps<T extends object> = ConditionalTreeNode<T> & IfElseSupplementalProps<T>

export const IfElse = <T extends object>({ if: primary, elseIfs, else: elseItem, onChange, onDelete, render, defaultItem, addItemIcon }: IfElseProps<T>): ReactElement => {
    //
    // TODO: Add onDelete argument to IfElse, and deleteIcon to display (using onChange to change the structure if deleting an elseIf, or else, or an If with elseIfs),
    // and onDelete to delete the entire conditional if needed
    //
    const IfElseWrapLocal = IfElseWrapBox<T>
    const actionFactory = useCallback((index: number) => ([
        <AddConditionalButton
            key={`else-If-${index}`}
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
                key={`else-${index}`}
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
            nodeKey={primary.key}
            source={primary.source}
            node={primary.node}
            onChange={(value) => {
                onChange({
                    if: value,
                    elseIfs,
                    else: elseItem
                })
            }}
            onDelete={() => {
                if (elseIfs.length) {
                    onChange({
                        if: elseIfs[0],
                        elseIfs: elseIfs.slice(1),
                        else: elseItem
                    })
                }
                else {
                    onDelete()
                }
            }}
            render={render}
            actions={actionFactory(0)}
            defaultItem={defaultItem}
            addItemIcon={addItemIcon}
        />
        {
            elseIfs.map((elseIf, index) => (
                <IfElseWrapLocal
                    key={`elseIf-${index}`}
                    type='elseIf'
                    nodeKey={elseIf.key}
                    source={elseIf.source}
                    node={elseIf.node}
                    onChange={(value) => {
                        onChange({
                            if: primary,
                            elseIfs: toSpliced(elseIfs, index, 1, value),
                            else: elseItem
                        })
                    }}
                    onDelete={() => {
                        onChange({
                            if: primary,
                            elseIfs: toSpliced(elseIfs, index, 1),
                            else: elseItem
                        })
                    }}
                    render={render}
                    actions={actionFactory(index + 1)}
                    defaultItem={defaultItem}
                    addItemIcon={addItemIcon}
                />
            ))
        }
        {
            elseItem && <IfElseWrapLocal
                type='else'
                nodeKey={elseItem.key}
                source=''
                node={elseItem.node}
                onChange={(value) => {
                    onChange({
                        if: primary,
                        elseIfs,
                        else: value
                    })
                }}
                onDelete={() => {
                    onChange({
                        if: primary,
                        elseIfs
                    })
                }}
                render={render}
                actions={[]}
                defaultItem={defaultItem}
                addItemIcon={addItemIcon}
            />
        }
    </React.Fragment>
}

type IfElseTreeProps<T extends object> = ConditionalTree<T> & {
    onChange: (value: ConditionalTree<T>) => void;
    render: RenderType<T>;
    defaultItem: T;
    addItemIcon: ReactElement;
}

export const IfElseTree = <T extends object>({ items, conditionals, onChange, render, defaultItem, addItemIcon }: IfElseTreeProps<T>): ReactElement => {
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
                    onDelete={() => {
                        onChange({
                            items,
                            conditionals: toSpliced(conditionals, index, 1)
                        })
                    }}
                    defaultItem={defaultItem}
                    addItemIcon={addItemIcon}
                />
            ))
        }
        <Stack direction="row" spacing={2}>
            <AddItemButton
                addItemIcon={addItemIcon}
                onClick={() => {
                    onChange({
                        items: [...items, { ...defaultItem }],
                        conditionals
                    })
                }}
            />
            <AddItemButton
                addItemIcon={<React.Fragment>If</React.Fragment>}
                onClick={() => {
                    onChange({
                        items,
                        conditionals: [
                            ...conditionals,
                            { if: { key: '', source: '', node: { items: [], conditionals: [] }}, elseIfs:[] }
                        ]
                    })
                }}
            />

        </Stack>
    </React.Fragment>
    //
    // TODO: Add "AddItem" and "AddConditional" buttons in IfElseTree
    //
}

export default IfElseTree
