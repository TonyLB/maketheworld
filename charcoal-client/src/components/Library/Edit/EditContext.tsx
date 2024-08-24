import React, { FunctionComponent, useContext } from "react"
import { GenericTree, GenericTreeNode } from "@tonylb/mtw-wml/dist/tree/baseClasses";
import { SchemaTag } from "@tonylb/mtw-wml/dist/schema/baseClasses";
import { TreeId } from "@tonylb/mtw-wml/dist/tree/baseClasses";

type EditContextType = {
    componentKey: string;
    field: GenericTreeNode<SchemaTag, TreeId>;
    inherited?: GenericTreeNode<SchemaTag, TreeId>;
    value: GenericTree<SchemaTag>;
    tag: 'ShortName' | 'Name' | 'Summary' | 'Description' | 'Statement' | 'Fallthrough' | 'If';
    onChange: (value: GenericTree<SchemaTag, TreeId>) => void;
    onDelete: () => void;
    subIndex?: number;
}

const EditContext = React.createContext<EditContextType>({
    componentKey: '',
    field: { data: { tag: 'Name' }, id: '', children: [] },
    tag: 'Name',
    value: [],
    onChange: () => {},
    onDelete: () => {}
})

export const EditSchema: FunctionComponent<EditContextType> = ({ componentKey, field, inherited, tag, value, onChange, onDelete, subIndex, children }) => {
    return <EditContext.Provider value={{ componentKey, field, inherited, subIndex, tag, value, onChange, onDelete }}>
        { children }
    </EditContext.Provider>
}

export const useEditContext = () => (useContext(EditContext))
