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
    Button,
    ButtonGroup,
    Toolbar,
} from '@mui/material'
import LinkIcon from '@mui/icons-material/Link'
import LinkOffIcon from '@mui/icons-material/LinkOff'

import { isCustomBlock } from '../../../Editor/baseClasses'

import { useDebouncedOnChange } from '../../../../hooks/useDebounce'
import descendantsToRender from '../../../Editor/StandardRenderEditor/descendantsToRender'
import descendantsFromRender from '../../../Editor/StandardRenderEditor/descendantsFromRender'
import { Element } from '../../../Editor/StandardRenderEditor/components'
import LinkDialog from '../../LinkDialog'
import WorkbenchTitledBox from '../../WorkbenchTitledBox'
import { useWorkbenchAsset } from '../useWorkbenchAsset'
import useUpdatedSlate from '../../../../hooks/useUpdatedSlate'
import withConstrainedWhitespace from '../../../Editor/StandardRenderEditor/constrainedWhitespace'
import TutorialPopover from '../../../Onboarding/TutorialPopover'
import { StandardForm } from '@tonylb/mtw-wml/ts/standardize'
import { StandardRender } from '@tonylb/mtw-wml/ts/standardize/render'

type StandardFormTag = 'ShortName' | 'Name' | 'Summary' | 'Description'

interface StandardRenderEditorProps {
    validLinkTags?: ('Feature' | 'Knowledge')[];
    toolbar?: boolean;
    checkPoints?: string[];
    value: StandardRender;
    onChange: (value: StandardRender) => void;
    /** Override placeholder. Example: "Enter a Description" */
    placeholder?: string;
    /** Field tag for default placeholder when placeholder is not provided. E.g. "Summary" -> "Enter a Summary" */
    tag?: StandardFormTag;
    /** When set, the editor renders a bordered title box (WorkbenchTitledBox) with the toolbar in the title bar */
    title?: string;
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
    const { readonly } = useWorkbenchAsset()
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
    const { readonly } = useWorkbenchAsset()
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
    title?: string;
}

const useStandardRenderEditorHook = (standard: StandardForm, value: StandardRender, onChange: (value: StandardRender) => void): { editor: Editor, value: Descendant[], setValue: (value: Descendant[]) => void } => {
    const defaultValue = useMemo(() => {
        const returnValue = descendantsFromRender(value, { standard })
        return returnValue
    }, [value, standard])
    // useUpdatedSlate syncs external value via Transforms (removeNodes/insertNodes), not by mutating editor.children
    const editor = useUpdatedSlate({
        initializeEditor: () => withConstrainedWhitespace(withInlines(withHistory(withReact(createEditor())))),
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
    checkPoints = [],
    title
}) => {

    const [linkDialogOpen, setLinkDialogOpen] = useState<boolean>(false)
    const { editor, value: slateValue, setValue } = useStandardRenderEditorHook(standard, value, onChange)
    // Slate 0.123+ uses initialValue (uncontrolled); capture first value so we don't change it after mount
    const [initialValue] = useState<Descendant[]>(() =>
        slateValue.length ? slateValue : [{ type: 'paragraph', children: [{ text: '' }] }]
    )
    const renderElement = useCallback((props: any) => <Element {...props} />, [])
    const ref = useRef<HTMLDivElement>(null)

    const toolbarButtons = toolbar && validLinkTags?.length ? (
        <ButtonGroup
            size="small"
            variant="outlined"
            sx={{
                alignSelf: 'stretch',
                '& > button:last-of-type': {
                    borderTopRightRadius: '0.5em',
                    borderBottomRightRadius: '0.5em'
                }
            }}
        >
            <AddLinkButton openDialog={() => { setLinkDialogOpen(true) }} />
            <RemoveLinkButton />
        </ButtonGroup>
    ) : null

    const editableContent = (
        <Box sx={{ padding: title ? '0.25em 0.5em 0.5em 0.5em' : '0.5em' }} ref={ref}>
            <Editable
                renderElement={renderElement}
                readOnly={readonly}
                placeholder={placeholder}
            />
        </Box>
    )

    return <Slate editor={editor} initialValue={initialValue} onChange={(next) => setValue(next)}>
        <LinkDialog open={linkDialogOpen} onClose={() => { setLinkDialogOpen(false) }} validTags={validLinkTags} />
        { title ? (
            <WorkbenchTitledBox title={title} actions={toolbarButtons}>
                {editableContent}
            </WorkbenchTitledBox>
        ) : (
            <>
                { toolbar && <Toolbar variant="dense" disableGutters sx={{ marginTop: '-0.375em' }}>
                    {toolbarButtons}
                </Toolbar> }
                {editableContent}
            </>
        ) }
        <TutorialPopover
            anchorEl={ref as any}
            placement="top"
            checkPoints={checkPoints}
        />
    </Slate>
}

export const StandardRenderEditor: FunctionComponent<StandardRenderEditorProps> = (props) => {
    const { standardForm, readonly } = useWorkbenchAsset()
    const contextPlaceholder = props.placeholder !== undefined ? '' : (props.tag && ['ShortName', 'Name', 'Summary', 'Description'].includes(props.tag) ? `Enter a ${props.tag}` : '')
    return <StandardRenderSlateComponent
        { ...props }
        placeholder={props.placeholder ?? contextPlaceholder}
        standard={standardForm}
        readonly={readonly}
        checkPoints={props.checkPoints}
    />
}

export default StandardRenderEditor
