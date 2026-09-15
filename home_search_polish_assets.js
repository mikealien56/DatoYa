const fs=require('fs');
const path=require('path');
const pub=path.join(__dirname,'public');
const src=path.join(__dirname,'home_search_polish.js');
const dst=path.join(pub,'home_search_polish.js');
if(fs.existsSync(src)){
  fs.mkdirSync(pub,{recursive:true});
  fs.copyFileSync(src,dst);
}
const idx=path.join(pub,'index.html');
if(fs.existsSync(idx)){
  let h=fs.readFileSync(idx,'utf8');
  if(!h.includes('/home_search_polish.js')) h=h.replace('</body>','<script src="/home_search_polish.js?v=3"></script>\n</body>');
  else h=h.replace(/\/home_search_polish\.js(?:\?v=\d+)?/g,'/home_search_polish.js?v=3');
  fs.writeFileSync(idx,h);
}
