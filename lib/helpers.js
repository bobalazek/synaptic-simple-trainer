var fs = require('fs');
var objectKeys = Object.keys || require('object-keys');
var natural = require('natural');

var helpers = {};

helpers.objectKeys = objectKeys;

helpers.objectSize = function(obj) {
    var size = 0, key;
    for (key in obj) {
        if (obj.hasOwnProperty(key)) size++;
    }
    return size;
};

helpers.arrayMaxIndex = function(array) {
    return array.indexOf(Math.max.apply(Math, array));
};

helpers.arrayEquals = function(arr1, arr2) {
    if(arr1.length !== arr2.length) {
        return false;
    }
    for(var i = arr1.length; i--;) {
        if(arr1[i] !== arr2[i]) {
            return false;
        }
    }
    return true;
};

helpers.arrayToDictonary = function(array, onlyKeys) {
    var dictionary = {};
    for (var i in array) {
        var single = array[i];
        var words = single.split(' ');
        for (var j in words) {
            var word = words[j];
            if (typeof dictionary[word] == 'undefined') {
                dictionary[word] = 0;
            }
            dictionary[word]++;
        }
    }
    return onlyKeys
        ? helpers.objectKeys(dictionary)
        : dictionary
    ;
};

helpers.textToVector = function(text, dictionary) {
    var vector = [];
    var dictionaryKeys = helpers.arrayToDictonary([text], true);
    for (var dictionaryKey in dictionary) {
        vector.push(
            dictionaryKeys.indexOf(dictionaryKey) === -1
                ? 0
                : 1
        );
    }
    return vector;
};

helpers.classesByValues = function(classes, vector) {
    var classesByValues = {};
    for (var i in vector) {
        var value = vector[i];
        var theClass = classes[i];
        classesByValues[theClass] = value;
    }
    return classesByValues;
};

helpers.objectSort = function(obj) {
    var result = {};
    var sorted = helpers.objectKeys(obj).sort(function(a, b) {
        return obj[a] - obj[b];
    });
    for (var i in sorted) {
        var key = sorted[i];
        result[key] = obj[key];
    }
    return result;
};

helpers.objectReverse = function(obj) {
    var result = {};
    var reversedKeys = helpers.objectKeys(obj).reverse();
    for (var i in reversedKeys) {
        var key = reversedKeys[i];
        result[key] = obj[key];
    }
    return result;
};

helpers.objectSlice = function(obj, begin, end) {
    var result = {};
    var reversedKeys = helpers.objectKeys(obj);
    for (var i in reversedKeys) {
        if (i < begin) {
            continue;
        }
        if (i > end) {
            break;
        }
        var key = reversedKeys[i];
        result[key] = obj[key];
    }
    return result;
};

helpers.fileExists = function(filename) {
    try {
        fs.accessSync(filename);

        return true;
    } catch(e) {
        return false;
    }
};

helpers.trimRight = function(str, charlist) {
  if (charlist === undefined)
    charlist = "\s";

  return str.replace(new RegExp("[" + charlist + "]+$"), "");
}

module.exports = helpers;
