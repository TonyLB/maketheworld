import recalculateComputes from '/opt/utilities/executeCode/recalculateComputes.js'
import parseWMLFile from './parseWMLFile.js'
import globalizeDBEntries from "./globalize.js"
import initializeRooms from './initializeRooms.js'
import AssetMetaData from './assetMetaData.js'
import mergeEntries from './mergeEntries.js'
import StateSynthesizer from './stateSynthesis.js'

//
// TODO:
//
// Consider how to handle the various cases of change,
// in relation to the characters possibly occupying the rooms
//
// What does it mean when the underlying assets of a room change, in terms
// of notifying people in it?
//

export const cacheAsset = async (assetId, options = {}) => {
    const { check = false, recursive = false, forceCache = false } = options

    const assetMetaData = new AssetMetaData(assetId)
    if (check) {
        const alreadyPresent = await assetMetaData.checkEphemera()
        if (alreadyPresent) {
            return
        }
    }
    const { fileName, importTree, instance } = await assetMetaData.fetch()
    //
    // Instanced stories are not directly cached, they are instantiated ... so
    // this would be a miscall, and should be ignored.
    //
    if (instance) {
        return
    }
    if (recursive) {
        await Promise.all(Object.keys(importTree || {}).map((assetId) => (cacheAsset(assetId, { recursive: true, check: !forceCache }))))
    }
    const firstPassNormal = await parseWMLFile(fileName)
    const secondPassNormal = await globalizeDBEntries(assetId, firstPassNormal)

    const stateSynthesizer = new StateSynthesizer(assetId, secondPassNormal)

    await Promise.all([
        stateSynthesizer.fetchFromEphemera(),
        mergeEntries(assetId, secondPassNormal),
        //
        // TODO: Check whether there is a race-condition between mergeEntries and initializeRooms
        //
        initializeRooms(Object.values(secondPassNormal)
            .filter(({ tag }) => (['Room'].includes(tag)))
            .map(({ EphemeraId }) => EphemeraId)
        )
    ])

    assetMetaData.dependencies = stateSynthesizer.dependencies
    
    stateSynthesizer.evaluateDefaults()
    await stateSynthesizer.fetchImportedValues()
    const { state } = recalculateComputes(
        stateSynthesizer.state,
        assetMetaData.dependencies,
        Object.entries(stateSynthesizer.state)
            .filter(([_, { computed }]) => (!computed))
            .map(([key]) => (key))
    )
    assetMetaData.state = state

    assetMetaData.actions = Object.values(secondPassNormal)
        .filter(({ tag }) => (tag === 'Action'))
        .reduce((previous, { key, src }) => ({
            ...previous,
            [key]: {
                ...(previous[key] || {}),
                src
            }
        }), {})
    await Promise.all([
        assetMetaData.pushEphemera(),
        stateSynthesizer.updateImportedDependencies()
    ])
}
