import { excludeUndefined } from "../../lib/lists"
import { objectFilter } from "../../lib/objects"
import { isImportable, isSchemaExport, isSchemaImport, SchemaWithKey } from "../../schema/baseClasses"
import { treeNodeTypeguard } from "../../tree/baseClasses"
import { SerializableStandardForm, StandardNDJSON } from "../baseClasses"

export const serialize = (standardForm: SerializableStandardForm): StandardNDJSON => {
    if (standardForm.tag === 'Character') {
        return []
    }
    const componentTags: SchemaWithKey["tag"][] = ['Bookmark', 'Room', 'Feature', 'Knowledge', 'Map', 'Theme', 'Message', 'Moment', 'Variable', 'Computed', 'Action']
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