import SourceStream from "../parser/tokenizer/sourceStream"
import { isSchemaExit, isSchemaWithContents, isSchemaWithKey, SchemaTag } from "../schema/baseClasses"
import { SearchParse, SearchTokenPropertyLegal } from "./search/baseClasses"
import searchParse from "./search/parse"
import searchTokenizer from './search/tokenize'

const recursiveTagSearchReduce = (tag: SchemaTag["tag"]) => (previous: SchemaTag[], node: SchemaTag): SchemaTag[] => {
    if (node.tag === tag) {
        return [
            ...previous,
            node
        ]
    }
    else {
        if (isSchemaWithContents(node)) {
            const contents: SchemaTag[] = node.contents
            return contents.reduce(recursiveTagSearchReduce(tag), previous)
        }
        else {
            return previous
        }
    }
}

const propertyFilter = (key: SearchTokenPropertyLegal, value: string) => (node: SchemaTag): boolean => {
    switch(key) {
        case 'key':
            if (isSchemaWithKey(node)) {
                return node.key === value
            }
            else {
                return false
            }
        case 'from':
            if (isSchemaExit(node)) {
                return node.from === value
            }
            else {
                return false
            }
        case 'to':
            if (isSchemaExit(node)) {
                return node.to === value
            }
            else {
                return false
            }
    }
    return false
}

const nthChildReducer = (n: number) => (previous: SchemaTag[], node: SchemaTag): SchemaTag[] => {
    if (isSchemaWithContents(node)) {
        const contents: SchemaTag[] = node.contents
        if (contents.length > n) {
            return [
                ...previous,
                contents[n]
            ]
        }
    }
    return previous
}

const isSameSchemaTag = (a: SchemaTag) => (b: SchemaTag) => (
    (a.parse.startTagToken === b.parse.startTagToken) && (a.parse.endTagToken === b.parse.endTagToken)
)

const searchCombiner = (a: SchemaTag[], b: SchemaTag[]): SchemaTag[] => {
    const uniqueAdditions = b.filter((node) => (!a.find(isSameSchemaTag(node))))
    return [
        ...a,
        ...uniqueAdditions
    ]
}

const searchReducer = (previous: SchemaTag[], term: SearchParse): SchemaTag[] => {
    switch(term.type) {
        case 'Tag':
            return previous.reduce(recursiveTagSearchReduce(term.tag), [])
        case 'Property':
            return previous.filter(propertyFilter(term.key, term.value))
        case 'First':
            if (previous.length) {
                return [previous[0]]
            }
            else {
                return []
            }
        case 'NthChild':
            return previous.reduce(nthChildReducer(term.n), [])
        case 'Serial':
            return term.items.reduce(searchReducer, previous)
        case 'Parallel':
            return term.items.reduce((accumulator, item) => {
                const newResults = searchReducer(previous, item)
                return searchCombiner(accumulator, newResults)
            }, [])
    }
    return previous
}

export const newWMLSelectorFactory = (schema: SchemaTag[], options: { currentNodes?: SchemaTag[] } = {}) => (search: SearchParse[]): SchemaTag[] => {
    return search.reduce(searchReducer, options.currentNodes || schema)
}