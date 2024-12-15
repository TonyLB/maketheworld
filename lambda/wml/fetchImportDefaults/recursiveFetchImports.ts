import { FetchImportsJSONHelper } from "./baseClasses"
import { StandardForm } from "@tonylb/mtw-wml/ts/standardize"
import { excludeUndefined } from "@tonylb/mtw-utilities/ts/lists"
import { ExportItemContent, ImportItemContent } from "@tonylb/mtw-wml/ts/standardize/components/metaData"
import { unique } from "@tonylb/mtw-wml/ts/list"
import { stripImportAndExport } from "./utils"

type RecursiveFetchImportArgument = {
    assetId: `ASSET#${string}`;
    jsonHelper: FetchImportsJSONHelper;
    fullKeys: string[];
    stubKeys: string[];
}

//
// syntheticStubKeyFactory examines a StandardForm and creates the first key of the
// form 'Stub####' that does not conflict with an already-existing key
//
const syntheticStubKeyFactory = (keysAlready: string[]): `Stub${string}` => {
    let stubIndex = 1
    while(keysAlready.includes(`Stub${stubIndex}`)) {
        stubIndex++
    }
    return `Stub${stubIndex}`
}

export const recursiveFetchImports = async ({ assetId, jsonHelper, fullKeys, stubKeys }: RecursiveFetchImportArgument): Promise<StandardForm> => {
    const standard = await jsonHelper.get(assetId)
    const keysByExportAs = Object.values(standard.byId)
        .reduce<Record<string, string>>((previous, component) => {
            const exportAs = component.export instanceof ExportItemContent ? component.export._exportAs : undefined
            return {
                ...previous,
                [exportAs ?? component.key]: component.key
            }
        }, {})
    const allImportsByAssetId = Object.values(standard.byId)
        .reduce<Record<string, Record<string, string>>>((previous, component) => {
            const importItem = component.import
            if (importItem instanceof ImportItemContent) {
                return {
                    ...previous,
                    [importItem.assetId]: {
                        ...(previous[importItem.assetId] ?? { fullKeys: {}, stubKeys: {} }),
                        [importItem.fromKey]: component.key
                    }
                }
            }
            return previous
        }, {})

    const fullKeysMapped = fullKeys.map((key) => (keysByExportAs[key])).filter(excludeUndefined)
    const stubKeysMapped = stubKeys.map((key) => (keysByExportAs[key])).filter(excludeUndefined)
    const newStandard = standard.subset([
        {
            requestType: 'Full',
            keys: fullKeysMapped,
            cascadeConditions: [
                { conditionType: 'Exit', cascadeType: 'ShortName' },
                { conditionType: 'Link', cascadeType: 'ShortName' },
                { conditionType: 'Position', cascadeType: 'ShortName' }
            ]
        },
        { requestType: 'ShortName', keys: stubKeysMapped }
    ])
    const allStubKeys = Object.keys(standard.byId).filter((key) => (!fullKeysMapped.includes(key)))

    //
    // Check all components in the subset standardForm, and see whether they require imports. From
    // that examination, make a record by AssetId of:
    //    (a) What fullKeys and stubKeys need to be imported from the ancestor Asset, and
    //    (b) How to map those keys (when received) to the names that they have in the child standardForm
    //
    const relevantImportsByAssetId = Object.values(newStandard.byId)
        .reduce<Record<string, { fullKeys: Record<string, string>; stubKeys: Record<string, string> }>>((previous, component) => {
            const importItem = component.import
            if (importItem instanceof ImportItemContent) {
                const fullOrStub = allStubKeys.includes(component.key) ? 'stubKeys' : 'fullKeys'
                return {
                    ...previous,
                    [importItem.assetId]: {
                        ...(previous[importItem.assetId] ?? { fullKeys: {}, stubKeys: {} }),
                        [fullOrStub]: {
                            ...(previous[importItem.assetId]?.[fullOrStub] ?? {}),
                            [importItem.fromKey]: component.key
                        }
                    }
                }
            }
            return previous
        }, {})

    //
    // Call recursively on all relevant imports, in order to generate flat pictures of each import
    // (for the relevant components)
    //
    const recursiveImports = (await Promise.all(Object.entries(relevantImportsByAssetId)
            .map(([assetId, { fullKeys, stubKeys }]) => (
                recursiveFetchImports({ assetId: `ASSET#${assetId}`, jsonHelper, fullKeys: Object.keys(fullKeys), stubKeys: Object.keys(stubKeys) })
            ))
        ))

    //
    // TODO: Merge all localized imports forward to the current level
    //
    const merged = recursiveImports.reduce<StandardForm>(
        (previous, incoming) => {
            //
            // Translate internal keys in the recursive imports into local namespace, resolving name collisions (which can only
            // happen with stub-keys) by replacing them with "Stub###" keys
            //
            const relevantImportMapping = relevantImportsByAssetId[incoming.key]
            if (!relevantImportMapping) {
                //
                // Somehow the import failed to register, so ignore
                //
                return previous
            }
            const { fullKeys, stubKeys } = relevantImportMapping
            //
            // First, find all the entries in the imported asset which are fulfilling import requests from the
            // main asset, and create renameKey arguments for those fields (possibly no-ops) to record how to
            // rename those components in the incoming StandardForm, in order to be able to merge it with
            // the results.
            //
            const translationRenamesForImports = [...Object.entries(fullKeys), ...Object.entries(stubKeys)].reduce<Parameters<StandardForm["renameKey"]>[0]>((accumulator, [exportKey, localKey]) => {
                const matchComponent = Object.values(incoming.byId).find((component) => {
                    if (component.export instanceof ExportItemContent) {
                        return component.export.exportAs === exportKey
                    }
                    else {
                        return component.key === exportKey
                    }
                })
                if (!matchComponent) {
                    return accumulator
                }
                return [
                    ...accumulator,
                    {
                        fromKey: matchComponent.key,
                        toKey: localKey
                    }
                ]
            }, [])

            //
            // Next, search the incoming keys for those that are *not* yet represented in the map (which must be stubs
            // generated by internal references in the import hierarchy). Those (a) can be named whatever is suitable,
            // and (b) might currently confict with existing names in the results. Add a renameKey argument for each
            // of these fields as well, either a no-op, or a rename to a synthetic key that doesn't conflict.
            //
            const keysMappedToImports = translationRenamesForImports.map(({ fromKey }) => (fromKey))
            const translationRenamesForStubs = Object.values(incoming.byId)
                .filter((component) => (!keysMappedToImports.includes(component.key)))
                .reduce<Parameters<StandardForm["renameKey"]>[0]>((accumulator, component) => {
                    //
                    // If a stub is already something that the asset imports, use the name it is imported under
                    //
                    const exportAs = component.export instanceof ExportItemContent ? component.export.exportAs : component.key
                    if (allImportsByAssetId[incoming.key][exportAs]) {
                        return [
                            ...accumulator,
                            {
                                fromKey: component.key,
                                toKey: allImportsByAssetId[incoming.key][exportAs]
                            }
                        ]
                    }
                    //
                    // Otherwise, add a new name that doesn't conflict, using the original name by preference,
                    // and creating a synthetic stub as needed
                    //
                    const currentKeys = unique(
                        Object.keys(previous.byId),
                        translationRenamesForImports.map(({ toKey }) => (toKey)),
                        accumulator.map(({ toKey }) => (toKey))
                    )
                    if (currentKeys.includes(component.key)) {
                        return [
                            ...accumulator,
                            {
                                fromKey: component.key,
                                toKey: syntheticStubKeyFactory(currentKeys)
                            }
                        ]
                    }
                    else {
                        return [
                            ...accumulator,
                            {
                                fromKey: component.key,
                                toKey: component.key
                            }
                        ]
                    }
                }, [])

            //
            // Finally, remove the no-ops, rename keys on the incoming StandardForm, and merge the results
            // into it.
            //
            const finalRenames = [...translationRenamesForImports, ...translationRenamesForStubs]
                .filter(({ fromKey, toKey }) => (fromKey !== toKey))
            return stripImportAndExport(incoming.renameKey(finalRenames)).merge(previous)
        },
        newStandard
    )

    newStandard._byId = merged.byId
    return newStandard

}

export default recursiveFetchImports
