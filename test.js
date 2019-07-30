import test from 'ava';
import fs from 'fs';
import nock from 'nock';

import lib from './index';

const sparqlTransformer = lib.default;

const OUTPUT = './examples/json_transformed/';
const JSONLD_QUERIES = './examples/json_queries/';
const SPARQL_OUTPUTS = './examples/sparql_output/';

function mock(file) {
  nock('http://dbpedia.org')
    .get('/sparql')
    .query(true)
    .reply(200, file);
}

function loadFiles(file) {
  const orig = fs.readFileSync(`${SPARQL_OUTPUTS}${file}`, 'utf8');
  const q = JSON.parse(fs.readFileSync(`${JSONLD_QUERIES}${file}`, 'utf8'));
  const expected = JSON.parse(fs.readFileSync(`${OUTPUT}${file}`, 'utf8'));

  return [orig, q, expected];
}

test('DBpedia list of cities (proto)', async (t) => {
  const file = 'city.list.json';
  const [orig, q, expected] = loadFiles(file);
  mock(orig);

  const out = await sparqlTransformer(q);
  // fs.writeFileSync('a.json', JSON.stringify(out, null, 2),'utf-8');

  t.deepEqual(out, expected);
});

test('DBpedia list of cities and regions (jsonld)', async (t) => {
  const file = 'city.region.list.ld.json';
  const [orig, q, expected] = loadFiles(file);
  mock(orig);

  const out = await sparqlTransformer(q);
  // fs.writeFileSync('a.json', JSON.stringify(out, null, 2), 'utf-8');

  t.deepEqual(out, expected);
});

test('DBpedia grunge bands', async (t) => {
  const file = 'band.json';
  const [orig, q, expected] = loadFiles(file);
  mock(orig);

  const out = await sparqlTransformer(q);
  // fs.writeFileSync('a.json', JSON.stringify(out, null, 2), 'utf-8');

  t.deepEqual(out, expected);
});
