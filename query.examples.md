Ex
===================

## Nested objects

```json
{
  "@context": "http://schema.org/",
  "@graph": [{
    "@type": "City",
    "@id": "?id",
    "name": "$rdfs:label$required$lang:it",
    "image": "$foaf:depiction$required",
    "containedInPlace":{
      "@type": "AdministrativeArea",
      "@id" : "$dbo:region$required$var:region",
      "name": "$rdfs:label$lang:it"
    }
  }],
  "$where": [
    "?id a dbo:City",
    "?id dbo:country dbr:Italy"
  ],
  "$limit": 100
}
```

The predicate refers to the closer `@id`/`id` in the structure, so the WHERE clauses will be:
- `?id rdfs:label ?v1`
- `?id foaf:depiction ?v2`
- `?id dbo:region ?region` (the closer `@id` can not be the same property)
- `?region dbo:region ?v3`

If `var:region` was not declared, an automatic variable would have been assigned and used in its place.

Output extract ([see the full version](./examples/jsonld/city.region.list.ld.json)):

```json
{
  "@context": "http://schema.org/",
  "@graph": [
    {
      "@type": "City",
      "@id": "http://dbpedia.org/resource/Vibo_Valentia",
      "name": {
        "@language": "it",
        "@value": "Vibo Valentia"
      },
      "image": "http://commons.wikimedia.org/wiki/Special:FilePath/Vibo_panorama.JPG",
      "containedInPlace": {
        "@type": "AdministrativeArea",
        "@id": "http://dbpedia.org/resource/Calabria",
        "name": {
          "@language": "it",
          "@value": "Calabria"
        }
      }
    }
  ]
}
```

If the `@id` of AdministrativeArea is missing, I should write the query in this way in order to obtain the same results.

```json
{
  "@context": "http://schema.org/",
  "@graph": [{
    "@type": "City",
    "@id": "?id",
    "name": "$rdfs:label$required$lang:it",
    "image": "$foaf:depiction$required",
    "containedInPlace":{
      "@type": "AdministrativeArea",
      "name": "$dbo:region/rdfs:label$lang:it"
    }
  }],
  "$where": [
    "?id a dbo:City",
    "?id dbo:country dbr:Italy"
  ],
  "$limit": 100
}
```
