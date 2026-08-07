/* Minimal SPARQL client */
function validURL(str) {
    const pattern = new RegExp('^(https?:\\/\\/)?' // protocol
        +
        '((([a-z\\d]([a-z\\d-]*[a-z\\d])*)\\.)+[a-z]{2,}|' // domain name
        +
        '((\\d{1,3}\\.){3}\\d{1,3}))' // OR ip (v4) address
        +
        '(\\:\\d+)?(\\/[-a-z\\d%_.~+]*)*' // port and path
        +
        '(\\?[;&a-z\\d%_.~+=-]*)?' // query string
        +
        '(\\#[-a-z\\d_]*)?$', 'i'); // fragment locator
    return !!pattern.test(str);
}

export default class SparqlClient {
    constructor(endpoint) {
        if (!endpoint || !validURL(endpoint)) throw new Error(`Not valid endpoint: ${endpoint}`);

        this.endpoint = endpoint;
    }

    query(q, params = {}) {
        // Query to the SPARQL endpoint
        return fetch(this.endpoint, {
            method: 'POST',
            headers: {
                'Accept': 'application/sparql-results+json',
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: new URLSearchParams({
                ...params,
                query: q,
            }),
        }).then((response) => {
            if (!response.ok) {
                throw new Error(response.statusText);
            }

            return response.json();
        });
    }
}