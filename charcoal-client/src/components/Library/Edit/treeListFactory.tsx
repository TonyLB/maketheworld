import { FunctionComponent } from "react"

import List from '@mui/material/List'
import ListItem from '@mui/material/ListItem'
import IconButton from "@mui/material/IconButton"
import DeleteIcon from '@mui/icons-material/Delete'

import { SchemaTag } from "@tonylb/mtw-wml/dist/schema/baseClasses"
import { GenericTreeFiltered, GenericTreeNodeFiltered, TreeId } from "@tonylb/mtw-wml/dist/tree/baseClasses"
import { useLibraryAsset } from "./LibraryAsset"

type TreeListRenderProps<NodeType extends SchemaTag> = {
    node: GenericTreeNodeFiltered<NodeType, SchemaTag, TreeId>;
}

type TreeListFactoryProps<NodeType extends SchemaTag> = {
    render: FunctionComponent<TreeListRenderProps<NodeType>>;
    defaultNode: NodeType;
}

type TreeListProps<NodeType extends SchemaTag> = {
    parentId: string;
    tree: GenericTreeFiltered<NodeType, SchemaTag, TreeId>;
}

export const treeListFactory = <NodeType extends SchemaTag>({ render, defaultNode }: TreeListFactoryProps<NodeType>): FunctionComponent<TreeListProps<NodeType>> => ({ parentId, tree }) => {
    const { updateSchema } = useLibraryAsset()
    //
    // TODO: Create addItem button
    //
    return <List>
        { tree.map((node) => (
            <ListItem
                key={node.id}
                secondaryAction={
                    <IconButton
                        edge="end"
                        aria-label="delete"
                        onClick={() => { updateSchema({ type: 'delete', id: node.id }) }}
                    >
                      <DeleteIcon />
                    </IconButton>
                }
            >
                { render({ node }) }
            </ListItem>
        )) }
    </List>
}

export default treeListFactory
