import { GenericTreeNode } from "@tonylb/mtw-base/ts/genericTree";
import { RenderTreeNode } from "@tonylb/mtw-base/ts/renderTree";
import { SchemaOutputTag } from "@tonylb/mtw-base/ts/schema";
import { StandardKey } from "../components/reference";
import { ReferenceFormat } from "../components/utils/references";

export interface StandardRenderElement {
    plainString: string;
    toJSON(): GenericTreeNode<SchemaOutputTag>;
    toNDJSON(): RenderTreeNode;
    clone(): StandardRenderElement;
}

export class StandardRenderAbstract implements StandardRenderElement {
    get plainString(): string { return '' }
    toJSON(): GenericTreeNode<SchemaOutputTag> { return { data: { tag: 'String' as const, value: '' }, children: [] } }
    toNDJSON(): RenderTreeNode { return '' }
    clone(): StandardRenderElement { return new StandardRenderAbstract() }
    remapReferences(props: { mapping: StandardKey[]; mapTo: ReferenceFormat }): this {
        const returnValue = this.clone() as this
        return returnValue
    }
}