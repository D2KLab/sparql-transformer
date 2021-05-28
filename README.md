SPARQL Transformer
===================

Write your SPARQL query directly in the JSON-LD you would like to have in output.

JavaScript package. Try it with the [Playground](https://d2klab.github.io/sparql-transformer/).

> Looking for the [Python one](https://github.com/D2KLab/py-sparql-transformer)?

## News

- The parameter `$libraryMode` allows to perform the pagination on the merged objects, obtaining exactly `n=$limit` objects
- It is now possible to set a different **merging anchor** instead of `id`/`@id` using the `$anchor` modifier.

**Table of Contents**

- [Motivation](./motivation.md)
- [Query in JSON](#query-in-json)
- [How to use](#how-to-use)
- [Credits](#credits)

You want to learn more? Watch this [Tutorial](https://d2klab.github.io/swapi2020/slides.html)

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

The subject of the predicate is the variable (declared of automatically assigned) of the closer **mergin anchor** in the structure, which is the `@id`/`id` property (if it exists, otherwise is the default `?id`).
The SPARQL variable name is manually (with the `$var` modifier) or automatically assigned.

Some modifiers can be present after, separated by the `$` sign. The `:` prepend the options for a given modifier.

|MODIFIER|OPTIONS|NOTE|
|---|---|---|
|`$required`|n/a| When omitted, the clause is wrapped by `OPTIONAL { ... }`.|
|`$sample`|n/a|Extract a single value for that property by adding a `SAMPLE(?v)` in the SELECT|
|`$lang`|`:lang`[string, optional]| FILTER by language. In absence of a language, pick the first value of `$lang` in the root.<br>Ex. `$lang:it`, `$lang:en`, `$lang`. |
|`$bestlang`|`:acceptedLangs`[string, optional]| Choose the best match (using `BEST_LANGMATCH`) over the languages according to the list expressed through the [Accept-Language standard](https://tools.ietf.org/html/rfc7231#section-5.3.5). This list can be appended after the `:` or expressed as `$lang` in the root.<br>Ex. `$bestlang`, `$bestlang:en;q=1, it;q=0.7 *;q=0.1`|
|`$var`|`:var`[string]| Specify the variable that will be assigned in the query, so that it can be referred in the root properties (like `$filter`). If missing, a `?` is prepended. <br> Ex. `$var:myVariable`, `$var:?name`|
|`$anchor`|n/a|Set this property as merging anchor. The set is valid for the current level in the JSON tree, ignoring eventual `id`/`@id` sibling properties. Ex. `"a":"?example$anchor"` sets`?example` as subject of SPARQL statements and merges the final results on the `a` property.|
|`$reverse`|n/a|Set this property for use the current variable as subject of the SPARQL predicate, rather than object.|
|`$count` `$sum` `$min` `$max` `$avg`| n/a | Return the respective aggregate function (COUNT, SUM, MIN, MAX, AVG) on the variable. |
|`$langTag`|`"hide"`, `"show"` (default)| When `hide`, language tags are not included in the output.<br> Ex. `hide` => `"label":"Bologna"` ;<br>  `show` => `"label":{"value": "Bologna", "language": "it"}` |
|`$accept`|`"string"`, `"number"`, `"boolean"`| If set, values of type different from the specified one are discarded. |
|`$asList`|n/a| When set, the interested property value would always be a list, even if with a single element. |


In this way, I specify a mapping between the JSON-LD output properties and the ones in the endpoint. The values non prepended by a `$` are transferred as is to the output.

### The root `$` properties

The `$`-something root properties allow to make the query more specific. They will be not present in the output, being used only at query level.
The supported properties are:

|PROPERTY|INPUT|NOTE|
|--------|-----|----|
|`$where`|string, array| Add where clause in the triple format.<br>Ex. `"$where": "?id a dbo:City"`|
|`$values`|object| Set `VALUES` for specified variables as a map. The presence of a lang tag or of the '$lang' attribute attached to the related property is taken in account. <br>Ex. `"$values": {"?id": ["dbr:Bari", "http://dbpedia.org/resource/Bologna"]}`|
|`$limit` |number| `LIMIT` the SPARQL results |
|`$limitMode` |`query` (default) or `library`| Perform the LIMIT operation in the query or on the obtained results (`library`) |
|`$from` |string(uri)| Define the graph `FROM` which selecting the results |
|`$offset` |number| `OFFSET` applied to the SPARQL results |
|`$distinct`|boolean (default `true`)| Set the `DISTINCT` in the select|
|`$orderby`|string, array| Build an `ORDER BY` on the variables in the input.<br> Ex. `"$orderby":["DESC(?name)","?age"]`|
|`$groupby`| string, array | Build an `GROUP BY` on the variables in the input. <br> Ex. `"$groupby":"?id"`|
|`$having`| string, array | Allows to declare the content of `HAVING`. If it is an array, the items are concatenated by `&&`. |
|`$filter`| string, array |Add the content as a `FILTER`.<br>`"$filter": "?myNum > 3"`|
|`$prefixes`| object | set the prefixes in the format `"foaf": "http://xmlns.com/foaf/0.1/"`.|
|`$lang`|`:acceptedLangs`[string]| The default language to use as `$bestlang` (see above), expressed through the [Accept-Language standard](https://www.w3.org/Protocols/rfc2616/rfc2616-sec14.html#sec14.4). <br>Ex. `$lang:en;q=1, it;q=0.7 *;q=0.1`|
|`$langTag`|`"hide"`, `"show"` (default)| When `hide`, language tags are not included in the output. Similar to the inline `$langTag`, but acting at a global level.<br> Ex. `hide` => `"label":"Bologna"` ;<br>  `show` => `"label":{"value": "Bologna", "language": "it"}` |

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

SPARQL Transformer is exposed as [ES Module](https://jakearchibald.com/2017/es-modules-in-browsers/). We rely on [getlibs](https://www.npmjs.com/package/getlibs) until the technology will allow to use ["bare" import specifier](https://github.com/WICG/import-maps#bare-specifiers).

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

> Pasquale Lisena, Albert Meroño-Peñuela, Tobias Kuhn and Raphaël Troncy. Easy Web API Development with SPARQL Transformer. In 18th International Semantic Web Conference (ISWC), Auckland, New Zealand, October 26-30, 2019.

[BIB file](./bib/lisena2019easyweb.bib)


> Pasquale Lisena and Raphaël Troncy. Transforming the JSON Output of SPARQL Queries for Linked Data Clients. In WWW'18 Companion: The 2018 Web Conference Companion, April 23–27, 2018, Lyon, France.
https://doi.org/10.1145/3184558.3188739

[BIB file](./bib/lisena2018sparqltransformer.bib)

---

<b id="f1">1</b>: Using a [lightweight SPARQL client](./src/sparql-client.mjs).
