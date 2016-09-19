


  export function autogenerateName() : string {
    var s = '';

    for (var i=0; i<16; i++) {
      s += String.fromCharCode('A'.charCodeAt(0) + Math.floor(Math.random() * 26))
    }

    return s;
  }
