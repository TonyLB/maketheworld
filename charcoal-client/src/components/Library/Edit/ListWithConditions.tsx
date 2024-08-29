import React, { FunctionComponent, PropsWithChildren, ReactElement } from "react"

import { isSchemaCondition, SchemaTag } from "@tonylb/mtw-wml/dist/schema/baseClasses"
import { GenericTreeNodeFiltered, treeNodeTypeguard } from "@tonylb/mtw-wml/dist/tree/baseClasses"
import { EditSubListSchema, useEditContext } from "./EditContext";
import IfElseTree from "./IfElseTree";

type ListWithConditionsProperties<T extends SchemaTag> = {
    typeGuard: (value: SchemaTag) => value is T;
    render: FunctionComponent<{ item: GenericTreeNodeFiltered<T, SchemaTag>, index: number }>;
}

export const ListWithConditions = <T extends SchemaTag>(props: PropsWithChildren<ListWithConditionsProperties<T>>): ReactElement<any, any> | null => {
    const { render: Render } = props
    const { value } = useEditContext()

    return <React.Fragment>{
        value.map((item, index) => (
            <EditSubListSchema
                key={`list-with-conditions-${index}`}
                index={index}
            >
                {
                    treeNodeTypeguard(isSchemaCondition)(item)
                        ? <IfElseTree render={props.render} />
                        : treeNodeTypeguard(props.typeGuard)(item)
                            ? <Render item={item} index={index} />
                            : null
                }
            </EditSubListSchema>
        ))
    }</React.Fragment>
}

export default ListWithConditions
