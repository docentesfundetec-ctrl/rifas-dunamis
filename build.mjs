import {build} from 'esbuild';
import {execFileSync} from 'node:child_process';
import fs from 'node:fs';
fs.cpSync('public','dist',{recursive:true});
execFileSync(process.execPath,['node_modules/tailwindcss/lib/cli.js','-i','styles.css','-o','dist/assets/styles.css','--minify'],{stdio:'inherit'});
await build({entryPoints:['src/app.js'],outfile:'dist/assets/app.js',bundle:true,minify:true,format:'esm',target:['es2020'],legalComments:'none'});
fs.mkdirSync('docs',{recursive:true});fs.cpSync('dist','docs',{recursive:true});fs.writeFileSync('docs/.nojekyll','');
