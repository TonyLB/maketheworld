import { RenderTreeNode } from "@tonylb/mtw-base/ts/renderTree";
import StandardReference from "../keys/reference";
import { ReferenceFormat } from "../components/utils/references";

export interface StandardRenderElement {
    plainString: string;
    toJSON(): RenderTreeNode;
    toNDJSON(): RenderTreeNode;
    clone(): StandardRenderElement;
}

export class StandardRenderAbstract implements StandardRenderElement {
    get plainString(): string { return '' }
    toJSON(): RenderTreeNode { return '' }
    toNDJSON(): RenderTreeNode { return '' }
    clone(): StandardRenderElement { return new StandardRenderAbstract() }
    remapReferences(props: { mapping: StandardReference[]; mapTo: ReferenceFormat }): this {
        const returnValue = this.clone() as this
        return returnValue
    }
}