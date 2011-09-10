function(doc, req) { 
    if(doc.type == 'message') { 
        return true; 
    } else { 
        return false; 
    }
}