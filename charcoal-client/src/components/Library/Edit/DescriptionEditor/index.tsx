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
import { grey } from '@mui/material/colors'
import LinkIcon from '@mui/icons-material/Link'
import LinkOffIcon from '@mui/icons-material/LinkOff'
import TreeIcon from '@mui/icons-material/AccountTree';

import {
    CustomIfWrapper,
    CustomNewIfWrapper,
    isCustomBlock
} from '../baseClasses'

import { useDebouncedOnChange } from '../../../../hooks/useDebounce'
import descendantsToRender from './descendantsToRender'
import descendantsFromRender from './descendantsFromRender'
import withConditionals from './conditionals'
import { decorateFactory, elementFactory, Leaf, withParagraphBR } from './components'
import LinkDialog from './LinkDialog'
import { useLibraryAsset } from '../LibraryAsset'
import useUpdatedSlate from '../../../../hooks/useUpdatedSlate'
import withConstrainedWhitespace from './constrainedWhitespace'
import { isSchemaOutputTag, SchemaOutputTag } from '@tonylb/mtw-wml/dist/schema/baseClasses'
import { GenericTree, GenericTreeNode, TreeId } from '@tonylb/mtw-wml/dist/tree/baseClasses'
import { maybeGenericIDFromTree } from '@tonylb/mtw-wml/dist/tree/genericIDTree'
import { treeTypeGuard } from '@tonylb/mtw-wml/dist/tree/filter'
import { SchemaTag } from '@tonylb/mtw-wml/dist/schema/baseClasses'
import { useEditContext } from '../EditContext'
import { StandardForm } from '@tonylb/mtw-wml/dist/standardize/baseClasses'

interface DescriptionEditorProps {
    validLinkTags?: ('Action' | 'Feature' | 'Knowledge')[];
    fieldName?: string;
    toolbar?: boolean;
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

interface AddIfButtonProps {
    forceOnChange: (value: Descendant[]) => void;
}

const AddIfButton: FunctionComponent<AddIfButtonProps> = ({ forceOnChange }) => {
    const { readonly } = useLibraryAsset()
    const editor = useSlate()
    const handleClick = useCallback(() => {
        const { selection } = editor
        const isCollapsed = selection && Range.isCollapsed(selection)
      
        const ifWrapper: CustomNewIfWrapper = {
            type: 'newIfWrapper',
            children: isCollapsed ? [{ text: '' }] : [],
        }
      
        if (isCollapsed) {
            Transforms.insertNodes(editor, [ifWrapper, { type: 'paragraph', children: [{ text: '' }] }])
        } else {
            Transforms.wrapNodes(editor, ifWrapper, { split: true })
            Transforms.collapse(editor, { edge: 'end' })
            editor.saveSelection = undefined
        }
        forceOnChange(editor.children)
    }, [editor, forceOnChange])
    return <Button
        variant="outlined"
        disabled={readonly}
        onClick={handleClick}
    >
        <TreeIcon />
    </Button>
}

type DescriptionEditorSlateComponentProperties = {
    data: GenericTreeNode<SchemaTag, TreeId>;
    standard: StandardForm;
    // editor: Editor;
    // value: Descendant[];
    validLinkTags?: ('Action' | 'Feature' | 'Knowledge')[];
    fieldName?: string;
    placeholder?: string;
    toolbar?: boolean;
    readonly: boolean;
    // setValue?: (value: Descendant[]) => void;
    // saveToReduce?: (value: Descendant[]) => void;
}

const useDescriptionEditorHook = (data: GenericTreeNode<SchemaTag, TreeId>, standard: StandardForm): { editor: Editor, value: Descendant[], setValue: (value: Descendant[]) => void, saveToReduce: (value: Descendant[]) => void } => {
    const { parentId, tag } = useEditContext()
    const { updateSchema } = useLibraryAsset()
    const onChange = useCallback((newRender: GenericTree<SchemaOutputTag, Partial<TreeId>>) => {
        if (data.id) {
            if (newRender.length) {
                updateSchema({
                    type: 'replaceChildren',
                    id: data.id,
                    children: newRender
                })
            }
            else {
                updateSchema({
                    type: 'delete',
                    id: data.id
                })
            }
        }
        else {
            if (tag !== 'Statement') {
                updateSchema({
                    type: 'addChild',
                    id: parentId,
                    item: { data: { tag }, children: newRender }
                })
            }
        }
    }, [data, updateSchema])
    const output = useMemo(() => (treeTypeGuard<SchemaTag, SchemaOutputTag, TreeId>({
        tree: data.children,
        typeGuard: isSchemaOutputTag
    })), [data])
    const defaultValue = useMemo(() => {
        const returnValue = descendantsFromRender(output, { standard })
        return returnValue
    }, [output, standard])
    const editor = useUpdatedSlate({
        initializeEditor: () => withConstrainedWhitespace(withParagraphBR(withConditionals(withInlines(withHistory(withReact(createEditor())))))),
        value: defaultValue,
        comparisonOutput: descendantsToRender(data.children)
    })
    const [value, setValue] = useState<Descendant[]>(defaultValue)
    const saveToReduce = useCallback((value: Descendant[]) => {
        const newRender = descendantsToRender(data.children)((value || []).filter(isCustomBlock))
        onChange(maybeGenericIDFromTree(newRender))
    }, [onChange, value, data])

    useDebouncedOnChange({
        value,
        delay: 1000,
        onChange: (value) => {
            saveToReduce(value)
        }
    })

    return {
        editor,
        value,
        setValue,
        saveToReduce
    }
}

const DescriptionEditorSlateComponent: FunctionComponent<DescriptionEditorSlateComponentProperties> = ({
    data,
    standard,
    validLinkTags,
    placeholder,
    fieldName,
    toolbar,
    readonly
}) => {

    const [linkDialogOpen, setLinkDialogOpen] = useState<boolean>(false)
    const Element = useMemo(() => (elementFactory(() => (<DescriptionEditor validLinkTags={validLinkTags} fieldName={fieldName} />))), [validLinkTags, placeholder])
    const renderElement = useCallback((props: RenderElementProps) => <Element {...props} />, [])
    const renderLeaf = useCallback(props => <Leaf {...props} />, [])
    const { editor, value, setValue, saveToReduce } = useDescriptionEditorHook(data, standard)

    const decorate = useCallback(decorateFactory(editor), [editor])
    return <Slate editor={editor} value={value} onChange={(value) => { setValue(value) }}>
        <LinkDialog open={linkDialogOpen} onClose={() => { setLinkDialogOpen(false) }} validTags={validLinkTags} />
        { toolbar && <Toolbar variant="dense" disableGutters sx={{ marginTop: '-0.375em' }}>
                { (validLinkTags.length &&
                    <React.Fragment>
                        <AddLinkButton openDialog={() => { setLinkDialogOpen(true) }} />
                        <RemoveLinkButton />
                    </React.Fragment>) || null
                }
                <AddIfButton forceOnChange={(value: Descendant[]) => {
                    setValue(value)
                    saveToReduce(value)
                }} />
            </Toolbar>
        }
        <Box sx={{ padding: '0.5em' }}>
            <Editable
                renderElement={renderElement}
                renderLeaf={renderLeaf}
                decorate={decorate}
                readOnly={readonly}
                placeholder={placeholder}
            />
        </Box>
    </Slate>
}

export const DescriptionEditor: FunctionComponent<DescriptionEditorProps> = (props) => {
    const { field, inherited } = useEditContext()
    const { standardForm, inheritedStandardForm, readonly } = useLibraryAsset()
    return <React.Fragment>
        { inherited?.id
            ? <Box sx={{
                padding: '0.5em',
                background: grey[100],
                width: '100%'
            }}>
                <DescriptionEditorSlateComponent
                    { ...props }
                    data={inherited}
                    standard={inheritedStandardForm}
                    readonly={true}
                />
            </Box>
            : null
        }
        <DescriptionEditorSlateComponent
            { ...props }
            placeholder={`${inherited?.id ? 'Add to': 'Enter a'} ${props.fieldName}`}
            data={field}
            standard={standardForm}
            readonly={readonly}
        />

    </React.Fragment>
}

export default DescriptionEditor
