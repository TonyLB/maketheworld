import { Schema, schemaToWML } from "../../../schema";
import { deIndentWML } from "../../../schema/utils";
import StandardComponentAbstract from "../abstract";

export const mergeTest = <T extends StandardComponentAbstract>(base: string, standardClass: new (...args) => T, incoming: string): string => {
    const baseSchema = new Schema()
    baseSchema.loadWML(deIndentWML(base))
    const baseStandard = new standardClass(baseSchema.schema[0])
    const testSchema = new Schema()
    testSchema.loadWML(deIndentWML(incoming))
    const testStandard = new standardClass(testSchema.schema[0])
    const mergedStandard = baseStandard.merge(testStandard)
    return schemaToWML([mergedStandard.schema])
}
