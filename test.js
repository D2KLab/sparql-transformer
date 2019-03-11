import test from 'ava';
import fs from 'fs';

import sparqlTransformer from './index';

const OUTPUT = './examples/json_transformed/';
const JSONLD_QUERIES = './examples/json_queries/';


test('DBpedia list of cities (proto)', async (t) => {
  const q = JSON.parse(fs.readFileSync(`${JSONLD_QUERIES}city.list.json`, 'utf8'));
  const expected = JSON.parse(fs.readFileSync(`${OUTPUT}city.list.ld.json`, 'utf8'));
  const out = await sparqlTransformer(q);
  // fs.writeFileSync('a.json', JSON.stringify(out, null, 2),'utf-8');

  t.deepEqual(out, expected);
});

test('DBpedia list of cities and regions (jsonld)', async (t) => {
  const q = JSON.parse(fs.readFileSync(`${JSONLD_QUERIES}city.region.list.ld.json`, 'utf8'));
  const expected = JSON.parse(fs.readFileSync(`${OUTPUT}city.region.list.ld.json`, 'utf8'));
  const out = await sparqlTransformer(q);
  // fs.writeFileSync('a.json', JSON.stringify(out, null, 2),'utf-8');

  t.deepEqual(out, expected);
});

test('DBpedia grunge bands', async (t) => {
  const q = JSON.parse(fs.readFileSync(`${JSONLD_QUERIES}band.json`, 'utf8'));
  const expected = JSON.parse(fs.readFileSync(`${OUTPUT}band.json`, 'utf8'));
  const out = await sparqlTransformer(q);
  // fs.writeFileSync('a.json', JSON.stringify(out, null, 2),'utf-8');

  t.deepEqual(out, expected);
});
