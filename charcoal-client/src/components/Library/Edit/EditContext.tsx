import React, { FunctionComponent, useCallback, useContext, useMemo, useState } from "react"
import { GenericTree, GenericTreeNode } from "@tonylb/mtw-wml/dist/tree/baseClasses";
import { SchemaTag } from "@tonylb/mtw-wml/dist/schema/baseClasses";
import { TreeId } from "@tonylb/mtw-wml/dist/tree/baseClasses";
import { maybeGenericIDFromTree } from "@tonylb/mtw-wml/dist/tree/genericIDTree";
import { v4 as uuidv4 } from 'uuid'

type EditHighlightContextType = {
    highlightId: string;
    setHighlight: (value: string) => void;
}

const EditHighlightContext = React.createContext<EditHighlightContextType>({
    highlightId: '',
    setHighlight: () => {}
})

export const EditHighlight: FunctionComponent<{}> = ({ children }) => {
    const [highlightId, setHighlight] = useState('')
    return <EditHighlightContext.Provider value={{ highlightId, setHighlight }}>
        { children }
    </EditHighlightContext.Provider>
}

type EditContextType = {
    field: GenericTreeNode<SchemaTag, TreeId>;
    id: string;
    inherited?: GenericTreeNode<SchemaTag, TreeId>;
    value: GenericTree<SchemaTag>;
    onChange: (value: GenericTree<SchemaTag, TreeId>) => void;
    highlighted?: boolean;
    setHighlight: (value?: string) => void;
}

const EditContext = React.createContext<EditContextType>({
    field: { data: { tag: 'Name' }, id: '', children: [] },
    id: 'NONE',
    value: [],
    onChange: () => {},
    setHighlight: () => {}
})

export const EditSchema: FunctionComponent<Omit<EditContextType, 'id' | 'setHighlight' | 'highlighted'>> = ({ field, inherited, value, onChange, children }) => {
    const id = useMemo(() => (uuidv4()), [])
    const { highlighted } = useContext(EditContext)
    const { highlightId, setHighlight: contextSetHighlight } = useContext(EditHighlightContext)
    const setHighlight = useCallback((value?: string) => { contextSetHighlight(value?? id) }, [id, contextSetHighlight])
    return <EditContext.Provider value={{ field, id, inherited, value, onChange, highlighted: id === highlightId || highlighted, setHighlight }}>
        { children }
    </EditContext.Provider>
}

type EditNodeContextType = {
    node: GenericTreeNode<SchemaTag, TreeId>;
    onChange: (value: GenericTree<SchemaTag, TreeId>) => void;
}
export const EditSchemaNode: FunctionComponent<EditNodeContextType> = ({ node, onChange }) => (
    <EditSchema field={node} value={[node]} onChange={onChange}/>
)

type EditChildrenArguments = {
    isEmpty?: (tree: GenericTree<SchemaTag>) => boolean;
}

export const EditChildren: FunctionComponent<EditChildrenArguments> = ({ isEmpty = () => false, children }) => {
    const { value, onChange: contextOnChange } = useEditContext()
    if (value.length === 0) {
        return null
    }
    const { children: nodeChildren } = value[0]
    const onChange = useCallback((newValue: GenericTree<SchemaTag>) => {
        if (isEmpty(newValue)) {
            contextOnChange([])
        }
        else {
            contextOnChange(maybeGenericIDFromTree([{ ...value[0], children: newValue }, ...value.slice(1)]))
        }
    }, [contextOnChange, isEmpty])
    return <EditSchema
        field={maybeGenericIDFromTree(value)[0]}
        value={nodeChildren}
        onChange={onChange}
    >
        { children }
    </EditSchema>
}

type EditSubListArguments = {
    index: number;
}
export const EditSubListSchema: FunctionComponent<EditSubListArguments> = ({ index, children }) => {
    const { value, onChange } = useEditContext()
    if (value.length === 0) {
        return null
    }
    if (index >= value.length) {
        return null
    }
    return <EditSchema
        field={maybeGenericIDFromTree([value[index]])[0]}
        value={[value[index]]}
        onChange={(newValue) => {
            onChange(maybeGenericIDFromTree([
                ...value.slice(0, index),
                ...newValue,
                ...value.slice(index + 1)
            ]))
        }}
    >
        { children }
    </EditSchema>
}

export const useEditContext = () => (useContext(EditContext))
export const useEditNodeContext = () => {
    const { value, onChange, highlighted } = useEditContext()
    return {
        data: value[0]?.data,
        children: value[0]?.children ?? [],
        onChange: (newValue: GenericTreeNode<SchemaTag>) => {
            onChange(maybeGenericIDFromTree([newValue, ...value.slice(1)]))
        },
        onDelete: () => {
            onChange(maybeGenericIDFromTree(value.slice(1)))
        },
        highlighted
    }
}
