import { FunctionComponent } from "react"

import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';

import { SchemaTag } from "@tonylb/mtw-wml/dist/schema/baseClasses"
import { GenericTreeFiltered, GenericTreeNodeFiltered, TreeId } from "@tonylb/mtw-wml/dist/tree/baseClasses"

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
    //
    // TODO: Create addItem button
    //
    return <List>
        { tree.map((node) => (render({ node }))) }
    </List>
}

export default treeListFactory
