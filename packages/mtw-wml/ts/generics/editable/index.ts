export type StandardEditableFactoryProps<T> = {

}

export interface StandardEditable<T> {
}

export type StandardEditableFactoryReturn<T> = {
    generatedClass: new () => StandardEditable<T>
}

export const standardEditableFactory = <T>(props: StandardEditableFactoryProps<T>): StandardEditableFactoryReturn<T> => {
    class generatedClass implements StandardEditable<T> {
        constructor() {
            
        }
    }
    return {
        generatedClass
    }
}