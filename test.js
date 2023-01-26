import test from 'ava';
import fs from 'fs'
import path from 'path';
import nock from 'nock';

import * as lib from './src/node_main.mjs';

const sparqlTransformer = lib.default;

const OUTPUT = './examples/json_transformed/';
const JSONLD_QUERIES = './examples/json_queries/';
const SPARQL_QUERIES = './examples/sparql_queries/';
const SPARQL_OUTPUTS = './examples/sparql_output/';

function mock(file) {
    nock('http://dbpedia.org')
        .post('/sparql')
        .query(true)
        .reply(200, file);
}

async function getSparqlQuery(q) {
    let sparqlQuery = null;
    try {
        await sparqlTransformer(q, {
            debug: false,
            sparqlFunction: async(query) => {
                sparqlQuery = `  ${query.trim()}`;
                return Promise.reject();
            },
        });
    } catch (e) {
        // eslint-disable-next-line no-empty
    }
    return sparqlQuery;
}

function loadFiles(file) {
    const orig = fs.readFileSync(`${SPARQL_OUTPUTS}${file}`, 'utf8');
    const q = JSON.parse(fs.readFileSync(`${JSONLD_QUERIES}${file}`, 'utf8'));
    const sparql = fs.readFileSync(`${SPARQL_QUERIES}${path.basename(file, path.extname(file))}.rq`, 'utf8');
    const expected = JSON.parse(fs.readFileSync(`${OUTPUT}${file}`, 'utf8'));

    return [orig, q, sparql, expected];
}

test('DBpedia list of cities (proto)', async(t) => {
    const file = 'city.list.json';
    const [orig, q, sparql, expected] = loadFiles(file);
    mock(orig);

    const outSparql = await getSparqlQuery(q);
    t.deepEqual(outSparql, sparql);

    const out = await sparqlTransformer(q);
    // fs.writeFileSync('a.json', JSON.stringify(out, null, 2), 'utf-8');

    t.deepEqual(out, expected);
});

test('DBpedia list of cities and regions (jsonld)', async(t) => {
    const file = 'city.region.list.ld.json';
    const [orig, q, sparql, expected] = loadFiles(file);
    mock(orig);

    const outSparql = await getSparqlQuery(q);
    t.deepEqual(outSparql, sparql);

    const out = await sparqlTransformer(q);
    // fs.writeFileSync('a.json', JSON.stringify(out, null, 2), 'utf-8');

    t.deepEqual(out, expected);
});

test('DBpedia grunge bands', async(t) => {
    const file = 'band.json';
    const [orig, q, sparql, expected] = loadFiles(file);
    mock(orig);

    const outSparql = await getSparqlQuery(q);
    t.deepEqual(outSparql, sparql);

    const out = await sparqlTransformer(q);
    // fs.writeFileSync('a.json', JSON.stringify(out, null, 2), 'utf-8');

    t.deepEqual(out, expected);
});

test('DBpedia genres with bands', async(t) => {
    const file = 'band_reversed.json';
    const [orig, q, sparql, expected] = loadFiles(file);
    mock(orig);

    const outSparql = await getSparqlQuery(q);
    t.deepEqual(outSparql.trim(), sparql.trim());

    const out = await sparqlTransformer(q);
    // fs.writeFileSync('a.json', JSON.stringify(out, null, 2), 'utf-8');

    t.deepEqual(out, expected);
});

test('Aggregates', async(t) => {
    const file = 'aggregates.json';
    const [orig, q, sparql, expected] = loadFiles(file);
    mock(orig);

    const outSparql = await getSparqlQuery(q);
    t.deepEqual(outSparql.trim(), sparql.trim());

    const out = await sparqlTransformer(q);
    // fs.writeFileSync('a.json', JSON.stringify(out, null, 2), 'utf-8');

    t.deepEqual(out, expected);
});

test('No lang tag', async(t) => {
    const file = 'city.list.ld.json';
    const [orig, q, sparql, expected] = loadFiles(file);
    mock(orig);

    const outSparql = await getSparqlQuery(q);
    t.deepEqual(outSparql, sparql);

    const out = await sparqlTransformer(q);
    // fs.writeFileSync('a.json', JSON.stringify(out, null, 2), 'utf-8');

    t.deepEqual(out, expected);
});

test('Duplicate variable name', async(t) => {
    const file = 'issue_10_duplicate_vars.json';
    const [orig, q, sparql, expected] = loadFiles(file);
    mock(orig);

    const outSparql = await getSparqlQuery(q);
    t.deepEqual(outSparql, sparql);

    const out = await sparqlTransformer(q);
    // fs.writeFileSync('a.json', JSON.stringify(out, null, 2), 'utf-8');

    t.deepEqual(out, expected);
});

test('List-required fieds', async(t) => {
    const file = 'band_forcelist.json';
    const [orig, q, sparql, expected] = loadFiles(file);
    mock(orig);

    const outSparql = await getSparqlQuery(q);
    t.deepEqual(outSparql, sparql);

    const out = await sparqlTransformer(q);
    // fs.writeFileSync('a.json', JSON.stringify(out, null, 2), 'utf-8');

    t.deepEqual(out, expected);
});

test('Library limit', async(t) => {
    const file = 'band.liblimit.json';
    const [orig, q, sparql, expected] = loadFiles(file);
    mock(orig);

    const outSparql = await getSparqlQuery(q);
    t.deepEqual(outSparql.trim(), sparql.trim());

    const out = await sparqlTransformer(q);
    // fs.writeFileSync('a.json', JSON.stringify(out, null, 2), 'utf-8');

    t.deepEqual(out, expected);
});