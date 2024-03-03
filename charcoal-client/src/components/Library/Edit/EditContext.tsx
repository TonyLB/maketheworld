import React, { FunctionComponent, useContext } from "react"
import { SchemaTag } from "@tonylb/mtw-wml/dist/schema/baseClasses"
import { GenericTree, TreeId } from "@tonylb/mtw-wml/dist/tree/baseClasses"
import { UpdateSchemaPayload } from "../../../slices/personalAssets/reducers"

type EditContextType = {
    schema: GenericTree<SchemaTag, TreeId>;
    updateSchema: (action: UpdateSchemaPayload) => void;
}

const EditContext = React.createContext<EditContextType>({
    schema: [],
    updateSchema: () => {}
})

export const EditSchema: FunctionComponent<EditContextType> = ({ schema, updateSchema, children }) => {
    return <EditContext.Provider value={({
        schema, 
        updateSchema
    })}>
        { children }
    </EditContext.Provider>
}

export const useEditContext = () => (useContext(EditContext))
