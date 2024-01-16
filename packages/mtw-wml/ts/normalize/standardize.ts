//
// standardizeNormal creates a new NormalForm with the exact same semantic content as the input,
// but with everything organized in a standard structure (see README.standardize.md)
//

import Normalizer from ".";
import { NormalForm, isNormalAsset, isNormalRoom, NormalItem, isNormalFeature, isNormalBookmark, isNormalMap, isNormalMessage, isNormalMoment, NormalMoment, isNormalVariable, isNormalComputed, isNormalAction, isNormalImport, NormalImport, isNormalKnowledge } from "./baseClasses"
import { isSchemaRoom, isSchemaBookmark, SchemaTag, isSchemaMessage, isSchemaMoment, SchemaComputedTag, isSchemaImport, SchemaImportMapping, isImportableTag, isSchemaWithKey } from "../simpleSchema/baseClasses"
import { GenericTree, GenericTreeNode } from "../sequence/tree/baseClasses";
import dfsWalk from "../sequence/tree/dfsWalk"
import { selectRender } from "./selectors/render"
import { selectName } from "./selectors/name"
import { selectMapRooms } from "./selectors/mapRooms"
import { selectImages } from './selectors/images'
import { selectExits } from "./selectors/exits";
import { selectRooms } from "./selectors/rooms";

const normalAlphabeticKeySort = ({ key: keyA }: NormalItem, { key: keyB }: NormalItem) => (keyA.localeCompare(keyB))

const extractBookmarkReferences = (items: GenericTree<SchemaTag>) => {
    const returnContents = dfsWalk({
        default: { output: [], state: {} },
        callback: (previous: { output: string[], state: {} }, item: SchemaTag) => {
            if (isSchemaBookmark(item)) {
                return { output: [...previous.output, item.key], state: {} }
            }
            return previous
        }
    })(items)

    return [...(new Set(returnContents))]
}

const extractConditionedMomentChildren = (contextNormalizer: Normalizer) => (item: NormalMoment) => {
    const { appearances } = item
    const returnContents = appearances.reduce<GenericTree<SchemaTag>>((previous, _, index ) => {
        const schemaVersion = contextNormalizer._normalToSchema(item.key, index)
        if (!(schemaVersion && isSchemaMoment(schemaVersion.data))) {
            return previous
        }
        const children = stripComponentContents(schemaVersion.children)
            .map(({ data, children }) => (isSchemaMessage(data) ? { data, children: [] } : { data, children }))
        return [
            ...previous,
            ...children
        ]
    }, [])

    return returnContents
}

const extractImportMapping = (contextNormalizer: Normalizer) => (item: NormalImport) => {
    const { appearances } = item
    const returnContents = appearances.reduce<Record<string, SchemaImportMapping>>((previous, _, index ) => {
        const schemaVersion = contextNormalizer._normalToSchema(item.key, index)
        if (!(schemaVersion && isSchemaImport(schemaVersion.data))) {
            return previous
        }

        return {
            ...previous,
            ...schemaVersion.data.mapping
        }
    }, {})

    return returnContents
}

const stripComponentContents = (items: GenericTree<SchemaTag>): GenericTree<SchemaTag> => {
    return items.map((item) => {
        const { data, children } = item
        const strippedData = (
            isSchemaRoom(data)
                ? { ...data, contents: [] }
                : isSchemaMessage(data)
                    ? { ...data, contents: [], rooms: [] }
                    : isSchemaBookmark(data)
                        ? { ...data, contents: [] }
                        : data
        )
        return {
            data: strippedData,
            children: stripComponentContents(children)
        }
    })
}

export const standardizeNormal = (normal: NormalForm): NormalForm => {
    const argumentNormalizer = new Normalizer()
    argumentNormalizer.loadNormal(normal)

    //
    // Isolate the wrapping asset node and add it to the results
    //
    const rootNode = Object.values(normal).find(({ appearances = [] }) => (appearances.find(({ contextStack }) => (contextStack.length === 0))))
    if (!(rootNode && isNormalAsset(rootNode))) {
        return {}
    }
    const resultNormalizer = new Normalizer()
    resultNormalizer._tags = { ...argumentNormalizer._tags }
    resultNormalizer.put({ data: { tag: 'Asset', key: rootNode.key, Story: undefined }, children: [] }, { contextStack: [] })

    //
    // Add standardized view of all Bookmarks in graph-sorted order
    //
    const bookmarkValues: GenericTree<SchemaTag> = Object.values(normal)
        .filter(isNormalBookmark)
        .sort(normalAlphabeticKeySort)
        .map((bookmark): GenericTreeNode<SchemaTag> => {
            const render = argumentNormalizer.select({ key: bookmark.key, selector: selectRender })
            return {
                data: {
                    tag: 'Bookmark',
                    key: bookmark.key
                },
                children: render,
            }
        })
    //
    // TODO: Refactor the below by borrowing the graph utilities from mtw-utilities,
    // making a Graph of references, and then applying the topologicalSort
    // to order the bookmarks
    //
    const bookmarkReferences: Record<string, string[]> = bookmarkValues
        .reduce<Record<string, string[]>>((previous, { data, children }) => {
            if (isSchemaBookmark(data)) {
                return {
                    ...previous,
                    [data.key]: extractBookmarkReferences(children)
                }    
            }
            return previous
        }, {})
    let alreadyWrittenKeys: string[] = []
    while(alreadyWrittenKeys.length < bookmarkValues.length) {
        let contentWritten = false
        bookmarkValues
            .filter(({ data }) => (
                isSchemaWithKey(data) &&
                !alreadyWrittenKeys.includes(data.key) &&
                (!(bookmarkReferences[data.key] || []).find((ref) => (!alreadyWrittenKeys.includes(ref))))
            ))
            .forEach((item) => {
                resultNormalizer.put(item, { 
                    contextStack: [{
                        key: rootNode.key,
                        tag: 'Asset',
                        index: 0
                    }]
                })
                const { data } = item
                if (isSchemaWithKey(data)) {
                    alreadyWrittenKeys.push(data.key)
                }
                contentWritten = true
            })
        if (!contentWritten) {
            break
        }
    }

    //
    // Add standardized view of all Rooms to the results
    //
    Object.values(normal)
        .filter(isNormalRoom)
        .sort(normalAlphabeticKeySort)
        .forEach((room) => {
            const render = argumentNormalizer.select({ key: room.key, selector: selectRender })
            const name = argumentNormalizer.select({ key: room.key, selector: selectName })
            const exits = argumentNormalizer.select({ key: room.key, selector: selectExits })
            resultNormalizer.put({
                data: {
                    tag: 'Room',
                    key: room.key
                },
                children: ([
                    ...(name.length ? [{
                        data: { tag: 'Name' as const },
                        children: name
                    }] : []),
                    ...(render.length ? [{
                        data: { tag: 'Description' as const },
                        children: render
                    }] : []),
                    ...exits,
                ])
            }, { 
                contextStack: [{
                    key: rootNode.key,
                    tag: 'Asset',
                    index: 0
                }]
            })

        })

    //
    // Add standardized view of all Features to the results
    //
    Object.values(normal)
        .filter(isNormalFeature)
        .sort(normalAlphabeticKeySort)
        .forEach((feature) => {
            const render = argumentNormalizer.select({ key: feature.key, selector: selectRender })
            const name = argumentNormalizer.select({ key: feature.key, selector: selectName })
            resultNormalizer.put({
                data: {
                    tag: 'Feature',
                    key: feature.key
                },
                children: [
                    ...(name.length ? [{
                        data: { tag: 'Name' as const },
                        children: name
                    }] : []),
                    ...(render.length ? [{
                        data: { tag: 'Description' as const },
                        children: render
                    }] : []),
                ]
            }, { 
                contextStack: [{
                    key: rootNode.key,
                    tag: 'Asset',
                    index: 0
                }]
            })

        })

    //
    // Add standardized view of all Knowledges to the results
    //
    Object.values(normal)
        .filter(isNormalKnowledge)
        .sort(normalAlphabeticKeySort)
        .forEach((knowledge) => {
            const render = argumentNormalizer.select({ key: knowledge.key, selector: selectRender })
            const name = argumentNormalizer.select({ key: knowledge.key, selector: selectName })
            resultNormalizer.put({
                data: {
                    tag: 'Knowledge',
                    key: knowledge.key
                },
                children: [
                    ...(name.length ? [{
                        data: { tag: 'Name' as const },
                        children: name
                    }] : []),
                    ...(render.length ? [{
                        data: { tag: 'Description' as const },
                        children: render
                    }] : []),
                ]
            }, { 
                contextStack: [{
                    key: rootNode.key,
                    tag: 'Asset',
                    index: 0
                }]
            })

        })

    //
    // Add standardized view of all Maps to the results
    //
    Object.values(normal)
        .filter(isNormalMap)
        .sort(normalAlphabeticKeySort)
        .forEach((map) => {
            const rooms = argumentNormalizer.select({ key: map.key, selector: selectMapRooms })
            const nameChildren = argumentNormalizer.select({ key: map.key, selector: selectName })
            const images = argumentNormalizer.select({ key: map.key, selector: selectImages })

            resultNormalizer.put({
                data: {
                    tag: 'Map',
                    key: map.key,
                    name: [{ tag: 'String', value: ' '}],
                    rooms: [],
                    images: []
                },
                children: [
                    ...(nameChildren.length ? [{
                        data: { tag: 'Name' as const },
                        children: nameChildren
                    }] : []),
                    ...images,
                    ...rooms
                ]
            }, { 
                contextStack: [{
                    key: rootNode.key,
                    tag: 'Asset',
                    index: 0
                }]
            })

        })

    //
    // Add standardized view of all Messages to the results
    //
    Object.values(normal)
        .filter(isNormalMessage)
        .sort(normalAlphabeticKeySort)
        .forEach((message) => {
            const render = argumentNormalizer.select({ key: message.key, selector: selectRender })
            const rooms = argumentNormalizer.select({ key: message.key, selector: selectRooms })
            resultNormalizer.put({
                data: {
                    tag: 'Message',
                    key: message.key,
                    //
                    // TODO: Create specialized rooms selector that recreates the legacy structure
                    //
                    rooms: [],
                },
                children: [
                    ...render,
                    ...rooms
                ]
            }, { 
                contextStack: [{
                    key: rootNode.key,
                    tag: 'Asset',
                    index: 0
                }]
            })

        })

    //
    // Add standardized view of all Moments to the results
    //
    Object.values(normal)
        .filter(isNormalMoment)
        .sort(normalAlphabeticKeySort)
        .forEach((moment) => {
            const children = extractConditionedMomentChildren(argumentNormalizer)(moment)
            resultNormalizer.put({
                data: {
                    tag: 'Moment',
                    key: moment.key
                },
                children
            }, { 
                contextStack: [{
                    key: rootNode.key,
                    tag: 'Asset',
                    index: 0
                }]
            })

        })

    //
    // Add standardized view of all Variables to the results
    //
    Object.values(normal)
        .filter(isNormalVariable)
        .sort(normalAlphabeticKeySort)
        .forEach((variable) => {
            resultNormalizer.put({
                data: {
                    tag: 'Variable',
                    key: variable.key,
                    default: variable.default
                },
                children: []
            }, { 
                contextStack: [{
                    key: rootNode.key,
                    tag: 'Asset',
                    index: 0
                }]
            })

        })

    //
    // Add standardized view of all ComputedValues in graph-sorted order
    //
    const computedValues: SchemaComputedTag[] = Object.values(normal)
        .filter(isNormalComputed)
        .sort(normalAlphabeticKeySort)
        .map((computed) => ({
            tag: 'Computed',
            key: computed.key,
            src: computed.src,
            dependencies: computed.dependencies
        }))
    const computedReferences: Record<string, string[]> = computedValues
        .reduce<Record<string, string[]>>((previous, { key, dependencies }) => {
            return {
                ...previous,
                [key]: (dependencies ?? []).filter((depend) => (computedValues.map(({ key }) => (key)).includes(depend)))
            }
        }, {})
    let alreadyWrittenComputes: string[] = []
    while(alreadyWrittenComputes.length < computedValues.length) {
        let contentWritten = false
        computedValues
            .filter(({ key }) => (!alreadyWrittenComputes.includes(key)))
            .filter(({ key }) => (!(computedReferences[key] || []).find((ref) => (!alreadyWrittenComputes.includes(ref)))))
            .forEach((item) => {
                resultNormalizer.put({ data: item, children: [] }, { 
                    contextStack: [{
                        key: rootNode.key,
                        tag: 'Asset',
                        index: 0
                    }]
                })
                alreadyWrittenComputes.push(item.key)
                contentWritten = true
            })
        if (!contentWritten) {
            break
        }
    }

    //
    // Add standardized view of all Actions to the results
    //
    Object.values(normal)
        .filter(isNormalAction)
        .sort(normalAlphabeticKeySort)
        .forEach((action) => {
            resultNormalizer.put({
                data: {
                    tag: 'Action',
                    key: action.key,
                    src: action.src
                },
                children: []
            }, { 
                contextStack: [{
                    key: rootNode.key,
                    tag: 'Asset',
                    index: 0
                }]
            })

        })

    //
    // Add standardized view of all Imports to the results
    //
    Object.values(normal)
        .filter(isNormalImport)
        .sort(normalAlphabeticKeySort)
        .forEach((importItem) => {
            resultNormalizer.put({
                data: {
                    tag: 'Import',
                    from: importItem.from,
                    mapping: extractImportMapping(argumentNormalizer)(importItem)
                },
                //
                // TODO: Children in Import
                //
                children: []
            }, { 
                contextStack: [{
                    key: rootNode.key,
                    tag: 'Asset',
                    index: 0
                }]
            })
        })

    //
    // Add standardized view of all Exports to the results
    //
    const exportItems = Object.values(normal)
        .filter(({ tag }) => (isImportableTag(tag)))
        .filter(({ key, exportAs }) => (exportAs && exportAs !== key))
        .sort(normalAlphabeticKeySort)
        .map(({ tag, key, exportAs }) => (exportAs ? { [exportAs]: { key, type: tag }} : {}))

    if (exportItems.length) {
        resultNormalizer.put({
            data: {
                tag: 'Export',
                mapping: Object.assign({}, ...exportItems)
            },
            //
            // TODO: Children in export
            //
            children: []
        }, { 
            contextStack: [{
                key: rootNode.key,
                tag: 'Asset',
                index: 0
            }]
        })
    }

    return resultNormalizer.normal
}

export default standardizeNormal
