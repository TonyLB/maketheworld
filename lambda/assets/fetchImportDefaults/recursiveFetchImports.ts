import { AssetKey, splitType } from "@tonylb/mtw-utilities/dist/types";
import { isNormalImport, NormalImport } from "@tonylb/mtw-wml/dist/normalize/baseClasses";
import { isSchemaExit } from "@tonylb/mtw-wml/dist/schema/baseClasses";
import { isSchemaRoomContents } from "@tonylb/mtw-wml/dist/schema/baseClasses";
import { isSchemaRoom } from "@tonylb/mtw-wml/dist/schema/baseClasses";
import { SchemaTag } from "@tonylb/mtw-wml/dist/schema/baseClasses";
import internalCache from "../internalCache";
import { objectMap } from "../lib/objects";
import normalSubset from "./normalSubset"

//
// The translateToFinal class accepts:
//    (a) a current set of occupied keys, and
//    (b) a localToFinal mapping
// and can:
//    (a) Translate SchemaTags to their final key encoding
//    (b) Create new, non-colliding, stub-keys from local keys
//    (c) Push a new mapping that multiplies the existing localToFinal mapping by an importMapping
//    (d) Pop a mapping
//
type NestedTranslateLocalToFinal = Record<string, string>
export class NestedTranslateImportToFinal extends Object {
    localToFinal: NestedTranslateLocalToFinal
    localKeys: string[]
    localStubKeys: string[]
    occupiedFinalKeys: string[]
    constructor(localKeys: string[], localStubKeys: string[], occupiedFinalKeys?: string[], localToFinal?: NestedTranslateLocalToFinal) {
        super()
        if (occupiedFinalKeys) {
            this.occupiedFinalKeys = occupiedFinalKeys
        }
        else {
            this.occupiedFinalKeys = [...localKeys, ...localStubKeys]
        }
        this.localKeys = localKeys
        this.localStubKeys = localStubKeys
        if (localToFinal) {
            this.localToFinal = localToFinal
        }
        else {
            this.localToFinal = [...localKeys, ...localStubKeys].reduce<Record<string, string>>((previous, key) => ({ ...previous, [key]: key }), {})
        }
    }
    nestMapping(keys: string[], stubKeys: string[], mapping: NormalImport["mapping"]): NestedTranslateImportToFinal {
        const localToImport = Object.assign({}, ...Object.entries(mapping).map(([from, { key }]) => ({ [from]: key }))) as Record<string, string>
        const keyMapping = keys
            .reduce<NestedTranslateLocalToFinal>((previous, key) => {
                if (key in localToImport) {
                    return {
                        ...previous,
                        [localToImport[key]]: this.localToFinal[key]
                    }
                }
                return previous
            }, {})
        const stubKeyMapping = stubKeys
            .reduce<NestedTranslateLocalToFinal>((previous, key) => {
                if (key in localToImport) {
                    return {
                        ...previous,
                        [localToImport[key]]: this.localToFinal[key]
                    }
                }
                return previous
            }, {})
        const newTranslate = new NestedTranslateImportToFinal(Object.keys(keyMapping), Object.keys(stubKeyMapping), this.occupiedFinalKeys, { ...stubKeyMapping, ...keyMapping })
        return newTranslate
    }
    translateKey(key: string): string {
        if (key in this.localToFinal) {
            return this.localToFinal[key]
        }
        //
        // TODO: Create collision-detection and avoidance
        //
        return key
    }
    addTranslation(key: string, final: string): void {
        this.localToFinal[key] = final
    }
    translateSchemaTag(tag: SchemaTag): SchemaTag {
        if (isSchemaExit(tag)) {
            return {
                ...tag,
                key: `${this.translateKey(tag.from)}#${this.translateKey(tag.to)}`,
                to: this.translateKey(tag.to),
                from: this.translateKey(tag.from)
            }
        }
        if (isSchemaRoom(tag)) {
            return {
                ...tag,
                key: this.translateKey(tag.key),
                contents: tag.contents.map((value) => (this.translateSchemaTag(value))).filter(isSchemaRoomContents)
            }
        }
        return tag
    }
}

type RecursiveFetchImportArgument = {
    assetId: `ASSET#${string}`;
    translate: NestedTranslateImportToFinal;
    prefixStubKeys?: boolean;
}

export const recursiveFetchImports = async ({ assetId, translate, prefixStubKeys }: RecursiveFetchImportArgument): Promise<SchemaTag[]> => {
    const { localKeys: keys, localStubKeys: stubKeys } = translate
    const { normal } = await internalCache.JSONFile.get(assetId)
    //
    // Coming straight from the datalake, this normal should already be in standardized form,
    // and can be fed directly to normalSubset
    //
    const { newStubKeys, schema } = normalSubset({ normal, keys, stubKeys })
    newStubKeys.forEach((key) => {
        translate.addTranslation(key, prefixStubKeys ? `${splitType(assetId)[1]}.${key}` : key)
    })

    const relevantImports = Object.values(normal)
        .filter(isNormalImport)
        .reduce<{ assetId: `ASSET#${string}`; mapping: NormalImport["mapping"] }[]>((previous, { from, mapping }) => {
            if ([...keys, ...stubKeys, ...newStubKeys].find((key) => (key in mapping))) {
                return [
                    ...previous,
                    {
                        assetId: `ASSET#${from}`,
                        mapping
                    }
                ]
            }
            else {
                return previous
            }
        }, [])
    //
    // Use nested translators from relevantImports to generate recursiveKeyFetches, and then to map
    // the return values to local names
    //
    const importSchema = (await Promise.all(relevantImports.map(async ({ assetId, mapping }) => {
        const nestedTranslate = translate.nestMapping(keys, [...stubKeys, ...newStubKeys], mapping)
        const tags: SchemaTag[] = await recursiveFetchImports({ assetId, translate: nestedTranslate, prefixStubKeys: true })
        return tags.map((tag) => (nestedTranslate.translateSchemaTag(tag)))
    }))).flat()

    return [
        ...importSchema,
        ...schema.map((tag) => (translate.translateSchemaTag(tag)))
    ]

}

export default recursiveFetchImports
