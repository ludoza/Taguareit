function(doc, req) { 
    if(doc.type == 'user') { 
        /*var now = new Date();
        var utc = now.getTime() + (now.getTimezoneOffset() * 60 * 1000);
        var diff = utc - doc.time;
        var min10 = 1000 * 60 * 10;
        if ( diff < min10 )*/
            return true; 
    } else { 
        return false; 
    }
}