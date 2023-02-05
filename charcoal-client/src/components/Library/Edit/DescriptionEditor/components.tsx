import React, { FunctionComponent, ReactNode, ForwardedRef, useCallback } from 'react'
import { pink, green, blue } from '@mui/material/colors'
import { LabelledIndentBox } from '../LabelledIndentBox'
import InlineChromiumBugfix from './InlineChromiumBugfix'
import { RenderElementProps, RenderLeafProps } from 'slate-react'
import { ComponentRenderItem } from '@tonylb/mtw-wml/dist/normalize/baseClasses'
import { DescriptionLinkActionChip, DescriptionLinkFeatureChip } from '../../../Message/DescriptionLink'

import Box from '@mui/material/Box'
import Chip from '@mui/material/Chip'
import BeforeIcon from '@mui/icons-material/Reply'
import ReplaceIcon from '@mui/icons-material/Backspace'
import KeyboardReturnIcon from '@mui/icons-material/KeyboardReturn'
import MoreIcon from '@mui/icons-material/More'
import {
    Editor,
    Node,
    NodeEntry,
    Element as SlateElement,
    Range,
    Path,
    Transforms
} from 'slate'
import { CustomBlock, isCustomParagraph, isCustomParagraphContents, isCustomText } from '../baseClasses'


type SlateIndentBoxProps = {
    color: Record<number | string, string>;
    children: any;
    label: ReactNode;
    actions?: ReactNode;
}

const SlateIndentBox = React.forwardRef(<T extends SlateIndentBoxProps>({ color, children, label, actions, ...attributes }: T, ref: ForwardedRef<any>) => {
    return <LabelledIndentBox
        color={color}
        label={label}
        actions={actions}
        slate
        { ...attributes }
        ref={ref}
    >
        <InlineChromiumBugfix />
        {children}
        <InlineChromiumBugfix />
    </LabelledIndentBox>
})

const AddConditionalButton: FunctionComponent<{ editor: Editor; path: Path; defaultItem: CustomBlock; label: string }> = ({ editor, path, defaultItem, label }) => {
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
    />
}

const AddElseIfButton: FunctionComponent<{ editor: Editor; path: Path }> = ({ editor, path }) => (
    <AddConditionalButton
        editor={editor}
        path={path}
        defaultItem={{ type: 'elseif', source: '', children: [{ type: 'paragraph', children: [{ text: '' }]}]}}
        label='Else If'
    />
)
const AddElseButton: FunctionComponent<{ editor: Editor; path: Path }> = ({ editor, path }) => (
    <AddConditionalButton
        editor={editor}
        path={path}
        defaultItem={{ type: 'else', children: [{ type: 'paragraph', children: [{ text: '' }]}]}}
        label='Else'
    />
)

export const Element: FunctionComponent<RenderElementProps & { inheritedRender?: ComponentRenderItem[]; editor: Editor }> = ({ inheritedRender, editor, ...props }) => {
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
            return <SlateIndentBox
                    { ...attributes }
                    color={highlight}
                    label={element.type === 'before'
                        ? <React.Fragment><BeforeIcon sx={{ verticalAlign: "middle", paddingBottom: '0.2em' }} />Before</React.Fragment>
                        : <React.Fragment><ReplaceIcon sx={{ verticalAlign: "middle", paddingBottom: '0.2em' }} />Replace</React.Fragment>
                    }
                >
                    { children }
            </SlateIndentBox>
        case 'ifBase':
        case 'elseif':
            return <SlateIndentBox
                    { ...attributes }
                    color={blue}
                    label={<React.Fragment>{element.type === 'ifBase' ? 'If' : 'Else If'} [{element.source}]</React.Fragment>}
                    actions={<React.Fragment>
                        <AddElseIfButton editor={editor} path={element.path ?? []} />
                        { element.isElseValid && <AddElseButton editor={editor} path={element.path ?? []} />}
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
        //
        // TODO: Build InheritedDescription into render base rather than into a Slate Element
        //
        // case 'description':
        //     const interspersedChildren = children.reduce((previous: any, item: any, index: number) => ([
        //         ...previous,
        //         ...((index > 0) ? [<br key={`line-break-${index}`} />] : []),
        //         item
        //     ]), [] as any[])
        //     return <span {...attributes}><span contentEditable={false}><InheritedDescription inheritedRender={inheritedRender} /></span>{interspersedChildren}</span>
        case 'paragraph':
            const paragraphTags = <React.Fragment>
                    { (element.explicitBR || element.softBR) && <span contentEditable={false}>
                        {
                            element.explicitBR && <KeyboardReturnIcon
                                color="primary"
                                fontSize="small"
                                sx={{ verticalAlign: 'middle' }}
                            />
                        }
                        {
                            (element.softBR && !element.explicitBR) && <MoreIcon
                                color="primary"
                                fontSize="small"
                                sx={{ verticalAlign: 'middle', transform: "rotate(-0.25turn)" }}
                            />
                        }
                    </span> }
            </React.Fragment>
            if (element.softBR || element.explicitBR) {
                return <Box
                    component='span'
                    {...attributes}
                >
                    {children}
                    {paragraphTags}
                    <br />
                </Box>
            }
            else {
                return <Box
                    {...attributes}
                    sx={{
                        display: 'inline-block',
                        verticalAlign: 'top',
                        marginRight: '0.1em'
                    }}
                >
                    {children}
                    {paragraphTags}
                </Box>
            }
        default: return (
            <p {...attributes}>
                {children}
            </p>
        )
    }
}

export const withParagraphBR = (editor: Editor) => {
    const { normalizeNode } = editor
    editor.normalizeNode = ([node, path]) => {
        //
        // Check all paragraphs to set their explicitBR and softBR marks according to their next element and contents
        //
        if ((SlateElement.isElement(node) && Editor.isBlock(editor, node) && !isCustomParagraph(node)) || Editor.isEditor(node)) {
            let errorNormalized: boolean = false
            const allChildren = [...Node.children(node, [])]
            allChildren.forEach(([child, childPath]) => {
                if (!errorNormalized && SlateElement.isElement(child) && isCustomParagraph(child)) {
                    let explicitBR: boolean | undefined
                    let softBR: boolean | undefined
                    const aggregatePath = [...path, ...childPath]
                    const next = Editor.next(editor, { at: aggregatePath})
                    if (next) {
                        const [nextNode] = next
                        if (SlateElement.isElement(nextNode) && isCustomParagraph(nextNode)) {
                            explicitBR = true
                        }
                        if (Node.string(child)) {
                            softBR = true
                        }
                    }
    
                    if ((Boolean(explicitBR) !== Boolean(child.explicitBR)) || (Boolean(softBR) !== Boolean(child.softBR))) {
                        Transforms.setNodes(editor, { explicitBR, softBR }, { at: aggregatePath })
                        errorNormalized = true
                    }
                }
            })
            if (errorNormalized) {
                return
            }
        }
        return normalizeNode([node, path])
    }
    return editor
}

export const Leaf: FunctionComponent<RenderLeafProps> = ({ attributes, children, leaf }) => {
    //
    // Hide Slate's default br after an empty paragraph block, so it can be used as a placeholder
    // in a horizontal layout with other blocks
    //
    return <Box 
        component="span"
        {...attributes}
        sx={{
            [`& span[data-slate-length=0]`]: {
                marginRight: '0.25em',
                '& br': {
                    display: 'none'
                }
            },
            ...(leaf.highlight ? {
                backgroundColor: blue[300],
                paddingLeft: '0.25em',
                paddingRight: '0.25em'
            } : {})
        }}
    >
        {children}
    </Box>
}

export const decorateFactory = (editor: Editor) =>
    ([node, path]: NodeEntry): (Range & { highlight?: boolean })[] => {
        if (SlateElement.isElement(node) && isCustomParagraph(node)) {
            let decorators: (Range & { highlight?: boolean })[] = []
            //
            // TODO: Highlight marker for spaces at beginning and end of paragraph
            //
            const children = [...Node.children(node, [])]
            if (children.length) {
                const [firstChild, firstChildPath] = children[0]
                if (isCustomParagraphContents(firstChild) && isCustomText(firstChild) && firstChild.text.match(/^\s/)) {
                    decorators.push({
                        anchor: { path: firstChildPath, offset: 0 },
                        focus: { path: firstChildPath, offset: 1 },
                        highlight: true
                    })
                }
                const [lastChild, lastChildPath] = children.slice(-1)[0]
                if (isCustomParagraphContents(lastChild) && isCustomText(lastChild) && lastChild.text.match(/\s$/)) {
                    decorators.push({
                        anchor: { path: lastChildPath, offset: lastChild.text.length - 1 },
                        focus: { path: lastChildPath, offset:  lastChild.text.length },
                        highlight: true
                    })
                }
            }
            return decorators
        }
        return []
    }
