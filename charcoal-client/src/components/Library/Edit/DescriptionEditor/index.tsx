import React, { FunctionComponent, useMemo, useState, useCallback } from 'react'
import { v4 as uuidv4 } from 'uuid'
import { isKeyHotkey } from 'is-hotkey'

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
import { Slate, Editable, withReact, ReactEditor, RenderElementProps } from 'slate-react'

import {
    Box,
    Toolbar,
    Button,
} from '@mui/material'
import LinkIcon from '@mui/icons-material/Link'
import LinkOffIcon from '@mui/icons-material/LinkOff'
import TreeIcon from '@mui/icons-material/AccountTree';

import {
    CustomIfWrapper,
    isCustomBlock
} from '../baseClasses'

import { useDebouncedOnChange } from '../../../../hooks/useDebounce'
import descendantsToRender from './descendantsToRender'
import descendantsFromRender from './descendantsFromRender'
import withConditionals from './conditionals'
import { decorateFactory, Element, Leaf, withParagraphBR } from './components'
import LinkDialog from './LinkDialog'
import { useLibraryAsset } from '../LibraryAsset'
import useUpdatedSlate from '../../../../hooks/useUpdatedSlate'
import withConstrainedWhitespace from './constrainedWhitespace'
import { SchemaOutputTag } from '@tonylb/mtw-wml/dist/schema/baseClasses'
import { GenericTree, TreeId } from '@tonylb/mtw-wml/dist/tree/baseClasses'
import { genericIDFromTree } from '@tonylb/mtw-wml/dist/tree/genericIDTree'

interface DescriptionEditorProps {
    ComponentId: string;
    output: GenericTree<SchemaOutputTag, TreeId>;
    validLinkTags?: ('Action' | 'Feature' | 'Knowledge')[];
    onChange?: (items: GenericTree<SchemaOutputTag, TreeId>) => void;
    placeholder?: string;
}

const withInlines = (editor: Editor) => {
    const { isInline } = editor

    //
    // TODO: Refactor before and replace as blocks rather than inlines, so they can contain conditionals
    //
    editor.isInline = (element: SlateElement) => (
        ['actionLink', 'featureLink', 'knowledgeLink', 'before', 'replace'].includes(element.type) || isInline(element)
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

const isLinkActive = isInContextOf(['actionLink', 'featureLink', 'knowledgeLink'])

const unwrapLink = (editor: Editor) => {
    Transforms.unwrapNodes(editor, {
        match: n =>
            !Editor.isEditor(n) && SlateElement.isElement(n) && ['actionLink', 'featureLink', 'knowledgeLink'].includes(n.type),
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

interface AddIfButtonProps {}

const AddIfButton: FunctionComponent<AddIfButtonProps> = () => {
    const { readonly } = useLibraryAsset()
    const editor = useSlate()
    const handleClick = useCallback(() => {
        const { selection } = editor
        const isCollapsed = selection && Range.isCollapsed(selection)
        const wrapper: CustomIfWrapper = {
            type: 'ifWrapper',
            tree: [
                { data: { tag: 'Statement', if: '' }, children: [{ data: { tag: 'String', value: ''}, children: [], id: uuidv4() }], id: uuidv4() }
            ]
        }
      
        if (isCollapsed) {
            Transforms.insertNodes(editor, [wrapper])
        } else {
            //
            // TODO: Extract data from current selection and run it through descendantsToRender
            // to populate the tree in the ifWrapper object
            //
            Transforms.removeNodes(editor)
            Transforms.insertNodes(editor, [wrapper])
            Transforms.collapse(editor, { edge: 'end' })
            editor.saveSelection = undefined
        }
    }, [editor])
    return <Button
        variant="outlined"
        disabled={readonly}
        onClick={handleClick}
    >
        <TreeIcon />
    </Button>
}

export const DescriptionEditor: FunctionComponent<DescriptionEditorProps> = ({ ComponentId, output, onChange = () => {}, validLinkTags=[], placeholder }) => {
    const { normalForm, components, readonly } = useLibraryAsset()
    const defaultValue = useMemo(() => (descendantsFromRender(output, { normal: normalForm })), [output, normalForm])
    const [value, setValue] = useState<Descendant[]>(defaultValue)
    const editor = useUpdatedSlate({
        initializeEditor: () => withConstrainedWhitespace(withParagraphBR(withConditionals(withInlines(withHistory(withReact(createEditor())))))),
        value: defaultValue,
        comparisonOutput: descendantsToRender
    })
    const [linkDialogOpen, setLinkDialogOpen] = useState<boolean>(false)
    const renderElement = useCallback((props: RenderElementProps) => <Element {...props} />, [])
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
    }, [editor])

    const saveToReduce = useCallback((value: Descendant[]) => {
        const newRender = descendantsToRender((value || []).filter(isCustomBlock))
        onChange(genericIDFromTree(newRender))
    }, [onChange, value])

    const onChangeHandler = useCallback((value) => {
        setValue(value)
    }, [setValue])

    useDebouncedOnChange({
        value,
        delay: 1000,
        onChange: (value) => {
            saveToReduce(value)
        }
    })

    const decorate = useCallback(decorateFactory(editor), [editor])

    //
    // TODO: Refactor Slate editor as a separate item from its controller, and use to
    // also populate InheritedDescription
    //
    return <React.Fragment>
        <Slate editor={editor} value={value} onChange={onChangeHandler}>
            <LinkDialog open={linkDialogOpen} onClose={() => { setLinkDialogOpen(false) }} validTags={validLinkTags} />
            <Toolbar variant="dense" disableGutters sx={{ marginTop: '-0.375em' }}>
                { (validLinkTags.length &&
                    <React.Fragment>
                        <AddLinkButton openDialog={() => { setLinkDialogOpen(true) }} />
                        <RemoveLinkButton />
                    </React.Fragment>) || null
                }
                <AddIfButton />
            </Toolbar>
            <Box sx={{ padding: '0.5em' }}>
                <Editable
                    renderElement={renderElement}
                    renderLeaf={renderLeaf}
                    decorate={decorate}
                    readOnly={readonly}
                    placeholder={placeholder}
                    // onKeyDown={onKeyDown}
                />
            </Box>
        </Slate>

    </React.Fragment>
}

export default DescriptionEditor
