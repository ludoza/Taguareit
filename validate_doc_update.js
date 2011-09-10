function (newDoc, oldDoc, userCtx, secObj) {
    var v = require("lib/validate").init(newDoc, oldDoc, userCtx, secObj);
    // admins can do anything
    if (v.isAdmin()) return true;
    if (newDoc.type == "user") {
        if (newDoc._id != userCtx.name)
            throw({unauthorized : 'You are not logged in!'});
    }
    if (newDoc.type == "message") {
        if (newDoc.user != userCtx.name)
            throw({unauthorized : 'You are not logged in!'});
    }
}