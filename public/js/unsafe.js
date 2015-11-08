function evalWith(string, obj) {
    with(obj) {
        return eval(string);
    }
}