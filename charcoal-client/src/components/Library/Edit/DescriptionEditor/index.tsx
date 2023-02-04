import React, { FunctionComponent, useMemo, useState, useCallback, useEffect } from 'react'
import { useSelector } from 'react-redux'
import {
    useParams
} from "react-router-dom"
import { isKeyHotkey } from 'is-hotkey'

import { useSlateStatic, useSlate } from 'slate-react'
import {
    Descendant,
    createEditor,
    Editor,
    Element as SlateElement,
    Transforms,
    Range,
    Node
} from 'slate'
import { withHistory } from 'slate-history'
import { Slate, Editable, withReact, ReactEditor, RenderElementProps } from 'slate-react'

import {
    Box,
    Toolbar,
    Button,
} from '@mui/material'
import CloseIcon from '@mui/icons-material/Close'
import LinkIcon from '@mui/icons-material/Link'
import LinkOffIcon from '@mui/icons-material/LinkOff'
import BeforeIcon from '@mui/icons-material/Reply'
import ReplaceIcon from '@mui/icons-material/Backspace'

import {
    CustomParagraphElement,
    CustomBeforeBlock,
    CustomReplaceBlock,
    isCustomParagraph,
} from '../baseClasses'

import { ComponentRenderItem } from '@tonylb/mtw-wml/dist/normalize/baseClasses'
import { DescriptionLinkActionChip, DescriptionLinkFeatureChip } from '../../../Message/DescriptionLink'
import { getNormalized } from '../../../../slices/personalAssets'
import useDebounce from '../../../../hooks/useDebounce'
import { deepEqual } from '../../../../lib/objects'
import descendantsToRender from './descendantToRender'
import descendantsFromRender from './descendantsFromRender'
import withConditionals from './conditionals'
import { decorateFactory, Element, Leaf } from './components'
import LinkDialog from './LinkDialog'

interface DescriptionEditorProps {
    inheritedRender?: ComponentRenderItem[];
    render: ComponentRenderItem[];
    onChange?: (items: ComponentRenderItem[]) => void;
}

const withInlines = (editor: Editor) => {
    const { isInline, isVoid } = editor

    //
    // TODO: Refactor before and replace as blocks rather than inlines, so they can contain conditionals
    //
    editor.isInline = (element: SlateElement) => (
        ['actionLink', 'featureLink', 'before', 'replace'].includes(element.type) || isInline(element)
    )

    editor.isVoid = (element: SlateElement) => (
        ['inherited'].includes(element.type) || isVoid(element)
    )

    return editor
}

const InheritedDescription: FunctionComponent<{ inheritedRender?: ComponentRenderItem[] }> = ({ inheritedRender=[] }) => {
    const { AssetId: assetKey } = useParams<{ AssetId: string }>()
    const AssetId = `ASSET#${assetKey}`
    const normalForm = useSelector(getNormalized(AssetId))
    return <span
        contentEditable={false}
        style={{ background: 'lightgrey' }}
    >
        {
            inheritedRender.map((item, index) => {
                switch(item.tag) {
                    case 'Link':
                        switch(item.targetTag) {
                            case 'Feature':
                                return <DescriptionLinkFeatureChip key={`link-${item.to}-${index}`} tooltipTitle={`Feature: ${item.to}`} active={false}>
                                        {item.text}
                                    </DescriptionLinkFeatureChip>
                            case 'Action':
                                return <DescriptionLinkActionChip key={`link-${item.to}-${index}`} tooltipTitle={`Action: ${item.to}`} active={false}>
                                        {item.text}
                                    </DescriptionLinkActionChip>
                            default:
                                return null
                        }
                    case 'String':
                        return item.value
                }
            })
        }
    </span>
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
const isIfBlock = isInContextOf(['if'])

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

export const DescriptionEditor: FunctionComponent<DescriptionEditorProps> = ({ inheritedRender = [], render, onChange = () => {} }) => {
    const editor = useMemo(() => withConditionals(withInlines(withHistory(withReact(createEditor())))), [])
    const { AssetId: assetKey } = useParams<{ AssetId: string }>()
    const AssetId = `ASSET#${assetKey}`
    const normalForm = useSelector(getNormalized(AssetId))
    const [defaultValue, setDefaultValue] = useState<Descendant[]>(() => (descendantsFromRender(normalForm)(render)))
    const [value, setValue] = useState<Descendant[]>(defaultValue)
    const [linkDialogOpen, setLinkDialogOpen] = useState<boolean>(false)
    const renderElement = useCallback((props: RenderElementProps) => <Element inheritedRender={inheritedRender} {...props} />, [inheritedRender])
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
        const newRender = descendantsToRender((('children' in value[0] && value[0].children) || []) as CustomParagraphElement[])
        onChange(newRender)
    }, [onChange, value])

    const onChangeHandler = useCallback((value) => {
        setValue(value)
    }, [setValue])
    
    const debouncedValue = useDebounce(value, 1000)
    useEffect(() => {
        if (!deepEqual(debouncedValue, defaultValue)) {
            saveToReduce(debouncedValue)
            setDefaultValue(debouncedValue)
        }
    }, [debouncedValue, defaultValue, saveToReduce])

    const decorate = useCallback(decorateFactory(editor), [editor])
    // const decorate = useCallback(
    //     ([node, path]): (Range & { explicitBR?: boolean; softBR?: boolean })[] => {
    //         if (SlateElement.isElement(node) && isCustomParagraph(node)) {
    //             let explicitBR: boolean | undefined
    //             let softBR: boolean | undefined
    //             const next = Editor.next(editor, { at: path })
    //             if (next) {
    //                 const [ nextNode, nextPath ] = next
    //                 if (SlateElement.isElement(nextNode) && isCustomParagraph(nextNode)) {
    //                     explicitBR = true
    //                 }
    //                 if (Node.string(node)) {
    //                     softBR = true
    //                 }
    //             }
    //             if (explicitBR || softBR) {
    //                 const last = Editor.last(editor, path)
    //                 if (last) {
    //                     //
    //                     // Apply marks to the last text leaf (which will render them appropriately)
    //                     //
    //                     const [_, lastPath] = last
    //                     const endPoint = Editor.end(editor, lastPath)
    //                     return [{
    //                         explicitBR,
    //                         softBR,
    //                         anchor: endPoint,
    //                         focus: endPoint
    //                     }]    
    //                 }
    //             }
    //     }
    //         return []
    //     },
    //     [editor]
    // )

    return <React.Fragment>
        <Slate editor={editor} value={value} onChange={onChangeHandler}>
            <LinkDialog open={linkDialogOpen} onClose={() => { setLinkDialogOpen(false) }} />
            <Toolbar variant="dense" disableGutters sx={{ marginTop: '-0.375em' }}>
                <AddLinkButton openDialog={() => { setLinkDialogOpen(true) }} />
                <RemoveLinkButton />
                <DisplayTagRadio />
            </Toolbar>
            <Box sx={{ padding: '0.5em' }}>
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
