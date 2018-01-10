import test from 'ava';
import fs from 'fs';

import sparqlTransformer from './index';

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
  var out = await sparqlTransformer(q);
    // fs.writeFileSync('a.json', JSON.stringify(out, null, 2),'utf-8');

  t.deepEqual(out, expected);
});

test('DBpedia list of cities and regions (jsonld)', async t => {
  var q = JSON.parse(fs.readFileSync(JSONLD_QUERIES + 'city.region.list.ld.json', 'utf8'));
  var expected = JSON.parse(fs.readFileSync(OUTPUT + 'city.region.list.ld.json', 'utf8'));
  var out = await sparqlTransformer(q);
    // fs.writeFileSync('a.json', JSON.stringify(out, null, 2),'utf-8');

  t.deepEqual(out, expected);
});

test('DOREMUS list of artists (jsonld)', async t => {
  var q = JSON.parse(fs.readFileSync(JSONLD_QUERIES + 'artist.list.ld.json', 'utf8'));

  var expected = JSON.parse(fs.readFileSync(OUTPUT + 'artist.list.ld.json', 'utf8'));
  var out = await sparqlTransformer(q, {
    endpoint: 'http://data.doremus.org/sparql'
  });
  t.deepEqual(out, expected);
});

test('DOREMUS list of expressions (jsonld)', async t => {
  var expected = JSON.parse(fs.readFileSync(OUTPUT + 'expression.list.ld.json', 'utf8'));
  var out = await sparqlTransformer(JSONLD_QUERIES + 'expression.list.ld.json', {
    endpoint: 'http://data.doremus.org/sparql'
  });

  t.deepEqual(out, expected);
});
