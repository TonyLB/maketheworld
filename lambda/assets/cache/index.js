
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

const mapContextStackToConditions = (normalForm) => ({ contextStack, ...rest }) => ({
    conditions: contextStack.reduce((previous, { key, tag }) => {
        if (tag !== 'Condition') {
            return previous
        }
        const { if: condition = '', dependencies = [] } = normalForm[key]
        return [
            ...previous,
            {
                if: condition,
                dependencies
            }
        ]
    }, []),
    ...rest
})

const mapContentsToExits = (normalForm) => ({ contents, ...rest }) => ({
    ...rest,
    exits: contents.reduce((previous, { tag, key }) => {
        if (tag === 'Exit') {
            return [
                ...previous,
                {
                    to: normalForm[key].toEphemeraId,
                    name: normalForm[key].name
                }
            ]
        }
        return previous
    }, [])
})

const mergeEntries = async (assetId, normalForm) => {
    const mergeEntries = Object.values(normalForm)
        .filter(({ tag }) => (['Room'].includes(tag)))
        .map(({ appearances, ...rest }) => ({
            ...rest,
            appearances: appearances
                .map(mapContextStackToConditions(normalForm))
                .map(mapContentsToExits(normalForm))
                .map(({ conditions, name, render, exits }) => ({
                    conditions,
                    name,
                    render,
                    exits
                }))
        }))
    await Promise.all([
        mergeIntoDataRange({
            table: 'ephemera',
            search: { DataCategory: `ASSET#${assetId}` },
            items: mergeEntries,
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
    const firstPassNormal = await parseWMLFile(fileName)
    const secondPassNormal = await globalizeDBEntries(assetId, firstPassNormal)
    const [{ State: currentState = {} } = {}] = await Promise.all([
        ephemeraDB.getItem({
            EphemeraId: `ASSET#${assetId}`,
            DataCategory: 'Meta::Asset',
            ProjectionFields: ['#state'],
            ExpressionAttributeNames: {
                '#state': 'State'
            }
        }),
        mergeEntries(assetId, secondPassNormal),
        //
        // TODO: Check whether there is a race-condition between mergeEntries and initializeRooms
        //
        initializeRooms(Object.values(secondPassNormal)
            .filter(({ tag }) => (['Room'].includes(tag)))
            .map(({ EphemeraId }) => EphemeraId)
        )
    ])

    const computeDependencies = Object.values(secondPassNormal)
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

    const dependencies = Object.values(secondPassNormal)
        .filter(({ tag }) => (['Room'].includes(tag)))
        .reduce((previous, { EphemeraId, appearances = [] }) => (
            appearances
                .map(mapContextStackToConditions(secondPassNormal))
                .reduce((accumulator, { conditions = [] }) => (
                    conditions.reduce((innerAccumulator, { dependencies = [] }) => (
                        dependencies.reduce((innermostAccumulator, dependency) => ({
                            ...innermostAccumulator,
                            [dependency]: {
                                ...(innermostAccumulator[dependency] || {}),
                                room: [...(new Set([
                                    ...(innermostAccumulator[dependency]?.room || []),
                                    //
                                    // Extract the globalized RoomId
                                    //
                                    splitType(EphemeraId)[1]
                                ]))]
                            }
                        }), innerAccumulator)
                    ), accumulator)
                ), previous)
        ), computeDependencies)

    const variableState = Object.values(secondPassNormal)
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

    const uncomputedState = Object.values(secondPassNormal)
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

    const actions = Object.values(secondPassNormal)
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
