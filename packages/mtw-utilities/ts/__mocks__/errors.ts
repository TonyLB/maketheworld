import { DEVELOPER_MODE } from './constants'

export const asyncSuppressExceptions = async (func, catchException = async () => ({})) => {
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
