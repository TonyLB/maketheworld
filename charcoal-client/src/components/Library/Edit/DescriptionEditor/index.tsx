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

import { extractDependenciesFromJS } from '@tonylb/mtw-wml/dist/convert/utils'

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
    CustomText,
    CustomParagraphContents,
    CustomParagraphElement,
    isCustomLineBreak,
    isCustomLink,
    isCustomText,
    isCustomFeatureLink,
    isCustomBeforeBlock,
    CustomBeforeBlock,
    CustomReplaceBlock,
    isCustomReplaceBlock,
    isCustomIfBlock,
    isCustomElseBlock,
    isCustomElseIfBlock,
    CustomIfBlock,
    CustomElseIfBlock,
    CustomElseBlock
} from '../baseClasses'

import { ComponentRenderItem, NormalForm, NormalFeature, NormalConditionStatement, NormalCondition } from '@tonylb/mtw-wml/dist/normalize/baseClasses'
import { DescriptionLinkActionChip, DescriptionLinkFeatureChip } from '../../../Message/DescriptionLink'
import { getNormalized } from '../../../../slices/personalAssets'
import useDebounce from '../../../../hooks/useDebounce'
import { deepEqual } from '../../../../lib/objects'
import { LabelledIndentBox } from '../LabelledIndentBox'

interface DescriptionEditorProps {
    inheritedRender?: ComponentRenderItem[];
    render: ComponentRenderItem[];
    onChange?: (items: ComponentRenderItem[]) => void;
}

const descendantsTranslate = function * (normalForm: NormalForm, renderItems: ComponentRenderItem[]): Generator<CustomParagraphContents> {
    let currentIfElement: CustomIfBlock | undefined
    const conditionElseContext: (current: CustomIfBlock | undefined) => { elseContext: string[], elseDefined: boolean } = (current) => {
        if (!current) {
            return {
                elseContext: [],
                elseDefined: false
            }
        }
        else {
            return {
                elseContext: [
                    current.source,
                    ...current.children.filter(isCustomElseIfBlock).map(({ source }) => (source))
                ],
                elseDefined: Boolean(current.children.find(isCustomElseBlock))
            }
        }
    }
    if (renderItems.length === 0) {
        yield {
            text: ''
        }
    }
    for (const item of renderItems) {
        if (item.tag !== 'Condition' && currentIfElement) {
            yield currentIfElement
            currentIfElement = undefined
        }
        switch(item.tag) {
            case 'Space':
                yield {
                    text: ' '
                } as CustomText
                break
            case 'Link':
                const targetTag = normalForm[item.to]?.tag || 'Action'
                yield {
                    type: targetTag === 'Feature' ? 'featureLink' : 'actionLink',
                    to: item.to,
                    children: [{
                        text: item.text || ''
                    }]
                } as CustomActionLinkElement | CustomFeatureLinkElement
                break
            case 'String':
                yield { text: item.value } as CustomText
                break
            case 'LineBreak':
                yield { type: 'lineBreak' }
                break
            case 'After':
                yield *descendantsTranslate(normalForm, item.contents)
                break
            case 'Before':
            case 'Replace':
                yield {
                    type: item.tag === 'Before' ? 'before' : 'replace',
                    children: [...descendantsTranslate(normalForm, item.contents)]
                }
                break
            case 'Condition':
                const predicateToSrc = (predicate: NormalConditionStatement): string => {
                    return `${ predicate.not ? '!' : ''}${predicate.if}`
                }
                const conditionsToSrc = (predicates: NormalConditionStatement[]): string => {
                    return predicates.length <= 1 ? `${predicateToSrc(predicates[0] || { dependencies: [], if: 'false' })}` : `(${predicates.map(predicateToSrc).join(') && (')})`
                }
                const { elseContext, elseDefined } = conditionElseContext(currentIfElement)
                //
                // TODO: Make a more complicated predicate matching, to handle as yet undefined more complicate uses of the conditional list structure
                //
                const matchesElseConditions = elseContext.length &&
                    (deepEqual(elseContext, item.conditions.slice(0, elseContext.length).map((predicate) => (predicate.if))))
                if (matchesElseConditions) {
                    const remainingConditions = item.conditions.slice(elseContext.length)
                    if (remainingConditions.length && currentIfElement && !elseDefined) {
                        currentIfElement = {
                            ...currentIfElement,
                            children: [
                                ...currentIfElement.children,
                                {
                                    type: 'elseif',
                                    source: conditionsToSrc(remainingConditions),
                                    children: [...descendantsTranslate(normalForm, item.contents)]
                                }
                            ]
                        }
                    }
                    else if (currentIfElement && !elseDefined) {
                        currentIfElement = {
                            ...currentIfElement,
                            children: [
                                ...currentIfElement.children,
                                {
                                    type: 'else',
                                    children: [...descendantsTranslate(normalForm, item.contents)]
                                }
                            ]
                        }
                    }
                    else {
                        if (currentIfElement) {
                            yield currentIfElement
                        }
                        currentIfElement = {
                            type: 'if',
                            source: conditionsToSrc(item.conditions),
                            children: [...descendantsTranslate(normalForm, item.contents)]
                        }
                    }
                }
                else {
                    if (currentIfElement) {
                        yield currentIfElement
                    }
                    currentIfElement = {
                        type: 'if',
                        source: conditionsToSrc(item.conditions),
                        children: [...descendantsTranslate(normalForm, item.contents)]
                    }
                }
                break
        }
    }
    if (currentIfElement) {
        yield currentIfElement
    }
}

const descendantsFromRender = (normalForm: NormalForm) => (render: ComponentRenderItem[]): CustomParagraphElement[] => {
    if (render.length > 0) {
        let returnValue = [] as CustomParagraphElement[]
        let accumulator = [] as CustomParagraphContents[]
        for (const item of descendantsTranslate(normalForm, render)) {
            if (isCustomLineBreak(item)) {
                returnValue = [...returnValue, { type: 'paragraph', children: accumulator.length > 0 ? accumulator : [{ text: '' }] }]
                accumulator = [{ text: ''} as CustomText]
            }
            else {
                accumulator.push(item)
            }
        }
        return [
            ...returnValue,
            ...(accumulator.length > 0
                //
                // TODO: Make or find a join procedure that joins children where possible (i.e. combines adjacent text children)
                //
                ? [{
                    type: "paragraph" as "paragraph",
                    children: accumulator
                }]
                : [] as CustomParagraphElement[])
        ]
    }
    return [{
        type: 'paragraph',
        children: [{
            text: ''
        } as CustomText]
    }]
}

const withInlines = (editor: Editor) => {
    const { isInline, isVoid } = editor

    //
    // TODO: Add in new Inline types for Before / Replace blocks.
    //
    // TODO: Add in new Inline types for If, Else If and Else blocks.
    //
    editor.isInline = (element: SlateElement) => (
        ['actionLink', 'featureLink', 'before', 'after', 'if', 'elseif', 'else'].includes(element.type) || isInline(element)
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
        case 'elseif':
            return <span {...attributes}>
                <SlateIndentBox
                    color={blue}
                    label={<React.Fragment>{element.type === 'if' ? 'If' : 'Else If'} [{element.source}]</React.Fragment>}
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

const isLinkActive = (editor: Editor) => {
    const link = Editor.nodes(editor, {
        match: n =>
            !Editor.isEditor(n) && SlateElement.isElement(n) && ['actionLink', 'featureLink'].includes(n.type),
    }).next()
    return !!(link?.value)
}

const isBeforeBlock = (editor: Editor) => {
    const block = Editor.nodes(editor, {
        match: n =>
            !Editor.isEditor(n) && SlateElement.isElement(n) && n.type === 'before',
    }).next()
    return !!(block?.value)
}

const isReplaceBlock = (editor: Editor) => {
    const block = Editor.nodes(editor, {
        match: n =>
            !Editor.isEditor(n) && SlateElement.isElement(n) && n.type === 'replace',
    }).next()
    return !!(block?.value)
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

const descendantsToRender = (items: (CustomParagraphElement | CustomBeforeBlock | CustomReplaceBlock | CustomElseIfBlock | CustomElseBlock)[]): ComponentRenderItem[] => (
    items.reduce<ComponentRenderItem[]>((accumulator, { children = [] }, index) => {
        return children
            .filter((item) => (!(isCustomText(item) && !item.text)))
            .reduce((previous, item) => {
                if (isCustomIfBlock(item)) {
                    const ifCondition = {
                        if: item.source,
                        dependencies: extractDependenciesFromJS(item.source)
                    }
                    const { elseIfs, ifContents, elseContents, runningConditions } = item.children.reduce<{ runningConditions: NormalConditionStatement[]; ifContents: ComponentRenderItem[]; elseIfs: ComponentRenderItem[]; elseContents: ComponentRenderItem[] }>((previous, child) => {
                        if (isCustomElseIfBlock(child)) {
                            const newCondition = {
                                if: child.source,
                                dependencies: extractDependenciesFromJS(child.source)
                            }
                            return {
                                ...previous,
                                elseIfs: [
                                    ...previous.elseIfs,
                                    {
                                        tag: 'Condition',
                                        conditions: [...previous.runningConditions, newCondition],
                                        contents: descendantsToRender([child])
                                    }
                                ],
                                runningConditions: [
                                    ...previous.runningConditions,
                                    { ...newCondition, not: true }
                                ]
                            }
                        }
                        else if (isCustomElseBlock(child)) {
                            return {
                                ...previous,
                                elseContents: descendantsToRender([child])
                            }
                        }
                        else {
                            return {
                                ...previous,
                                ifContents: [
                                    ...previous.ifContents,
                                    ...(descendantsToRender([{ type: 'paragraph', children: [child] }]))
                                ]
                            }
                        }
                    }, { ifContents: [], elseIfs: [], elseContents: [], runningConditions: [{ ...ifCondition, not: true }] })
                    const elseItem: ComponentRenderItem | undefined = elseContents.length ? {
                        tag: 'Condition',
                        conditions: runningConditions,
                        contents: elseContents
                    } : undefined
                    return [
                        ...previous,
                        {
                            tag: 'Condition',
                            conditions: [ifCondition],
                            contents: ifContents
                        },
                        ...elseIfs,
                        ...(elseItem ? [elseItem] : [])
                    ]
                }
                if (isCustomLink(item)) {
                    return [
                        ...previous,
                        {
                            tag: 'Link',
                            targetTag: isCustomFeatureLink(item) ? 'Feature' : 'Action',
                            to: item.to,
                            text: item.children
                                .filter((child) => ('text' in child))
                                .map(({ text }) => (text))
                                .join('')
                        }
                    ]
                }
                if (isCustomBeforeBlock(item) || isCustomReplaceBlock(item)) {
                    return [
                        ...previous,
                        {
                            tag: item.type === 'before' ? 'Before' : 'Replace',
                            contents: descendantsToRender([item])
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
            }, (index > 0) ? [...accumulator, { tag: 'LineBreak' }] : accumulator) as ComponentRenderItem[]
    }, [] as ComponentRenderItem[])
)

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
    const editor = useMemo(() => withInlines(withHistory(withReact(createEditor()))), [])
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
