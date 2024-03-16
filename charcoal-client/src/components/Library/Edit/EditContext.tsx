import React, { FunctionComponent, useContext } from "react"
import { SchemaStandardField } from "@tonylb/mtw-wml/dist/standardize/baseClasses"

type EditContextType = {
    field: SchemaStandardField;
    parentId: string;
    tag: 'Name' | 'Description' | 'Statement' | 'Fallthrough' | 'If'
}

const EditContext = React.createContext<EditContextType>({
    field: { id: '', value: [] },
    parentId: '',
    tag: 'Name'
})

export const EditSchema: FunctionComponent<EditContextType> = ({ field, parentId, tag, children }) => {
    return <EditContext.Provider value={{ field, parentId, tag }}>
        { children }
    </EditContext.Provider>
}

export const useEditContext = () => (useContext(EditContext))
