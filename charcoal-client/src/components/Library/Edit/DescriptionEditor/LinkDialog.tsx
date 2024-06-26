import {
    Box,
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
import React, { FunctionComponent, useMemo } from 'react';
import { ReactEditor, useSlate } from 'slate-react';
import { CustomActionLinkElement, CustomFeatureLinkElement, CustomKnowledgeLinkElement } from '../baseClasses';
import {
    Range,
    Editor,
    Transforms,
    Element as SlateElement
} from 'slate';
import { useLibraryAsset } from '../LibraryAsset';
import { isStandardAction, isStandardFeature, isStandardKnowledge } from '@tonylb/mtw-wml/dist/standardize/baseClasses';

interface LinkDialogProps {
    open: boolean;
    onClose: () => void;
    validTags?: ('Feature' | 'Action' | 'Knowledge')[]
}

const isInContextOf = (tags: string[]) => (editor: Editor) => {
    const link = Editor.nodes(editor, {
        match: n =>
            !Editor.isEditor(n) && SlateElement.isElement(n) && tags.includes(n.type),
    }).next()
    return !!(link?.value)
}

const isLinkActive = isInContextOf(['actionLink', 'featureLink', 'knowledgeLink'])

const selectActiveLink = (editor: Editor) => {
    const link = Editor.nodes(editor, {
        match: n =>
            !Editor.isEditor(n) && SlateElement.isElement(n) && ['actionLink', 'featureLink', 'knowledgeLink'].includes(n.type),
    }).next()
    if (link?.value) {
        const location = link.value[1]
        Transforms.select(editor, location)
    }
}

const unwrapLink = (editor: Editor) => {
    Transforms.unwrapNodes(editor, {
        match: n =>
            !Editor.isEditor(n) && SlateElement.isElement(n) && ['actionLink', 'featureLink', 'knowledgeLink'].includes(n.type),
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

const wrapKnowledgeLink = (editor: Editor, to: string) => {
    if (isLinkActive(editor)) {
        selectActiveLink(editor)
        unwrapLink(editor)
    }
  
    const { selection } = editor
    const isCollapsed = selection && Range.isCollapsed(selection)
    const link: CustomKnowledgeLinkElement = {
        type: 'knowledgeLink',
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

type LinkChoicesSubsectionProps = {
    subheader: string;
    keys: string[];
    onClose: () => void;
    wrapLink: (editor: Editor, key: string) => void;
}

const LinkChoicesSubsection: FunctionComponent<LinkChoicesSubsectionProps> = ({ subheader, keys, onClose, wrapLink }) => {
    const editor = useSlate()
    return keys.length
        ? <React.Fragment>
            <ListSubheader>
                { subheader }
            </ListSubheader>
            { keys.map((key) => (
                <ListItemButton
                    key={key}
                    onClick={() => {
                        wrapLink(editor, key)
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
        </React.Fragment>
        : null
}

const LinkDialog: FunctionComponent<LinkDialogProps> = ({ open, onClose, validTags = ['Feature', 'Action', 'Knowledge'] }) => {
    const { standardForm } = useLibraryAsset()
    const { actions, features, knowledges } = useMemo<{ actions: string[], features: string[], knowledges: string[] }>(() => (
        Object.values(standardForm.byId).reduce((previous, component) => {
            if (validTags.includes('Action') && isStandardAction(component)) {
                return { ...previous, actions: [previous.actions, component.key]}
            }
            if (validTags.includes('Feature') && isStandardFeature(component)) {
                return { ...previous, features: [previous.features, component.key]}
            }
            if (validTags.includes('Knowledge') && isStandardKnowledge(component)) {
                return { ...previous, knowledges: [previous.knowledges, component.key]}
            }
            return previous
        }, { actions: [], features: [], knowledges: [] })
    ), [standardForm])
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
                <LinkChoicesSubsection
                    subheader="Actions"
                    keys={actions}
                    onClose={onClose}
                    wrapLink={wrapActionLink}
                />
                <LinkChoicesSubsection
                    subheader="Features"
                    keys={features}
                    onClose={onClose}
                    wrapLink={wrapFeatureLink}
                />
                <LinkChoicesSubsection
                    subheader="Knowledge"
                    keys={knowledges}
                    onClose={onClose}
                    wrapLink={wrapKnowledgeLink}
                />
            </List>
        </DialogContent>
    </Dialog>
}

export default LinkDialog
