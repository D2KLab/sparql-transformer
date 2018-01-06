import test from 'ava';
import fs from 'fs';

import jsonldTransformer from './index';

const INPUT = "./examples/json/";
const OUTPUT = "./examples/jsonld/";
const JSONLD_QUERIES = "./examples/jsonld_queries/";
const SPARQL_QUERIES = "./examples/queries/";

function normaliseStr(str = '') {
  return str.split('\n')
    .map(s => s.trim())
    .filter(s => s)
    .sort()
    .join('\n');
}

var q = JSON.parse(fs.readFileSync(JSONLD_QUERIES + 'artist.list.ld.json', 'utf8'));

test(async t => {
  var expected = JSON.parse(fs.readFileSync(OUTPUT + 'artist.list.ld.json', 'utf8'));
  var out = await jsonldTransformer(q, {endpoint: 'http://data.doremus.org/sparql'});
  t.deepEqual(out, expected);
});

// test('Assign correctly the values in JSON-LD proto', t => {
//   let sparqlRes = fs.readFileSync(INPUT + 'artist.list.json', 'utf8');
//   let replaced = replaceInProto(sparqlRes, out.proto);
//   let expected = fs.readFileSync(OUTPUT + 'artist.list.ld.json', 'utf8');
//   let exp = JSON.parse(expected);
//   t.deepEqual(out.proto, exp['@graph']);
// });
