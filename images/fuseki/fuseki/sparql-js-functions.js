// Math Functions

function log(v) {
  return Math.log(v)
}

function log10(v) {
  return java.lang.Math.log10(v)
}


// CamelCase a string
// Words to be combined are separated by a space in the string.


function toTitleCase(str) {
  return str.toLowerCase().split(' ').map(function(word) {
    return word.replace(word[0], word[0].toUpperCase());
  }).join(' ');
}

// https://www.30secondsofcode.org/js/s/levenshtein-distance
function levenshteinDistance (s, t) {
  if (!s.length) return t.length;
  if (!t.length) return s.length;
  var arr = [];
  for (var i = 0; i <= t.length; i++) {
    arr[i] = [i];
    for (var j = 1; j <= s.length; j++) {
      arr[i][j] =
        i === 0
          ? j
          : Math.min(
              arr[i - 1][j] + 1,
              arr[i][j - 1] + 1,
              arr[i - 1][j - 1] + (s[j - 1] === t[i - 1] ? 0 : 1)
            );
    }
  }
  return arr[t.length][s.length];
}

function distanceFromTitleCase(str) {
  return levenshteinDistance(str,toTitleCase(str))
}

function toCamelCase(str) {
  function ucFirst(word)    {
    return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
  }

  function lcFirst(word)    {
    return word.toLowerCase();
  }

  function cc(word,index)   {
    return (index == 0) ? lcFirst(word) : ucFirst(word);
  }

  return str.split(' ')
    .map(cc)
    .join('');
}
