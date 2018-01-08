import test from 'ava';
import fs from 'fs';

import jsonldTransformer from './index';

const INPUT = "./examples/json/";
const OUTPUT = "./examples/jsonld/";
const JSONLD_QUERIES = "./examples/json_queries/";
const SPARQL_QUERIES = "./examples/queries/";

function normaliseStr(str = '') {
  return str.split('\n')
    .map(s => s.trim())
    .filter(s => s)
    .sort()
    .join('\n');
}


test('DBpedia list of cities (proto)', async t => {
  var q = JSON.parse(fs.readFileSync(JSONLD_QUERIES + 'city.list.json', 'utf8'));
  var expected = JSON.parse(fs.readFileSync(OUTPUT + 'city.list.ld.json', 'utf8'));
  var out = await jsonldTransformer(q);
  t.deepEqual(out, expected);
});

test('DOREMUS list of artists (jsonld)', async t => {
  var q = JSON.parse(fs.readFileSync(JSONLD_QUERIES + 'artist.list.ld.json', 'utf8'));

  var expected = JSON.parse(fs.readFileSync(OUTPUT + 'artist.list.ld.json', 'utf8'));
  var out = await jsonldTransformer(q, {
    endpoint: 'http://data.doremus.org/sparql'
  });
  t.deepEqual(out, expected);
});
