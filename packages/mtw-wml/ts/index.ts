import Normalizer from './normalize'
import { NormalCondition, NormalExit, isNormalComponent, isNormalVariable, isNormalComputed, isNormalAction } from './normalize/baseClasses'
import { SchemaTag } from './schema/baseClasses'

const flattenToElements = (includeFunction) => (node) => {
    const flattenedNode = includeFunction(node) ? [node] : []
    return node.contents.reduce(
        (previous, node) => ([...previous, ...flattenToElements(includeFunction)(node)]),
        flattenedNode
    )
}

export const dbEntries = (schema: SchemaTag[]) => {
    const normalizer = new Normalizer()
    schema.forEach((schemaItem) => {
        normalizer.add(schemaItem)
    })
    const normalForm = normalizer.normal
    const mapContextStackToConditions = <T extends { contextStack: { key: string, tag: string }[] }>({ contextStack, ...rest }: T): { conditions: { if: string; dependencies: any[] }[] } & Omit<T, 'contextStack'> => ({
        conditions: contextStack.reduce((previous, { key, tag }) => {
            if (tag !== 'Condition') {
                return previous
            }
            const { if: condition = '', dependencies = [] } = normalForm[key] as NormalCondition
            return [
                ...previous,
                {
                    if: condition,
                    dependencies
                }
            ]
        }, [] as { if: string, dependencies: any[] }[]),
        ...rest
    })

    return Object.values(normalForm)
        .filter(({ tag }) => (['Room', 'Feature', 'Variable', 'Action', 'Computed'].includes(tag)))
        .map((item) => {
            if (isNormalComponent(item)) {
                switch(item.tag) {
                    case 'Room':
                        const returnVal = {
                            ...item,
                            appearances: item.appearances
                                .map(mapContextStackToConditions)
                                .map(({ contents, location, ...remainder }) => {
                                    const exitContents = contents
                                        .filter(({ tag }) => (tag === 'Exit'))
                                    return {
                                        ...remainder,
                                        exits: (exitContents.length > 0)
                                            ? exitContents
                                                .map(({ key }) => {
                                                    const { name, to } = normalForm[key] as NormalExit
                                                    return { name, to }
                                                })
                                            : undefined
                                    }
                                })
                        }
                        return returnVal
                    case 'Feature':
                        const featureVal = {
                            ...item,
                            appearances: item.appearances
                                .map(mapContextStackToConditions)
                                .map(({ contents, location, ...rest }) => (rest))
                        }
                        return featureVal
                }
            }
            if (isNormalVariable(item)) {
                return {
                    tag: item.tag,
                    key: item.key,
                    default: item.default
                }
            }
            if (isNormalComputed(item)) {
                return {
                    tag: item.tag,
                    key: item.key,
                    dependencies: item.dependencies,
                    src: item.src
                }
            }
            if (isNormalAction(item)) {
                return {
                    tag: item.tag,
                    key: item.key,
                    src: item.src
                }
            }
        })
        .filter((item) => (item?.key))
        .reduce((previous, item) => {
            if (!item) {
                return previous
            }
            else {
                const { key, ...rest } = item
                return { ...previous, [key]: rest }
            }
        }, {})
}
