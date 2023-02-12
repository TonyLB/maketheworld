//
// standardizeNormal creates a new NormalForm with the exact same semantic content as the input,
// but with everything organized in a standard structure (see README.standardize.md)
//

import Normalizer from ".";
import { NormalForm, isNormalAsset, isNormalRoom, NormalItem, ComponentRenderItem, isNormalCondition, NormalRoom, NormalFeature, NormalBookmark, ComponentAppearance, isNormalFeature } from "./baseClasses"
import { SchemaTaggedMessageLegalContents, SchemaConditionTagDescriptionContext, isSchemaRoom, isSchemaFeature, isSchemaBookmark, SchemaExitTag, SchemaConditionTagRoomContext, SchemaRoomLegalContents } from "../schema/baseClasses"

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

    return resultNormalizer.normal
}

export default standardizeNormal
