import React, { FunctionComponent, useMemo, useState, useCallback, useEffect } from 'react'
import { useSelector } from 'react-redux'
import {
    useParams
} from "react-router-dom"
import { isKeyHotkey } from 'is-hotkey'
import { grey } from '@mui/material/colors'

import { useSlate } from 'slate-react'
import {
    Descendant,
    createEditor,
    Editor,
    Element as SlateElement,
    Transforms,
    Range
} from 'slate'
import { withHistory } from 'slate-history'
import { Slate, Editable, withReact, ReactEditor, RenderElementProps } from 'slate-react'

import {
    Box,
    Toolbar,
    Button,
} from '@mui/material'
import LinkIcon from '@mui/icons-material/Link'
import LinkOffIcon from '@mui/icons-material/LinkOff'
import BeforeIcon from '@mui/icons-material/Reply'
import ReplaceIcon from '@mui/icons-material/Backspace'

import {
    CustomBeforeBlock,
    CustomReplaceBlock,
    isCustomBlock,
    CustomInheritedReadOnlyElement
} from '../baseClasses'

import { ComponentRenderItem } from '@tonylb/mtw-wml/dist/normalize/baseClasses'
import { DescriptionLinkActionChip, DescriptionLinkFeatureChip } from '../../../Message/DescriptionLink'
import { getNormalized } from '../../../../slices/personalAssets'
import { useDebouncedOnChange } from '../../../../hooks/useDebounce'
import descendantsToRender from './descendantsToRender'
import descendantsFromRender from './descendantsFromRender'
import withConditionals from './conditionals'
import { decorateFactory, Element, Leaf, withParagraphBR } from './components'
import LinkDialog from './LinkDialog'
import { AddIfButton } from '../SlateIfElse'
import { useLibraryAsset } from '../LibraryAsset'
import { LabelledIndentBox, SlateIndentBox } from '../LabelledIndentBox'

interface DescriptionEditorProps {
    ComponentId: string;
    inheritedRender?: ComponentRenderItem[];
    render: ComponentRenderItem[];
    onChange?: (items: ComponentRenderItem[]) => void;
}

const withInlines = (editor: Editor) => {
    const { isInline } = editor

    //
    // TODO: Refactor before and replace as blocks rather than inlines, so they can contain conditionals
    //
    editor.isInline = (element: SlateElement) => (
        ['actionLink', 'featureLink', 'before', 'replace'].includes(element.type) || isInline(element)
    )

    return editor
}

//
// TODO: Rewrite InheritedDescription as an inline VOID Slate type, with a read-only slate sub-editor
//
const InheritedDescription: FunctionComponent<{ inheritedRender?: ComponentRenderItem[] }> = ({ inheritedRender=[] }) => {
    const inheritedValue = useMemo<CustomInheritedReadOnlyElement[]>(() => ([{
        type: 'inherited',
        children: descendantsFromRender(inheritedRender)
    }]), [inheritedRender])
    const editor = useMemo(() => withParagraphBR(withConditionals(withInlines(withHistory(withReact(createEditor()))))), [])
    const renderElement = useCallback((props: RenderElementProps) => <Element {...props} />, [])
    const renderLeaf = useCallback(props => <Leaf {...props} />, [])
    const decorate = useCallback(decorateFactory(editor), [editor])
    useEffect(() => {
        //
        // Since slate-react doesn't seem to catch up to reactive changes in the value of a Slate
        // object, we need to manually reset the value on a change
        //
        editor.children = inheritedValue
        Editor.normalize(editor, { force: true })
    }, [editor, inheritedValue])

    if ((inheritedRender || []).length === 0) {
        return null
    }

    return <Box sx={{ position: "relative", width: "calc(100% - 0.1em)", display: 'inline-block' }}>
        <Box
            sx={{
                borderRadius: "0em 1em 1em 0em",
                borderStyle: 'solid',
                borderColor: grey[500],
                background: grey[100],
                display: 'inline',
                paddingRight: '0.25em',
                position: 'absolute',
                top: 0,
                left: 0
            }}
        >
            Inherited
        </Box>
        <Box
            sx={{
                borderRadius: '0em 1em 1em 0em',
                borderStyle: 'solid',
                borderColor: grey[500],
                background: grey[50],
                paddingRight: '0.5em',
                paddingLeft: '0.25em',
                paddingTop: "0.5em",
                marginTop: '1em',
            }}
        >
            <Slate editor={editor} value={inheritedValue}>
                <Editable
                    readOnly
                    renderElement={renderElement}
                    renderLeaf={renderLeaf}
                    decorate={decorate}
                />
            </Slate>
        </Box>
    </Box>
}

const isInContextOf = (tags: string[]) => (editor: Editor) => {
    const link = Editor.nodes(editor, {
        match: n =>
            !Editor.isEditor(n) && SlateElement.isElement(n) && tags.includes(n.type),
    }).next()
    return !!(link?.value)
}

const isLinkActive = isInContextOf(['actionLink', 'featureLink'])

const isBeforeBlock = isInContextOf(['before'])
const isReplaceBlock = isInContextOf(['replace'])

const unwrapLink = (editor: Editor) => {
    Transforms.unwrapNodes(editor, {
        match: n =>
            !Editor.isEditor(n) && SlateElement.isElement(n) && ['actionLink', 'featureLink'].includes(n.type),
    })
}

const selectActiveBlock = (editor: Editor) => {
    const block = Editor.nodes(editor, {
        match: n =>
            !Editor.isEditor(n) && SlateElement.isElement(n) && ['before', 'replace'].includes(n.type),
    }).next()
    if (block?.value) {
        const location = block.value[1]
        Transforms.select(editor, location)
    }
}

const unwrapBlock = (editor: Editor) => {
    Transforms.unwrapNodes(editor, {
        match: n =>
            !Editor.isEditor(n) && SlateElement.isElement(n) && ['before', 'replace'].includes(n.type),
    })
}

const wrapBeforeBlock = (editor: Editor) => {
    if (isBeforeBlock(editor)) {
        selectActiveBlock(editor)
        unwrapBlock(editor)
    }
  
    const { selection } = editor
    const isCollapsed = selection && Range.isCollapsed(selection)
    const block: CustomBeforeBlock = {
        type: 'before',
        children: [],
    }
  
    if (isCollapsed) {
        Transforms.insertNodes(editor, block)
    } else {
        Transforms.wrapNodes(editor, block, { split: true })
        Transforms.collapse(editor, { edge: 'end' })
        editor.saveSelection = undefined
    }
}

const wrapReplaceBlock = (editor: Editor) => {
    if (isReplaceBlock(editor)) {
        selectActiveBlock(editor)
        unwrapBlock(editor)
    }
  
    const { selection } = editor
    const isCollapsed = selection && Range.isCollapsed(selection)
    const block: CustomReplaceBlock = {
        type: 'replace',
        children: [],
    }
  
    if (isCollapsed) {
        Transforms.insertNodes(editor, block)
    } else {
        Transforms.wrapNodes(editor, block, { split: true })
        Transforms.collapse(editor, { edge: 'end' })
        editor.saveSelection = undefined
    }
}

interface AddLinkButtonProps {
    openDialog: () => void;
}

const AddLinkButton: FunctionComponent<AddLinkButtonProps> = ({ openDialog }) => {
    const editor = useSlate()
    const { selection } = editor
    return <Button
        variant={isLinkActive(editor) ? "contained" : "outlined"}
        disabled={!selection || Boolean(!isLinkActive(editor) && Range.isCollapsed(selection))}
        onClick={openDialog}
    >
        <LinkIcon />
    </Button>
}

interface RemoveLinkButtonProps {
}

const RemoveLinkButton: FunctionComponent<RemoveLinkButtonProps> = () => {
    const editor = useSlate()
    const { selection } = editor
    const handleClick = useCallback(() => {
        unwrapLink(editor)
        setTimeout(() => {
            ReactEditor.focus(editor)
        }, 10)
    }, [editor])
    return <Button
        variant={isLinkActive(editor) ? "contained" : "outlined"}
        disabled={!selection || Boolean(!isLinkActive(editor) && Range.isCollapsed(selection))}
        onClick={handleClick}
    >
        <LinkOffIcon />
    </Button>
}

const DisplayTagRadio: FunctionComponent<{}> = () => {
    const editor = useSlate()
    const { selection } = editor
    const handleBeforeClick = useCallback(() => {
        if (isBeforeBlock(editor)) {
            unwrapBlock(editor)
        }
        else {
            if (isReplaceBlock(editor)) {
                selectActiveBlock(editor)
                unwrapBlock(editor)
            }
            wrapBeforeBlock(editor)
        }
        setTimeout(() => {
            if (editor.saveSelection) {
                Transforms.select(editor, editor.saveSelection)
            }
            ReactEditor.focus(editor)
        }, 10)
    }, [editor])
    const handleReplaceClick = useCallback(() => {
        if (isReplaceBlock(editor)) {
            unwrapBlock(editor)
        }
        else {
            if (isBeforeBlock(editor)) {
                selectActiveBlock(editor)
                unwrapBlock(editor)
            }
            wrapReplaceBlock(editor)
        }
        setTimeout(() => {
            if (editor.saveSelection) {
                Transforms.select(editor, editor.saveSelection)
            }
            ReactEditor.focus(editor)
        }, 10)
    }, [editor])
    const handleAfterClick = useCallback(() => {
        if (isReplaceBlock(editor) || isBeforeBlock(editor)) {
            selectActiveBlock(editor)
            unwrapBlock(editor)
        }
        setTimeout(() => {
            if (editor.saveSelection) {
                Transforms.select(editor, editor.saveSelection)
            }
            ReactEditor.focus(editor)
        }, 10)
    }, [editor])
    return <React.Fragment>
        <Button
            variant={isBeforeBlock(editor) ? "contained" : "outlined"}
            disabled={!selection || Boolean(!isBeforeBlock(editor) && !isReplaceBlock(editor) && selection && Range.isCollapsed(selection))}
            onClick={handleBeforeClick}
        >
            <BeforeIcon />
        </Button>
        <Button
            variant={isReplaceBlock(editor) ? "contained" : "outlined"}
            disabled={!selection || Boolean(!isBeforeBlock(editor) && !isReplaceBlock(editor) && Range.isCollapsed(selection))}
            onClick={handleReplaceClick}
        >
            <ReplaceIcon />
        </Button>
        <Button
            variant={(isReplaceBlock(editor) || isBeforeBlock(editor)) ? "outlined" : "contained"}
            disabled={!selection || Boolean(!isBeforeBlock(editor) && !isReplaceBlock(editor) && Range.isCollapsed(selection))}
            onClick={handleAfterClick}
        >
            <BeforeIcon sx={{ transform: "scaleX(-1)" }} />
        </Button>
    </React.Fragment>
}

export const DescriptionEditor: FunctionComponent<DescriptionEditorProps> = ({ ComponentId, render, onChange = () => {} }) => {
    const { AssetId: assetKey } = useParams<{ AssetId: string }>()
    const AssetId = `ASSET#${assetKey}`
    const normalForm = useSelector(getNormalized(AssetId))
    const { components } = useLibraryAsset()
    const inheritedRender = useMemo(() => (components[ComponentId]?.inheritedRender || []), [components, ComponentId])
    const editor = useMemo(() => withParagraphBR(withConditionals(withInlines(withHistory(withReact(createEditor()))))), [])
    const defaultValue = useMemo(() => (descendantsFromRender(render)), [render, normalForm])
    const [value, setValue] = useState<Descendant[]>(defaultValue)
    useEffect(() => {
        editor.children = defaultValue
        Editor.normalize(editor, { force: true })
    }, [editor, defaultValue])
    const [linkDialogOpen, setLinkDialogOpen] = useState<boolean>(false)
    const renderElement = useCallback((props: RenderElementProps) => <Element {...props} />, [])
    const renderLeaf = useCallback(props => <Leaf {...props} />, [])
    const onKeyDown: React.KeyboardEventHandler<HTMLInputElement> = useCallback((event) => {
        const { selection } = editor
    
        // Default left/right behavior is unit:'character'.
        // This fails to distinguish between two cursor positions, such as
        // <inline>foo<cursor/></inline> vs <inline>foo</inline><cursor/>.
        // Here we modify the behavior to unit:'offset'.
        // This lets the user step into and out of the inline without stepping over characters.
        // You may wish to customize this further to only use unit:'offset' in specific cases.
        if (selection && Range.isCollapsed(selection)) {
            const { nativeEvent } = event
            if (isKeyHotkey('left', nativeEvent)) {
                event.preventDefault()
                Transforms.move(editor, { unit: 'offset', reverse: true })
                console.log(`afterKeyDown: ${JSON.stringify(editor.selection, null, 4)}`)
                return
            }
            if (isKeyHotkey('right', nativeEvent)) {
                event.preventDefault()
                Transforms.move(editor, { unit: 'offset' })
                console.log(`afterKeyDown: ${JSON.stringify(editor.selection, null, 4)}`)
                return
            }
        }
        console.log(`afterKeyDown: ${JSON.stringify(editor.selection, null, 4)}`)
    }, [editor])

    const saveToReduce = useCallback((value: Descendant[]) => {
        const newRender = descendantsToRender((value || []).filter(isCustomBlock))
        onChange(newRender)
    }, [onChange, value])

    const onChangeHandler = useCallback((value) => {
        setValue(value)
    }, [setValue])

    useDebouncedOnChange({
        value,
        delay: 1000,
        onChange: (value) => {
            saveToReduce(value)
        }
    })

    const decorate = useCallback(decorateFactory(editor), [editor])

    //
    // TODO: Refactor Slate editor as a separate item from its controller, and use to
    // also populate InheritedDescription
    //
    return <React.Fragment>
        <Slate editor={editor} value={value} onChange={onChangeHandler}>
            <LinkDialog open={linkDialogOpen} onClose={() => { setLinkDialogOpen(false) }} />
            <Toolbar variant="dense" disableGutters sx={{ marginTop: '-0.375em' }}>
                <AddLinkButton openDialog={() => { setLinkDialogOpen(true) }} />
                <RemoveLinkButton />
                <DisplayTagRadio />
                <AddIfButton defaultBlock={{
                    type: 'paragraph',
                    children: [{ text: '' }]
                }} />
            </Toolbar>
            <Box sx={{ padding: '0.5em' }}>
                <InheritedDescription inheritedRender={inheritedRender} />
                <Editable
                    renderElement={renderElement}
                    renderLeaf={renderLeaf}
                    decorate={decorate}
                    // onKeyDown={onKeyDown}
                />
            </Box>
        </Slate>

    </React.Fragment>
}

export default DescriptionEditor
