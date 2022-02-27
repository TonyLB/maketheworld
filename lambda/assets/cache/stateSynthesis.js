import { ephemeraDB } from '/opt/utilities/dynamoDB/index.js'
import { splitType, AssetKey } from '/opt/utilities/types.js'

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

export const fetchAssetState = async (assetId) => {
    const { State = {} } = await ephemeraDB.getItem({
        EphemeraId: AssetKey(assetId),
        DataCategory: 'Meta::Asset',
        ProjectionFields: ['#state'],
        ExpressionAttributeNames: {
            '#state': 'State'
        }
    }) || {}
    return State
}

export const extractDependencies = (normalForm) => {
    const computeDependencies = Object.values(normalForm)
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

    const dependencies = Object.values(normalForm)
        .filter(({ tag }) => (['Room'].includes(tag)))
        .reduce((previous, { EphemeraId, appearances = [] }) => (
            appearances
                .map(mapContextStackToConditions(normalForm))
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

    return dependencies
}