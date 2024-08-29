import React, { FunctionComponent, PropsWithChildren, ReactElement } from "react"

import { isSchemaCondition, SchemaConditionTag, SchemaTag } from "@tonylb/mtw-wml/dist/schema/baseClasses"
import { GenericTreeFiltered, GenericTreeNodeFiltered, treeNodeTypeguard } from "@tonylb/mtw-wml/dist/tree/baseClasses"
import { EditSubListSchema, useEditContext } from "./EditContext"
import IfElseTree from "./IfElseTree"
import List from "@mui/material/List"
import ListItem from "@mui/material/ListItem"

type ListWithConditionsProperties<T extends SchemaTag> = {
    typeGuard: (value: SchemaTag) => value is T;
    render: FunctionComponent<{ item: GenericTreeNodeFiltered<T, SchemaTag>, index: number }>;
}

type ListWithConditionsGroup<T extends SchemaTag> = {
    type: 'tree';
    startIndex: number;
    tree: GenericTreeFiltered<T, SchemaTag>;
} | {
    type: 'if';
    index: number;
    node: GenericTreeNodeFiltered<SchemaConditionTag, SchemaTag>;
}

export const ListWithConditions = <T extends SchemaTag>(props: PropsWithChildren<ListWithConditionsProperties<T>>): ReactElement<any, any> | null => {
    const { render: Render } = props
    const { value } = useEditContext()

    const listGroups = value.reduce<ListWithConditionsGroup<T>[]>((previous, item, index) => {
        if (treeNodeTypeguard(isSchemaCondition)(item)) {
            return [...previous, { type: 'if', node: item, index }]
        }
        else if (treeNodeTypeguard(props.typeGuard)(item)) {
            const last = previous.length ? previous.slice(-1)[0] : undefined
            if (last && last.type === 'tree') {
                return [...previous.slice(0, -1), { ...last, tree: [...last.tree, item] }]
            }
            else {
                return [...previous, { type: 'tree', tree: [item], startIndex: index }]
            }
        }
        else {
            throw new Error('Invalid type in ListWithConditions')
        }
    }, [])

    return <React.Fragment>{
        listGroups.map((group) => (
            group.type === 'tree'
                ? <List>
                    { group.tree.map((item, index) => (
                        <EditSubListSchema
                            key={`list-with-conditions-${group.startIndex + index}`}
                            index={group.startIndex + index}
                        >
                            <ListItem><Render item={item} index={group.startIndex + index} /></ListItem>
                        </EditSubListSchema>
                    ))}
                </List>
                : <EditSubListSchema
                    key={`list-with-conditions-${group.index}`}
                    index={group.index}
                >
                    <IfElseTree render={props.render} />
                </EditSubListSchema>
        ))
    }</React.Fragment>
}

export default ListWithConditions
