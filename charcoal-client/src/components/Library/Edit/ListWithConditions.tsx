import React, { FunctionComponent, PropsWithChildren, ReactElement } from "react"

import List from "@mui/material/List"
import ListItem from "@mui/material/ListItem"
import ListItemIcon from "@mui/material/ListItemIcon"
import ListItemButton from "@mui/material/ListItemButton"
import ListItemText from "@mui/material/ListItemText"
import IconButton from "@mui/material/IconButton"
import AddIcon from '@mui/icons-material/Add'
import DeleteIcon from '@mui/icons-material/Delete'

import { isSchemaCondition, SchemaConditionTag, SchemaTag } from "@tonylb/mtw-wml/dist/schema/baseClasses"
import { GenericTreeFiltered, GenericTreeNodeFiltered, treeNodeTypeguard } from "@tonylb/mtw-wml/dist/tree/baseClasses"
import { EditSubListSchema, useEditContext, useEditNodeContext } from "./EditContext"
import IfElseTree from "./IfElseTree"

type ListWithConditionsProperties<T extends SchemaTag> = {
    typeGuard: (value: SchemaTag) => value is T;
    render: FunctionComponent<{ item: GenericTreeNodeFiltered<T, SchemaTag>, index: number }>;
    label: string;
    defaultNode: T;
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

const ListWithConditionItem = <T extends SchemaTag>(props: PropsWithChildren<{ index: number; render: FunctionComponent<{ item: GenericTreeNodeFiltered<T, SchemaTag>, index: number }>; typeGuard: (value: SchemaTag) => value is T; }>) => {
    const { onDelete, data, children } = useEditNodeContext()
    const { render: Render } = props
    if (!props.typeGuard(data)) {
        return null
    }
    return <ListItem
        secondaryAction={
            <IconButton
                edge="end"
                aria-label="delete"
                onClick={() => { onDelete() }}
            >
                <DeleteIcon />
            </IconButton>
        }>
            <Render item={{ data, children }} index={props.index} />
        </ListItem>
}

export const ListWithConditions = <T extends SchemaTag>(props: PropsWithChildren<ListWithConditionsProperties<T>>): ReactElement<any, any> | null => {
    const { render, typeGuard } = props
    const { value, onChange } = useEditContext()

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

    const addButton = <List>
        <ListItemButton onClick={() => { onChange([...value, { data: props.defaultNode, children: [] }]) }}>
            <ListItemIcon>
                <AddIcon />
            </ListItemIcon>
            <ListItemText primary={`Add ${props.label}`} />
        </ListItemButton>
    </List>

    return <React.Fragment>
        { listGroups.map((group, index) => (
            group.type === 'tree'
                ? <List key={`list-with-conditions-${group.startIndex + index}`}>
                    { group.tree.map((item, index) => (
                        <EditSubListSchema
                            key={`subList-${group.startIndex + index}`}
                            index={group.startIndex + index}
                        >
                            <ListWithConditionItem index={group.startIndex + index} render={render} typeGuard={typeGuard} />
                        </EditSubListSchema>
                    ))}
                    { index === listGroups.length - 1 && addButton }
                </List>
                : <EditSubListSchema
                    key={`list-with-conditions-${group.index}`}
                    index={group.index}
                >
                    <IfElseTree render={props.render} />
                </EditSubListSchema>
        )) }
        { listGroups.slice(-1)[0]?.type !== 'tree' && addButton }
    </React.Fragment>
}

export default ListWithConditions
