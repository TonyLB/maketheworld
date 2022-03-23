import React, { FunctionComponent, useMemo, useState, useCallback } from 'react'
import { useSelector } from 'react-redux'
import {
    useParams
} from "react-router-dom"

import { useSlateStatic } from 'slate-react'
import {
    Descendant,
    createEditor,
    Editor,
    Element as SlateElement,
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

import { CustomDescriptionElement, CustomActionLinkElement, CustomFeatureLinkElement, CustomText } from './baseClasses'

import { RoomRenderItem, NormalForm, NormalFeature } from '../../../wml/normalize'
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

interface LinkDialogProps {
    open: boolean;
    onClose: () => void;
}

const LinkDialog: FunctionComponent<LinkDialogProps> = ({ open, onClose }) => {
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
                    <ListItemButton key={key}>
                        <ListItemText>
                            {key}
                        </ListItemText>
                    </ListItemButton>
                ))}
                <ListSubheader>
                    Features
                </ListSubheader>
                { features.map(({ key, name }) => (
                    <ListItemButton key={key}>
                        <ListItemText>
                            {name}
                        </ListItemText>
                    </ListItemButton>
                ))}
            </List>
        </DialogContent>
    </Dialog>
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
    const [linkDialogOpen, setLinkDialogOpen] = useState<boolean>(false)
    const renderElement = useCallback((props: RenderElementProps) => <Element {...props} />, [])
    const renderLeaf = useCallback(props => <Leaf {...props} />, [])
    return <React.Fragment>
        <LinkDialog open={linkDialogOpen} onClose={() => { setLinkDialogOpen(false) }} />
        <Slate editor={editor} value={value} onChange={value => { setValue(value) }}>
            <Toolbar variant="dense" disableGutters sx={{ marginTop: '-0.375em' }}>
                <Button variant="outlined" onClick={() => { setLinkDialogOpen(true) }}><LinkIcon /></Button>
            </Toolbar>
            <Box sx={{ padding: '0.5em' }}>
                <Editable
                    renderElement={renderElement}
                    renderLeaf={renderLeaf}
                />
            </Box>
        </Slate>

    </React.Fragment>
}

export default DescriptionEditor
