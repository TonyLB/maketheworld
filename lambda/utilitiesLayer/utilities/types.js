export const splitType = (value) => {
    const sections = value.split('#')
    if (sections.length) {
        return [sections[0], sections.slice(1).join('#')]
    }
    else {
        return ['', '']
    }
}
