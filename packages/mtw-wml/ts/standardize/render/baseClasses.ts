import { SchemaOutputTag } from "../../schema/baseClasses";
import { GenericTreeNode } from "../../tree/baseClasses";

type RenderTreeNode = string | {
    data: SchemaOutputTag;
    children: RenderTreeNode;
}

type RenderTree = RenderTreeNode[]

export interface StandardRenderElement {
    plainString: string;
    toJSON(): GenericTreeNode<SchemaOutputTag>;
    toNDJSON(): RenderTree;
}