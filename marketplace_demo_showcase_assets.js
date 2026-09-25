const fs=require('fs'),path=require('path');
const root=__dirname,pub=path.join(root,'public');fs.mkdirSync(pub,{recursive:true});
for(const name of ['marketplace_demo_showcase.css','marketplace_demo_pitch.css','marketplace_demo_showcase_ui.js','marketplace_demo_pitch_ui.js']){
  const src=path.join(root,name),dst=path.join(pub,name);if(fs.existsSync(src))fs.copyFileSync(src,dst);
}
const idx=path.join(pub,'index.html');
if(fs.existsSync(idx)){
  let html=fs.readFileSync(idx,'utf8');
  for(const css of ['marketplace_demo_showcase','marketplace_demo_pitch'])html=html.replace(new RegExp('<link[^>]+href="\\/'+css+'\\.css[^\"]*"[^>]*>\\s*','g'),'');
  for(const js of ['marketplace_demo_showcase_ui','marketplace_demo_pitch_ui'])html=html.replace(new RegExp('<script[^>]+src="\\/'+js+'\\.js[^\"]*"[^>]*><\\/script>\\s*','g'),'');
  html=html.replace('</head>','<link rel="stylesheet" href="/marketplace_demo_showcase.css?v=20260917-2">\n<link rel="stylesheet" href="/marketplace_demo_pitch.css?v=20260917-1">\n</head>');
  html=html.replace('</body>','<script src="/marketplace_demo_showcase_ui.js?v=20260925-1"></script>\n<script src="/marketplace_demo_pitch_ui.js?v=20260917-1"></script>\n</body>');
  fs.writeFileSync(idx,html);
}
