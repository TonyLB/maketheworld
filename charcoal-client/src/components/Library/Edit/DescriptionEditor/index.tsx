import React, { FunctionComponent, useMemo, useState, useCallback, useEffect, ReactNode } from 'react'
import { useSelector } from 'react-redux'
import {
    useParams
} from "react-router-dom"
import { isKeyHotkey } from 'is-hotkey'
import { pink, green, blue } from '@mui/material/colors'

import { useSlateStatic, useSlate } from 'slate-react'
import {
    Descendant,
    createEditor,
    Editor,
    Element as SlateElement,
    Transforms,
    Range
} from 'slate'
import { withHistory } from 'slate-history'
import { Slate, Editable, withReact, ReactEditor, RenderElementProps, RenderLeafProps } from 'slate-react'

import {
    Box,
    Toolbar,
    Button,
    Dialog,
    DialogTitle,
    DialogContent,
    List,
    ListItemButton,
    ListItemText,
    ListSubheader,
    IconButton
} from '@mui/material'
import CloseIcon from '@mui/icons-material/Close'
import LinkIcon from '@mui/icons-material/Link'
import LinkOffIcon from '@mui/icons-material/LinkOff'
import BeforeIcon from '@mui/icons-material/Reply'
import ReplaceIcon from '@mui/icons-material/Backspace'

import {
    CustomActionLinkElement,
    CustomFeatureLinkElement,
    CustomParagraphElement,
    CustomBeforeBlock,
    CustomReplaceBlock,
} from '../baseClasses'

import { ComponentRenderItem, NormalFeature } from '@tonylb/mtw-wml/dist/normalize/baseClasses'
import { DescriptionLinkActionChip, DescriptionLinkFeatureChip } from '../../../Message/DescriptionLink'
import { getNormalized } from '../../../../slices/personalAssets'
import useDebounce from '../../../../hooks/useDebounce'
import { deepEqual } from '../../../../lib/objects'
import { LabelledIndentBox } from '../LabelledIndentBox'
import descendantsToRender from './descendantToRender'
import InlineChromiumBugfix from './InlineChromiumBugfix'
import descendantsFromRender from './descendantsFromRender'
import withConditionals from './conditionals'

interface DescriptionEditorProps {
    inheritedRender?: ComponentRenderItem[];
    render: ComponentRenderItem[];
    onChange?: (items: ComponentRenderItem[]) => void;
}

const withInlines = (editor: Editor) => {
    const { isInline, isVoid } = editor

    editor.isInline = (element: SlateElement) => (
        ['actionLink', 'featureLink', 'before', 'replace', 'if'].includes(element.type) || isInline(element)
    )

    editor.isVoid = (element: SlateElement) => (
        ['inherited'].includes(element.type) || isVoid(element)
    )

    return editor
}

//
// TODO: Create a normalizer mixin to prevent the insertion of in-between text points inside of a CustomIfElement
// child-family
//

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

type SlateIndentBoxProps = {
    color: Record<number | string, string>;
    children: any;
    label: ReactNode;
}

const SlateIndentBox: FunctionComponent<SlateIndentBoxProps> = ({ color, children, label }) => {
    return <LabelledIndentBox
        color={color}
        label={label}
        slate
    >
        <InlineChromiumBugfix />
        {children}
        <InlineChromiumBugfix />
    </LabelledIndentBox>
}

const Element: FunctionComponent<RenderElementProps & { inheritedRender?: ComponentRenderItem[] }> = ({ inheritedRender, ...props }) => {
    const { attributes, children, element } = props
    switch(element.type) {
        case 'featureLink':
            return <span {...attributes}>
                <DescriptionLinkFeatureChip tooltipTitle={`Feature: ${element.to}`}>
                    <InlineChromiumBugfix />
                    {children}
                    <InlineChromiumBugfix />
                </DescriptionLinkFeatureChip>
            </span>
        case 'actionLink':
            return <span {...attributes}>
                <DescriptionLinkActionChip tooltipTitle={`Action: ${element.to}`}>
                    <InlineChromiumBugfix />
                    {children}
                    <InlineChromiumBugfix />
                </DescriptionLinkActionChip>
            </span>
        case 'before':
        case 'replace':
            const highlight = element.type === 'before' ? green : pink
            return <span {...attributes}>
                <SlateIndentBox
                    color={highlight}
                    label={element.type === 'before'
                        ? <React.Fragment><BeforeIcon sx={{ verticalAlign: "middle", paddingBottom: '0.2em' }} />Before</React.Fragment>
                        : <React.Fragment><ReplaceIcon sx={{ verticalAlign: "middle", paddingBottom: '0.2em' }} />Replace</React.Fragment>
                    }
                >
                    { children }
                </SlateIndentBox>
            </span>
        case 'if':
            return <span {...attributes}>
                <InlineChromiumBugfix />
                { children }
                <InlineChromiumBugfix />
            </span>
        case 'ifBase':
        case 'elseif':
            return <span {...attributes}>
                <SlateIndentBox
                    color={blue}
                    label={<React.Fragment>{element.type === 'ifBase' ? 'If' : 'Else If'} [{element.source}]</React.Fragment>}
                >
                    { children }
                </SlateIndentBox>
            </span>
        case 'else':
            return <span {...attributes}>
                <SlateIndentBox
                    color={blue}
                    label={<React.Fragment>Else</React.Fragment>}
                >
                    { children }
                </SlateIndentBox>
            </span>
        case 'description':
            const interspersedChildren = children.reduce((previous: any, item: any, index: number) => ([
                ...previous,
                ...((index > 0) ? [<br key={`line-break-${index}`} />] : []),
                item
            ]), [] as any[])
            return <span {...attributes}><span contentEditable={false}><InheritedDescription inheritedRender={inheritedRender} /></span>{interspersedChildren}</span>
        case 'paragraph':
            return <span {...attributes} >{ children }</span>
        default: return (
            <p {...attributes}>
                {children}
            </p>
        )
    }
}

const Leaf: FunctionComponent<RenderLeafProps> = ({ attributes, children, leaf }) => {
    return <span {...attributes}>{children}</span>
}

interface LinkDialogProps {
    open: boolean;
    onClose: () => void;
}

const LinkDialog: FunctionComponent<LinkDialogProps> = ({ open, onClose }) => {
    const editor = useSlateStatic()
    const { AssetId: assetKey } = useParams<{ AssetId: string }>()
    const AssetId = `ASSET#${assetKey}`
    const normalForm = useSelector(getNormalized(AssetId))
    const actions = Object.values(normalForm)
        .filter(({ tag }) => (tag === 'Action'))
    const features = Object.values(normalForm)
        .filter(({ tag }) => (tag === 'Feature')) as NormalFeature[]
    return <Dialog
        open={open}
        scroll='paper'
        onClose={onClose}
    >
        <DialogTitle>
            <Box sx={{ marginRight: '2rem' }}>
                Select Link Target
            </Box>
            <IconButton
                aria-label="close"
                onClick={onClose}
                sx={{
                position: 'absolute',
                right: 8,
                top: 8
                }}
            >
                <CloseIcon />
            </IconButton>
        </DialogTitle>
        <DialogContent>
            <List>
                <ListSubheader>
                    Actions
                </ListSubheader>
                { actions.map(({ key }) => (
                    <ListItemButton
                        key={key}
                        onClick={() => {
                            wrapActionLink(editor, key)
                            onClose()
                            setTimeout(() => {
                                if (editor.saveSelection) {
                                    Transforms.select(editor, editor.saveSelection)
                                }
                                ReactEditor.focus(editor)
                            }, 10)
                        }}
                    >
                        <ListItemText>
                            {key}
                        </ListItemText>
                    </ListItemButton>
                ))}
                <ListSubheader>
                    Features
                </ListSubheader>
                { features.map(({ key }) => (
                    <ListItemButton
                        key={key}
                        onClick={() => {
                            wrapFeatureLink(editor, key)
                            onClose()
                            setTimeout(() => {
                                if (editor.saveSelection) {
                                    Transforms.select(editor, editor.saveSelection)
                                }
                                ReactEditor.focus(editor)
                            }, 10)
                        }}
                    >
                        <ListItemText>
                            {key}
                        </ListItemText>
                    </ListItemButton>
                ))}
            </List>
        </DialogContent>
    </Dialog>
}

const isInContextOf = (tags: string[]) => (editor: Editor) => {
    const link = Editor.nodes(editor, {
        match: n =>
            !Editor.isEditor(n) && SlateElement.isElement(n) && tags.includes(n.type),
    }).next()
    return !!(link?.value)
}

const isLinkActive = isInContextOf(['actionLink', 'featureLink'])
// const isLinkActive = (editor: Editor) => {
//     const link = Editor.nodes(editor, {
//         match: n =>
//             !Editor.isEditor(n) && SlateElement.isElement(n) && ['actionLink', 'featureLink'].includes(n.type),
//     }).next()
//     return !!(link?.value)
// }

const isBeforeBlock = isInContextOf(['before'])
// const isBeforeBlock = (editor: Editor) => {
//     const block = Editor.nodes(editor, {
//         match: n =>
//             !Editor.isEditor(n) && SlateElement.isElement(n) && n.type === 'before',
//     }).next()
//     return !!(block?.value)
// }

const isReplaceBlock = isInContextOf(['replace'])
// const isReplaceBlock = (editor: Editor) => {
//     const block = Editor.nodes(editor, {
//         match: n =>
//             !Editor.isEditor(n) && SlateElement.isElement(n) && n.type === 'replace',
//     }).next()
//     return !!(block?.value)
// }

const isIfBlock = isInContextOf(['if'])

const selectActiveLink = (editor: Editor) => {
    const link = Editor.nodes(editor, {
        match: n =>
            !Editor.isEditor(n) && SlateElement.isElement(n) && ['actionLink', 'featureLink'].includes(n.type),
    }).next()
    if (link?.value) {
        const location = link.value[1]
        Transforms.select(editor, location)
    }
}

const unwrapLink = (editor: Editor) => {
    Transforms.unwrapNodes(editor, {
        match: n =>
            !Editor.isEditor(n) && SlateElement.isElement(n) && ['actionLink', 'featureLink'].includes(n.type),
    })
}

const wrapActionLink = (editor: Editor, to: string) => {
    if (isLinkActive(editor)) {
        selectActiveLink(editor)
        unwrapLink(editor)
    }
  
    const { selection } = editor
    const isCollapsed = selection && Range.isCollapsed(selection)
    const link: CustomActionLinkElement = {
        type: 'actionLink',
        to,
        children: isCollapsed ? [{ text: to }] : [],
    }
  
    if (isCollapsed) {
        Transforms.insertNodes(editor, link)
    } else {
        Transforms.wrapNodes(editor, link, { split: true })
        Transforms.collapse(editor, { edge: 'end' })
        editor.saveSelection = undefined
    }
}

const wrapFeatureLink = (editor: Editor, to: string) => {
    if (isLinkActive(editor)) {
        selectActiveLink(editor)
        unwrapLink(editor)
    }
  
    const { selection } = editor
    const isCollapsed = selection && Range.isCollapsed(selection)
    const link: CustomFeatureLinkElement = {
        type: 'featureLink',
        to,
        children: isCollapsed ? [{ text: to }] : [],
    }
  
    if (isCollapsed) {
        Transforms.insertNodes(editor, link)
    } else {
        Transforms.wrapNodes(editor, link, { split: true })
        Transforms.collapse(editor, { edge: 'end' })
        editor.saveSelection = undefined
    }
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
    const [defaultValue, setDefaultValue] = useState<Descendant[]>(() => ([{
        type: 'description',
        children: descendantsFromRender(normalForm)(render)
    }]))
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
                return
            }
            if (isKeyHotkey('right', nativeEvent)) {
                event.preventDefault()
                Transforms.move(editor, { unit: 'offset' })
                return
            }
        }
    }, [])

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
                    onKeyDown={onKeyDown}
                />
            </Box>
        </Slate>

    </React.Fragment>
}

export default DescriptionEditor
