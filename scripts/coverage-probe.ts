const sources = [
  ["DEV machine learning", "https://dev.to/feed/tag/machinelearning"],
  ["DEV crypto", "https://dev.to/feed/tag/crypto"],
  ["DEV AI", "https://dev.to/feed/tag/ai"],
  ["Google AI blog", "https://blog.google/technology/ai/rss/"],
  ["arXiv Quant", "https://rss.arxiv.org/rss/q-fin"],
];
await Promise.all(sources.map(async ([name,url]) => {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(11000) });
    const body = await response.text();
    console.log(JSON.stringify({name,status:response.status,items:(body.match(/<item(?:\\s|>)|<entry(?:\\s|>)/g)??[]).length,bytes:body.length,containsAuthors:/(dc:creator|<author>)/i.test(body),kind:body.slice(0,100).replace(/\\s+/g," ")}));
  } catch(error) { console.log(JSON.stringify({name,error:error instanceof Error?error.name:"error"})); }
}));
