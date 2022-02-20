
import {
    assetDB,
    ephemeraDB,
    mergeIntoDataRange
} from '/opt/utilities/dynamoDB/index.js'
import { splitType } from '/opt/utilities/types.js'
import { recalculateComputes } from '/opt/utilities/executeCode/index.js'
import { evaluateCode } from '/opt/utilities/computation/sandbox.js'
import parseWMLFile from './parseWMLFile.js'
import globalizeDBEntries from "./globalize.js"
import initializeRooms from './initializeRooms.js'

//
// TODO:
//
// Consider how to handle the various cases of change,
// in relation to the characters possibly occupying the rooms
//
// What does it mean when the underlying assets of a room change, in terms
// of notifying people in it?
//

export const fetchAssetMetaData = async (assetId) => {
    const { fileName = '' } = await assetDB.getItem({
        AssetId: `ASSET#${assetId}`,
        DataCategory: 'Meta::Asset',
        ProjectionFields: ['fileName']
    })
    return fileName
}

//
// At current levels of functionality, it is sufficient to do a deep-equality
// check.
//
const compareEntries = (current, incoming) => {
    return JSON.stringify(current) === JSON.stringify(incoming)
}

const pushMetaData = async (assetId, state, dependencies, actions) => {
    await ephemeraDB.putItem({
        EphemeraId: `ASSET#${assetId}`,
        DataCategory: 'Meta::Asset',
        State: state || {},
        Dependencies: dependencies || {
            room: [],
            computed: []
        },
        Actions: actions || {}
    })
}

const mergeEntries = async (assetId, dbEntriesList) => {
    await Promise.all([
        mergeIntoDataRange({
            table: 'ephemera',
            search: { DataCategory: `ASSET#${assetId}` },
            items: dbEntriesList,
            mergeFunction: ({ current, incoming }) => {
                if (!incoming) {
                    return 'delete'
                }
                if (!current) {
                    return incoming
                }
                if (compareEntries(current, incoming)) {
                    return 'ignore'
                }
                else {
                    return incoming
                }
            }
        })
    ])
}

export const cacheAsset = async (assetId) => {
    const fileName = await fetchAssetMetaData(assetId)
    const dbEntriesList = await parseWMLFile(fileName)
    const globalEntries = await globalizeDBEntries(assetId, dbEntriesList)
    const [{ State: currentState = {} } = {}] = await Promise.all([
        ephemeraDB.getItem({
            EphemeraId: `ASSET#${assetId}`,
            DataCategory: 'Meta::Asset',
            ProjectionFields: ['#state'],
            ExpressionAttributeNames: {
                '#state': 'State'
            }
        }),
        mergeEntries(
            assetId,
            globalEntries.filter(({ EphemeraId }) => (['ROOM'].includes(splitType(EphemeraId)[0])))
        ),
        //
        // TODO: Check whether there is a race-condition between mergeEntries and initializeRooms
        //
        initializeRooms(globalEntries
            .filter(({ EphemeraId }) => (splitType(EphemeraId)[0] === 'ROOM'))
            .map(({ EphemeraId }) => EphemeraId)
        )
    ])
    const programScopeIdsByEphemeraId = globalEntries
        .filter(({ EphemeraId }) => (['VARIABLE', 'ACTION'].includes(splitType(EphemeraId)[0])))
        .reduce((previous, { EphemeraId, scopedId }) => ({ ...previous, [EphemeraId]: scopedId }), {})

    const computeDependencies = dbEntriesList
        .filter(({ tag }) => (tag === 'Computed'))
        .reduce((previous, { key, dependencies }) => (
            dependencies.reduce((accumulator, dependency) => ({
                ...accumulator,
                [dependency]: {
                    computed: [
                        ...(accumulator[dependency]?.computed || []),
                        key
                    ]
                }
            }), previous)
        ), {})

    const dependencies = globalEntries
        .filter(({ EphemeraId }) => (splitType(EphemeraId)[0] === 'ROOM'))
        .reduce((previous, { EphemeraId, appearances = [] }) => (
            appearances.reduce((accumulator, { conditions = [] }) => (
                conditions.reduce((innerAccumulator, { dependencies = [] }) => (
                    dependencies.reduce((innermostAccumulator, dependency) => ({
                        ...innermostAccumulator,
                        [dependency]: {
                            ...(innermostAccumulator[dependency] || {}),
                            room: [...(new Set([
                                ...(innermostAccumulator[dependency]?.room || []),
                                splitType(EphemeraId)[1]
                            ]))]
                        }
                    }), innerAccumulator)
                ), accumulator)
            ), previous)
        ), computeDependencies)

    const variableState = dbEntriesList
        .filter(({ tag }) => (tag === 'Variable'))
        .reduce((previous, { key, default: defaultValue }) => {
            if (previous[key]?.value !== undefined) {
                return previous
            }
            const defaultEvaluation = evaluateCode(`return (${defaultValue})`)({})
            return {
                ...previous,
                [key]: {
                    value: defaultEvaluation
                }
            }
        }, currentState)

    const uncomputedState = dbEntriesList
        .filter(({ tag }) => (tag === 'Computed'))
        .reduce((previous, { key, src }) => ({
            ...previous,
            [key]: {
                key,
                computed: true,
                src
            }
        }), variableState)

    const { state } = recalculateComputes(
        uncomputedState,
        dependencies,
        Object.entries(variableState)
            .filter(([_, { computed }]) => (!computed))
            .map(([key]) => (key))
    )

    const actions = dbEntriesList
        .filter(({ tag }) => (tag === 'Action'))
        .reduce((previous, { key, src }) => ({
            ...previous,
            [key]: {
                ...(previous[key] || {}),
                src
            }
        }), {})
    await pushMetaData(
        assetId,
        state,
        dependencies,
        actions
    )
}
