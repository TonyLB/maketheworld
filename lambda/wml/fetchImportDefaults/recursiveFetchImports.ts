import { FetchImportsJSONHelper } from "./baseClasses"
import { StandardForm } from "@tonylb/mtw-wml/ts/standardize"
import { excludeUndefined } from "@tonylb/mtw-utilities/ts/lists"
import { AssetUUID, ComponentUUID } from "@tonylb/mtw-base/ts/schema"
import { StandardKey } from "@tonylb/mtw-wml/ts/standardize/components/reference"
import { mapKeyToFormat, mapReferenceToFormat } from "@tonylb/mtw-wml/ts/standardize/components/utils/references"

type RecursiveFetchImportArgument = {
    assetId: AssetUUID;
    jsonHelper: FetchImportsJSONHelper;
    fullKeys: ComponentUUID[];
    stubKeys: ComponentUUID[];
    removeLocalKeys?: boolean;
}

export const recursiveFetchImports = async ({ assetId, jsonHelper, fullKeys, stubKeys, removeLocalKeys }: RecursiveFetchImportArgument): Promise<StandardForm> => {
    const standard = await jsonHelper.get(assetId)

    const subsetStandard = standard.subset([
        {
            requestType: 'Full',
            keys: fullKeys.map((key) => (new StandardKey(key))),
            cascadeConditions: [
                { conditionType: 'Exit', cascadeType: 'ShortName' },
                { conditionType: 'Link', cascadeType: 'ShortName' },
                { conditionType: 'Position', cascadeType: 'ShortName' }
            ]
        },
        { requestType: 'ShortName', keys: stubKeys.map((key) => (new StandardKey(key))) }
    ])

    //
    // If removeLocalKeys is true then remove all non-universal keys from the subsetStandard
    // in order to create newStandard. Beyond the first level of recursion, we are not interested
    // in the local keys, as they are not relevant to the import process.
    //
    const newStandard = subsetStandard
    if (removeLocalKeys) {
        const allKeys = newStandard._components
            .map((component) => (component._key))
        newStandard._components = newStandard._components
            .map((component) => {
                const returnValue = component.clone()
                returnValue._key = mapKeyToFormat('universal')(returnValue._key)
                return returnValue.withMapping(allKeys).remapReferences('universal')
            })
    }
    const allStubKeys = standard._components
        .filter((component) => (!fullKeys.find((checkKey) => (new StandardKey(checkKey).equals(component._key)))))
        .map((component) => (component.universalKey))
        .filter(excludeUndefined)

    //
    // Check all components in the subset standardForm, and see whether they require imports. From
    // that examination, make a record by AssetId of what fullKeys and stubKeys need to be imported
    // from the ancestor Asset
    //
    const relevantImportsByAssetId = newStandard._components
        .reduce<Record<AssetUUID, { fullKeys: ComponentUUID[]; stubKeys: ComponentUUID[] }>>((previous, component) => {
            const importItem = component._from
            if (importItem) {
                const fullOrStub = (component.universalKey && allStubKeys.includes(component.universalKey)) ? 'stubKeys' : 'fullKeys'
                return {
                    ...previous,
                    [importItem]: {
                        ...(previous[importItem] ?? { fullKeys: [], stubKeys: [] }),
                        [fullOrStub]: [
                            ...(previous[importItem]?.[fullOrStub] ?? []),
                            component.universalKey
                        ]
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
                recursiveFetchImports({ assetId: assetId as AssetUUID, jsonHelper, fullKeys, stubKeys, removeLocalKeys: true })
            ))
        ))

    //
    // Merge all localized imports forward to the current level
    //
    newStandard._components.forEach((component) => { component._from = undefined })
    const merged = recursiveImports.reduce<StandardForm>(
        (previous, incoming) => {
            incoming._components.forEach((component) => { component._from = undefined })
            return incoming.merge(previous)
        },
        newStandard
    )

    newStandard._components = merged._components
    return newStandard.finalize()

}

export default recursiveFetchImports
