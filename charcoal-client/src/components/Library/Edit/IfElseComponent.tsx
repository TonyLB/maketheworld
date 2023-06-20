import Box from "@mui/material/Box"
import Chip from "@mui/material/Chip"
import { blue } from "@mui/material/colors"
import React, { FunctionComponent, useCallback, ReactChild, ReactChildren } from "react"
import CodeEditor from "./CodeEditor"
import { LabelledIndentBox } from "./LabelledIndentBox"

import { useLibraryAsset } from "./LibraryAsset"

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

type IfElseWrapBoxProps = {
    type: 'if' | 'elseIf' | 'else';
    source: string;
    onChange: (value: string) => void;
    actions: ReactChild[] | ReactChildren;
}

const IfElseWrapBox: FunctionComponent<IfElseWrapBoxProps> = ({ type, source, onChange, actions, children }) => (
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
                        <CodeEditor source={source} onChange={onChange} />
                    </Box>
                </React.Fragment>
        }
        actions={actions}
    >
        { children }
    </LabelledIndentBox>
)

type IfElseConditional = {
    source: string;
    contents: ReactChild[] | ReactChildren;
}

export type IfElseProps = {
    primary: IfElseConditional;
    elseIfs: IfElseConditional[];
    elseItem?: ReactChild[] | ReactChildren
}

export const IfElse: FunctionComponent<IfElseProps & { onChange: (props: IfElseProps) => void}> = ({ primary, elseIfs, elseItem, onChange }) => {
    const actionFactory = useCallback((index: number) => ([
        <AddConditionalButton
            label="Else If"
            onClick={() => {
                onChange({
                    primary,
                    elseIfs: [
                        ...elseIfs.slice(0, index),
                        {
                            source: '',
                            contents: []
                        },
                        ...elseIfs.slice(index)
                    ],
                    elseItem
                })
            }}
        />,
        ...((typeof elseItem !== 'undefined') ? [] : [
            <AddConditionalButton
                label="Else"
                onClick={() => {
                    onChange({
                        primary,
                        elseIfs,
                        elseItem: []
                    })
                }}
            />
        ])
    ]), [primary, elseIfs, elseItem, onChange])
    return <React.Fragment>
        <IfElseWrapBox
            type='if'
            source={primary.source}
            onChange={(value) => {
                onChange({
                    primary: {
                        ...primary,
                        source: value
                    },
                    elseIfs,
                    elseItem
                })
            }}
            children={primary.contents}
            actions={actionFactory(0)}
        />
        {
            elseIfs.map(({ source, contents }, index) => (
                <IfElseWrapBox
                    type='elseIf'
                    source={source}
                    onChange={(value) => {
                        onChange({
                            primary,
                            elseIfs: [
                                ...elseIfs.slice(0, index - 1),
                                {
                                    ...elseIfs[index],
                                    source: value
                                },
                                ...elseIfs.slice(index + 1)
                            ],
                            elseItem
                        })
                    }}
                    children={contents}
                    actions={actionFactory(index + 1)}
                />
            ))
        }
        {
            elseItem && <IfElseWrapBox
                type='else'
                source=''
                onChange={() => {}}
                children={elseItem}
                actions={[]}
            />
        }
    </React.Fragment>
}

export default IfElse
