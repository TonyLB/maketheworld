import {
    CustomBeforeBlock,
    CustomBlock,
    CustomReplaceBlock,
    isCustomBeforeBlock,
    isCustomIfWrapper,
    isCustomLink,
    isCustomNewIfWrapper,
    isCustomParagraph,
    isCustomParagraphContents,
    isCustomReplaceBlock,
    isCustomText
} from "../baseClasses"
import { GenericTree, TreeId } from "@tonylb/mtw-wml/dist/tree/baseClasses"
import { SchemaOutputTag, SchemaTag, isSchemaOutputTag } from "@tonylb/mtw-wml/dist/schema/baseClasses"
import { stripIDFromTree } from "@tonylb/mtw-wml/dist/tree/genericIDTree"
import { selectById } from "@tonylb/mtw-wml/dist/normalize/selectors/byId"
import { treeTypeGuard } from "@tonylb/mtw-wml/dist/tree/filter"

//
// TODO: Refactor descendantsToRender to return GenericTree<SchemaTag, { id: string }>
//
export const descendantsToRender = (schema: GenericTree<SchemaTag, TreeId>) => (items: (CustomBeforeBlock | CustomReplaceBlock | CustomBlock)[]): GenericTree<SchemaOutputTag> => {
    const returnValue = items.reduce<GenericTree<SchemaOutputTag>>((tree, item, index) => {
        if (isCustomParagraph(item) || (isCustomParagraphContents(item) && (isCustomBeforeBlock(item) || isCustomReplaceBlock(item)))) {
            return item.children
                .filter((item) => (!(isCustomText(item) && !item.text)))
                .reduce<GenericTree<SchemaOutputTag>>((previous, item) => {
                    if (isCustomNewIfWrapper(item)) {
                        return [
                            ...previous,
                            {
                                data: { tag: 'If' },
                                children: [{
                                    data: { tag: 'Statement', if: '' },
                                    children: []
                                }]
                            }
                        ]
                    }
                    if (isCustomIfWrapper(item)) {
                        const node = selectById(item.treeId)(schema)
                        if (typeof node === 'undefined') {
                            return previous
                        }
                        return [
                            ...previous,
                            ...stripIDFromTree(treeTypeGuard({ tree: [node], typeGuard: isSchemaOutputTag }))
                        ]
                    }
                    if (isCustomLink(item)) {
                        return [
                            ...previous,
                            {
                                data: {
                                    tag: 'Link', 
                                    to: item.to,
                                    text: item.children
                                    .filter((child) => ('text' in child))
                                    .map(({ text }) => (text))
                                    .join('')
                                },
                                children: []
                            }
                        ]
                    }
                    if (isCustomBeforeBlock(item) || isCustomReplaceBlock(item)) {
                        return [
                            ...previous,
                            {
                                data: { tag: item.type === 'before' ? 'Before' : 'Replace' },
                                children: descendantsToRender(schema)([item])
                            }
                        ]
                    }
                    if ('text' in item) {
                        const lastItem = previous.at(-1)?.data
                        if (lastItem && lastItem.tag === 'String') {
                            return [
                                ...previous.slice(0, -1),
                                { data: { tag: 'String', value: lastItem.value.trimEnd() }, children: [] },
                                { data: { tag: 'br' }, children: [] },
                                { data: { tag: 'String', value: item.text }, children: [] }
                            ]
                        }
                        return [
                            ...previous,
                            item.text.trim()
                                ? { data: { tag: 'String', value: item.text }, children: [] }
                                : { data: { tag: 'Space' }, children: [] }
                        ]
                    }
                    return previous
                }, tree)
        }
        return tree
    }, [])
    return returnValue
}

export default descendantsToRender
