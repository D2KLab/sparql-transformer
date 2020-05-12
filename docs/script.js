import sparqlTransformer from 'sparql-transformer@2.3.1';
import SparqlClient from 'sparql-transformer@2.3.1/src/sparql-client.mjs';
import AsyncComputed from 'vue-async-computed';

const jq = {
  proto: {
    id: '?id',
    name: '$rdfs:label$required',
    image: '$foaf:depiction$required',
  },
  $where: [
    '?id a dbo:City',
    '?id dbo:country dbr:Italy',
  ],
  $limit: 100,
};


function syntaxHighlight(json) {
  if (typeof json !== 'string') {
    json = JSON.stringify(json, undefined, 2);
  }
  json = json.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return json.replace(/("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+-]?\d+)?)/g, (match) => {
    let cls = 'number';
    if (/^"/.test(match)) {
      if (/:$/.test(match)) {
        cls = 'key';
      } else {
        cls = 'string';
      }
    } else if (/true|false/.test(match)) {
      cls = 'boolean';
    } else if (/null/.test(match)) {
      cls = 'null';
    }
    return `<span class="${cls}">${match}</span>`;
  });
}


const application = new Vue({
  el: '#app',
  data: {
    input: JSON.stringify(jq, null, 2),
    endpoint: 'https://dbpedia.org/sparql',
    loading: false,
    sparql: '',
    frogJson: null,
    princeJson: null,
    jsonError: null,
  },
  created() {
    this.computeSparql();
    document.querySelector('body').classList.remove('loading');
  },
  methods: {
    computeSparql() {
      const app = this;

      let jsonQuery;
      try {
        jsonQuery = JSON.parse(this.input);
      } catch (e) {
        return;
      }
      sparqlTransformer(jsonQuery, {
        endpoint: this.endpoint,
        sparqlFunction(sparql) {
          app.sparql = sparql;
          return Promise.reject();
        },
      }).catch(() => { });
    },
    execute() {
      const app = this;
      app.frogJson = null;
      app.princeJson = null;
      app.jsonError = null;

      let jsonQuery;
      try {
        jsonQuery = JSON.parse(this.input);
      } catch (e) {
        app.jsonError = e;
        return;
      }
      this.loading = true;
      sparqlTransformer(jsonQuery, {
        sparqlFunction(sparql) {
          const client = new SparqlClient(app.endpoint);
          return client.query(sparql)
            .then((res) => {
              app.frogJson = syntaxHighlight(res);
              return res;
            });
        },
      }).then((res) => {
        this.loading = false;
        app.princeJson = syntaxHighlight(res);
        setTimeout(() => {
          const tabs = document.querySelector('.tabs');
          M.Tabs.init(tabs);
          const instance = M.Tabs.getInstance(tabs);
          instance.select('prince');
        }, 10);
      }).catch((e) => {
        app.jsonError = e;
      });
    },
  },
});
