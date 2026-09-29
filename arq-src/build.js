var fs = require('fs');
var dir = __dirname;
var engine = fs.readFileSync(dir + '/engine.js', 'utf8');
var tpl = fs.readFileSync(dir + '/template.html', 'utf8');
if (tpl.indexOf('/*ENGINE*/') < 0) throw new Error('placeholder missing');
var body = tpl.replace('/*ENGINE*/', function () { return engine; });

// artifact version: page content only (the publisher adds the document skeleton)
fs.writeFileSync(dir + '/artifact.html', body);

// standalone version for the D: drive: full document with charset + viewport
var cut = body.indexOf('<div class="wrap">');
var head = body.slice(0, cut), rest = body.slice(cut);
var full = '<!doctype html>\n<html lang="th">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n' +
  head + '</head>\n<body>\n' + rest + '</body>\n</html>\n';
fs.writeFileSync(dir + '/../ARQ-Lab.html', full);
console.log('built standalone ' + full.length + ' bytes, artifact ' + body.length + ' bytes');
