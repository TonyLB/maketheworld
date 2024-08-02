import { Standardizer } from ".."
import { excludeUndefined } from "../../lib/lists"
import { objectFilter } from "../../lib/objects"
import { isImportable, isSchemaExport, isSchemaImport, SchemaTag, SchemaWithKey } from "../../schema/baseClasses"
import { treeNodeTypeguard } from "../../tree/baseClasses"
import { SerializableStandardComponent, SerializableStandardForm, SerializeNDJSONMixin, StandardNDJSON } from "../baseClasses"

export const serialize = (
    standardForm: SerializableStandardForm,
    universalKey: (searchKey: string, tag: SchemaWithKey["tag"]) => string | undefined = () => (undefined),
    fileAssociation: (searchKey: string) => string | undefined = () => (undefined)
): StandardNDJSON => {
    const componentTags: SchemaWithKey["tag"][] = standardForm.tag === 'Character' ? ['Image'] : ['Image', 'Bookmark', 'Room', 'Feature', 'Knowledge', 'Map', 'Theme', 'Message', 'Moment', 'Variable', 'Computed', 'Action']
    const importByKey = Object.assign({}, ...standardForm.metaData
        .filter(treeNodeTypeguard(isSchemaImport))
        .map(({ data, children }) => (
            children
                .map(({ data }) => (data))
                .filter(isImportable)
                .map(({ as, key }) => ({
                    [as ?? key]: {
                        assetId: data.from,
                        key
                    }
                }))
        ))
        .flat(1)
    ) as Record<string, { assetId: string, key: string }>
    const exportByKey = Object.assign({}, ...standardForm.metaData
        .filter(treeNodeTypeguard(isSchemaExport))
        .map(({ children }) => (
            children
                .map(({ data }) => (data))
                .filter(isImportable)
                .map(({ as, key }) => ({
                    [key]: as
                }))
        ))
        .flat(1)
    ) as Record<string, string>
    const addNDJSONSerializeKeys = (standardComponent: SerializableStandardComponent): SerializableStandardComponent & SerializeNDJSONMixin => ({
        ...standardComponent,
        ...(standardComponent.key in importByKey ? { from: importByKey[standardComponent.key]} : {}),
        ...(standardComponent.key in exportByKey ? { exportAs: exportByKey[standardComponent.key]} : {}),
        universalKey: universalKey(standardComponent.key, standardComponent.tag),
        fileName: fileAssociation(standardComponent.key)
    })
    const baseItem = standardForm.tag === 'Character'
        ? addNDJSONSerializeKeys(standardForm.byId[standardForm.key])
        : { tag: 'Asset' as const, key: standardForm.key }
    return [
        baseItem,
        ...(componentTags
            .map((tag) => {
                const keys = Object.keys(objectFilter(standardForm.byId, ({ tag: checkTag }) => (checkTag === tag)))
                return keys
                    .map((key) => (standardForm.byId[key]))
                    .filter(excludeUndefined)
                    .map(addNDJSONSerializeKeys)
            }).flat(1)
        )
    ]
}

export const deserialize = (ndjson: StandardNDJSON ): { standardForm: SerializableStandardForm, universalKeys: Record<string, string>, fileAssociations: Record<string, string> }  => {
    let assetKey: string | undefined
    let characterKey: string | undefined
    let byId: Record<string, SerializableStandardComponent> = {}
    let importsBySource: Record<string, { key: string; as?: string }[]> = {}
    let exports: Record<string, string> = {}
    let universalKeys: Record<string, string> = {}
    let fileAssociations: Record<string, string> = {}
    ndjson.forEach((component) => {
        if (component.tag === 'Asset') {
            assetKey = component.key
        }
        else {
            if (component.tag === 'Character') {
                characterKey = component.key
            }
            byId[component.key] = component
            if (component.from) {
                importsBySource[component.from.assetId] = [
                    ...(importsBySource[component.from.assetId] || []),
                    { key: component.from.key, as: component.from.key !== component.key ? component.key : undefined }
                ]
            }
            if (component.exportAs) {
                exports[component.key] = component.exportAs
            }
            if (component.universalKey) {
                universalKeys[component.key] = component.universalKey
            }
            if (component.fileName) {
                fileAssociations[component.key] = component.fileName
            }
        }
    })
    const tempKey = assetKey || characterKey
    if (!tempKey) {
        throw new Error('No asset line found in deserialize')
    }
    //
    // TODO: Figure out a better way to create base standardizer from NDJSON
    //
    const standardizer = new Standardizer([{
        data: { tag: 'Asset', key: tempKey, Story: undefined },
        children: []
    }])
    standardizer.deserialize({
        key: tempKey,
        tag: assetKey ? 'Asset' : 'Character',
        byId,
        metaData: []
    })
    let standardForm = standardizer.stripped
    standardForm.byId = byId
    standardForm.metaData = [
        ...Object.entries(importsBySource)
            .map(([assetId, imports]) => ({
                data: { tag: 'Import' as const, from: assetId, mapping: {} },
                children: imports.map(({ key, as }) => {
                    const lookupKey = as ?? key
                    const lookupComponent = byId[lookupKey]
                    if (!lookupComponent) {
                        throw new Error('Import not represented in byId in deserialize')
                    }
                    if (lookupComponent.tag === 'Character') {
                        throw new Error('Import cannot accept character components')
                    }
                    return { data: { tag: lookupComponent.tag, key, as } as SchemaTag, children: [] }
                })
            })),
        ...(Object.entries(exports).length
            ? [{
                data: { tag: 'Export' as const, mapping: {} },
                children: Object.entries(exports).map(([key, as]) => {
                    const lookupComponent = byId[key]
                    if (!lookupComponent) {
                        throw new Error('Export not represented in byId in deserialize')
                    }
                    if (lookupComponent.tag === 'Character') {
                        throw new Error('Export cannot accept character components')
                    }
                    return { data: { tag: lookupComponent.tag, key, as: as !== key ? as : undefined } as SchemaTag, children: [] }
                })
            }]
            : []
        )
    ]
    return { standardForm, universalKeys, fileAssociations }
}
