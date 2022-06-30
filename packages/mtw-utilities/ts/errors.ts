import { DEVELOPER_MODE } from './constants'

export const asyncSuppressExceptions = async (func: () => Promise<void | undefined | Record<string, any> | any[]>, catchException: () => Promise<void | undefined | Record<string, any> | any[]> = async () => {}) => {
    if (DEVELOPER_MODE) {
        return await func()
    }
    else {
        try {
            return await func()
        }
        catch {
            return await catchException()
        }
    }
}
