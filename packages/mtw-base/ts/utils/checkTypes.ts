export enum CheckTypes {
    STRING = 'string',
    NUMBER = 'number',
    BOOLEAN = 'boolean',
}

type CheckTypesProps = {
    required: Record<string, CheckTypes>;
    optional?: Record<string, CheckTypes>;
}

export const checkTypes = (props: CheckTypesProps) => (args: any): boolean => {
    if (typeof args !== 'object') return false
    const required = Object.entries(props.required).every(([key, type]) => typeof args[key] === type)
    const optional = !props.optional || Object.entries(props.optional).every(([key, type]) => !args[key] || typeof args[key] === type)
    return required && optional
}

export default checkTypes
