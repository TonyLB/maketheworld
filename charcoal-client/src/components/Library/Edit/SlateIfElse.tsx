import Box from "@mui/material/Box"
import Button from "@mui/material/Button"
import Chip from "@mui/material/Chip"
import { blue } from "@mui/material/colors"
import React, { FunctionComponent, useCallback, useMemo } from "react"
import { Editor, Transforms, Path } from "slate"
import { ReactEditor, RenderElementProps, useSlate } from "slate-react"
import { CustomBlock, CustomIfBlock } from "./baseClasses"
import CodeEditor from "./CodeEditor"
import { SlateIndentBox } from "./LabelledIndentBox"

import IfIcon from '@mui/icons-material/Quiz'
import { useLibraryAsset } from "./LibraryAsset"

const AddConditionalButton: FunctionComponent<{ editor: Editor; path: Path; defaultItem: CustomBlock; label: string }> = ({ editor, path, defaultItem, label }) => {
    const { readonly } = useLibraryAsset()
    const onClick = useCallback(() => {
        if (path.length) {
            Transforms.insertNodes(
                editor,
                defaultItem,
                { at: [...path.slice(0, -1), path.slice(-1)[0] + 1] }
            )
        }
    }, [editor, path])
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
        onClick={onClick}
        disabled={readonly}
    />
}

const AddElseIfButton: FunctionComponent<{ editor: Editor; path: Path; defaultBlock: CustomBlock }> = ({ editor, path, defaultBlock }) => (
    <AddConditionalButton
        editor={editor}
        path={path}
        defaultItem={{ type: 'elseif', source: '', children: [defaultBlock]}}
        label='Else If'
    />
)
const AddElseButton: FunctionComponent<{ editor: Editor; path: Path; defaultBlock: CustomBlock }> = ({ editor, path, defaultBlock }) => (
    <AddConditionalButton
        editor={editor}
        path={path}
        defaultItem={{ type: 'else', children: [defaultBlock]}}
        label='Else'
    />
)

const wrapIfBlock = (editor: Editor, defaultBlock: CustomBlock) => {
    const block: CustomIfBlock = {
        type: 'ifBase',
        source: "",
        children: [defaultBlock]
    }
    Transforms.insertNodes(editor, block)
}

type AddIfButton = {
    defaultBlock: CustomBlock;
}

export const AddIfButton: FunctionComponent<AddIfButton> = ({ defaultBlock}) => {
    const editor = useSlate()
    const { readonly } = useLibraryAsset()
    const onClick = useCallback(() => {
        wrapIfBlock(editor, defaultBlock)
    }, [editor])
    return <Button
        variant="outlined"
        disabled={readonly}
        onClick={onClick}
    >
        <IfIcon />If
    </Button>
}

export const SlateIfElse: FunctionComponent<RenderElementProps & { defaultBlock: CustomBlock }> = ({ defaultBlock, ...props }) => {
    const editor = useSlate()
    const { attributes, children, element } = props
    const path = ReactEditor.findPath(editor, element)
    switch(element.type) {
        case 'ifBase':
        case 'elseif':
            return <SlateIndentBox
                    { ...attributes }
                    color={blue}
                    label={
                        <React.Fragment>
                            {element.type === 'ifBase' ? 'If ' : 'Else If '}
                            <Box
                                sx={{
                                    display: 'inline-block',
                                    borderRadius: '0.25em',
                                    backgroundColor: blue[50],
                                    paddingLeft: '0.25em',
                                    paddingRight: '0.25em',
                                    marginRight: '0.25em'
                                }}
                            >
                                <CodeEditor
                                    source={element.source}
                                    onChange={(value: string) => {
                                        Transforms.setNodes(editor, { source: value }, { at: ReactEditor.findPath(editor, element) })
                                    }}
                                />
                            </Box>
                        </React.Fragment>
                    }
                    actions={<React.Fragment>
                        <AddElseIfButton editor={editor} path={path ?? []} defaultBlock={defaultBlock} />
                        { element.isElseValid && <AddElseButton editor={editor} path={path ?? []} defaultBlock={defaultBlock} />}
                    </React.Fragment>}
                >
                    { children }
            </SlateIndentBox>
        case 'else':
            return <SlateIndentBox
                    {...attributes}
                    color={blue}
                    label={<React.Fragment>Else</React.Fragment>}
                >
                    { children }
            </SlateIndentBox>
        default: return (
            <p {...attributes}>
                {children}
            </p>
        )
    }
}

export default SlateIfElse
