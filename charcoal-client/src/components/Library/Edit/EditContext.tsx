import React, { FunctionComponent, useContext } from "react"
import { GenericTree, GenericTreeNode } from "@tonylb/mtw-wml/dist/tree/baseClasses";
import { SchemaTag } from "@tonylb/mtw-wml/dist/schema/baseClasses";
import { TreeId } from "@tonylb/mtw-wml/dist/tree/baseClasses";

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

export const useEditContext = () => (useContext(EditContext))
