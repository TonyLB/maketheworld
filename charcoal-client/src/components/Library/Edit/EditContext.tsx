import React, { FunctionComponent, useCallback, useContext, useMemo, useState } from "react"
import { GenericTree, GenericTreeNode } from "@tonylb/mtw-wml/dist/tree/baseClasses"
import { SchemaTag } from "@tonylb/mtw-wml/dist/schema/baseClasses"
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
    id: string;
    inherited?: GenericTreeNode<SchemaTag>;
    value: GenericTree<SchemaTag>;
    onChange: (value: GenericTree<SchemaTag>) => void;
    highlighted?: boolean;
    setHighlight: (value?: string) => void;
}

const EditContext = React.createContext<EditContextType>({
    id: 'NONE',
    value: [],
    onChange: () => {},
    setHighlight: () => {}
})

export const EditSchema: FunctionComponent<Omit<EditContextType, 'id' | 'setHighlight' | 'highlighted'>> = ({ inherited, value, onChange, children }) => {
    const id = useMemo(() => (uuidv4()), [])
    const { highlighted } = useContext(EditContext)
    const { highlightId, setHighlight: contextSetHighlight } = useContext(EditHighlightContext)
    const setHighlight = useCallback((value?: string) => { contextSetHighlight(value?? id) }, [id, contextSetHighlight])
    return <EditContext.Provider value={{ id, inherited, value, onChange, highlighted: id === highlightId || highlighted, setHighlight }}>
        { children }
    </EditContext.Provider>
}

type EditNodeContextType = {
    node: GenericTreeNode<SchemaTag>;
    onChange: (value: GenericTree<SchemaTag>) => void;
}
export const EditSchemaNode: FunctionComponent<EditNodeContextType> = ({ node, onChange }) => (
    <EditSchema value={[node]} onChange={onChange}/>
)

type EditChildrenArguments = {
    isEmpty?: (tree: GenericTree<SchemaTag>) => boolean;
}

export const EditChildren: FunctionComponent<EditChildrenArguments> = ({ isEmpty = () => false, children }) => {
    const { value, onChange: contextOnChange } = useEditContext()
    const { children: nodeChildren } = value[0]
    const onChange = useCallback((newValue: GenericTree<SchemaTag>) => {
        if (isEmpty(newValue)) {
            contextOnChange([])
        }
        else {
            contextOnChange([{ ...value[0], children: newValue }, ...value.slice(1)])
        }
    }, [contextOnChange, isEmpty])
    if (value.length === 0) {
        return null
    }
    return <EditSchema
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
        value={[value[index]]}
        onChange={(newValue) => {
            onChange([
                ...value.slice(0, index),
                ...newValue,
                ...value.slice(index + 1)
            ])
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
            onChange([newValue, ...value.slice(1)])
        },
        onDelete: () => {
            onChange(value.slice(1))
        },
        highlighted
    }
}
