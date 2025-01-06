import { GenericTreeNode } from "@tonylb/mtw-base/ts/genericTree";
import { RenderTreeNode } from "@tonylb/mtw-base/ts/renderTree";
import { SchemaOutputTag } from "@tonylb/mtw-base/ts/schema";

export interface StandardRenderElement {
    plainString: string;
    toJSON(): GenericTreeNode<SchemaOutputTag>;
    toNDJSON(): RenderTreeNode;
}

export class StandardRenderAbstract implements StandardRenderElement {
    get plainString(): string { return '' }
    toJSON(): GenericTreeNode<SchemaOutputTag> { return { data: { tag: 'String' as const, value: '' }, children: [] } }
    toNDJSON(): RenderTreeNode { return '' }
}