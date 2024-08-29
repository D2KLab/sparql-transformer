import fs from 'fs';
import path from 'path';
import { test, mock } from 'node:test';
import assert from 'node:assert';

import * as lib from './src/node_main.mjs';

const sparqlTransformer = lib.default;

const OUTPUT = './examples/json_transformed/';
const JSONLD_QUERIES = './examples/json_queries/';
const SPARQL_QUERIES = './examples/sparql_queries/';
const SPARQL_OUTPUTS = './examples/sparql_output/';

function mockFetch(file) {
    mock.method(global, 'fetch', () => Promise.resolve({
        ok: true,
        json: () => Promise.resolve(JSON.parse(file)),
    }));
}

async function getSparqlQuery(q) {
    let sparqlQuery = null;
    try {
        await sparqlTransformer(q, {
            debug: false,
            sparqlFunction: async (query) => {
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

test('DBpedia list of cities (proto)', async (t) => {
    const file = 'city.list.json';
    const [orig, q, sparql, expected] = loadFiles(file);
    mockFetch(orig);

    const outSparql = await getSparqlQuery(q);
    assert.deepStrictEqual(outSparql, sparql);

    const out = await sparqlTransformer(q);
    assert.deepStrictEqual(out, expected);
});

test('DBpedia list of cities and regions (jsonld)', async () => {
    const file = 'city.region.list.ld.json';
    const [orig, q, sparql, expected] = loadFiles(file);
    mockFetch(orig);

    const outSparql = await getSparqlQuery(q);
    assert.deepStrictEqual(outSparql, sparql);

    const out = await sparqlTransformer(q);
    assert.deepStrictEqual(out, expected);
});

test('DBpedia grunge bands', async () => {
    const file = 'band.json';
    const [orig, q, sparql, expected] = loadFiles(file);
    mockFetch(orig);

    const outSparql = await getSparqlQuery(q);
    assert.deepStrictEqual(outSparql, sparql);

    const out = await sparqlTransformer(q);
    assert.deepStrictEqual(out, expected);
});

test('DBpedia genres with bands', async () => {
    const file = 'band_reversed.json';
    const [orig, q, sparql, expected] = loadFiles(file);
    mockFetch(orig);

    const outSparql = await getSparqlQuery(q);
    assert.deepStrictEqual(outSparql.trim(), sparql.trim());

    const out = await sparqlTransformer(q);
    assert.deepStrictEqual(out, expected);
});

test('Aggregates', async () => {
    const file = 'aggregates.json';
    const [orig, q, sparql, expected] = loadFiles(file);
    mockFetch(orig);

    const outSparql = await getSparqlQuery(q);
    assert.deepStrictEqual(outSparql.trim(), sparql.trim());

    const out = await sparqlTransformer(q);
    assert.deepStrictEqual(out, expected);
});

test('No lang tag', async () => {
    const file = 'city.list.ld.json';
    const [orig, q, sparql, expected] = loadFiles(file);
    mockFetch(orig);

    const outSparql = await getSparqlQuery(q);
    assert.deepStrictEqual(outSparql, sparql);

    const out = await sparqlTransformer(q);
    assert.deepStrictEqual(out, expected);
});

test('Duplicate variable name', async () => {
    const file = 'issue_10_duplicate_vars.json';
    const [orig, q, sparql, expected] = loadFiles(file);
    mockFetch(orig);

    const outSparql = await getSparqlQuery(q);
    assert.deepStrictEqual(outSparql, sparql);

    const out = await sparqlTransformer(q);
    assert.deepStrictEqual(out, expected);
});

test('List-required fields', async () => {
    const file = 'band_forcelist.json';
    const [orig, q, sparql, expected] = loadFiles(file);
    mockFetch(orig);

    const outSparql = await getSparqlQuery(q);
    assert.deepStrictEqual(outSparql, sparql);

    const out = await sparqlTransformer(q);
    assert.deepStrictEqual(out, expected);
});

test('Library limit', async () => {
    const file = 'band.liblimit.json';
    const [orig, q, sparql, expected] = loadFiles(file);
    mockFetch(orig);

    const outSparql = await getSparqlQuery(q);
    assert.deepStrictEqual(outSparql.trim(), sparql.trim());

    const out = await sparqlTransformer(q);
    assert.deepStrictEqual(out, expected);
});
