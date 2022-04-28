import React, { FunctionComponent, useMemo, useState, useCallback, useEffect } from 'react'
import { useSelector, useDispatch } from 'react-redux'
import {
    useParams
} from "react-router-dom"
import { v4 as uuidv4 } from 'uuid'
import { isKeyHotkey } from 'is-hotkey'

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

import { CustomDescriptionElement, CustomActionLinkElement, CustomFeatureLinkElement, CustomText } from './baseClasses'

import { ComponentRenderItem, NormalForm, NormalFeature } from '../../../wml/normalize'
import { DescriptionLinkActionChip, DescriptionLinkFeatureChip } from '../../Message/DescriptionLink'
import { getNormalized } from '../../../slices/personalAssets'
import useDebouncedCallback from './useDebouncedCallback'

interface DescriptionEditorProps {
    inheritedRender?: ComponentRenderItem[];
    render: ComponentRenderItem[];
    spaceBefore?: boolean;
    spaceAfter?: boolean;
    onChange?: (items: ComponentRenderItem[]) => void;
}

const descendantsTranslate = function * (normalForm: NormalForm, renderItems: ComponentRenderItem[]) {
    for (const item of renderItems) {
        switch(item.tag) {
            case 'Link':
                const targetTag = normalForm[item.to]?.tag || 'Action'
                if (item.spaceBefore) {
                    yield {
                        text: ' '
                    } as CustomText
                }
                yield {
                    type: targetTag === 'Feature' ? 'featureLink' : 'actionLink',
                    to: item.to,
                    key: item.key,
                    children: [{
                        text: item.text || ''
                    }]
                } as CustomActionLinkElement | CustomFeatureLinkElement
                break
            case 'String':
                yield { text: `${item.spaceBefore ? ' ' : '' }${item.value}` } as CustomText
        }
    }
}

const descendantsFromRender = (normalForm: NormalForm) => ({ render, spaceBefore, spaceAfter }: { render: ComponentRenderItem[]; spaceBefore: boolean; spaceAfter: boolean }): (CustomActionLinkElement | CustomFeatureLinkElement | CustomText)[] => {
    if (render.length > 0) {
        let returnValue = [] as (CustomActionLinkElement | CustomFeatureLinkElement | CustomText)[]
        if (spaceBefore) {
            returnValue.push({
                text: ' '
            } as CustomText)
        }
        for (const item of descendantsTranslate(normalForm, render)) {
            returnValue.push(item)
        }
        if (spaceAfter) {
            returnValue.push({
                text: ' '
            } as CustomText)
        }
        return returnValue
    }
    return [{
        text: ''
    } as CustomText]
}

const withInlines = (editor: Editor) => {
    const { isInline, isVoid } = editor

    editor.isInline = (element: SlateElement) => (
        ['actionLink', 'featureLink'].includes(element.type) || isInline(element)
    )

    editor.isVoid = (element: SlateElement) => (
        ['inherited'].includes(element.type) || isVoid(element)
    )

    return editor
}

// Put this at the start and end of an inline component to work around this Chromium bug:
// https://bugs.chromium.org/p/chromium/issues/detail?id=1249405
const InlineChromiumBugfix = () => (
    <Box
        component="span"
        contentEditable={false}
        sx={{ fontSize: 0 }}
    >
        ${String.fromCodePoint(160) /* Non-breaking space */}
    </Box>
)

const InheritedDescription: FunctionComponent<{ inheritedRender?: ComponentRenderItem[] }> = ({ inheritedRender=[] }) => {
    const { AssetId: assetKey } = useParams<{ AssetId: string }>()
    const AssetId = `ASSET#${assetKey}`
    const normalForm = useSelector(getNormalized(AssetId))
    return <span
        contentEditable={false}
        style={{ background: 'lightgrey' }}
    >
        {
            inheritedRender.map((item) => {
                switch(item.tag) {
                    case 'Link':
                        switch(item.targetTag) {
                            case 'Feature':
                                return <DescriptionLinkFeatureChip key={item.key} tooltipTitle={`Feature: ${item.to}`} active={false}>
                                        {item.text}
                                    </DescriptionLinkFeatureChip>
                            case 'Action':
                                return <DescriptionLinkActionChip key={item.key} tooltipTitle={`Action: ${item.to}`} active={false}>
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
        case 'description':
            return <span {...attributes}><span contentEditable={false}><InheritedDescription inheritedRender={inheritedRender} /></span>{children}</span>
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

const isLinkActive = (editor: Editor) => {
    const link = Editor.nodes(editor, {
        match: n =>
            !Editor.isEditor(n) && SlateElement.isElement(n) && ['actionLink', 'featureLink'].includes(n.type),
    }).next()
    return !!(link?.value)
}

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
        key: uuidv4(),
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
        key: uuidv4(),
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
export const DescriptionEditor: FunctionComponent<DescriptionEditorProps> = ({ inheritedRender = [], render, spaceBefore = false, spaceAfter = false, onChange = () => {} }) => {
    const editor = useMemo(() => withInlines(withHistory(withReact(createEditor()))), [])
    const { AssetId: assetKey } = useParams<{ AssetId: string }>()
    const AssetId = `ASSET#${assetKey}`
    const normalForm = useSelector(getNormalized(AssetId))
    const [value, setValue] = useState<Descendant[]>([{
            type: 'description',
            children: descendantsFromRender(normalForm)({ render, spaceBefore, spaceAfter })
        }])
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

    const saveToReduce = useCallback(() => {
        const newRender = ((('children' in value[0] && value[0].children) || []) as (CustomActionLinkElement | CustomFeatureLinkElement | CustomText)[])
            .filter((item) => (('type' in item && item.type) || ('text' in item && item.text)))
            .reduce((previous, item) => {
                if ('type' in item && ['featureLink', 'actionLink'].includes(item.type)) {
                    return [
                        ...previous,
                        {
                            tag: 'Link',
                            targetTag: item.type === 'featureLink' ? 'Feature' : 'Action',
                            key: item.key,
                            to: item.to,
                            text: item.children
                                .filter((child) => ('text' in child))
                                .map(({ text }) => (text))
                                .join('')
                        }
                    ]
                }
                if ('text' in item) {
                    return [
                        ...previous,
                        {
                            tag: 'String',
                            value: item.text
                        }
                    ]
                }
                return previous
            }, [] as ComponentRenderItem[]) as ComponentRenderItem[]
        onChange(newRender)
    }, [onChange, value])

    const debouncedSave = useDebouncedCallback(saveToReduce)

    const onChangeHandler = useCallback((value) => {
        setValue(value)
        debouncedSave()
    }, [setValue, debouncedSave])

    return <React.Fragment>
        <Slate editor={editor} value={value} onChange={onChangeHandler}>
            <LinkDialog open={linkDialogOpen} onClose={() => { setLinkDialogOpen(false) }} />
            <Toolbar variant="dense" disableGutters sx={{ marginTop: '-0.375em' }}>
                <AddLinkButton openDialog={() => { setLinkDialogOpen(true) }} />
                <RemoveLinkButton />
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
