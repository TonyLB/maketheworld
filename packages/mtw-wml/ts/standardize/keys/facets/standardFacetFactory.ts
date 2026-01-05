//
// standardFacetFactory takes an incoming argument that can apply to any of the StandardFacet classes,
// finds the correct constructor, and creates the sub-typed class
//
// This is in a separate file from facetFactory.ts to avoid circular dependencies:
// - facetFactory.ts exports facetClassFactory
// - position.ts/mark.ts/exit.ts import facetClassFactory from facetFactory.ts
// - This file imports the concrete facet classes from position.ts/mark.ts/exit.ts
// - No circular dependency!

import { GenericTree } from "@tonylb/mtw-base/ts/genericTree";
import { SchemaTag } from "@tonylb/mtw-base/ts/schema";
import { isSchemaRoom, isSchemaExit } from "@tonylb/mtw-base/ts/schema/components";
import { isSchemaMark } from "@tonylb/mtw-base/ts/schema/worldState";
import { StandardFacetData, isStandardFacetData, isPositionPayload, isMarkFacetPayload, isExitPayload } from "./dataTypes/facet";
import { treeNodeTypeguard } from "@tonylb/mtw-base/ts/genericTree";
import { isSchemaTreeNode } from "../../../schema";
import { StandardPositionFacet } from "./position";
import { StandardMarkFacet } from "./mark";
import { StandardExitFacet } from "./exit";

/**
 * standardFacetFactory: Dispatcher function that creates the appropriate concrete facet class instance
 * 
 * Takes either JSON data (StandardFacetData) or a schema tree (GenericTree<SchemaTag>) and returns
 * the appropriate concrete facet class instance (StandardPositionFacet, StandardMarkFacet, or StandardExitFacet).
 * 
 * @param arg - Either StandardFacetData (JSON format) or GenericTree<SchemaTag> (WML schema tree)
 * @returns The appropriate concrete facet class instance, or undefined if type cannot be determined
 * 
 * @example
 * // Create from JSON data
 * const facetData: StandardFacetData<PositionPayload> = {
 *   reference: { key: 'room1', tag: 'Room', ref: 1 },
 *   payload: { type: 'PositionFacet', x: 10, y: 20 }
 * };
 * const facet = standardFacetFactory(facetData); // Returns StandardPositionFacet
 * 
 * @example
 * // Create from schema tree
 * const schema = treeFromWML('<Room key=(room1)><Position x={10} y={20} /></Room>');
 * const facet = standardFacetFactory(schema); // Returns StandardPositionFacet
 */
export const standardFacetFactory = (arg: StandardFacetData | GenericTree<SchemaTag>): InstanceType<typeof StandardPositionFacet> | InstanceType<typeof StandardMarkFacet> | InstanceType<typeof StandardExitFacet> | undefined => {
    // For JSON data (StandardFacetData), check payload type using payload type guards
    // GenericTree is an array, so check if it's NOT an array first
    if (!Array.isArray(arg) && isStandardFacetData(arg)) {
        if (isPositionPayload(arg.payload)) {
            return new StandardPositionFacet(arg);
        }
        if (isMarkFacetPayload(arg.payload)) {
            return new StandardMarkFacet(arg);
        }
        if (isExitPayload(arg.payload)) {
            return new StandardExitFacet(arg);
        }
    }
    
    // For schema trees (GenericTree<SchemaTag>), check root tag using schema type guards
    if (Array.isArray(arg) && arg.length > 0 && arg.every(isSchemaTreeNode)) {
        const schema = arg as GenericTree<SchemaTag>;
        if (treeNodeTypeguard(isSchemaRoom)(schema[0])) {
            return new StandardPositionFacet(schema);
        }
        if (treeNodeTypeguard(isSchemaMark)(schema[0])) {
            return new StandardMarkFacet(schema);
        }
        if (treeNodeTypeguard(isSchemaExit)(schema[0])) {
            return new StandardExitFacet(schema);
        }
    }
    
    return undefined;
};
