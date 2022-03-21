import { FunctionComponent, useMemo, useState, useCallback } from 'react'
import { useSelector } from 'react-redux'
import {
    useParams
} from "react-router-dom"

import { useSlateStatic } from 'slate-react'
import { Descendant, createEditor, Editor, Node, Range, Text, Point, Element as SlateElement } from 'slate'
import { withHistory } from 'slate-history'
import { Slate, Editable, withReact, ReactEditor, RenderElementProps, RenderLeafProps } from 'slate-react'
import { CustomDescriptionElement, CustomActionLinkElement, CustomFeatureLinkElement, CustomText } from './baseClasses'

import { RoomRenderItem, NormalForm } from '../../../wml/normalize'
import { DescriptionLinkActionChip, DescriptionLinkFeatureChip } from '../../Message/DescriptionLink'
import { getNormalized } from '../../../slices/personalAssets'

interface DescriptionEditorProps {
    inheritedRender?: RoomRenderItem[];
    render: RoomRenderItem[];
}

const descendantsFromRender = (normalForm: NormalForm) => (render: RoomRenderItem[]): (CustomActionLinkElement | CustomFeatureLinkElement | CustomText)[] => {
    if (render.length > 0) {
        return render.map((item) => {
            if (typeof item === 'object') {
                if (item.tag === 'Link') {
                    const targetTag = normalForm[item.to]?.tag || 'Action'
                    return {
                        type: targetTag === 'Feature' ? 'featureLink' : 'actionLink',
                        to: item.to,
                        key: item.key,
                        children: [{
                            text: item.text || ''
                        }]
                    }
                }
            }
            return { text: item as string }
        })
    }
    return []
}

const withInlines = (editor: Editor) => {
    const { isInline } = editor

    editor.isInline = (element: SlateElement) => (
        ['actionLink', 'featureLink'].includes(element.type) || isInline(element)
    )

    return editor
}

const Element: FunctionComponent<RenderElementProps> = ({ attributes, children, element }) => {
    switch(element.type) {
        case 'featureLink':
            return <DescriptionLinkFeatureChip>{children}</DescriptionLinkFeatureChip>
        case 'actionLink':
            return <DescriptionLinkActionChip>{children}</DescriptionLinkActionChip>
        case 'description':
            return <span {...attributes}>{children}</span>
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

export const DescriptionEditor: FunctionComponent<DescriptionEditorProps> = ({ inheritedRender = [], render }) => {
    const editor = useMemo(() => withInlines(withHistory(withReact(createEditor()))), [])
    const { AssetId: assetKey } = useParams<{ AssetId: string }>()
    const AssetId = `ASSET#${assetKey}`
    const normalForm = useSelector(getNormalized(AssetId))
    const [value, setValue] = useState<Descendant[]>([{
        type: 'description',
        children: [
            ...descendantsFromRender(normalForm)(inheritedRender),
            ...descendantsFromRender(normalForm)(render)
        ]
    }])
    const renderElement = useCallback((props: RenderElementProps) => <Element {...props} />, [])
    const renderLeaf = useCallback(props => <Leaf {...props} />, [])
    return <Slate editor={editor} value={value} onChange={value => { setValue(value) }}>
        <Editable
            renderElement={renderElement}
            renderLeaf={renderLeaf}
        />
    </Slate>
}

export default DescriptionEditor
