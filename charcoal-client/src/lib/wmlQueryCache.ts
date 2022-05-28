import { WMLQuery } from '../wml/wmlQuery'

let wmlQueryCacheArray: Record<string, WMLQuery> = {}

export const wmlQueryFromCache = ({ key, value = '' }: { key: string, value?: string }): WMLQuery => {
    if (wmlQueryCacheArray[key]) {
        return wmlQueryCacheArray[key]
    }
    wmlQueryCacheArray[key] = new WMLQuery(value)
    return wmlQueryCacheArray[key]
}
