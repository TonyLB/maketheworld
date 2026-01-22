import React, { FunctionComponent, useMemo, useState, useCallback, useRef } from 'react'

import { useSlate } from 'slate-react'
import {
    Descendant,
    createEditor,
    Editor,
    Element as SlateElement,
    Transforms,
    Range
} from 'slate'
import { withHistory } from 'slate-history'
import { Slate, Editable, withReact, ReactEditor } from 'slate-react'

import {
    Box,
    Toolbar,
    Button,
} from '@mui/material'
import LinkIcon from '@mui/icons-material/Link'
import LinkOffIcon from '@mui/icons-material/LinkOff'

import { isCustomBlock } from '../baseClasses'

import { useDebouncedOnChange } from '../../../../hooks/useDebounce'
import descendantsToRender from './descendantsToRender'
import descendantsFromRender from './descendantsFromRender'
import { decorateFactory, Element, Leaf, withParagraphBR } from './components'
import LinkDialog from './LinkDialog'
import { useLibraryAsset } from '../LibraryAsset'
import useUpdatedSlate from '../../../../hooks/useUpdatedSlate'
import withConstrainedWhitespace from './constrainedWhitespace'
import TutorialPopover from '../../../Onboarding/TutorialPopover'
import { useStandardFormContext } from '../StandardFormContext'
import { StandardForm } from '@tonylb/mtw-wml/ts/standardize'
import { StandardRender } from '@tonylb/mtw-wml/ts/standardize/render'

interface StandardRenderEditorProps {
    validLinkTags?: ('Feature' | 'Knowledge')[];
    toolbar?: boolean;
    checkPoints?: string[];
    value: StandardRender;
    onChange: (value: StandardRender) => void;
}

const withInlines = (editor: Editor) => {
    const { isInline } = editor

    editor.isInline = (element: SlateElement) => (
        ['featureLink', 'knowledgeLink'].includes(element.type) || isInline(element)
    )

    return editor
}

const isInContextOf = (tags: string[]) => (editor: Editor) => {
    const link = Editor.nodes(editor, {
        match: n =>
            !Editor.isEditor(n) && SlateElement.isElement(n) && tags.includes(n.type),
    }).next()
    return !!(link?.value)
}

const isLinkActive = isInContextOf(['featureLink', 'knowledgeLink'])

const unwrapLink = (editor: Editor) => {
    Transforms.unwrapNodes(editor, {
        match: n =>
            !Editor.isEditor(n) && SlateElement.isElement(n) && ['featureLink', 'knowledgeLink'].includes(n.type),
    })
}

interface AddLinkButtonProps {
    openDialog: () => void;
}

const AddLinkButton: FunctionComponent<AddLinkButtonProps> = ({ openDialog }) => {
    const editor = useSlate()
    const { readonly } = useLibraryAsset()
    const { selection } = editor
    return <Button
        variant={isLinkActive(editor) ? "contained" : "outlined"}
        disabled={readonly || !selection || Boolean(!isLinkActive(editor) && Range.isCollapsed(selection))}
        onClick={openDialog}
    >
        <LinkIcon />
    </Button>
}

interface RemoveLinkButtonProps {
}

const RemoveLinkButton: FunctionComponent<RemoveLinkButtonProps> = () => {
    const editor = useSlate()
    const { readonly } = useLibraryAsset()
    const { selection } = editor
    const handleClick = useCallback(() => {
        unwrapLink(editor)
        setTimeout(() => {
            ReactEditor.focus(editor)
        }, 10)
    }, [editor])
    return <Button
        variant={isLinkActive(editor) ? "contained" : "outlined"}
        disabled={readonly || !selection || Boolean(!isLinkActive(editor) && Range.isCollapsed(selection))}
        onClick={handleClick}
    >
        <LinkOffIcon />
    </Button>
}

type StandardRenderSlateComponentProperties = {
    standard: StandardForm;
    value: StandardRender;
    onChange: (value: StandardRender) => void;
    validLinkTags?: ('Feature' | 'Knowledge')[];
    placeholder?: string;
    toolbar?: boolean;
    readonly: boolean;
    checkPoints?: string[];
}

const useStandardRenderEditorHook = (standard: StandardForm, value: StandardRender, onChange: (value: StandardRender) => void): { editor: Editor, value: Descendant[], setValue: (value: Descendant[]) => void } => {
    const defaultValue = useMemo(() => {
        const returnValue = descendantsFromRender(value, { standard })
        return returnValue
    }, [value, standard])
    const editor = useUpdatedSlate({
        initializeEditor: () => withConstrainedWhitespace(withParagraphBR(withInlines(withHistory(withReact(createEditor()))))),
        value: defaultValue,
        comparisonOutput: descendantsToRender(standard)
    })
    const [outputValue, setValue] = useState<Descendant[]>(defaultValue)

    useDebouncedOnChange({
        value: outputValue,
        delay: 1000,
        onChange: (value) => {
            const newRender = descendantsToRender(standard)((value || []).filter(isCustomBlock))
            onChange(newRender)
        }
    })

    return {
        editor,
        value: outputValue,
        setValue
    }
}

const StandardRenderSlateComponent: FunctionComponent<StandardRenderSlateComponentProperties> = ({
    standard,
    value,
    onChange,
    validLinkTags,
    placeholder,
    toolbar,
    readonly,
    checkPoints = []
}) => {

    const [linkDialogOpen, setLinkDialogOpen] = useState<boolean>(false)
    const { editor, value: slateValue, setValue } = useStandardRenderEditorHook(standard, value, onChange)
    const renderElement = useCallback((props: any) => <Element {...props} />, [])
    const renderLeaf = useCallback((props: any) => <Leaf {...props} />, [])
    const ref = useRef<HTMLDivElement>(null)

    const decorate = useCallback(decorateFactory(editor), [editor])
    return <Slate editor={editor} value={slateValue} onChange={(value) => { setValue(value) }}>
        <LinkDialog open={linkDialogOpen} onClose={() => { setLinkDialogOpen(false) }} validTags={validLinkTags} />
        { toolbar && <Toolbar variant="dense" disableGutters sx={{ marginTop: '-0.375em' }}>
                { (validLinkTags?.length &&
                    <React.Fragment>
                        <AddLinkButton openDialog={() => { setLinkDialogOpen(true) }} />
                        <RemoveLinkButton />
                    </React.Fragment>) || null
                }
            </Toolbar>
        }
        <Box sx={{ padding: '0.5em' }} ref={ref}>
            <Editable
                renderElement={renderElement}
                renderLeaf={renderLeaf}
                decorate={decorate}
                readOnly={readonly}
                placeholder={placeholder}
            />
        </Box>
        <TutorialPopover
            anchorEl={ref as any}
            placement="top"
            checkPoints={checkPoints}
        />
    </Slate>
}

export const StandardRenderEditor: FunctionComponent<StandardRenderEditorProps> = (props) => {
    const { tag } = useStandardFormContext()
    const { standardForm, readonly } = useLibraryAsset()
    return <StandardRenderSlateComponent
        { ...props }
        placeholder={['ShortName', 'Name', 'Summary', 'Description'].includes(tag) ? `Enter a ${tag}` : ''}
        standard={standardForm}
        readonly={readonly}
        checkPoints={props.checkPoints}
    />
}

export default StandardRenderEditor
