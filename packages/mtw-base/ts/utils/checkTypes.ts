export enum CheckTypes {
    STRING = 'string',
    NUMBER = 'number',
    BOOLEAN = 'boolean',
    OBJECT = 'object',
}

type CheckTypesProps = {
    required: Record<string, CheckTypes>;
    optional?: Record<string, CheckTypes>;
    values?: Record<string, any>;
}

export const checkTypes = (props: CheckTypesProps) => (args: any): boolean => {
    if (typeof args !== 'object') return false
    const required = Object.entries(props.required).every(([key, type]) => typeof args[key] === type)
    const optional = !props.optional || Object.entries(props.optional).every(([key, type]) => !args[key] || typeof args[key] === type)
    const values = !props.values || Object.entries(props.values).every(([key, value]) => {
        if (typeof value === 'function') {
            return value(args[key]);
        }
        return !args[key] || args[key] === value;
    });
    return required && optional && values
}

export default checkTypes
