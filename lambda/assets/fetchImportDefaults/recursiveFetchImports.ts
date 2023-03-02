import { AssetKey } from "@tonylb/mtw-utilities/dist/types";
import { isNormalImport } from "@tonylb/mtw-wml/dist/normalize/baseClasses";
import { SchemaTag } from "@tonylb/mtw-wml/dist/schema/baseClasses";
import internalCache from "../internalCache";
import { objectMap } from "../lib/objects";
import normalSubset from "./normalSubset"

type RecursiveFetchImportArgument = {
    assetId: `ASSET#${string}`;
    keys: string[];
    stubKeys: string[];
}

export const recursiveFetchImports = async ({ assetId, keys, stubKeys }: RecursiveFetchImportArgument): Promise<SchemaTag[]> => {
    const { normal } = await internalCache.JSONFile.get(assetId)
    const aggregateImportMapping = Object.values(normal)
        .filter(isNormalImport)
        .reduce<Record<`ASSET#${string}`, { importToLocal: Record<string, string>, localToImport: Record<string, string> }>>((previous, { mapping, from }) => {
            const importToLocal = objectMap(mapping, ({ key }) => (key))
            const localToImport = Object.assign({}, ...Object.entries(mapping).map(([from, { key }]) => ({ [key]: from }))) as Record<string, string>
            return {
                ...previous,
                [from]: {
                    importToLocal,
                    localToImport
                }
            }
        }, {})
    //
    // TODO: ISS2251: Use aggregateImportMapping to generate recursiveKeyFetches, and then to map
    // the return values to local names
    //
    const recursiveKeyFetches = keys.reduce<Record<`ASSET#${string}`, RecursiveFetchImportArgument>>((previous, key) => {
        const importReference = (normal[key]?.appearances || []).map(({ contextStack }) => (contextStack)).flat().find(({ tag }) => (tag === 'Import'))
        if (importReference) {
            const importItem = normal[importReference.key]
            if (importItem.tag === 'Import') {
                const importMapping = importItem.mapping[key]
                const importAsset = `ASSET#${importItem.from}`
                if (importMapping) {
                    return {
                        ...previous,
                        [importAsset]: {
                            assetId: importAsset,
                            keys: [...(previous[importAsset]?.keys || []), importMapping.key],
                            stubKeys: previous[importAsset]?.stubKeys || []
                        }
                    }
                }
            }
        }
        return previous
    }, {})

    //
    // TODO: ISS-2246: Extend normalSubset to return an updated list of stubKeys, in addition to
    // the SchemaTag main output, and use that to determine what needs to be looked up
    // as possible imports from a different asset, to fill out yet more of the
    // layers of inheritance.
    //

    //
    // TODO: ISS-2247: Rename imports from recursive calls, to match them with their original aliases
    //

    //
    // TODO: ISS-2248: Rename stubKeys from recursive calls, if needed to avoid conflict with names
    // in the original asset (or other imported stubKeys)
    //

    //
    // Coming straight from the datalake, this normal should already be in standardized form,
    // and can be fed directly to normalSubset
    //
    return normalSubset({ normal, keys, stubKeys })

}

export default recursiveFetchImports
