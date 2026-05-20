/**
 * Situation prose facet: Situation reference + optional DisplayName/Summary/Description.
 * Shared by Room, Feature, and Knowledge (D2 prose triplet).
 */

import { GenericTree, GenericTreeNode, treeNodeTypeguard } from "@tonylb/mtw-base/ts/genericTree";
import { SchemaTag } from "@tonylb/mtw-base/ts/schema";
import { LookupMappings, StandardReference } from "../reference";
import type { StandardFacetData } from "./dataTypes/facet";
import { isStandardFacetData } from "./dataTypes/facet";
import { isSchemaSituation } from "@tonylb/mtw-base/ts/schema/components";
import { isSchemaRemove } from "@tonylb/mtw-base/ts/schema/edit";
import { isSchemaSummary, isSchemaDescription } from "@tonylb/mtw-base/ts/schema/prose";
import { facetClassFactory } from "./facetFactory";
import { isSchemaTreeNode, treeFromWML } from "../../../schema";
import { StandardLiteral } from "../../literal";
import { StandardRender } from "../../render";
import { processWithConsumers, StandardizeConsumerRender, StandardizeConsumerStandardLiteral } from "../../components/fromSchemaPipeline";
import { StandardKey } from "../key";
import { StandardComponent } from "../../components/baseClasses";
import { RenderTree, renderTreeToSchema, schemaToRenderTree } from "@tonylb/mtw-base/ts/renderTree";
import { StandardEditableData, extractFromEditableData } from "@tonylb/mtw-base/ts/editable";
import { excludeUndefined } from "@tonylb/mtw-base/ts/utils/lists";
import { TagMismatchError } from "@tonylb/mtw-base/ts/standardize";
import { transformNestedChildren } from "../../../schema/utils";
import type { StandardizeFromSchemaContext } from "../../wmlStandardizeMode";
import type { StandardComponentReferenceKey } from "../../components/baseClasses";
import linkReferenceKeys, { ReferenceFormat } from "../../components/utils/references";

/** Payload shape: optional displayName/summary/description.
 *  displayName is a StandardLiteral (string-based), while summary/description remain StandardRender (RenderTree-based).
 */
export type SituationProseFacetPayloadType = {
    displayName?: StandardEditableData<string>;
    summary?: StandardEditableData<RenderTree>;
    description?: StandardEditableData<RenderTree>;
};

/** Type guard for SituationProseFacetPayloadType (object with optional displayName/summary/description). */
export const isSituationProseFacetPayload = (arg: any): arg is SituationProseFacetPayloadType => {
    if (typeof arg !== "object" || arg === null) return false;
    const keys = Object.keys(arg);
    const allowed = ["displayName", "summary", "description"];
    return keys.every((k) => allowed.includes(k));
};

/**
 * Parse DisplayName / Summary / Description children (same pipeline as inside a Situation facet).
 * Used by SituationProseFacetPayload.fromSchema and Room ephemera `<Render>`.
 */
export function parseProseTripletChildren(
    children: GenericTree<SchemaTag>,
    options?: { allowUnconsumed?: boolean }
): SituationProseFacetPayloadType {
    const result: SituationProseFacetPayloadType = {};
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
    processWithConsumers(context, consumers, children, { allowUnconsumed: options?.allowUnconsumed ?? false });
    return result;
}

/** Apply a schema-tree callback to summary/description render fields (for mapContents / key rename propagation). */
export const mapSituationProsePayloadContents = (
    payload: SituationProseFacetPayload,
    callback: (incoming: GenericTree<SchemaTag>) => GenericTree<SchemaTag>
): SituationProseFacetPayload => {
    const returnValue = payload.clone();
    if (returnValue._summary) {
        returnValue._summary = returnValue._summary.mapContents((renderTree) =>
            schemaToRenderTree(callback(renderTreeToSchema(renderTree)))
        );
    }
    if (returnValue._description) {
        returnValue._description = returnValue._description.mapContents((renderTree) =>
            schemaToRenderTree(callback(renderTreeToSchema(renderTree)))
        );
    }
    return returnValue;
};

/** Payload class: holds optional StandardLiteral for displayName, and StandardRender for summary/description. */
export class SituationProseFacetPayload {
    _displayName?: StandardLiteral;
    _summary?: StandardRender;
    _description?: StandardRender;

    constructor(arg: SituationProseFacetPayload | SituationProseFacetPayloadType | Record<string, unknown>) {
        if (arg instanceof SituationProseFacetPayload) {
            this._displayName = arg._displayName;
            this._summary = arg._summary;
            this._description = arg._description;
            return;
        }
        const obj = arg as SituationProseFacetPayloadType;
        this._displayName = obj.displayName !== undefined ? new StandardLiteral(obj.displayName, { tag: "DisplayName" }) : undefined;
        this._summary = obj.summary !== undefined ? new StandardRender(obj.summary) : undefined;
        this._description = obj.description !== undefined ? new StandardRender(obj.description) : undefined;
    }

    clone(): SituationProseFacetPayload {
        return new SituationProseFacetPayload(this.toJSON());
    }

    /** Returns true if all displayName, summary, and description are absent or empty. */
    static isEmpty(payload: SituationProseFacetPayload): boolean {
        const emptyLiteral = (l?: StandardLiteral) => !l || !String((l as any).plainString ?? (l as any)._payload?.plain?.data ?? "").trim();
        const emptyRender = (r?: StandardRender) => !r || !String(r.plainString ?? "").trim();
        return (
            emptyLiteral(payload._displayName) &&
            emptyRender(payload._summary) &&
            emptyRender(payload._description)
        );
    }

    /** True when DisplayName has non-empty visible text (for ephemera `<Render>` validation). */
    hasNonEmptyDisplayName(): boolean {
        const emptyLiteral = (l?: StandardLiteral) => !l || !String((l as any).plainString ?? (l as any)._payload?.plain?.data ?? "").trim();
        return !emptyLiteral(this._displayName);
    }

    /**
     * Link targets inside Summary / Description render trees (same extraction as Example prose fields).
     * DisplayName is literal-only and does not contribute links.
     */
    static linkReferenceKeysFromSummaryDescription(
        mapping: StandardReference[],
        summary?: StandardRender,
        description?: StandardRender
    ): StandardComponentReferenceKey[] {
        const editableData = [summary?.toJSON(), description?.toJSON()].filter(excludeUndefined) as StandardEditableData<RenderTree>[];
        const renderTrees = editableData.flatMap(extractFromEditableData<RenderTree>);
        return linkReferenceKeys(mapping)(renderTreeToSchema(renderTrees.flat(1))).map((reference) => ({
            referenceType: "Link" as const,
            reference,
        }));
    }

    referencedLinkKeys(mapping: StandardReference[]): StandardComponentReferenceKey[] {
        return SituationProseFacetPayload.linkReferenceKeysFromSummaryDescription(mapping, this._summary, this._description);
    }

    remapReferences(props: { mappings: StandardReference[]; mapTo: ReferenceFormat }): SituationProseFacetPayload {
        const returnValue = this.clone();
        if (returnValue._summary) {
            returnValue._summary = returnValue._summary.remapReferences({ mapping: props.mappings, mapTo: props.mapTo });
        }
        if (returnValue._description) {
            returnValue._description = returnValue._description.remapReferences({ mapping: props.mappings, mapTo: props.mapTo });
        }
        return returnValue;
    }

    /**
     * Children for `<Render>` WML or inner prose under Situation (DisplayName, Summary, Description).
     * PROVISIONAL: Only emits nodes for present fields; strict `Render.finalize` in
     * `packages/mtw-wml/ts/schema/converters/components.ts` can still require a full triplet and
     * non-empty DisplayName on parse. Ephemera workarounds (for example invisible title in
     * `lambda/ephemera/dataSource/perception/orchestrate.ts`) exist until that contract is loosened.
     */
    toProseTripletChildren(options?: { mappings?: StandardReference[] }): GenericTree<SchemaTag> {
        const mappings = options?.mappings;
        return [
            ...(this._displayName?.nestedSchema({ tag: "DisplayName" }) ?? []),
            ...(this._summary?.nestedSchema({ tag: "Summary", mappings }) ?? []),
            ...(this._description?.nestedSchema({ tag: "Description", mappings }) ?? []),
        ].filter(excludeUndefined);
    }

    toJSON(): SituationProseFacetPayloadType {
        return {
            ...(this._displayName ? { displayName: this._displayName.toJSON() } : {}),
            ...(this._summary ? { summary: this._summary.toJSON() } : {}),
            ...(this._description ? { description: this._description.toJSON() } : {}),
        };
    }

    merge(incoming: SituationProseFacetPayload): SituationProseFacetPayload | undefined {
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
        const out = new SituationProseFacetPayload({});
        out._displayName = displayName ?? undefined;
        out._summary = summary ?? undefined;
        out._description = description ?? undefined;
        return out;
    }

    diff(incoming: SituationProseFacetPayload | undefined): SituationProseFacetPayload | undefined {
        if (incoming) {
            const displayName = this._displayName?.diff(incoming._displayName);
            const summary = this._summary?.diff(incoming._summary);
            const description = this._description?.diff(incoming._description);
            if (displayName === undefined && summary === undefined && description === undefined) return undefined;
            const out = new SituationProseFacetPayload({});
            out._displayName = displayName ?? undefined;
            out._summary = summary ?? undefined;
            out._description = description ?? undefined;
            return out;
        }
        return this.invert();
    }

    invert(): SituationProseFacetPayload {
        const out = new SituationProseFacetPayload({});
        out._displayName = this._displayName?.invert();
        out._summary = this._summary?.invert();
        out._description = this._description?.invert();
        return out;
    }

    fromSchema(node: GenericTree<SchemaTag>, _reference: StandardReference, _schemaContext?: StandardizeFromSchemaContext): SituationProseFacetPayloadType {
        if (node.length === 0) throw new Error("Invalid schema: empty node");
        const first = node[0];
        if (!treeNodeTypeguard(isSchemaSituation)(first)) throw new Error("Invalid schema: expected Situation node");
        const children: GenericTree<SchemaTag> = Array.isArray(first.children) ? first.children : [];
        return parseProseTripletChildren(children, { allowUnconsumed: true });
    }

    renderFacet(
        reference: StandardReference,
        _payload: SituationProseFacetPayloadType,
        referenceRender?: GenericTreeNode<SchemaTag>,
        lookup?: (key: string | StandardKey) => StandardComponent | undefined,
        mappings?: StandardReference[]
    ): { newNode?: GenericTreeNode<SchemaTag>; aggregatedNode?: GenericTreeNode<SchemaTag> } {
        if (referenceRender && treeNodeTypeguard(isSchemaRemove)(referenceRender)) {
            return { aggregatedNode: referenceRender };
        }

        const transformSituationChildren = transformNestedChildren({
            tag: "Situation",
            transform: () => this.toProseTripletChildren({ mappings }),
        });

        if (referenceRender) {
            try {
                return { aggregatedNode: transformSituationChildren(referenceRender) };
            } catch (error) {
                if (error instanceof TagMismatchError) {
                    throw new Error("Invalid referenceRender: expected Situation tag");
                }
                throw error;
            }
        }

        const lookedUpReference = lookup ? (lookup(reference.standardKey)?.reference ?? reference) : reference;
        const formattedRef = lookedUpReference.toFormat("key").withRef(reference.ref);
        const refSchema = formattedRef.schema;
        if (refSchema.length === 0) throw new Error("Invalid reference schema: empty");
        return { aggregatedNode: transformSituationChildren(refSchema[0]) };
    }
}

/** Ephemera wire: `<Render>` node from resolved prose payload (Room, Feature, Knowledge). */
export const renderPayloadToSchemaNode = (
    p: SituationProseFacetPayload,
    mappings?: StandardReference[]
): GenericTreeNode<SchemaTag> => ({
    data: { tag: 'Render' },
    children: p.toProseTripletChildren({ mappings }),
})

function createSituationProseFacetPayload(arg: any): SituationProseFacetPayload {
    if (arg instanceof SituationProseFacetPayload) return new SituationProseFacetPayload(arg);
    if (isSituationProseFacetPayload(arg)) return new SituationProseFacetPayload(arg);
    if (typeof arg === "string" && (arg.includes("<") || arg.includes("["))) {
        const schema = treeFromWML(arg);
        if (schema.length === 0) throw new Error("Invalid WML string in SituationProseFacetPayload: empty schema");
        arg = schema;
    }
    if (Array.isArray(arg) && arg.length > 0 && arg.every(isSchemaTreeNode)) {
        const schema = arg as GenericTree<SchemaTag>;
        const first = schema[0];
        if (!treeNodeTypeguard(isSchemaSituation)(first)) throw new Error("Expected Situation node");
        const payloadData = new SituationProseFacetPayload({}).fromSchema(schema, new StandardReference(schema));
        return new SituationProseFacetPayload(payloadData);
    }
    if (typeof arg === "object" && arg !== null && "reference" in arg && "payload" in arg && isStandardFacetData(arg)) {
        return new SituationProseFacetPayload((arg as StandardFacetData<SituationProseFacetPayloadType>).payload);
    }
    throw new Error("Invalid argument to createSituationProseFacetPayload");
}

export class StandardSituationProseFacet extends facetClassFactory(
    SituationProseFacetPayload,
    createSituationProseFacetPayload,
    "SituationProseFacet",
    undefined,
    {
        missingPayloadDefault: () => ({})
    }
) {
    constructor(
        props:
            | StandardFacetData<SituationProseFacetPayloadType>
            | StandardSituationProseFacet
            | GenericTree<SchemaTag>
            | string
    ) {
        super(props);
    }

    remapReferences(props: { mappings: StandardReference[]; mapTo: ReferenceFormat }): this {
        const formattedReference = this._reference.lookup(props.mappings).toFormat(props.mapTo);
        const remappedPayload = this.payload.remapReferences(props);
        const result = new StandardSituationProseFacet({
            reference: formattedReference.toJSON(),
            payload: remappedPayload.toJSON(),
        });
        return this._wrap(result);
    }

    override _wrap(instance: any): this {
        return new StandardSituationProseFacet(instance as StandardSituationProseFacet) as this;
    }

    /**
     * @param mappings - Optional asset mappings for display-time link remapping in Summary/Description.
     */
    override renderFacet(
        referenceRender?: GenericTreeNode<SchemaTag>,
        lookup?: (key: string | StandardKey) => StandardComponent | undefined,
        mappings?: StandardReference[]
    ): { newNode?: GenericTreeNode<SchemaTag>; aggregatedNode?: GenericTreeNode<SchemaTag> } {
        const refIsNegative = this._reference.ref < 0;
        const invertedPayload = refIsNegative ? this.payload.invert() : null;
        const payloadData = refIsNegative
            ? invertedPayload!.toJSON()
            : this.payload.toJSON();
        const payloadInstance = refIsNegative ? invertedPayload! : this.payload;
        return payloadInstance.renderFacet(this._reference, payloadData, referenceRender, lookup, mappings);
    }
}

import { facetListClassFactory } from "./facetListFactory";

export class SituationProseFacetList extends facetListClassFactory(StandardSituationProseFacet, "SituationProseFacetList") {
    constructor(arg: any) {
        super(arg);
    }

    override clone(): SituationProseFacetList {
        return super.clone() as SituationProseFacetList;
    }

    override lookup(mappings: LookupMappings): SituationProseFacetList {
        return super.lookup(mappings) as SituationProseFacetList;
    }

    override merge(incoming: SituationProseFacetList): SituationProseFacetList | undefined {
        return super.merge(incoming) as SituationProseFacetList | undefined;
    }

    override invert(): SituationProseFacetList {
        return super.invert() as SituationProseFacetList;
    }

    remapReferences(props: { mappings: StandardReference[]; mapTo: ReferenceFormat }): SituationProseFacetList {
        const remappedItems = this._items.map((item) => item.remapReferences(props));
        return this._wrap(new SituationProseFacetList(remappedItems));
    }

    override _wrap(instance: any): this {
        return new SituationProseFacetList(instance as SituationProseFacetList) as this;
    }
}

/** @deprecated Use SituationProseFacetPayloadType */
export type SituationRoomFacetPayloadType = SituationProseFacetPayloadType;

/** @deprecated Use isSituationProseFacetPayload */
export const isSituationRoomFacetPayload = isSituationProseFacetPayload;

/** @deprecated Use SituationProseFacetPayload */
export const SituationRoomFacetPayload = SituationProseFacetPayload;

/** @deprecated Use StandardSituationProseFacet */
export const StandardSituationRoomFacet = StandardSituationProseFacet;

/** @deprecated Use SituationProseFacetList */
export const SituationRoomFacetList = SituationProseFacetList;
