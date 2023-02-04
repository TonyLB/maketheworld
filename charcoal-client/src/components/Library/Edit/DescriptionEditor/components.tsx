import React, { FunctionComponent, ReactNode, ForwardedRef } from 'react'
import { pink, green, blue } from '@mui/material/colors'
import { LabelledIndentBox } from '../LabelledIndentBox'
import InlineChromiumBugfix from './InlineChromiumBugfix'
import { RenderElementProps, RenderLeafProps } from 'slate-react'
import { ComponentRenderItem } from '@tonylb/mtw-wml/dist/normalize/baseClasses'
import { DescriptionLinkActionChip, DescriptionLinkFeatureChip } from '../../../Message/DescriptionLink'

import Button from '@mui/material/Button'
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
    Range
} from 'slate'
import { isCustomParagraph } from '../baseClasses'


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

const AddElseIfButton: FunctionComponent<{}> = ({}) => (
    <Chip
        variant="filled"
        size="small"
        sx={{
            backgroundColor: blue[50],
            borderStyle: "solid",
            borderWidth: "1px",
            borderColor: blue[300],
            '&:hover': {
                backgroundColor: blue[100]
            },
            '&:click': {
                backgroundColor: blue[200]
            }
        }}
        label="+ Else If"
        onClick={() => {}}
    />
)

const AddElseButton: FunctionComponent<{}> = ({}) => (
    <Chip
        variant="filled"
        size="small"
        sx={{
            backgroundColor: blue[50],
            borderStyle: "solid",
            borderWidth: "1px",
            borderColor: blue[300],
            '&:hover': {
                backgroundColor: blue[100]
            },
            '&:click': {
                backgroundColor: blue[200]
            }
        }}
        label="+ Else"
        onClick={() => {}}
    />
)

export const Element: FunctionComponent<RenderElementProps & { inheritedRender?: ComponentRenderItem[] }> = ({ inheritedRender, ...props }) => {
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
                        <AddElseIfButton />
                        { element.isElseValid && <AddElseButton />}
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
            //
            // TODO: Add a decorator that tags paragraph items with "softBR" if they have any text and "explicitBR" if they are followed by
            // another paragraph ... and then adds a carriage-return icon in the case of "explicitBR" and a <br /> in the case of softBR
            //
            return <span {...attributes} >{ children }</span>
        default: return (
            <p {...attributes}>
                {children}
            </p>
        )
    }
}

export const Leaf: FunctionComponent<RenderLeafProps> = ({ attributes, children, leaf }) => {
    return <span {...attributes}>
        {children}
        { (leaf.explicitBR || leaf.softBR) && <span contentEditable={false}>
            {
                leaf.explicitBR && <KeyboardReturnIcon
                    color="primary"
                    fontSize="small"
                    sx={{ verticalAlign: 'middle' }}
                />
            }
            {
                (leaf.softBR && !leaf.explicitBR) && <MoreIcon
                    color="primary"
                    fontSize="small"
                    sx={{ verticalAlign: 'middle', transform: "rotate(-0.25turn)" }}
                />
            }
            <br />
        </span> }
    </span>
}

export const decorateFactory = (editor: Editor) =>
    ([node, path]: NodeEntry): (Range & { explicitBR?: boolean; softBR?: boolean })[] => {
        if (SlateElement.isElement(node) && isCustomParagraph(node)) {
            let explicitBR: boolean | undefined
            let softBR: boolean | undefined
            const next = Editor.next(editor, { at: path })
            if (next) {
                const [ nextNode, nextPath ] = next
                if (SlateElement.isElement(nextNode) && isCustomParagraph(nextNode)) {
                    explicitBR = true
                }
                if (Node.string(node)) {
                    softBR = true
                }
            }
            if (explicitBR || softBR) {
                const last = Editor.last(editor, path)
                if (last) {
                    //
                    // Apply marks to the last text leaf (which will render them appropriately)
                    //
                    const [_, lastPath] = last
                    const endPoint = Editor.end(editor, lastPath)
                    return [{
                        explicitBR,
                        softBR,
                        anchor: endPoint,
                        focus: endPoint
                    }]    
                }
            }
        }
        return []
    }
