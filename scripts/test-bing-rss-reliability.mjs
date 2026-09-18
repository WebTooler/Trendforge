const base = 'https://www.bing.com/news/search?q=AI&format=RSS';
const variants = [
  ['default',''],
  ['ua-browser',''],
  ['ua-googlebot',''],
  ['accept-xml',''],
  ['accept-rss',''],
  ['lang-en','&setlang=en-US'],
  ['mkt-en','&setmkt=en-US'],
  ['first-1','&first=1'],
  ['count-30','&count=30'],
  ['first-count','&first=1&count=30'],
];
const headers = {
  default:{},
  'ua-browser':{'user-agent':'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/140.0 Safari/537.36'},
  'ua-googlebot':{'user-agent':'Googlebot/2.1 (+http://www.google.com/bot.html)'},
  'accept-xml':{accept:'application/xml'},
  'accept-rss':{accept:'application/rss+xml'},
  'lang-en':{},
  'mkt-en':{},
  'first-1':{},
  'count-30':{},
  'first-count':{},
};
function items(x){return (x.match(/<item\b/gi)||[]).length}
for(const [name,suffix] of variants){
  const r=await fetch(base+suffix,{headers:headers[name]});
  const body=await r.text();
  console.log(JSON.stringify({name,status:r.status,type:r.headers.get('content-type'),bytes:body.length,items:items(body),finalUrl:r.url}));
}