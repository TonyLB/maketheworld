import { vi } from 'vitest'
export const cacheDB = {
    clientSettings: {
        where: () => ({
            startsWith: () => ({
                delete: vi.fn
            })
        })
    }
}

export default cacheDB
