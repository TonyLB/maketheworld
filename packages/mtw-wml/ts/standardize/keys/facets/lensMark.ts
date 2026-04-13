/**
 * Lens Mark facet: Mark reference + optional Default literal.
 * Used on Lens only; payload holds the default value for the Mark when viewed through this Lens.
 */

import { GenericTree, GenericTreeNode, treeNodeTypeguard } from "@tonylb/mtw-base/ts/genericTree";
import { SchemaTag } from "@tonylb/mtw-base/ts/schema";
import { StandardReference } from "../reference";
import type { LensMarkFacetPayloadType, StandardFacetData } from "./dataTypes/facet";
import { isStandardFacetData } from "./dataTypes/facet";
import { isSchemaMark } from "@tonylb/mtw-base/ts/schema/worldState";
import { isSchemaRemove } from "@tonylb/mtw-base/ts/schema/edit";
import { facetClassFactory } from "./facetFactory";
import { isSchemaTreeNode, treeFromWML } from "../../../schema";
import { StandardLiteral } from "../../literal";
import { StandardKey } from "../key";
import { StandardComponent } from "../../components/baseClasses";
import { excludeUndefined } from "@tonylb/mtw-base/ts/utils/lists";
import { splitTaggedChildren } from "../../../schema/utils";
import type { StandardizeFromSchemaContext } from "../../wmlStandardizeMode";

/** Payload class: holds optional StandardLiteral for default. */
export class LensMarkFacetPayload {
    _default?: StandardLiteral;

    get default() {
        return this._default;
    }

    constructor(arg: LensMarkFacetPayload | LensMarkFacetPayloadType | Record<string, unknown>) {
        if (arg instanceof LensMarkFacetPayload) {
            this._default = arg._default;
            return;
        }
        const obj = arg as LensMarkFacetPayloadType;
        this._default = obj.default !== undefined
            ? new StandardLiteral(obj.default, { tag: "Default" })
            : undefined;
    }

    clone(): LensMarkFacetPayload {
        return new LensMarkFacetPayload(this.toJSON());
    }

    toJSON(): LensMarkFacetPayloadType {
        return {
            ...(this._default ? { default: this._default.toJSON() } : {}),
        };
    }

    merge(incoming: LensMarkFacetPayload): LensMarkFacetPayload | undefined {
        // When both have default, incoming wins (last-write-wins for default values)
        const merged = (this._default && incoming._default)
            ? incoming._default
            : this._default ?? incoming._default;
        const out = new LensMarkFacetPayload({});
        out._default = merged instanceof StandardLiteral ? merged : (merged !== undefined ? new StandardLiteral(merged, { tag: "Default" }) : undefined);
        return out;
    }

    diff(incoming: LensMarkFacetPayload | undefined): LensMarkFacetPayload | undefined {
        if (incoming) {
            let diffed: StandardLiteral | undefined;
            if (this._default && incoming._default) {
                diffed = this._default.diff(incoming._default);
            } else if (this._default && !incoming._default) {
                diffed = this._default.diff(undefined);
            } else if (!this._default && incoming._default) {
                diffed = incoming._default;
            } else {
                return undefined;
            }
            if (diffed === undefined) return undefined;
            const out = new LensMarkFacetPayload({});
            out._default = diffed;
            return out;
        }
        return this.invert();
    }

    invert(): LensMarkFacetPayload {
        const out = new LensMarkFacetPayload({});
        out._default = this._default?.invert();
        return out;
    }

    fromSchema(node: GenericTree<SchemaTag>, _reference: StandardReference, _context?: StandardizeFromSchemaContext): LensMarkFacetPayloadType {
        if (node.length === 0) throw new Error("Invalid schema: empty node");
        const first = node[0];
        if (!treeNodeTypeguard(isSchemaMark)(first)) throw new Error("Invalid schema: expected Mark node");
        const children: GenericTree<SchemaTag> = Array.isArray(first.children) ? first.children : [];
        const { matched: defaultNodes } = splitTaggedChildren({ children, tag: "Default" });
        const result: LensMarkFacetPayloadType = {};
        if (defaultNodes.length > 0) {
            const literal = new StandardLiteral(defaultNodes, { tag: "Default" });
            result.default = literal.toJSON();
        }
        return result;
    }

    renderFacet(
        reference: StandardReference,
        _payload: LensMarkFacetPayloadType,
        referenceRender?: GenericTreeNode<SchemaTag>,
        lookup?: (key: string | StandardKey) => StandardComponent | undefined
    ): { newNode?: GenericTreeNode<SchemaTag>; aggregatedNode?: GenericTreeNode<SchemaTag> } {
        if (referenceRender && treeNodeTypeguard(isSchemaRemove)(referenceRender)) {
            return { aggregatedNode: referenceRender };
        }
        const defaultChildren = this._default?.nestedSchema({ tag: "Default" }) ?? [];
        if (referenceRender && treeNodeTypeguard(isSchemaMark)(referenceRender)) {
            const existingChildren = referenceRender.children ?? [];
            const { remainder: withoutDefault } = splitTaggedChildren({ children: existingChildren, tag: "Default" });
            const children = [...withoutDefault, ...defaultChildren].filter(excludeUndefined);
            return {
                aggregatedNode: { ...referenceRender, children },
            };
        }
        const children: GenericTree<SchemaTag> = [...defaultChildren].filter(excludeUndefined);
        const lookedUpReference = lookup ? (lookup(reference.standardKey)?.reference ?? reference) : reference;
        const formattedRef = lookedUpReference.toFormat("key").withRef(reference.ref);
        const refSchema = formattedRef.schema;
        if (refSchema.length === 0) throw new Error("Invalid reference schema: empty");
        const aggregatedNode: GenericTreeNode<SchemaTag> = {
            data: { ...refSchema[0].data },
            children,
        };
        return { aggregatedNode };
    }
}

function createLensMarkFacetPayload(arg: any): LensMarkFacetPayload {
    if (arg instanceof LensMarkFacetPayload) return new LensMarkFacetPayload(arg);
    if (typeof arg === "object" && arg !== null && !Array.isArray(arg) && !("reference" in arg)) {
        const keys = Object.keys(arg);
        if (keys.every((k) => k === "default" || k === "tag")) {
            return new LensMarkFacetPayload(arg as LensMarkFacetPayloadType);
        }
    }
    if (typeof arg === "string" && (arg.includes("<") || arg.includes("["))) {
        const schema = treeFromWML(arg);
        if (schema.length === 0) throw new Error("Invalid WML string in LensMarkFacetPayload: empty schema");
        arg = schema;
    }
    if (Array.isArray(arg) && arg.length > 0 && arg.every(isSchemaTreeNode)) {
        const schema = arg as GenericTree<SchemaTag>;
        const first = schema[0];
        if (!treeNodeTypeguard(isSchemaMark)(first)) throw new Error("Expected Mark node");
        const payloadData = new LensMarkFacetPayload({}).fromSchema(schema, new StandardReference(schema));
        return new LensMarkFacetPayload(payloadData);
    }
    if (typeof arg === "object" && arg !== null && "reference" in arg && "payload" in arg && isStandardFacetData(arg)) {
        return new LensMarkFacetPayload((arg as StandardFacetData<LensMarkFacetPayloadType>).payload);
    }
    throw new Error("Invalid argument to createLensMarkFacetPayload");
}

export class StandardLensMarkFacet extends facetClassFactory(
    LensMarkFacetPayload,
    createLensMarkFacetPayload,
    "LensMarkFacet"
) {
    constructor(
        props:
            | StandardFacetData<LensMarkFacetPayloadType>
            | StandardLensMarkFacet
            | GenericTree<SchemaTag>
            | string
    ) {
        super(props);
    }

    override _wrap(instance: any): this {
        return new StandardLensMarkFacet(instance as StandardLensMarkFacet) as this;
    }
}

import { facetListClassFactory } from "./facetListFactory";

export class LensMarkFacetList extends facetListClassFactory(StandardLensMarkFacet, "LensMarkFacetList") {
    constructor(arg: any) {
        super(arg);
    }

    override _wrap(instance: any): this {
        return new LensMarkFacetList(instance as LensMarkFacetList) as this;
    }

    /** Array of Mark references (for compatibility with code expecting reference list semantics). */
    get payload() {
        return this.items.map((f) => f.reference);
    }
}
