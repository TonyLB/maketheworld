export const paginateList = <V extends any>(items: V[], pageSize: number): V[][] => {
    const { requestLists, current } = items
        .reduce<{ requestLists: V[][], current: V[] }>((({ current, requestLists }, item) => {
            if (current.length >= pageSize) {
                return {
                    requestLists: [ ...requestLists, current ],
                    current: [item]
                }
            }
            else {
                return {
                    requestLists,
                    current: [...current, item]
                }
            }
        }), { current: [], requestLists: []})
    return [...requestLists, current]
}

export default paginateList
