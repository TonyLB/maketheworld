import React, { FunctionComponent, PropsWithChildren, ReactElement } from "react"

import { isSchemaCondition, SchemaTag } from "@tonylb/mtw-wml/dist/schema/baseClasses"
import { GenericTreeNodeFiltered, treeNodeTypeguard } from "@tonylb/mtw-wml/dist/tree/baseClasses"
import { EditSchema, useEditContext } from "./EditContext";
import { maybeGenericIDFromTree } from "@tonylb/mtw-wml/dist/tree/genericIDTree";
import IfElseTree from "./IfElseTree";

type ListWithConditionsProperties<T extends SchemaTag> = {
    typeGuard: (value: SchemaTag) => value is T;
    render: FunctionComponent<{ item: GenericTreeNodeFiltered<T, SchemaTag> }>;
}

export const ListWithConditions = <T extends SchemaTag>(props: PropsWithChildren<ListWithConditionsProperties<T>>): ReactElement<any, any> | null => {
    const { render: Render } = props
    const { value, onChange } = useEditContext()

    return <React.Fragment>{
        value.map((item, index) => {
            if (treeNodeTypeguard(isSchemaCondition)(item)) {
                return <EditSchema
                    key={`list-with-conditions-${index}`}
                    field={maybeGenericIDFromTree([item])[0]}
                    value={[item]}
                    onChange={(newValue) => { onChange(maybeGenericIDFromTree([...value.slice(0, index), { ...item, children: newValue }, ...value.slice(index+1)])) }}
                    onDelete={() => { onChange(maybeGenericIDFromTree([...value.slice(0, index), ...value.slice(index+1)])) }}
                >
                    <IfElseTree render={props.render} />
                </EditSchema>
            }
            else if (treeNodeTypeguard(props.typeGuard)(item)) {
                return <EditSchema
                    key={`list-with-conditions-${index}`}
                    field={maybeGenericIDFromTree([item])[0]}
                    value={[item]}
                    onChange={(newValue) => { onChange(maybeGenericIDFromTree([...value.slice(0, index), { ...item, children: newValue }, ...value.slice(index+1)])) }}
                    onDelete={() => { onChange(maybeGenericIDFromTree([...value.slice(0, index), ...value.slice(index+1)])) }}
                >
                    <Render item={item} />
                </EditSchema>
            }
            return null
        })
    }</React.Fragment>
}

export default ListWithConditions
