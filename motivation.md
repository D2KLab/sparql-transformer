Motivation
==========


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
