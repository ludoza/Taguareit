function(doc, req) { 
    if(doc.type == 'tagged') { 
        return true; 
    } else { 
        return false; 
    }
}