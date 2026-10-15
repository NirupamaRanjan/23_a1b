(() => {
// Backward-compatible entry point. All definitions live in schema.json.
const fs = require('fs');
const path = require('path');
const script = [path.join(process.cwd(), 'mongo', '01_collections_and_indexes.js'),
  path.join(process.cwd(), '01_collections_and_indexes.js')].find(file => fs.existsSync(file));
if (!script) throw new Error('Run from the project root or mongo/ directory.');
load(script);

})();
