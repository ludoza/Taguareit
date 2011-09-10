var thisUserDoc = {
    type: 'user',
    x: 0,
    y: 0,
    _id: undefined,
    time: new Date(),
    tagged: 0,
    hits: 0};
var taggedUserDoc = {
    _id: "taggedUser",
    user: undefined,
    type: "tagged"
};
var AnimationDelay = 0;
var msgDelay = 20 * 1000;
var dbName = 'taguareit';
var statusCodes = {
    OK: 200, //Request completed successfully.
    Created: 201, //Document created successfully.
    Accepted: 202, //Request has been accepted, but the corresponding operation may not have completed. This is used for background operations, such as database compaction.
    NotModified: 304, //The additional content requested has not been modified. This is used with the ETag system to identify the version of information returned.
    BadRequest: 400, //Bad request structure. The error can indicate an error with the request URL, path or headers. Differences in the supplied MD5 hash and content also trigger this error, as this may indicate message corruption.
    Unauthorized: 401, //The item requested was not available using the supplied authorization, or authorization was not supplied.
    Forbidden: 403, //The requested item or operation is forbidden.
    NotFound: 404, //The requested content could not be found. The content will include further information, as a JSON object, if available. The structure will contain two keys, error and reason. For example: {"error":"not_found","reason":"no_db_file"}
    ResourceNotAllowed: 405, //A request was made using an invalid HTTP request type for the URL requested. For example, you have requested a PUT when a POST is required. Errors of this type can also triggered by invalid URL strings.
    NotAcceptable: 406, //The requested content type is not supported by the server.
    Conflict: 409, //Request resulted in an update conflict.
    PreconditionFailed: 412, //The request headers from the client and the capabilities of the server do not match.
    BadContentType: 415, //The content types supported, and the content type of the information being requested or submitted indicate that the content type is not supported.
    RequestedRangeNotSatisfiable: 416, //The range specified in the request header cannot be satisfied by the server.
    ExpectationFailed: 417, //When sending documents in bulk, the bulk load operation failed.
    InternalServerError: 500, // The request was invalid, either because the supplied JSON was invalid, or invalid information was supplied as part of the request.
}

var timeDiffWithServer = undefined;

var Utils = {
    nowTime: function () {
        var now = new Date();
        return now.getTime();
    },
    
    timeDiff: function(ms1, ms2, abs) {
        return abs ? Math.abs(ms1 - ms2) : ms1 - ms2;    
    },
    
    serverTime:  function () {
        return Utils.nowTime() + timeDiffWithServer;
    },
    
    setupServerTime: function(dateString){
        var serverDate = new Date(dateString);
        timeDiffWithServer = Utils.timeDiff(serverDate, Utils.nowTime());    
    }  
    
    
}

var Receive = {
    users: function() {
        var jqxhr = $.couch.db(dbName).view("taguareit/users", { success: function(doc) {
                Utils.setupServerTime(jqxhr.getResponseHeader("Date"));
                for (var i = 0; i < doc.total_rows; i++) {
                    Render.createOrUpdateUserObj(doc.rows[i].value);
                }
            }});
    },
    createListeners: function () {
        var db = $.couch.db(dbName);
        var changes = db.changes(0, { filter:"taguareit/users"});
        changes.onChange( function(doc) {
            for (var i = 0; i < doc.results.length; i++) {
                $.couch.db(dbName).openDoc(doc.results[i].id,
                { success: function(doc) {
                        Render.createOrUpdateUserObj(doc);
                    }});
            }
        });
        changes = db.changes(0, { filter:"taguareit/messages"});
        changes.onChange( function(doc) {
            for (var i = 0; i < doc.results.length; i++) {
                $.couch.db(dbName).openDoc(doc.results[i].id,
                { success: function(doc) {
                        Render.showMessage(doc);
                    }});
            }
        });
        changes = db.changes(0, { filter:"taguareit/tagged"});
        changes.onChange( function(doc) {
            for (var i = 0; i < doc.results.length; i++) {
                $.couch.db(dbName).openDoc(doc.results[i].id,
                { success: function(doc) {
                        Render.tagUser(doc.user);
                    }});
            }
        });
    },
    doc: function(id, success, _error) {
        $.couch.db(dbName).openDoc(id, { success: function(doc) {
                if (success) {
                    success(doc)
                }
            }, error: function(status, error, reason) {
                if (_error) {
                    _error(status, error, reason);
                }
            }
        });
    }
}

var sendThisUserLocked = false;
var Send = {
    thisUser: function() {
        if (!thisUserDoc._id) {
            return;
        }

        function save() {
            thisUserDoc.time = Utils.serverTime();
            $.couch.db(dbName).saveDoc(thisUserDoc, { success: function(doc) {
                    sendThisUserLocked = false;
                }});
        }

        if (!sendThisUserLocked) {
            sendThisUserLocked = true;
            $.couch.db(dbName).openDoc(thisUserDoc._id, { success: function(doc) {
                    
                    thisUserDoc._rev = doc._rev;
                    save();
                }, error: function(status, error, reason) {
                    /* TODO: saving blindly because we think the doc does not exist, add logging */
                    save();
                }});
        }
    },
    tagMe: function () {
        Send.sendTag(thisUserDoc._id);
    },
    message: function (msg) {
        if (!thisUserDoc._id) {
            return;
        }
        var doc = { type: "message", message: msg, user: thisUserDoc._id};
        $.couch.db(dbName).saveDoc(doc, { success: function(doc) {
                /* TODO: move clearing of input to render */
                $("#message").val("");
            }});
    },
    login: function (_name, _password, callback) {
        var jqxhr = $.couch.login({name: _name, password: _password, success: function(doc) {                
                Utils.setupServerTime(jqxhr.getResponseHeader("Date"));
                 
                Receive.doc(_name, function(doc) {
                    thisUserDoc = doc;
                    Send.thisUser();
                }, function() {
                    /* no user create one */
                    thisUserDoc._id = _name;
                    Send.thisUser();
                });
                callback();
            },
            error: function(status, error, reason) {
                callback({"name": reason});
            }});
    },
    signup: function (_name, _password, callback) {
        $.couch.signup({name : _name}, _password, { success: function(doc) {
                Send.login(_name, _password, function() {
                    thisUserDoc._id = _name;
                    Send.thisUser();
                    callback();
                });
            }, error: function(status, error, reason) {
                if (status == statusCodes.Conflict) {
                    callback({"name": "A user with this name already exist."});       
                } else callback({"name": reason});
            }});
    },
    sendTag: function (taggedUserId) {
        taggedUserDoc.user = taggedUserId;
        $.couch.db(dbName).openDoc(taggedUserDoc._id, { success: function(successDoc) {
                successDoc.user = taggedUserId;
                $.couch.db(dbName).saveDoc(successDoc, { error: function (status, error, reason) {
                        Send.sendTag(taggedUserId)
                    }});
            }, error: function (status, error, reason) {
                $.couch.db(dbName).saveDoc(taggedUserDoc);
            }});
    }
}

var lastCheckForCollision = Utils.nowTime();
var Render = {
    /* Update or create a user in the DOM from a JSON Doc */
    createOrUpdateUserObj: function(userDoc) {
        /* search */
        var userObj = $("#" + userDoc._id);
        if (!userObj.length) {
            /* create */
            var userDiv = [
            '<div class="user" id="${id}">',
            '  <div class="bubble">',
            '    <div  class="bubbleText""></div>',
            '  </div>',
            '  <div class="userName"></div>',
            '  <img src="img/user.png" class="userImage"></img>',
            '  <img src="img/user.png" class="userHideImage"></img>',
            '</div>'
            ].join('\n').replace('${id}',userDoc._id);
            $("#users").append(userDiv);
            userObj = $("#" + userDoc._id);
            Render.setUserObjPosition(userObj, userDoc.x , userDoc.y);
        }
        $(userObj).data('doc', userDoc);
        /*TODO: need a better hits counter */
        if (!userDoc.hits) {
            userDoc.hits = 0;
        }
        $(userObj).find(".userName").text(userDoc._id + " [" + userDoc.hits + "]");
    },
    setUserObjPosition: function (userObj, x, y) {
        $(userObj).css({
            "top": y + "px",
            "left": x + "px"
        });
    },
    moveUserObj: function (userObj) {
        if (userObj === undefined) {
            return;
        }
        var toY = $(userObj).data('doc').y;
        var toX = $(userObj).data('doc').x;
        var currentY = parseInt($(userObj).css("top"));
        if (isNaN(currentY))
            currentY = 0;
        var currentX = parseInt($(userObj).css("left"));
        if (isNaN(currentX))
            currentX = 0;

        var X = (toX - currentX);
        var Y = (toY - currentY);
        if (Math.abs(X) > 5 || Math.abs(Y) > 5) {
            var len = Math.sqrt(X*X+Y*Y);
            var dx = 5 * (X/len);
            var dy = 5 * (Y/len);
            Render.setUserObjPosition(userObj, currentX + dx , currentY + dy);
        }
    },
    Users: function () {
        jQuery.each($('.user'), function() {
            /* hide inactive users */
            if (Utils.timeDiff(Utils.serverTime(),$(this).data('doc').time, true) > 30 * 1000) {
                $("#"+ $(this).data('doc')._id).find(".userImage").css("display", "none");
                $("#"+ $(this).data('doc')._id).find(".userName").css("opacity", "0.5");
                $("#"+ $(this).data('doc')._id).find(".userHideImage").css("display", "block");
            } else {
                $("#"+ $(this).data('doc')._id).find(".userImage").css("display", "block");
                $("#"+ $(this).data('doc')._id).find(".userName").css("opacity", "1");
                $("#"+ $(this).data('doc')._id).find(".userHideImage").css("display", "none");
            }
            
            Render.moveUserObj(this);
        });
    },
    hideUserMessage: function (id) {
        $("#"+id).find(".bubble").css("display", "none");
    },
    showMessage: function(doc) {
        var user = $("#"+doc.user);
        $(user).find(".bubble").css("display", "inline");
        $(user).find(".bubbleText").text(doc.message);
        if ($(user).data('hideMsgTimer')) {
            clearTimeout($(user).data('hideMsgTimer'));
        }
        $(user).data('hideMsgTimer', setTimeout("Render.hideUserMessage('" + doc.user + "')", msgDelay));
        var logMsg = ($('#messages').html().length != 0 ? "<br/>" : "") + "<b>" + doc.user + "</b> said " + doc.message;
        $('#messages').html($('#messages').html() + logMsg);
        $('#messagesContainer').scrollTo( 'max' );
    },
    createRenderLoop: function () {
        var t=setTimeout("Render.doRenderLoop()",AnimationDelay);
    },
    doRenderLoop: function () {
        Render.Users();
        Render.checkForCollision();
        Render.createRenderLoop();
    },
    tagUser: function (taggedUser) {
        $(".userName").css("color", "white");
        $("#" + taggedUser).find(".userName").css("color", "red");
        taggedUserDoc.user = taggedUser;
        /*TODO: Bad place to update hits */
        if ($("#" + taggedUser).data('doc')._id == thisUserDoc._id) {
            if (!thisUserDoc.hits){
                thisUserDoc.hits = 0;   
            }
            thisUserDoc.hits += 1;
            Send.thisUser();    
        }
        
    },
    comparePositions: function (p1, p2) {
        var x1 = p1[0] < p2[0] ? p1 : p2;
        var x2 = p1[0] < p2[0] ? p2 : p1;
        return x1[1] > x2[0] || x1[0] === x2[0] ? true : false;
    },
    getOffsets: function (box) {
        var $box = $(box);
        var pos = $box.offset();
        var width = $box.width();
        var height = $box.height();
        return [ [ pos.left, pos.left + width ], [ pos.top, pos.top + height ] ];
    },
    checkForCollision: function () {
        /* only the tagged user checks for collisions */
        if (!thisUserDoc._id || taggedUserDoc.user != thisUserDoc._id ) {
            return;
        }

        var box = $("#"+ thisUserDoc._id);
        var pos = Render.getOffsets(box);

        $(".user").each( function(i) {
            if ( $(this).data("doc")._id == thisUserDoc._id ) {
                return;
            }
            var userImage = $(this).find(".userImage");
            var pos2 = Render.getOffsets(userImage);
            var horizontalMatch = Render.comparePositions(pos[0], pos2[0]);
            var verticalMatch = Render.comparePositions(pos[1], pos2[1]);
            var match = horizontalMatch && verticalMatch;
            if (match) {
                var now = Utils.serverTime();
                if (now - lastCheckForCollision < 500) {
                    return;
                }
                lastCheckForCollision = now;
                setTimeout("Send.sendTag('" + $(this).data("doc")._id + "');", 500);
            }
        });
    },
};

var Popup = {

    validateUsernameAndPassword: function (data, callback) {
        if (!data.name || data.name.length == 0) {
            callback({"name": "Please enter a name."});
            return false;
        };
        if (!data.password || data.password.length == 0) {
            callback({"password": "Please enter a password."});
            return false;
        };
        if (!/^[a-zA-Z0-9]+$/.test(data.name)) {
            callback({"name": "Your name my only contain alphabet letters and numbers"});
            return false;
        };
        return true;
    },
    login: function() {
        Popup.loginPopup();

    },

    loginPopup: function() {
        $.showDialog("dlg/_login.html", {
            submit: function(data, callback) {
                if (!Popup.validateUsernameAndPassword(data, callback))
                    return;
                Send.login(data.name, data.password, callback);
            }
        });
        return false;
    },
        
   about: function() {
        $.showDialog("dlg/_about.html", {
            submit: function(data, callback) {     
                callback(); 
                if (!thisUserDoc._id) {
                    setTimeout("Popup.loginPopup()", 500);
                }          
            }
        });
        return false;
    },
    
    signupPopup: function() {
        $.showDialog("dlg/_signup.html", {
            submit: function(data, callback) {
                if (!Popup.validateUsernameAndPassword(data, callback))
                    return;
                Send.signup(data.name, data.password, callback);
            }
        });
    },
    signup: function () {
        //TODO: fix overlay click and delay hack
        $("#overlay").click();
        setTimeout("Popup.signupPopup()", 500);
    },
};

function setupKeysAndMouse() {
    $("#message").keyup( function(event) {
        if(event.keyCode == 13) {
            var msg = $("#message").val();
            Send.message(msg);
        }
    });
    $("#message").hint();

    $("#clickOverlay").mousedown( function(event) {
        thisUserDoc.y = event.pageY;
        thisUserDoc.x = event.pageX;
        Send.thisUser();
    });
    $("#showMessages").mousedown( function(event) {
        if($("#messagesContainer").css("display") == "none") {
            $("#messagesContainer").css("display", "block");
            $('#messagesContainer').scrollTo( 'max' );
        } else {
            $("#messagesContainer").css("display", "none");
        }
    });
    $(".messages").draggable({ handle: '.dragImage' });
}

function setupTooltips() {
    $(".tagMe").tooltip({showURL: false });
    $(".dragImage").tooltip({showURL: false });    
    $("#showMessages").tooltip({showURL: false });
    $(".about").tooltip({showURL: false });
}

$(document).ready( function() {
    Popup.login();
    Receive.users();
    Receive.createListeners();
    Render.createRenderLoop();
    setupKeysAndMouse();
    setupTooltips();
});