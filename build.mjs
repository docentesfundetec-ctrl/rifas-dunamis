import {build} from 'esbuild';
import {execFileSync} from 'node:child_process';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
fs.cpSync('public','dist',{recursive:true});
execFileSync(process.execPath,['node_modules/tailwindcss/lib/cli.js','-i','styles.css','-o','dist/assets/styles.css','--minify'],{stdio:'inherit'});
await build({entryPoints:['src/app.js'],outfile:'dist/assets/app.js',bundle:true,minify:true,format:'esm',target:['es2020'],legalComments:'none'});
let html=fs.readFileSync('dist/index.html','utf8');
for(const name of ['app.js','styles.css']){const hash=createHash('sha256').update(fs.readFileSync('dist/assets/'+name)).digest('hex').slice(0,12);html=html.replace('assets/'+name,'assets/'+name+'?v='+hash);}
fs.writeFileSync('dist/index.html',html);
fs.mkdirSync('docs',{recursive:true});fs.cpSync('dist','docs',{recursive:true});fs.writeFileSync('docs/.nojekyll','');
