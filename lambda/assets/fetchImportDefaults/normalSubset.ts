//
// normalSubset takes a NormalForm and a set of keys for Rooms, Features, Bookmarks, and Maps,
// and returns a *subset* NormalForm that contains a listing of only those things needed in order
// to render the structure of the object specified by the given keys
//

import { NormalForm } from "@tonylb/mtw-wml/dist/normalize/baseClasses"

export const normalSubset = (normal: NormalForm, keys: string[]): NormalForm => {
    return {}
}

export default normalSubset
