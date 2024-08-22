import React, { FunctionComponent, useContext } from "react"
import { GenericTreeNode } from "@tonylb/mtw-wml/dist/tree/baseClasses";
import { SchemaTag } from "@tonylb/mtw-wml/dist/schema/baseClasses";
import { TreeId } from "@tonylb/mtw-wml/dist/tree/baseClasses";

type EditContextType = {
    componentKey: string;
    field: GenericTreeNode<SchemaTag, TreeId>;
    inherited?: GenericTreeNode<SchemaTag, TreeId>;
    parentId: string;
    tag: 'ShortName' | 'Name' | 'Summary' | 'Description' | 'Statement' | 'Fallthrough' | 'If';
    onChange: (value: GenericTreeNode<SchemaTag, TreeId>) => void;
}

const EditContext = React.createContext<EditContextType>({
    componentKey: '',
    field: { data: { tag: 'Name' }, id: '', children: [] },
    parentId: '',
    tag: 'Name',
    onChange: () => {}
})

export const EditSchema: FunctionComponent<EditContextType> = ({ componentKey, field, inherited, parentId, tag, onChange, children }) => {
    return <EditContext.Provider value={{ componentKey, field, inherited, parentId, tag, onChange }}>
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
