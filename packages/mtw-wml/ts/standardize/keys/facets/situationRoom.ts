/**
 * Situation room facet: Situation reference + optional DisplayName/Summary/Description.
 * Used on Room only (Phase 2); payload shape is Room-specific.
 */

import { GenericTree, GenericTreeNode, treeNodeTypeguard } from "@tonylb/mtw-base/ts/genericTree";
import { SchemaTag } from "@tonylb/mtw-base/ts/schema";
import { StandardReference } from "../reference";
import type { StandardFacetData } from "./dataTypes/facet";
import { isStandardFacetData } from "./dataTypes/facet";
import { isSchemaSituation } from "@tonylb/mtw-base/ts/schema/components";
import { isSchemaRemove } from "@tonylb/mtw-base/ts/schema/edit";
import { isSchemaSummary, isSchemaDescription } from "@tonylb/mtw-base/ts/schema/example";
import { facetClassFactory } from "./facetFactory";
import { isSchemaTreeNode, treeFromWML } from "../../../schema";
import { StandardLiteral } from "../../literal";
import { StandardRender } from "../../render";
import { processWithConsumers, StandardizeConsumerRender, StandardizeConsumerStandardLiteral } from "../../components/fromSchemaPipeline";
import { StandardKey } from "../key";
import { StandardComponent } from "../../components/baseClasses";
import { RenderTree } from "@tonylb/mtw-base/ts/renderTree";
import { StandardEditableData } from "@tonylb/mtw-base/ts/editable";
import { excludeUndefined } from "@tonylb/mtw-base/ts/utils/lists";
import type { StandardizeFromSchemaContext } from "../../wmlStandardizeMode";

/** Payload shape: optional displayName/summary/description.
 *  displayName is a StandardLiteral (string-based), while summary/description remain StandardRender (RenderTree-based).
 */
export type SituationRoomFacetPayloadType = {
    displayName?: StandardEditableData<string>;
    summary?: StandardEditableData<RenderTree>;
    description?: StandardEditableData<RenderTree>;
};

/** Type guard for SituationRoomFacetPayloadType (object with optional displayName/summary/description). */
export const isSituationRoomFacetPayload = (arg: any): arg is SituationRoomFacetPayloadType => {
    if (typeof arg !== "object" || arg === null) return false;
    const keys = Object.keys(arg);
    const allowed = ["displayName", "summary", "description"];
    return keys.every((k) => allowed.includes(k));
};

/** Payload class: holds optional StandardLiteral for displayName, and StandardRender for summary/description. */
export class SituationRoomFacetPayload {
    _displayName?: StandardLiteral;
    _summary?: StandardRender;
    _description?: StandardRender;

    constructor(arg: SituationRoomFacetPayload | SituationRoomFacetPayloadType | Record<string, unknown>) {
        if (arg instanceof SituationRoomFacetPayload) {
            this._displayName = arg._displayName;
            this._summary = arg._summary;
            this._description = arg._description;
            return;
        }
        const obj = arg as SituationRoomFacetPayloadType;
        this._displayName = obj.displayName !== undefined ? new StandardLiteral(obj.displayName, { tag: "DisplayName" }) : undefined;
        this._summary = obj.summary !== undefined ? new StandardRender(obj.summary) : undefined;
        this._description = obj.description !== undefined ? new StandardRender(obj.description) : undefined;
    }

    clone(): SituationRoomFacetPayload {
        return new SituationRoomFacetPayload(this.toJSON());
    }

    /** Returns true if all displayName, summary, and description are absent or empty. */
    static isEmpty(payload: SituationRoomFacetPayload): boolean {
        const emptyLiteral = (l?: StandardLiteral) => !l || !String((l as any).plainString ?? (l as any)._payload?.plain?.data ?? "").trim();
        const emptyRender = (r?: StandardRender) => !r || !String(r.plainString ?? "").trim();
        return (
            emptyLiteral(payload._displayName) &&
            emptyRender(payload._summary) &&
            emptyRender(payload._description)
        );
    }

    toJSON(): SituationRoomFacetPayloadType {
        return {
            ...(this._displayName ? { displayName: this._displayName.toJSON() } : {}),
            ...(this._summary ? { summary: this._summary.toJSON() } : {}),
            ...(this._description ? { description: this._description.toJSON() } : {}),
        };
    }

    merge(incoming: SituationRoomFacetPayload): SituationRoomFacetPayload | undefined {
        const displayName = (this._displayName && incoming._displayName)
            ? this._displayName.merge(incoming._displayName)
            : this._displayName ?? incoming._displayName;
        const summary = (this._summary && incoming._summary)
            ? this._summary.merge(incoming._summary)
            : this._summary ?? incoming._summary;
        const description = (this._description && incoming._description)
            ? this._description.merge(incoming._description)
            : this._description ?? incoming._description;
        if (displayName === undefined && summary === undefined && description === undefined) return undefined;
        const out = new SituationRoomFacetPayload({});
        out._displayName = displayName ?? undefined;
        out._summary = summary ?? undefined;
        out._description = description ?? undefined;
        return out;
    }

    diff(incoming: SituationRoomFacetPayload | undefined): SituationRoomFacetPayload | undefined {
        if (incoming) {
            const displayName = this._displayName?.diff(incoming._displayName);
            const summary = this._summary?.diff(incoming._summary);
            const description = this._description?.diff(incoming._description);
            if (displayName === undefined && summary === undefined && description === undefined) return undefined;
            const out = new SituationRoomFacetPayload({});
            out._displayName = displayName ?? undefined;
            out._summary = summary ?? undefined;
            out._description = description ?? undefined;
            return out;
        }
        return this.invert();
    }

    invert(): SituationRoomFacetPayload {
        const out = new SituationRoomFacetPayload({});
        out._displayName = this._displayName?.invert();
        out._summary = this._summary?.invert();
        out._description = this._description?.invert();
        return out;
    }

    fromSchema(node: GenericTree<SchemaTag>, _reference: StandardReference, _schemaContext?: StandardizeFromSchemaContext): SituationRoomFacetPayloadType {
        if (node.length === 0) throw new Error("Invalid schema: empty node");
        const first = node[0];
        if (!treeNodeTypeguard(isSchemaSituation)(first)) throw new Error("Invalid schema: expected Situation node");
        const children: GenericTree<SchemaTag> = Array.isArray(first.children) ? first.children : [];
        const result: SituationRoomFacetPayloadType = {};
        const context = { result };
        const consumers = [
            new StandardizeConsumerStandardLiteral<typeof context>(context, {
                tag: "DisplayName",
                update(literal) {
                    if (literal) this.result.displayName = literal.toJSON();
                },
            }),
            new StandardizeConsumerRender(context, {
                tag: "Summary",
                nodeTypeGuard: isSchemaSummary,
                errorMessage: "Schema mismatch",
                update(render) {
                    if (render) this.result.summary = render.toJSON();
                },
            }),
            new StandardizeConsumerRender(context, {
                tag: "Description",
                nodeTypeGuard: isSchemaDescription,
                errorMessage: "Schema mismatch",
                update(render) {
                    if (render) this.result.description = render.toJSON();
                },
            }),
        ];
        processWithConsumers(context, consumers, children, { allowUnconsumed: true });
        return result;
    }

    renderFacet(
        reference: StandardReference,
        _payload: SituationRoomFacetPayloadType,
        referenceRender?: GenericTreeNode<SchemaTag>,
        lookup?: (key: string | StandardKey) => StandardComponent | undefined
    ): { newNode?: GenericTreeNode<SchemaTag>; aggregatedNode?: GenericTreeNode<SchemaTag> } {
        if (referenceRender && treeNodeTypeguard(isSchemaRemove)(referenceRender)) {
            return { aggregatedNode: referenceRender };
        }
        const children: GenericTree<SchemaTag> = [
            ...(this._displayName?.nestedSchema({ tag: "DisplayName" }) ?? []),
            ...(this._summary?.nestedSchema({ tag: "Summary" }) ?? []),
            ...(this._description?.nestedSchema({ tag: "Description" }) ?? []),
        ].filter(excludeUndefined);
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

function createSituationRoomFacetPayload(arg: any): SituationRoomFacetPayload {
    if (arg instanceof SituationRoomFacetPayload) return new SituationRoomFacetPayload(arg);
    if (isSituationRoomFacetPayload(arg)) return new SituationRoomFacetPayload(arg);
    if (typeof arg === "string" && (arg.includes("<") || arg.includes("["))) {
        const schema = treeFromWML(arg);
        if (schema.length === 0) throw new Error("Invalid WML string in SituationRoomFacetPayload: empty schema");
        arg = schema;
    }
    if (Array.isArray(arg) && arg.length > 0 && arg.every(isSchemaTreeNode)) {
        const schema = arg as GenericTree<SchemaTag>;
        const first = schema[0];
        if (!treeNodeTypeguard(isSchemaSituation)(first)) throw new Error("Expected Situation node");
        const payloadData = new SituationRoomFacetPayload({}).fromSchema(schema, new StandardReference(schema));
        return new SituationRoomFacetPayload(payloadData);
    }
    if (typeof arg === "object" && arg !== null && "reference" in arg && "payload" in arg && isStandardFacetData(arg)) {
        return new SituationRoomFacetPayload((arg as StandardFacetData<SituationRoomFacetPayloadType>).payload);
    }
    throw new Error("Invalid argument to createSituationRoomFacetPayload");
}

export class StandardSituationRoomFacet extends facetClassFactory(
    SituationRoomFacetPayload,
    createSituationRoomFacetPayload,
    "SituationRoomFacet"
) {
    constructor(
        props:
            | StandardFacetData<SituationRoomFacetPayloadType>
            | StandardSituationRoomFacet
            | GenericTree<SchemaTag>
            | string
    ) {
        super(props);
    }

    override _wrap(instance: any): this {
        return new StandardSituationRoomFacet(instance as StandardSituationRoomFacet) as this;
    }
}

import { facetListClassFactory } from "./facetListFactory";

export class SituationRoomFacetList extends facetListClassFactory(StandardSituationRoomFacet, "SituationRoomFacetList") {
    constructor(arg: any) {
        super(arg);
    }

    override _wrap(instance: any): this {
        return new SituationRoomFacetList(instance as SituationRoomFacetList) as this;
    }
}
