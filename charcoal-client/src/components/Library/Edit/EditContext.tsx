import React, { FunctionComponent, useContext } from "react"
import { GenericTreeNode } from "@tonylb/mtw-wml/dist/tree/baseClasses";
import { SchemaTag } from "@tonylb/mtw-wml/dist/schema/baseClasses";
import { TreeId } from "@tonylb/mtw-wml/dist/tree/baseClasses";

type EditContextType = {
    field: GenericTreeNode<SchemaTag, TreeId>;
    parentId: string;
    tag: 'ShortName' | 'Name' | 'Description' | 'Statement' | 'Fallthrough' | 'If'
}

const EditContext = React.createContext<EditContextType>({
    field: { data: { tag: 'Name' }, id: '', children: [] },
    parentId: '',
    tag: 'Name'
})

export const EditSchema: FunctionComponent<EditContextType> = ({ field, parentId, tag, children }) => {
    return <EditContext.Provider value={{ field, parentId, tag }}>
        { children }
    </EditContext.Provider>
}

export const useEditContext = () => (useContext(EditContext))
