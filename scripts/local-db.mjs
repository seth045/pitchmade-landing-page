import {DatabaseSync} from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
export function openDatabase(filename){
 if(filename!==':memory:')fs.mkdirSync(path.dirname(filename),{recursive:true});
 const sqlite=new DatabaseSync(filename);sqlite.exec('PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;');
 const exists=sqlite.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='waitlist'").get();
 if(!exists)sqlite.exec(fs.readFileSync(path.join(root,'drizzle/0000_waitlist.sql'),'utf8'));
 return {
  sqlite,
  prepare(sql){const statement=sqlite.prepare(sql);const make=(values=[])=>({bind(...args){return make(args)},async run(){const r=statement.run(...values);return {success:true,meta:{changes:Number(r.changes)}}},async first(){return statement.get(...values)||null},async all(){return {success:true,results:statement.all(...values)}}});return make();},
  close(){sqlite.close();}
 };
}
