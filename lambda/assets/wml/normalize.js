import { produce } from 'immer'
import { v4 as uuidv4 } from 'uuid'
import { objectEntryMap } from '../lib/objects.js'

export class WMLNormalizeError extends Error {
    constructor(message) {
        super(`WMLNormalize: ${message}`)
        this.name = 'WMLNormalizeError'
    }
}

export class NormalizeTagMismatchError extends WMLNormalizeError {
    constructor(message) {
        super(message)
        this.name = 'TagMismatchError'
    }
}

export class NormalizeKeyMismatchError extends WMLNormalizeError {
    constructor(message) {
        super(message)
        this.name = 'KeyTagMismatchError'
    }
}

let generatedKeys = {}

export const clearGeneratedKeys = () => {
    generatedKeys = {}
}

const nextGeneratedKey = (tag) => {
    const currentValues = Object.keys(generatedKeys)
        .filter((key) => (key.startsWith(`${tag}-`)))
        .map((key) => (key.slice(`${tag}-`.length)))
    const maxValue = currentValues.reduce((previous, value) => {
        const numericValue = parseInt(value) || 0
        return (numericValue > previous) ? numericValue : previous
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

const getCurrentAppearance = (existingMap = {}, key) => {
    if ((existingMap[key]?.appearances || []).length > 0) {
        return {
            appearance: existingMap[key].appearances[-1],
            index: existingMap[key].appearances.length - 1,
            valid: true
        }
    }
    return { valid: false }
}

const pullProperties = (node) => {
    return Object.entries(node).reduce((previous, [key, value]) => {
        let pullTags = [
            'tag',
            'key',
            'global'
        ]
        switch(node.tag) {
            case 'Exit':
                pullTags = [...pullTags, 'to', 'from', 'name']
                break
            case 'Variable':
                pullTags.push('default')
                break
            case 'Computed':
                pullTags = [...pullTags, 'src', 'dependencies']
                break
            case 'Action':
                pullTags.push('src')
                break
            case 'Condition':
                pullTags = [...pullTags, 'if', 'dependencies']
                break
            case 'Image':
                pullTags = [...pullTags, 'fileURL', 'display']
                break
            case 'Import':
                pullTags = [...pullTags, 'mapping', 'from']
                break
            case 'Story':
            case 'Asset':
                pullTags = [...pullTags, 'Story', 'instance', 'name', 'fileName', 'player', 'zone']
                break
            case 'Character':
                pullTags = [...pullTags, 'Name', 'fileName', 'fileURL', 'Pronouns', 'FirstImpression', 'OneCoolThing', 'Outfit', 'player', 'zone']
                break
        }
        if (pullTags.includes(key)) {
            if (Array.isArray(value)) {
                return {
                    ...previous,
                    topLevel: {
                        ...previous.topLevel,
                        [key]: [
                            ...(previous.topLevel[key] ?? []),
                            ...value
                        ]
                    }
                }
            }
            //
            // For boolean props, lift any true up above all falses
            //
            if (previous.topLevel === true) {
                return previous
            }
            if (value === true) {
                return {
                    ...previous,
                    topLevel: {
                        ...previous.topLevel,
                        [key]: true
                    }
                }
            }
            if (value !== null && typeof value === 'object') {
                return {
                    ...previous,
                    topLevel: {
                        ...previous.topLevel,
                        [key]: {
                            ...previous.topLevel[key] ?? {},
                            ...value
                        }
                    }
                }
            }
            return {
                ...previous,
                topLevel: {
                    ...previous.topLevel,
                    [key]: value
                }
            }
        }
        else {
            return {
                ...previous,
                appearance: {
                    ...previous.appearance,
                    [key]: value
                }
            }
        }
    }, { topLevel: {}, appearance: {} })
}

export const transformNode = (contextStack, node) => {
    if (node.tag === 'Exit') {
        const roomIndex = contextStack.reduceRight((previous, { tag }, index) => (((tag === 'Room') && (previous === -1)) ? index : previous), -1)
        if (roomIndex === -1) {
            return {
                contextStack: [
                    ...contextStack,
                    {
                        key: node.from,
                        tag: 'Room'
                    }
                ],
                node: {
                    key: `${node.from}#${node.to}`,
                    ...node
                }
            }
        }
        const roomKey = contextStack[roomIndex].key
        const { to, from, ...rest } = node
        const returnValue = {
            ...rest,
            key: `${from || roomKey}#${to || roomKey}`,
            to: to || roomKey,
            from: from || roomKey
        }
        if (from && from !== roomKey) {
            const contextStackBeforeRoom = contextStack.slice(0, roomIndex)
            const contextStackAfterRoom = contextStack.slice(roomIndex + 1)
            //
            // NOTE: Context stacks within the sibling room element created do not have
            // an index item.  addElement will need to infer the correct index (either
            // the current for a matching element, or a created next wrapper)
            //
            return {
                contextStack: [
                    ...contextStackBeforeRoom,
                    {
                        key: from,
                        tag: 'Room'
                    },
                    ...(contextStackAfterRoom.map(({ key, tag }) => ({ key, tag })))
                ],
                node: returnValue
            }
        }
        else {   
            return {
                contextStack,
                node: returnValue
            }
        }
    }
    if (node.tag === 'Condition') {
        const key = keyForValue('Condition', node.src)
        return {
            node: {
                key,
                ...node    
            },
            contextStack
        }
    }
    if (node.tag === 'Import') {
        const key = keyForValue('Import', node.from)
        return {
            node: {
                key,
                ...node,
                contents: Object.entries(node.mapping)
                    .map(([key, { type }]) => ({ key, tag: type }))
            },
            contextStack
        }
    }
    return { node, contextStack }
}

//
// postProcessAppearance parses through elements after all of the normal structure has been
// created, and updates appearanes where necessary (e.g. to include locations in the rooms
// denormalization of Map nodes)
//
export const postProcessAppearance = (normalForm, key, index) => {
    const node = normalForm[key]
    if (!node) {
        return normalForm
    }
    if (node.tag === 'Map') {
        if (index >= node.appearances.length) {
            return normalForm
        }
        const appearance = node.appearances[index]
        const { rooms = {}, contents = [] } = appearance
        const revisedRooms = objectEntryMap(rooms, (roomKey, roomPosition) => {
            const roomContentItem = contents.find(({ key }) => (key === roomKey))
            if (roomContentItem) {
                const roomAppearance = normalForm[roomKey]?.appearances?.[roomContentItem.index]
                if (roomAppearance) {
                    const { location } = roomAppearance
                    return {
                        ...roomPosition,
                        location
                    }
                }
            }
            return roomPosition
        })
        return produce(normalForm, (draftNormalForm) => {
            draftNormalForm[key].appearances[index].rooms = revisedRooms
        })
    }
    return normalForm
}

//
// mergeElements tracks how to add an element into the normalized structure, given the contextStack in
// which it is encountered.
//
const mergeElements = ({ previous, contextStack, node, location }) => {
    const deepEqual = (listA, listB) => {
        return JSON.stringify(listA) === JSON.stringify(listB)
    }

    const [currentAppearance] = previous.appearances.slice(-1)
    const { topLevel, appearance: incomingAppearance } = pullProperties(node)
    //
    // Integrate the topLevel data, making sure there are no conflicts
    //
    if (topLevel.key !== previous.key) {
        throw new NormalizeKeyMismatchError('Keys somehow mismatched in normalize')
    }
    if (topLevel.tag !== previous.tag) {
        throw new NormalizeTagMismatchError(`Key '${topLevel.key}' is used to define elements of different tags ('${previous.tag}' and '${topLevel.tag}')`)
    }

    //
    // If it is a sibling to a similarly keyed item, in the same context,
    // with no similarly-keyed items in other contexts (e.g. a conditional
    // redefining some properties after the first sibling) then its data
    // can be folded in ... sequential siblings get merged.
    //
    if (deepEqual(currentAppearance.contextStack, contextStack)) {
        const priorAppearances = previous.appearances.slice(0, -1)
        return {
            ...previous,
            ...topLevel,
            appearances: [
                ...priorAppearances,
                {
                    ...currentAppearance,
                    ...incomingAppearance,
                    contents: [
                        ...(currentAppearance.contents || []),
                        ...(incomingAppearance.contents || [])
                    ],
                    location
                }
            ]
        }
    }
    //
    // Otherwise, create a new appearance for the item
    //
    else {
        return {
            ...previous,
            ...topLevel,
            appearances: [
                ...previous.appearances,
                {
                    contextStack,
                    location,
                    ...incomingAppearance
                }
            ]
        }
    }
}

export const addElement = (existingMap = {}, { contextStack = [], node, location }) => {
    const { key } = node
    const { contextFilledMap, filledContext } = contextStack.reduce((previous, { key, tag, index }) => {
        if (index !== undefined) {
            return {
                ...previous,
                filledContext: [...previous.filledContext, { key, tag, index }]
            }
        }
        else {
            const newMap = addElement(
                previous.contextFilledMap,
                {
                    contextStack: previous.filledContext,
                    node: {
                        key,
                        tag
                    }
                }
            )
            return {
                contextFilledMap: newMap,
                filledContext: [
                    ...previous.filledContext,
                    {
                        key,
                        tag,
                        index: newMap[key].appearances.length - 1
                    }
                ]
            }
        }
    }, { contextFilledMap: existingMap, filledContext: [] })
    return produce(contextFilledMap, (draftMap) => {
        let merged = false
        if (draftMap[key]) {
            //
            // If the item has already appeared, check whether to merge
            // with a same-level sibling, or add a new appearance
            //
            const priorAppearances = draftMap[key].appearances.length
            draftMap[key] = mergeElements({ previous: draftMap[key], contextStack: filledContext, node, location })
            if (draftMap[key].appearances.length === priorAppearances) {
                merged = true
            }
        }
        else {
            //
            // If this is the first appearance of the item, add it to the
            // map fresh.
            //
            const { topLevel, appearance } = pullProperties(node)
            draftMap[key] = {
                ...topLevel,
                appearances: [{
                    contextStack: filledContext,
                    location,
                    ...appearance
                }]
            }
        }
        //
        // If a new element is added in a context, the parent item needs to have its
        // contents updated to reflect that.
        //
        if (filledContext.length > 0 && !merged) {
            const { key, index } = filledContext.slice(-1)[0]
            const { index: nodeIndex } = getCurrentAppearance(draftMap, node.key)
            draftMap[key].appearances[index].contents = [
                ...(draftMap[key].appearances[index].contents || []),
                {
                    key: node.key,
                    tag: node.tag,
                    index: nodeIndex
                }
            ]
        }
    })
}

export const normalize = (node, existingMap = {}, contextStack = [], location = [0]) => {
    const { contextStack: transformedContext, node: transformedNode } = transformNode(contextStack, node)
    const { topLevel: { key, tag, ...topLevelRest }, appearance: { contents } } = pullProperties(transformedNode)
    if (!key || !tag) {
        return existingMap
    }
    const firstPassMap = addElement(
        existingMap,
        {
            contextStack: transformedContext,
            location,
            node: {
                ...transformedNode,
                contents: []
            }
        })
    const updatedContextStack = [
        ...transformedContext,
        {
            key,
            tag,
            ...topLevelRest,
            index: (firstPassMap[key]?.appearances || []).length - 1
        }
    ]
    const secondPassMap = (contents || []).reduce((previous, node, index) => (normalize(node, previous, updatedContextStack, [...location, index])), firstPassMap)
    const thirdPassMap = Object.entries(secondPassMap)
        .reduce((previous, [key, normalItem]) => (
            normalItem.appearances
                .reduce((accumulator, _, index) => (postProcessAppearance(accumulator, key, index)), previous)
        ), secondPassMap)
    return thirdPassMap
}

export const isNormalExit = (arg) => (arg.tag === 'Exit')
export const isNormalImage = (arg) => (arg.tag === 'Image')
export const isNormalComponent = (arg) => (['Room', 'Feature'].includes(arg.tag))

export default normalize
