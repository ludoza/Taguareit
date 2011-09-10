function(doc, req) { 
    if(doc.type == 'collision' /*&& doc.hits == 2*/) { 
        return true; 
    } else { 
        return false; 
    }
}