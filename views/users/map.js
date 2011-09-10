function(doc) {
  if (doc.type == "user") {    
    var now = new Date();    
    var nowTime = now.getTime();
    var diff = Math.abs(nowTime - doc.time);
    var min10 = 1000 * 60 * 10;
    if ( diff < min10 ) {
        emit({}, doc);
    };    
  }
};