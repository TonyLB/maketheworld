export const cacheDB = {
    clientSettings: {
        where: () => ({
            startsWith: () => ({
                delete: jest.fn
            })
        })
    }
}

export default cacheDB
