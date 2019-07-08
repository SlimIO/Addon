
module.exports = (text) => {
    if (typeof text !== "string") {
        throw new TypeError("Expected a string");
    }

    return text
        .replace(/([\p{Ll}\d])(\p{Lu})/gu, "$1_$2")
        .replace(/(\p{Lu}+)(\p{Lu}[\p{Ll}\d]+)/gu, "$1_$2")
        .toLowerCase();
};
