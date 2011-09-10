function nowUTC() {
    var now = new Date();
    return now.getTime() + now.getTimezoneOffset();
}