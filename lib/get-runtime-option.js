/**
 * A very simple but also very useful function that lets you get
 * a runtime argument passed during invocation of your Node.js
 * program, either returning the type-inferred value, or false
 * if the runtime argument was not found.
 */
module.exports = function getRuntimeOption(long, short, opts = {}) {
  if (long) {
    opts.longUsesEqual = opts.longUsesEqual || false;
    const val = getValue(long, process.argv, opts.longUsesEqual);
    if (val) return inferType(val);
  }

  if (short) {
    opts.shortUsesEqual = opts.shortUsesEqual || false;
    const val = getValue(short, process.argv, opts.shortUsesEqual);
    if (val) return inferType(val);
  }

  return false;
};

// Declared after the export, because functions are hoisted, meaning
// that the parser reads in the entire file, builds all functions
// first, _then_ does stuff like module.exports assignment.

function getValue(flag, argv, useEqual) {
  let pos = process.argv.indexOf(flag);
  if (pos === -1) return false;
  let val;
  if (useEqual) val = argv[pos].slice(flag.length + 1);
  else val = argv[pos + 1];
  return val;
}

function inferType(val) {
  // number type?
  if (parseFloat(val) == val) return parseFloat(val); // using `==` coercion
  // boolean?
  let lc = val.toLowerCase();
  if (lc === "true" || lc === "false") return lc === "true";
  // string.
  return val;
}
