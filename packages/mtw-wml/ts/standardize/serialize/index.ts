import { excludeUndefined } from "../../lib/lists"
import { objectFilter } from "../../lib/objects"
import { SchemaWithKey } from "../../schema/baseClasses"
import { SerializableStandardForm, StandardNDJSON } from "../baseClasses"

export const serialize = (standardForm: SerializableStandardForm): StandardNDJSON => {
    if (standardForm.tag === 'Character') {
        return []
    }
    const componentTags: SchemaWithKey["tag"][] = ['Bookmark', 'Room', 'Feature', 'Knowledge', 'Map', 'Theme', 'Message', 'Moment', 'Variable', 'Computed', 'Action']
    return [
        { tag: 'Asset', key: standardForm.key },
        ...(componentTags
            .map((tag) => {
                const keys = Object.keys(objectFilter(standardForm.byId, ({ tag: checkTag }) => (checkTag === tag)))
                return keys
                    .map((key) => (standardForm.byId[key]))
                    .filter(excludeUndefined)
            }).flat(1)
        )
    ]
}