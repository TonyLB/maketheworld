import React, { FunctionComponent, useContext } from "react"
import { GenericTree, GenericTreeNode } from "@tonylb/mtw-wml/dist/tree/baseClasses";
import { SchemaTag } from "@tonylb/mtw-wml/dist/schema/baseClasses";
import { TreeId } from "@tonylb/mtw-wml/dist/tree/baseClasses";
import { maybeGenericIDFromTree } from "@tonylb/mtw-wml/dist/tree/genericIDTree";

type EditContextType = {
    field: GenericTreeNode<SchemaTag, TreeId>;
    inherited?: GenericTreeNode<SchemaTag, TreeId>;
    value: GenericTree<SchemaTag>;
    onChange: (value: GenericTree<SchemaTag, TreeId>) => void
}

const EditContext = React.createContext<EditContextType>({
    field: { data: { tag: 'Name' }, id: '', children: [] },
    value: [],
    onChange: () => {}
})

export const EditSchema: FunctionComponent<EditContextType> = ({ field, inherited, value, onChange, children }) => {
    return <EditContext.Provider value={{ field, inherited, value, onChange }}>
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
    const { value, onChange } = useEditContext()
    return {
        data: value[0]?.data,
        children: value[0]?.children ?? [],
        onChange: (newValue: GenericTreeNode<SchemaTag>) => {
            onChange(maybeGenericIDFromTree([newValue, ...value.slice(1)]))
        },
        onDelete: () => {
            onChange(maybeGenericIDFromTree(value.slice(1)))
        }
    }
}
