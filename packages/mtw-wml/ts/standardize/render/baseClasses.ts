import { SchemaOutputTag } from "../../schema/baseClasses";
import { GenericTreeNode } from "../../tree/baseClasses";

export type RenderTreeNode = string | {
    data: SchemaOutputTag;
    children: RenderTreeNode;
}

export type RenderTree = RenderTreeNode[]

export interface StandardRenderElement {
    plainString: string;
    toJSON(): GenericTreeNode<SchemaOutputTag>;
    toNDJSON(): RenderTreeNode;
}