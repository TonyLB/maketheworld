/**
 * Utility for creating reusable cache key validation patterns
 * 
 * This abstracts the common pattern of generating and parsing delimited cache keys
 * with validation, while allowing custom implementations where needed.
 */

export class CacheKeyValidator {
    /**
     * Creates a validator for delimited cache keys
     * 
     * @param delimiter - The delimiter used to separate key components
     * @param keyNames - Array of key component names in order
     * @param validators - Validation functions for each key component
     * @returns Object with generateKey and parseKey functions
     */
    static createDelimitedValidator<T extends Record<string, any>>(
        delimiter: string,
        keyNames: (keyof T)[],
        validators: Record<keyof T, (value: string) => boolean>
    ) {
        return {
            generateKey: (...values: T[keyof T][]) => {
                if (values.length !== keyNames.length) {
                    throw new Error(`Expected ${keyNames.length} values, got ${values.length}`)
                }
                return values.join(delimiter)
            },
            
            parseKey: (key: string): T => {
                const parts = key.split(delimiter)
                if (parts.length !== keyNames.length) {
                    throw new Error(`Invalid cache key format: ${key}. Expected ${keyNames.length} parts separated by '${delimiter}'`)
                }
                
                const result = {} as T
                keyNames.forEach((name, index) => {
                    const value = parts[index]
                    if (!validators[name](value)) {
                        throw new Error(`Invalid ${String(name)} in cache key: ${key}. Value: ${value}`)
                    }
                    result[name] = value as T[keyof T]
                })
                return result
            }
        }
    }

    /**
     * Creates a simple single-key validator
     * 
     * @param validator - Validation function for the key
     * @returns Object with generateKey and parseKey functions
     */
    static createSimpleValidator<T extends string>(
        validator: (value: string) => value is T
    ) {
        return {
            generateKey: (key: T) => key,
            parseKey: (key: string): T => {
                if (!validator(key)) {
                    throw new Error(`Invalid cache key: ${key}`)
                }
                return key
            }
        }
    }
}

