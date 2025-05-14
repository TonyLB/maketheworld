import { Schema, schemaToWML } from "../../../schema";
import { deIndentWML } from "../../../schema/utils";

export const mergeTest = <T extends { toJSON: () => any, merge: (args: any) => any }>(base: string, standardClass: new (...args) => T, incoming: string): string => {
    const baseSchema = new Schema()
    baseSchema.loadWML(deIndentWML(base))
    const baseStandard = new standardClass(baseSchema.schema[0])
    console.log(`baseStandard: ${JSON.stringify(baseStandard.toJSON(), null, 4)}`)
    const testSchema = new Schema()
    testSchema.loadWML(deIndentWML(incoming))
    const testStandard = new standardClass(testSchema.schema[0])
    const mergedStandard = baseStandard.merge(testStandard)
    if (!mergedStandard) {
        throw new Error('Failure in mergeTest utility')
    }
    console.log(`mergedStandard: ${JSON.stringify(mergedStandard.toJSON(), null, 4)}`)
    return schemaToWML([mergedStandard.schema])
}
