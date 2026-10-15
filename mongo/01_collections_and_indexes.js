(() => {
// Run from the repository root; schema.json is shared with mongo/setup.py.
const fs = require('fs');
const path = require('path');
const schemaPath = [process.env.CARECONNECT_MONGO_SCHEMA,
  path.join(process.cwd(), 'mongo', 'schema.json'),
  path.join(process.cwd(), 'schema.json')].filter(Boolean).find(file => fs.existsSync(file));
if (!schemaPath) throw new Error('Run this script from the project root, or set CARECONNECT_MONGO_SCHEMA.');
const schema = JSON.parse(fs.readFileSync(schemaPath, 'utf8'));
if (process.env.CARECONNECT_MONGO_DB && process.env.CARECONNECT_MONGO_DB !== schema.database)
  throw new Error('Set CARECONNECT_MONGO_DB=careconnect_a2.');
db = db.getSiblingDB(schema.database);
for (const [name, definition] of Object.entries(schema.collections)) {
  const options = {validator: {$jsonSchema: definition.schema}, validationLevel: 'strict', validationAction: 'error'};
  if (db.getCollectionNames().includes(name)) {
    const result = db.runCommand({collMod: name, ...options});
    if (!result.ok) throw new Error('Validator setup failed: ' + name);
  } else db.createCollection(name, options);
  for (const index of definition.indexes)
    db.getCollection(name).createIndex(Object.fromEntries(index.keys), index.options || {});
}
print('careconnect_a2 schema applied. Existing documents preserved.');

})();
