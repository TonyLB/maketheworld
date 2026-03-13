import { isSchemaString } from "@tonylb/mtw-base/ts/schema/renderTree"

/**
 * Flatten a RenderTree-like array (or API JSON) to plain text for display.
 * Handles string items, isSchemaString data values, and string children.
 */
export function renderTreeToPlainText(tree: unknown): string {
    if (!tree || !Array.isArray(tree) || tree.length === 0) return ""
    return tree
        .map((item: unknown) => {
            if (typeof item === "string") return item
            if (item && typeof item === "object" && "data" in item) {
                const data = (item as { data?: unknown }).data
                if (data && typeof data === "object" && isSchemaString(data)) {
                    return (data as { value: string }).value
                }
                const children = (item as { children?: unknown[] }).children
                if (Array.isArray(children) && children.length > 0) {
                    return children.filter((c): c is string => typeof c === "string").join("")
                }
            }
            return ""
        })
        .filter(Boolean)
        .join(" ")
        .trim()
}
