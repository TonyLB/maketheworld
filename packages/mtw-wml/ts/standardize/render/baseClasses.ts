import { GenericTreeNode } from "@tonylb/mtw-base/ts/genericTree";
import { SchemaOutputTag } from "@tonylb/mtw-base/ts/schema";

export type RenderTreeNode = string | {
    data: SchemaOutputTag;
    children: RenderTree;
}

export type RenderTree = RenderTreeNode[]

export interface StandardRenderElement {
    plainString: string;
    toJSON(): GenericTreeNode<SchemaOutputTag>;
    toNDJSON(): RenderTreeNode;
}

export class StandardRenderAbstract implements StandardRenderElement {
    get plainString() { return '' }
    toJSON(): GenericTreeNode<SchemaOutputTag> { return { data: { tag: 'String' as const, value: '' }, children: [] } }
    toNDJSON(): RenderTreeNode { return '' }
}