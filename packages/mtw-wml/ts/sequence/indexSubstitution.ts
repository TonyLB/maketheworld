//
// IndexSubstitution is a utility class for dealing with complicated data items where only direct equality
// needs to be accounted for (e.g. Shorted Common Subsequence algorithm).  The class is created with a type
// generic specified, and accepts a comparison operator as part of the construction.  Then entries can be
// added to the mapping table with the 'add' method, and items can be mapped to and from the index table
// with 'toIndex' and 'fromIndex'
//
export class IndexSubstitution<T> {
    _compare: (A: T, B: T) => boolean;
    _mappingTable: T[] = [];
    constructor(compare: (A: T, B: T) => boolean) {
        this._compare = compare
    }

    //
    // findIndex returns the index of the item in the mapping table, -1 otherwise
    //
    findIndex(item: T): number {
        return this._mappingTable.findIndex((check) => (this._compare(check, item)))
    }

    //
    // toIndex returns the index of the item in the mapping table, adding it if necessary
    //
    toIndex(item: T): number {
        const index = this.findIndex(item)
        if (index === -1) {
            this._mappingTable.push(item)
            return this._mappingTable.length - 1
        }
        else {
            return index
        }
    }

    fromIndex(index: number): T | undefined {
        if (index >= 0 && index < this._mappingTable.length) {
            return this._mappingTable[index]
        }
        else {
            return undefined
        }
    }

    add(list: T[]): number[] {
        return list.map(this.toIndex.bind(this))
    }

}

export default IndexSubstitution
