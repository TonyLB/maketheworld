import {
    SchemaExportTag,
    SchemaImportTag,
    SchemaTag
} from "../schema/baseClasses";
import { NormalItem, NormalizeTagMismatchError } from "./baseClasses";

export const rebuildContentsFromImport = (node: SchemaImportTag): SchemaTag[] => {
    return Object.entries(node.mapping).map<SchemaTag>(([key, { type, key: internalKey }]) => {
        const keyAssign = { key, from: internalKey || key }
        switch(type) {
            case 'Room':
                return {
                    ...keyAssign,
                    tag: 'Room'
                }
            case 'Feature':
                return {
                    ...keyAssign,
                    tag: 'Feature'
                }
            case 'Knowledge':
                return {
                    ...keyAssign,
                    tag: 'Knowledge'
                }
            case 'Variable':
                return {
                    ...keyAssign,
                    tag: 'Variable',
                }
            case 'Computed':
                return {
                    ...keyAssign,
                    tag: 'Computed',
                    from: internalKey,
                    src: ''
                }
            case 'Action':
                return {
                    ...keyAssign,
                    tag: 'Action',
                    src: ''
                }
            case 'Map':
                return {
                    ...keyAssign,
                    tag: 'Map',
                    name: [],
                    rooms: [],
                    images: []
                }
            //
            // TODO: Add import for Bookmarks
            //
            default:
                throw new NormalizeTagMismatchError(`"${type}" tag not allowed in import`)
        }
    })
}

export const buildNormalPlaceholdersFromExport = (node: SchemaExportTag): NormalItem[] => {
    return Object.entries(node.mapping).map<NormalItem>(([key, { type, key: internalKey }]) => {
        const keyAssign = { exportAs: key, key: internalKey || key }
        switch(type) {
            case 'Room':
                return {
                    ...keyAssign,
                    tag: 'Room',
                    appearances: []
                }
            case 'Feature':
                return {
                    ...keyAssign,
                    tag: 'Feature',
                    appearances: []
                }
            case 'Knowledge':
                return {
                    ...keyAssign,
                    tag: 'Knowledge',
                    appearances: []
                }
            case 'Variable':
                return {
                    ...keyAssign,
                    tag: 'Variable',
                    default: '',
                    appearances: []
                }
            case 'Computed':
                return {
                    ...keyAssign,
                    tag: 'Computed',
                    src: '',
                    appearances: []
                }
            case 'Action':
                return {
                    ...keyAssign,
                    tag: 'Action',
                    src: '',
                    appearances: []
                }
            case 'Map':
                return {
                    ...keyAssign,
                    tag: 'Map',
                    appearances: []
                }
            //
            // TODO: Add export for Bookmarks
            //
            default:
                throw new NormalizeTagMismatchError(`"${type}" tag not allowed in export`)
        }
    })}