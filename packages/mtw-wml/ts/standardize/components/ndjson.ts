import StandardComponentAbstract from "./abstract"

export const ndjsonWrap = <TBase extends new (...args: any[]) => StandardComponentAbstract>(Base: TBase, label: string) => {
    return class NDJSONWrapped extends Base {
        static fromNDJSON(payload: any): NDJSONWrapped {
            if (payload && ('key' in payload)) {
                const returnValue = ('universalKey' in payload)
                    ? (new NDJSONWrapped(payload)).withUniversalKey(payload.universalKey)
                    : new NDJSONWrapped(payload)
                return returnValue
            }
            else {
                throw new Error(`Type mismatch in ${label} fromNDJSON`)
            }
        }    
    }
}
