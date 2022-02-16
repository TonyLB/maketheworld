import { produce } from 'immer'
import { v4 as uuidv4 } from 'uuid'

export class NormalizeTagMismatchError extends Error {
    constructor(message) {
        super(message)
        this.name = 'NormalizeTagMismatchError'
    }
}

const mergeNormalizeMaps = (existingMap, newMap) => {
    const mergedMap = Object.entries(newMap).reduce((previous, [key, { tag, appearances = [] }]) => {
        return produce(previous, (draft) => {
            if (draft[key]) {
                if (draft[key].tag !== tag) {
                    throw new NormalizeTagMismatchError(`Key '${key}' is used to define elements of different tags ('${draft[key].tag}' and '${tag}')`)
                }
                const deduplicateSet = draft[key].appearances.map(({ deduplicate }) => (deduplicate))
                draft[key].appearances = [
                    ...draft[key].appearances,
                    ...(appearances.filter(({ deduplicate }) => (!deduplicateSet.includes(deduplicate))))
                ]
            }
            else {
                draft[key] = {
                    key,
                    tag,
                    appearances
                }
            }
        })
    }, existingMap)
    return mergedMap
}

let generatedKeys = {}

const nextGeneratedKey = (tag) => {
    const currentValues = Object.keys(generatedKeys)
        .filter((key) => (key.startsWith(`${tag}-`)))
        .map((key) => (key.slice(`${tag}-`.length)))
    const maxValue = currentValues.reduce((previous, value) => {
        const numericValue = parseInt(value) || 0
        return (value > previous) ? value : previous
    }, 0)
    return `${tag}-${maxValue}`
}

const keyForValue = (tag, value) => {
    const [foundKey] = Object.entries(generatedKeys)
        .find(([key, checkValue]) => (
            key.startsWith(`${tag}-`) &&
            (checkValue === value)
        )) || [null]
    if (foundKey) {
        return foundKey
    }
    const syntheticKey = nextGeneratedKey(tag)
    generatedKeys[syntheticKey] = value
    return syntheticKey
}

const transformNode = (node, map = {}, contextStack = []) => {
    if (node.tag === 'Exit') {
        const roomKey = contextStack.slice(-1)[0].key
        const { to, from, ...rest } = node
        return {
            key: `${from || roomKey}#${to || roomKey}`,
            to: to || roomKey,
            from: from || roomKey,
            ...rest
        }
    }
    if (node.tag === 'Condition') {
        const key = keyForValue('Condition', node.src)
        return {
            key,
            ...node
        }
    }
    return node
}

export const normalize = (node, existingMap = {}, contextStack = []) => {
    const { key, tag, contents = [], ...rest } = transformNode(node, existingMap, contextStack)
    if (!key || !tag) {
        return existingMap
    }
    const contextIndex = (existingMap[key]?.appearances || []).length
    const updatedContextStack = [
        ...contextStack,
        {
            key,
            index: contextIndex
        }
    ]
    //
    // Before we can fill in the contents of the updated normalize map by adding
    // this current appearance of the node, we need to map the keys of the contents
    // using transformNode.  That means we need a map with a _placeholder_ for
    // the current node (with all its properties but an empty contents) in order
    // to pass for context to the nodes to be transformed.
    //
    const placeholderMap = mergeNormalizeMaps(existingMap, {
        key,
        tag,
        appearances: [{
            deduplicate: uuidv4(),
            contextStack,
            contents: [],
            ...rest
        }]
    })
    const updatedMap = mergeNormalizeMaps(existingMap, {
        [key]: {
            key,
            tag,
            appearances: [{
                deduplicate: uuidv4(),
                contextStack,
                contents: contents.map((item) => {
                    const itemKey = transformNode(item, placeholderMap, updatedContextStack).key
                    return {
                        key: itemKey,
                        index: (existingMap[itemKey]?.appearances || []).length
                    }
                }),
                ...rest
            }]
        }
    })
    const returnValue = (node.contents || []).reduce((previous, contentNode) => {
        return mergeNormalizeMaps(
            previous,
            normalize(
                contentNode,
                previous,
                updatedContextStack
            )
        )
    }, updatedMap)

    if (Object.keys(existingMap).length === 0) {
        return Object.entries(returnValue).reduce((previous, [key, { appearances, ...rest }]) => {
            return {
                ...previous,
                [key]: {
                    appearances: appearances.map(({ deduplicate, ...remainder }) => (remainder)),
                    ...rest
                }
            }
        }, {})
    }
    return returnValue
}

export default normalize
