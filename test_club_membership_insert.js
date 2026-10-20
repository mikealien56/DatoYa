'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const source=fs.readFileSync('customer_club_bootstrap.js','utf8');
test('paid Club membership insert matches 10 columns, 9 parameter values and one active literal',()=>{
  const sql=/INSERT INTO customer_club_memberships\(([^)]+)\) VALUES\(([^)]+)\)/.exec(source);
  assert.ok(sql,'Club paid membership insert missing');
  const columns=sql[1].split(',').map(x=>x.trim());
  const values=sql[2].split(',').map(x=>x.trim());
  assert.equal(columns.length,10);
  assert.equal(values.length,columns.length,'Each INSERT value must map to one column');
  assert.equal(values.filter(x=>x==='?').length,9);
  assert.equal(values[1],"'active'");
});
