import React, { FunctionComponent, useCallback, useMemo } from 'react'
import { pink, green, blue } from '@mui/material/colors'
import { SlateIndentBox } from '../LabelledIndentBox'
import InlineChromiumBugfix from './InlineChromiumBugfix'
import { RenderElementProps, RenderLeafProps, useSlate } from 'slate-react'
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
import { isCustomBlock, isCustomIfWrapper, isCustomParagraph, isCustomParagraphContents, isCustomText } from '../baseClasses'
import IfElseTree from '../IfElseTree'
import { selectById } from '@tonylb/mtw-wml/dist/schema/selectors/byId'
import { EditSchema, useEditContext } from '../EditContext'
import { useLibraryAsset } from '../LibraryAsset'
import { GenericTree, treeNodeTypeguard } from '@tonylb/mtw-wml/dist/tree/baseClasses'
import { isSchemaCondition, SchemaTag } from '@tonylb/mtw-wml/dist/schema/baseClasses'

export const elementFactory = (render: FunctionComponent<{}>): FunctionComponent<RenderElementProps> => (props) => {
    const editor = useSlate()
    const { componentKey } = useEditContext()
    const { schema } = useLibraryAsset()
    const { attributes, children, element } = props
    const newIfWrapperStub = useCallback(() => {
    }, [])
    const ifWrapperOnChange = useCallback((position: number) => (value: GenericTree<SchemaTag>) => {
        //
        // TODO: Create onChange function that uses the element's placement in the Slate Editor Descendants list
        // to create a Transform to update the `subTree` property with the new values of the ifWrapper editable void
        //
        const subTree = Editor.fragment(editor, [position])[0]
        if (!(isCustomBlock(subTree) && isCustomIfWrapper(subTree))) {
            throw new Error('If Wrapper position error')
        }
        if (value.length === 0) {
            Transforms.removeNodes(editor, { at: [position] })
        }
        const wrapper = value[0]
        if (treeNodeTypeguard(isSchemaCondition)(wrapper)) {
            Transforms.setNodes(editor, { subTree: wrapper }, { at: [position] })
        }
    }, [editor])
    const nodeById = useMemo(() => {
        if (element.type === 'ifWrapper') {
            return selectById(element.treeId)(schema)
        }
        return undefined
    }, [element, schema])
    switch(element.type) {
        case 'featureLink':
            return <span {...attributes}>
                <DescriptionLinkFeatureChip tooltipTitle={`Feature: ${element.to}`}>
                    <InlineChromiumBugfix />
                    {children}
                    <InlineChromiumBugfix />
                </DescriptionLinkFeatureChip>
            </span>
        case 'knowledgeLink':
            return <span {...attributes}>
                <DescriptionLinkFeatureChip tooltipTitle={`Knowledge: ${element.to}`}>
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
        case 'replace':
            return <SlateIndentBox
                    { ...attributes }
                    color={pink}
                    label={<React.Fragment><ReplaceIcon sx={{ verticalAlign: "middle", paddingBottom: '0.2em' }} />Replace</React.Fragment>}
                >
                    { children }
            </SlateIndentBox>
        case 'newIfWrapper':
            return <div {...attributes} contentEditable={false}>
                <EditSchema
                    componentKey={componentKey}
                    tag="If"
                    field={{ data: { tag: 'If' }, children: [{ data: { tag: 'Statement', if: '' }, children: [], id: '' }], id: '' }}
                    value={[]}
                    onChange={newIfWrapperStub}
                    onDelete={() => {}}
                >
                    <IfElseTree render={render} />
                </EditSchema>
            </div>
        case 'ifWrapper':
            return <div {...attributes} contentEditable={false}>
                <EditSchema
                    componentKey={componentKey}
                    tag="If"
                    field={nodeById}
                    value={element.subTree.children}
                    onChange={ifWrapperOnChange(element.position)}
                    onDelete={() => {}}
                >
                    <IfElseTree render={render} />
                </EditSchema>
            </div>
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
            <div {...attributes}>
                {children}
            </div>
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
