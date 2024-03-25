import { splitType } from "@tonylb/mtw-utilities/ts/types"
import {
    isImportable,
    isSchemaExit,
    isSchemaRoom,
    SchemaTag
} from "@tonylb/mtw-wml/ts/schema/baseClasses"
import { GenericTree, GenericTreeNode } from '@tonylb/mtw-wml/ts/tree/baseClasses'
import { FetchImportsJSONHelper } from "./baseClasses"
import standardSubset from "./standardSubset"
import { GenericTreeNodeFiltered, treeNodeTypeguard } from "@tonylb/mtw-wml/dist/tree/baseClasses"
import { isSchemaImport, SchemaImportTag } from "@tonylb/mtw-wml/dist/schema/baseClasses"
import { Standardizer } from "@tonylb/mtw-wml/ts/standardize"
import { stripIDFromTree } from "@tonylb/mtw-wml/ts/tree/genericIDTree"

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
    nestMapping(keys: string[], stubKeys: string[], mapping: GenericTreeNodeFiltered<SchemaImportTag, SchemaTag>): NestedTranslateImportToFinal {
        const localToImport = Object.assign({},
            ...mapping.children
                .map(({ data }) => {
                    if (isImportable(data)) {
                        return { [data.key]: data.from ?? data.key }
                    }
                    return {}
                })
        ) as Record<string, string>
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
    translateSchemaTag(tag: GenericTreeNode<SchemaTag>): GenericTreeNode<SchemaTag> {
        if (isSchemaExit(tag.data)) {
            return {
                data: {
                    ...tag.data,
                    key: `${this.translateKey(tag.data.from)}#${this.translateKey(tag.data.to)}`,
                    to: this.translateKey(tag.data.to),
                    from: this.translateKey(tag.data.from)
                },
                children: tag.children
            }
        }
        if (isSchemaRoom(tag.data)) {
            return {
                data: {
                    ...tag.data,
                    key: this.translateKey(tag.data.key),
                },
                children: tag.children.map((value) => (this.translateSchemaTag(value)))
            }
        }
        return tag
    }
}

type RecursiveFetchImportArgument = {
    assetId: `ASSET#${string}`;
    jsonHelper: FetchImportsJSONHelper;
    translate: NestedTranslateImportToFinal;
    prefixStubKeys?: boolean;
}

export const recursiveFetchImports = async ({ assetId, jsonHelper, translate, prefixStubKeys }: RecursiveFetchImportArgument): Promise<GenericTree<SchemaTag>> => {
    const { localKeys: keys, localStubKeys: stubKeys } = translate
    const { standard } = await jsonHelper.get(assetId)
    //
    // Coming straight from the datalake, this normal should already be in standardized form,
    // and can be fed directly to normalSubset
    //

    //
    // TODO: Refactor normalSubset as standardSubset to operate on standardForm
    //
    const { newStubKeys, standard: newStandard } = standardSubset({ standard, keys, stubKeys })
    newStubKeys.forEach((key) => {
        translate.addTranslation(key, prefixStubKeys ? `${splitType(assetId)[1]}.${key}` : key)
    })

    const relevantImports = newStandard.metaData
        .filter(treeNodeTypeguard(isSchemaImport))
        .reduce<{ assetId: `ASSET#${string}`; mapping: GenericTreeNodeFiltered<SchemaImportTag, SchemaTag> }[]>((previous, { data, children }) => {
            const filteredChildren = children
                .filter(treeNodeTypeguard(isImportable))
                .filter(({ data }) => ([...keys, ...stubKeys, ...newStubKeys].includes(data.as ?? data.key)))
            if (filteredChildren.length) {
                return [
                    ...previous,
                    {
                        assetId: `ASSET#${data.from}`,
                        mapping: { data, children: filteredChildren }
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
        const tags: GenericTree<SchemaTag> = await recursiveFetchImports({ assetId, jsonHelper, translate: nestedTranslate, prefixStubKeys: true })
        return tags.map((tag) => (nestedTranslate.translateSchemaTag(tag)))
    }))).flat()

    const deserializeStandardizer = new Standardizer()
    deserializeStandardizer.deserialize({ ...newStandard, metaData: [] })
    const rawSchema = stripIDFromTree(deserializeStandardizer.schema)
    const translatedSchema = [{ ...rawSchema[0], children: rawSchema[0].children.map((tag) => (translate.translateSchemaTag(tag))) }]
    const mergeStandardizer = new Standardizer([{
        ...translatedSchema[0],
        children: [
            ...importSchema,
            ...translatedSchema[0].children
        ]
    }])

    return stripIDFromTree(mergeStandardizer.schema[0].children)

}

export default recursiveFetchImports
