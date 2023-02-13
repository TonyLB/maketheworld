//
// standardizeNormal creates a new NormalForm with the exact same semantic content as the input,
// but with everything organized in a standard structure (see README.standardize.md)
//

import Normalizer from ".";
import { NormalForm, isNormalAsset, isNormalRoom, NormalItem, ComponentRenderItem, isNormalCondition, NormalRoom, NormalFeature, NormalBookmark, ComponentAppearance, isNormalFeature, isNormalBookmark, NormalMap, isNormalMap } from "./baseClasses"
import { SchemaTaggedMessageLegalContents, SchemaConditionTagDescriptionContext, isSchemaRoom, isSchemaFeature, isSchemaBookmark, SchemaExitTag, SchemaConditionTagRoomContext, SchemaRoomLegalContents, SchemaBookmarkTag, isSchemaCondition, SchemaTaggedMessageIncomingContents, SchemaMapLegalContents, isSchemaMap, SchemaConditionTagMapContext, SchemaTag, isSchemaMapContents, isSchemaImage } from "../schema/baseClasses"
import { extractConditionedItemFromContents, extractNameFromContents } from "../schema/utils";

const normalAlphabeticKeySort = ({ key: keyA }: NormalItem, { key: keyB }: NormalItem) => (keyA.localeCompare(keyB))

const extractConditionedRender = (contextNormalizer: Normalizer) => (item: NormalRoom | NormalFeature | NormalBookmark) => {
    const { appearances } = item
    const render = (appearances as ComponentAppearance[]).reduce<SchemaTaggedMessageLegalContents[]>((previous, { contextStack }, index ) => {
        const schemaVersion = contextNormalizer._normalToSchema(item.key, index)
        if (!(schemaVersion && (isSchemaRoom(schemaVersion) || isSchemaFeature(schemaVersion) || isSchemaBookmark(schemaVersion)))) {
            return previous
        }
        const render = isSchemaBookmark(schemaVersion) ? schemaVersion.contents : schemaVersion.render
        if (!render.length) {
            return previous
        }
        const newRender = contextStack
            .filter(({ tag }) => (tag === 'If'))
            .reduceRight<SchemaTaggedMessageLegalContents[]>((previous, { key }) => {
                const ifReference = contextNormalizer.normal[key]
                if (!(ifReference && isNormalCondition(ifReference))) {
                    return previous
                }
                const returnValue: SchemaConditionTagDescriptionContext = {
                    tag: 'If' as 'If',
                    contextTag: 'Description',
                    conditions: ifReference.conditions,
                    contents: previous
                }
                return [returnValue]
            }, render)
        return [
            ...previous,
            ...newRender
        ]
    }, [])

    return render
}

const extractConditionedName = (contextNormalizer: Normalizer) => (item: NormalRoom | NormalFeature) => {
    const { appearances } = item
    const name = appearances.reduce<SchemaTaggedMessageLegalContents[]>((previous, { contextStack }, index ) => {
        const schemaVersion = contextNormalizer._normalToSchema(item.key, index)
        if (!(schemaVersion && (isSchemaRoom(schemaVersion) || isSchemaFeature(schemaVersion)))) {
            return previous
        }
        const { name } = schemaVersion
        if (!name.length) {
            return previous
        }
        const newName = contextStack
            .filter(({ tag }) => (tag === 'If'))
            .reduceRight<SchemaTaggedMessageLegalContents[]>((previous, { key }) => {
                const ifReference = contextNormalizer.normal[key]
                if (!(ifReference && isNormalCondition(ifReference))) {
                    return previous
                }
                const returnValue: SchemaConditionTagDescriptionContext = {
                    tag: 'If' as 'If',
                    contextTag: 'Description',
                    conditions: ifReference.conditions,
                    contents: previous
                }
                return [returnValue]
            }, name)
        return [
            ...previous,
            ...newName
        ]
    }, [])

    return name
}

const extractConditionedExits = (contextNormalizer: Normalizer) => (item: NormalRoom) => {
    const { appearances } = item
    const returnContents = appearances.reduce<(SchemaExitTag | SchemaConditionTagRoomContext)[]>((previous, { contextStack }, index ) => {
        const schemaVersion = contextNormalizer._normalToSchema(item.key, index)
        if (!(schemaVersion && isSchemaRoom(schemaVersion))) {
            return previous
        }
        const contents = schemaVersion.contents.filter((tag: SchemaRoomLegalContents): tag is (SchemaExitTag | SchemaConditionTagRoomContext) => (['If', 'Exit'].includes(tag.tag)))
        if (!contents.length) {
            return previous
        }
        const newContents = contextStack
            .filter(({ tag }) => (tag === 'If'))
            .reduceRight<(SchemaExitTag | SchemaConditionTagRoomContext)[]>((previous, { key }) => {
                const ifReference = contextNormalizer.normal[key]
                if (!(ifReference && isNormalCondition(ifReference))) {
                    return previous
                }
                const returnValue: SchemaConditionTagRoomContext = {
                    tag: 'If' as 'If',
                    contextTag: 'Room',
                    conditions: ifReference.conditions,
                    contents: previous
                }
                return [returnValue]
            }, contents)
        return [
            ...previous,
            ...newContents
        ]
    }, [])

    return returnContents
}

const extractBookmarkReferences = (items: SchemaTaggedMessageIncomingContents[]) => {
    const returnContents = items.reduce<string[]>((previous, item ) => {
        if (isSchemaBookmark(item)) {
            return [...(new Set([...previous, item.key]))]
        }
        if (isSchemaCondition(item)) {
            return [...(new Set([
                ...previous,
                extractBookmarkReferences(item.contents as SchemaTaggedMessageIncomingContents[])
            ]))]
        }
        return previous
    }, [])

    return returnContents
}

const extractConditionedMapContents = (contextNormalizer: Normalizer) => (item: NormalMap) => {
    const { appearances } = item
    const returnContents = appearances.reduce<SchemaMapLegalContents[]>((previous, { contextStack }, index ) => {
        const schemaVersion = contextNormalizer._normalToSchema(item.key, index)
        if (!(schemaVersion && isSchemaMap(schemaVersion))) {
            return previous
        }
        const contents = schemaVersion.contents
        if (!contents.length) {
            return previous
        }
        const newContents = contextStack
            .filter(({ tag }) => (tag === 'If'))
            .reduceRight<SchemaMapLegalContents[]>((previous, { key }) => {
                const ifReference = contextNormalizer.normal[key]
                if (!(ifReference && isNormalCondition(ifReference))) {
                    return previous
                }
                const returnValue: SchemaConditionTagMapContext = {
                    tag: 'If' as 'If',
                    contextTag: 'Map',
                    conditions: ifReference.conditions,
                    contents: previous
                }
                return [returnValue]
            }, contents)
        return [
            ...previous,
            ...newContents
        ]
    }, [])

    return returnContents
}

const stripComponentContents = <T extends SchemaTag>(items: T[]): T[] => {
    return items.map((item) => {
        if (isSchemaRoom(item)) {
            return {
                ...item,
                render: [],
                name: [],
                contents: []
            }
        }
        if (isSchemaFeature(item)) {
            return {
                ...item,
                name: [],
                render: []
            }
        }
        if (isSchemaBookmark(item)) {
            return {
                ...item,
                contents: []
            }
        }
        if (isSchemaCondition(item)) {
            return {
                ...item,
                contents: stripComponentContents(item.contents as T[])
            }
        }
        return item
    })
}

export const standardizeNormal = (normal: NormalForm): NormalForm => {
    const argumentNormalizer = new Normalizer()
    argumentNormalizer.loadNormal(normal)

    //
    // Isolate the wrapping asset node and add it to the results
    //
    const rootNode = Object.values(normal).find(({ appearances }) => (appearances.find(({ contextStack }) => (contextStack.length === 0))))
    if (!isNormalAsset(rootNode)) {
        return {}
    }
    const resultNormalizer = new Normalizer()
    resultNormalizer.put({ tag: 'Asset', key: rootNode.key, contents: [], Story: undefined }, { contextStack: [] })

    //
    // Add standardized view of all Bookmarks in graph-sorted order
    //
    const bookmarkValues: SchemaBookmarkTag[] = Object.values(normal)
        .filter(isNormalBookmark)
        .sort(normalAlphabeticKeySort)
        .map((bookmark) => ({
            tag: 'Bookmark',
            key: bookmark.key,
            contents: extractConditionedRender(argumentNormalizer)(bookmark),
        }))
    const bookmarkReferences: Record<string, string[]> = bookmarkValues
        .reduce<Record<string, string[]>>((previous, { key, contents }) => {
            return {
                ...previous,
                [key]: extractBookmarkReferences(contents)
            }
        }, {})
    let alreadyWrittenKeys: string[] = []
    while(alreadyWrittenKeys.length < bookmarkValues.length) {
        let contentWritten = false
        bookmarkValues
            .filter(({ key }) => (!alreadyWrittenKeys.includes(key)))
            .filter(({ key }) => (!(bookmarkReferences[key] || []).find((ref) => (!alreadyWrittenKeys.includes(ref)))))
            .forEach((item) => {
                resultNormalizer.put(item, { 
                    contextStack: [{
                        key: rootNode.key,
                        tag: 'Asset',
                        index: 0
                    }]
                })
                alreadyWrittenKeys.push(item.key)
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
            resultNormalizer.put({
                tag: 'Room',
                key: room.key,
                name: extractConditionedName(argumentNormalizer)(room),
                render: extractConditionedRender(argumentNormalizer)(room),
                contents: extractConditionedExits(argumentNormalizer)(room),
                global: room.global
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
            resultNormalizer.put({
                tag: 'Feature',
                key: feature.key,
                name: extractConditionedName(argumentNormalizer)(feature),
                render: extractConditionedRender(argumentNormalizer)(feature),
                contents: [],
                global: feature.global
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
            const contents = extractConditionedMapContents(argumentNormalizer)(map)
            const componentContents = (stripComponentContents(contents) as SchemaTag[]).filter(isSchemaMapContents)
            resultNormalizer.put({
                tag: 'Map',
                key: map.key,
                name: extractNameFromContents(contents),
                contents: componentContents,
                rooms: extractConditionedItemFromContents({
                    contents: contents as SchemaMapLegalContents[],
                    typeGuard: isSchemaRoom,
                    transform: ({ key, x, y }) => ({ conditions: [], key, x, y })
                }),
                images: (contents as SchemaTag[]).filter(isSchemaImage).map(({ key }) => (key))
            }, { 
                contextStack: [{
                    key: rootNode.key,
                    tag: 'Asset',
                    index: 0
                }]
            })

        })

    return resultNormalizer.normal
}

export default standardizeNormal
