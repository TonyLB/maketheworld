import { Standardizer } from ".."
import { excludeUndefined } from "../../lib/lists"
import { objectFilter } from "../../lib/objects"
import { isImportable, isSchemaExport, isSchemaImport, SchemaTag, SchemaWithKey } from "../../schema/baseClasses"
import { treeNodeTypeguard } from "../../tree/baseClasses"
import { SerializableStandardAsset, SerializableStandardComponent, SerializableStandardForm, SerializeNDJSONMixin, StandardNDJSON } from "../baseClasses"

export const serialize = (standardForm: SerializableStandardForm): StandardNDJSON => {
    if (standardForm.tag === 'Character') {
        return []
    }
    const componentTags: SchemaWithKey["tag"][] = ['Image', 'Bookmark', 'Room', 'Feature', 'Knowledge', 'Map', 'Theme', 'Message', 'Moment', 'Variable', 'Computed', 'Action']
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
    return [
        { tag: 'Asset', key: standardForm.key },
        ...(componentTags
            .map((tag) => {
                const keys = Object.keys(objectFilter(standardForm.byId, ({ tag: checkTag }) => (checkTag === tag)))
                return keys
                    .map((key) => (standardForm.byId[key]))
                    .filter(excludeUndefined)
                    .map((standardComponent) => (standardComponent.key in importByKey
                        ? { ...standardComponent, from: importByKey[standardComponent.key] }
                        : standardComponent
                    ))
                    .map((standardComponent) => (standardComponent.key in exportByKey
                        ? { ...standardComponent, exportAs: exportByKey[standardComponent.key] }
                        : standardComponent
                    ))
            }).flat(1)
        )
    ]
}

export const deserialize = (ndjson: StandardNDJSON ): SerializableStandardForm  => {
    let assetKey: string | undefined
    let byId: Record<string, SerializableStandardComponent> = {}
    let importsBySource: Record<string, { key: string; as?: string }[]> = {}
    ndjson.forEach((component) => {
        if (component.tag === 'Asset') {
            assetKey = component.key
        }
        else {
            byId[component.key] = component
            if (component.from) {
                importsBySource[component.from.assetId] = [
                    ...(importsBySource[component.from.assetId] || []),
                    { key: component.from.key, as: component.from.key !== component.key ? component.key : undefined }
                ]
            }
        }
    })
    if (!assetKey) {
        throw new Error('No asset line found in deserialize')
    }
    const standardizer = new Standardizer([{ data: { tag: 'Asset', key: assetKey, Story: undefined }, children: [] }])
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
            }))
    ]
    return standardForm
}
