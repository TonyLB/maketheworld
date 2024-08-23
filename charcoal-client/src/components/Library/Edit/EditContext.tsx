import React, { FunctionComponent, useContext } from "react"
import { GenericTree, GenericTreeNode } from "@tonylb/mtw-wml/dist/tree/baseClasses";
import { SchemaTag } from "@tonylb/mtw-wml/dist/schema/baseClasses";
import { TreeId } from "@tonylb/mtw-wml/dist/tree/baseClasses";

type EditContextType = {
    componentKey: string;
    field: GenericTreeNode<SchemaTag, TreeId>;
    inherited?: GenericTreeNode<SchemaTag, TreeId>;
    tag: 'ShortName' | 'Name' | 'Summary' | 'Description' | 'Statement' | 'Fallthrough' | 'If';
    onChange: (value: GenericTree<SchemaTag, TreeId>) => void;
}

const EditContext = React.createContext<EditContextType>({
    componentKey: '',
    field: { data: { tag: 'Name' }, id: '', children: [] },
    tag: 'Name',
    onChange: () => {}
})

export const EditSchema: FunctionComponent<EditContextType> = ({ componentKey, field, inherited, tag, onChange, children }) => {
    return <EditContext.Provider value={{ componentKey, field, inherited, tag, onChange }}>
        { children }
    </EditContext.Provider>
}

type EditSubSchemaArgs = {}

export const EditSubSchema: FunctionComponent<EditSubSchemaArgs> = ({}) => {
    //
    // TODO: Create EditSubSchema
    //
    return null
}

export const useEditContext = () => (useContext(EditContext))
