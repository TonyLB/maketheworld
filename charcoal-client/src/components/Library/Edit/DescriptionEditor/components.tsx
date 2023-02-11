import React, { FunctionComponent, ReactNode, ForwardedRef, useMemo } from 'react'
import { pink, green, blue } from '@mui/material/colors'
import { SlateIndentBox } from '../LabelledIndentBox'
import InlineChromiumBugfix from './InlineChromiumBugfix'
import { RenderElementProps, RenderLeafProps } from 'slate-react'
import { ComponentRenderItem } from '@tonylb/mtw-wml/dist/normalize/baseClasses'
import { DescriptionLinkActionChip, DescriptionLinkFeatureChip } from '../../../Message/DescriptionLink'

import Box from '@mui/material/Box'
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
    Transforms
} from 'slate'
import { isCustomParagraph, isCustomParagraphContents, isCustomText } from '../baseClasses'
import SlateIfElse from '../SlateIfElse'

export const Element: FunctionComponent<RenderElementProps & { inheritedRender?: ComponentRenderItem[]; }> = ({ inheritedRender, ...props }) => {
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
        case 'else':
            return <SlateIfElse defaultBlock={{ type: 'paragraph', children: [{ text: '' }]}} { ...props } />
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
    return <React.Fragment>
        { leaf.highlight && 
            <Box 
                component="div"
                contentEditable={false}
                sx={{
                    position: "relative",
                    display: 'inline-block',
                    backgroundColor: blue[300],
                    marginLeft: '0.1em',
                    marginRight: '-0.15em',
                    minWidth: '0.75em',
                    '&::after': {
                        content: '""',
                        width: "100%",
                        height: "0.25em",
                        position: "absolute",
                        bottom: 0,
                        left:0,
                        borderColor: blue[500],
                        borderStyle: 'solid',
                        borderTopStyle: 'none',
                    }
                }}
            >
                &nbsp;
            </Box>
        }
        <Box 
            component="span"
            {...attributes}
            sx={{
                [`& span[data-slate-length=0]`]: {
                    marginRight: '0.25em',
                    '& br': {
                        display: 'none'
                    }
                }
            }}
        >
            {children}
        </Box>
    </React.Fragment>
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
                        anchor: { path: [...path, ...firstChildPath], offset: 0 },
                        focus: { path: [...path, ...firstChildPath], offset: 1 },
                        highlight: true
                    })
                }
                const [lastChild, lastChildPath] = children.slice(-1)[0]
                if (isCustomParagraphContents(lastChild) && isCustomText(lastChild) && lastChild.text.match(/\s$/)) {
                    decorators.push({
                        anchor: { path: [...path, ...lastChildPath], offset: lastChild.text.length - 1 },
                        focus: { path: [...path, ...lastChildPath], offset:  lastChild.text.length },
                        highlight: true
                    })
                }
            }
            return decorators
        }
        return []
    }
