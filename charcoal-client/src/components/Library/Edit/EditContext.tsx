import React, { FunctionComponent, useContext } from "react"
import { GenericTree, GenericTreeNode } from "@tonylb/mtw-wml/dist/tree/baseClasses";
import { SchemaTag } from "@tonylb/mtw-wml/dist/schema/baseClasses";
import { TreeId } from "@tonylb/mtw-wml/dist/tree/baseClasses";
import { maybeGenericIDFromTree } from "@tonylb/mtw-wml/dist/tree/genericIDTree";

type EditContextType = {
    field: GenericTreeNode<SchemaTag, TreeId>;
    inherited?: GenericTreeNode<SchemaTag, TreeId>;
    value: GenericTree<SchemaTag>;
    onChange: (value: GenericTree<SchemaTag, TreeId>) => void;
    onDelete: () => void;
    subIndex?: number;
}

const EditContext = React.createContext<EditContextType>({
    field: { data: { tag: 'Name' }, id: '', children: [] },
    value: [],
    onChange: () => {},
    onDelete: () => {}
})

export const EditSchema: FunctionComponent<EditContextType> = ({ field, inherited, value, onChange, onDelete, subIndex, children }) => {
    return <EditContext.Provider value={{ field, inherited, subIndex, value, onChange, onDelete }}>
        { children }
    </EditContext.Provider>
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
        onDelete={() => {
            onChange(maybeGenericIDFromTree([
                ...value.slice(0, index),
                ...value.slice(index + 1)
            ]))
        }}
    >
        { children }
    </EditSchema>
}

export const useEditContext = () => (useContext(EditContext))
