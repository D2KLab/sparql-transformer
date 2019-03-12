SPARQL Transformer
===================

Write your SPARQL query directly in the JSON-LD you would like to have in output.

JavaScript package. Try it with the [Playground](https://d2klab.github.io/sparql-transformer/).

> Looking for the [Python one](https://github.com/D2KLab/py-sparql-transformer)?

<!-- START doctoc generated TOC please keep comment here to allow auto update -->
<!-- DON'T EDIT THIS SECTION, INSTEAD RE-RUN doctoc TO UPDATE -->
**Table of Contents**

- [Motivation](#motivation)
- [Query in JSON](#query-in-json)
- [How to use](#how-to-use)
- [Credits](#credits)

<!-- END doctoc generated TOC please keep comment here to allow auto update -->

## Motivation

[Slides at the WebConf 2018.](https://goo.gl/s5FoDv)

The output of SPARQL endpoints (i.e. [Virtuoso](https://virtuoso.openlinksw.com/)) is not so practical. It simply presents the results as an array of all possible sets of variables that satisfy the query.

As an example, I retrieve from DBpedia all the Italian cities, with name and an image.

```sql
SELECT *
WHERE {
 ?city a dbo:City ;
      dbo:country dbr:Italy ;
      foaf:depiction ?image ;
      rdfs:label ?name .
} LIMIT 100
```
Extract of the [json results](http://dbpedia.org/sparql?default-graph-uri=http%3A%2F%2Fdbpedia.org&query=SELECT+*%0D%0AWHERE+%7B%0D%0A+%3Fcity+a+%3Chttp%3A%2F%2Fdbpedia.org%2Fontology%2FCity%3E+%3B%0D%0A++++++dbo%3Acountry+dbr%3AItaly+%3B%0D%0A++++++foaf%3Adepiction+%3Fimage+%3B%0D%0A++++++rdfs%3Alabel+%3Fname+.%0D%0A%7D+LIMIT+100&format=text%2Fhtml&CXML_redir_for_subjs=121&CXML_redir_for_hrefs=&timeout=30000&debug=on&run=+Run+Query+):

```json
{
  "head": { ... },
  "results": {
    "distinct": false,
    "ordered": true,
    "bindings": [{
        "city": {
          "type": "uri",
          "value": "http://dbpedia.org/resource/Bologna"
        },
        "image": {
          "type": "uri",
          "value": "http://commons.wikimedia.org/wiki/Special:FilePath/Bologna_postcard.jpg"
        },
        "label": {
          "type": "literal",
          "xml:lang": "fr",
          "value": "Bologne"
        }
      }, {
        "city": {
          "type": "uri",
          "value": "http://dbpedia.org/resource/Bologna"
        },
        "image": {
          "type": "uri",
          "value": "http://commons.wikimedia.org/wiki/Special:FilePath/Bologna_postcard.jpg"
        },
        "label": {
          "type": "literal",
          "xml:lang": "it",
          "value": "Bologna"
        }
      }, {
        "city": {
          "type": "uri",
          "value": "http://dbpedia.org/resource/Siena"
        },
        "image": {
        "type": "uri",
        "value": "http://commons.wikimedia.org/wiki/Special:FilePath/PiazzadelCampoSiena.jpg"
        },
        "label": {
          "type": "literal",
          "xml:lang": "en",
          "value": "Siena"
        }
      }]
  }
}
```

The output is hard to read and manipulate. Displaying all the names of Bologna means to merge the results of the first two lines, being careful to keep all the different names of the city and the unique but repeated value for the image.

More practical would be an output of this shape, following the specification of JSON-LD:
```json
{
  "@context": "http://schema.org",
  "@graph": [{
    "@type": "City",
    "@id" : "http://dbpedia.org/resource/Bologna",
    "name": [
       {"@value":"Bologna","@language":"it"},
       {"@value":"Bologne","@language":"fr"}
     ],
    "image": "http://commons.wikimedia.org/wiki/Special:FilePath/Bologna_postcard.jpg"
  }, {
    "@type": "City",
    "@id" : "http://dbpedia.org/resource/Siena",
    "name": { "@value":"Siena", "@language":"en" },
    "image": "http://commons.wikimedia.org/wiki/Special:FilePath/PiazzadelCampoSiena.jpg"
  }]
}
```

Here is clear that there are 2 results, each one with an image and 2 (the first) or 1 (the second) value for the name.

## Query in JSON

The core idea of this module is writing in a single file the query and the expected output in JSON.

Two syntaxes are supported: plain JSON and JSON-LD.
Here the examples in the 2 formats for the query of cities.

- plain JSON

```json
{
  "proto": [{
    "id" : "?id",
    "name": "$rdfs:label$required",
    "image": "$foaf:depiction$required"
  }],
  "$where": [
    "?id a dbo:City",
    "?id dbo:country dbr:Italy"
  ],
  "$limit": 100
}
```

- JSON-LD

```json
{
  "@context": "http://schema.org/",
  "@graph": [{
    "@type": "City",
    "@id" : "?id",
    "name": "$rdfs:label$required",
    "image": "$foaf:depiction$required"
  }],
  "$where": [
    "?id a dbo:City",
    "?id dbo:country dbr:Italy"
  ],
  "$limit": 100
}
```

The syntax is composed by two main parts.

### The prototype

The `@graph`/`proto` property contains the prototype of the result as I expect it. When the value should be taken from the query result, I declare it using the following syntax:

    $<SPARQL PREDICATE>[$modifier[:option...]...]

The subject of the predicate is the variable (declared of automatically assigned) of the closer `@id`/`id` in the structure (if it exists, otherwise is the default `?id`).
The object is manually (with the `$var` modifier) or automatically assigned.

Some modifiers can be present after, separated by the `$` sign. The `:` prepend the options for a given modifier.

|MODIFIER|OPTIONS|NOTE|
|---|---|---|
|`$required`|n/a| When omitted, the clause is wrapped by `OPTIONAL { ... }`.|
|`$sample`|n/a|extract a single value for that property by adding a `SAMPLE(?v)` in the SELECT|
|`$lang`|`:lang`[string]| FILTER by language.<br>Ex. `$lang:it`, `$lang:en`|
|`$bestlang`|`:acceptedLangs`[string, optional]| Choose the best match (using `BEST_LANGMATCH`) over the languages according to the list expressed through the [Accept-Language standard](https://www.w3.org/Protocols/rfc2616/rfc2616-sec14.html#sec14.4). This list can be appended after the `:` or expressed as `$lang` in the root.<br>Ex. `$bestlang`, `$bestlang:en;q=1, it;q=0.7 *;q=0.1`|
|`$var`|`:var`[string]| Specify the variable that will be assigned in the query, so that it can be referred in the root properties (like `$filter`). If missing, a `$` is prepended. <br> Ex. `$var:myVariable`, `$var:?name`|

In this way, I specify a mapping between the JSON-LD output properties and the ones in the endpoint. The values non prepended by a `$` are transferred as is to the output.

### The root `$` properties

The `$`-something root properties allow to make the query more specific. They will be not present in the output, being used only at query level.
The supported properties are:

|PROPERTY|INPUT|NOTE|
|--------|-----|----|
|`$where`|string, array| Add where clause in the triple format.<br>Ex. `"$where": "?id a dbo:City"`|
|`$values`|object| Set `VALUES` for specified variables as a map.<br>Ex. `"$values": {"?id": ["dbr:Bari", "http://dbpedia.org/resource/Bologna"]}`|
|`$limit` |number| `LIMIT` the SPARQL results |
|`$offset` |number| `OFFSET` applied to the SPARQL results |
|`$distinct`|boolean (default `true`)| Set the `DISTINCT` in the select|
|`$orderby`|string, array| Build an `ORDER BY` on the variables in the input.<br> Ex. `"$orderby":["DESC(?name)","?age"]`|
|`$groupby`| string, array | Build an `ORDER BY` on the variables in the input. <br> Ex. `"$groupby":"?id"`|
|`$having`| string, array | Allows to declare the content of `HAVING`. If it is an array, the items are concatenated by `&&`. |
|`$filter`| string, array |Add the content as a `FILTER`.<br>`"$filter": "?myNum > 3"`|
|`$prefixes`| object | set the prefixes in the format `"foaf": "http://xmlns.com/foaf/0.1/"`.|
|`$lang`|`:acceptedLangs`[string]| The default language to use as `$bestlang` (see above), expressed through the [Accept-Language standard](https://www.w3.org/Protocols/rfc2616/rfc2616-sec14.html#sec14.4). <br>Ex. `$lang:en;q=1, it;q=0.7 *;q=0.1`|

The `@context` property (for the JSON-LD version) will be transferred to the output.

The output of this query is intended to be:
- for the plain JSON, an array of object with the shape of the prototype;
- for the JSON-LD, an array of object with the shape of the prototype in the `@graph` property and with a sibling `@context`.

## How to use

#### Install in nodeJS
Install by npm.

```bash
npm install sparql-transformer
```


Add to the application.

```js
import sparqlTransformer from 'sparql-transformer';
```

#### Install in the browser

SPARQL Tranformer is exposed as [ES Module](https://jakearchibald.com/2017/es-modules-in-browsers/). We rely on [getlibs](https://www.npmjs.com/package/getlibs) until the technology will allow to use ["bare" import specifier](https://github.com/WICG/import-maps#bare-specifiers).

```html
<script src="https://unpkg.com/getlibs"></script>
<script>sparqlTransformer = System.import('https://unpkg.com/sparql-transformer')</script>
```

#### Use
```js
sparqlTransformer(query, options)
  .then(res => console.log(res))
  .catch(err => console.error(err););

```

The first parameter (`query`) is the query in the JSON-LD format. The JSON-LD can be:
- an already parsed JS object (or defined real time),
- **ONLY if running in NodeJS**, the local path of a JSON file (that will then be read and parsed).

The `options` parameter is optional, and can define the following:

| OPTION | DEFAULT | NOTE |
| --- | --- | --- |
|context | http://schema.org/ | The value in `@context`. It overwrites the one in the query.|
| sparqlFunction | `null` | A function receiving in input the transformed query in SPARQL, returning a Promise. If not specified, the module performs the query on its own<sup id="a1">[1](#f1)</sup> against the specified endpoint.  |
| endpoint | http://dbpedia.org/sparql | Used only if `sparqlFunction` is not specified. |
| debug | `false` | Enter in debug mode. This allow to print in console the generated SPARQL query. |


See [`test.js`](./test.js) for further examples.


## Credits

If you use this module for your research work, please cite:

> Pasquale Lisena and Raphaël Troncy. Transforming the JSON Output of SPARQL Queries for Linked Data Clients. In WWW'18 Companion: The 2018 Web Conference Companion, April 23–27, 2018, Lyon, France.
https://doi.org/10.1145/3184558.3188739

[BIB file](./lisena2018sparqltransformer.bib)

---

<b id="f1">1</b>: Using a [lightweight SPARQL client](./src/sparql-client.mjs).
