const assert = (condition : boolean, message = "Assertion failed") => {
    if (!condition) {
        throw new Error(message);
    }
};

export default assert;