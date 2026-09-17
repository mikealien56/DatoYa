// Publica los textos legales vigentes después de account_security_ui para reemplazar textos antiguos.
const fs=require('fs'),path=require('path');
const pub=path.join(__dirname,'public');fs.mkdirSync(pub,{recursive:true});
const source=path.join(__dirname,'legal_final_ui.js'),target=path.join(pub,'legal_final_ui.js');if(fs.existsSync(source))fs.copyFileSync(source,target);
const indexPath=path.join(pub,'index.html');if(fs.existsSync(indexPath)){let html=fs.readFileSync(indexPath,'utf8');html=html.replace(/<script src="\/legal_final_ui\.js(?:\?v=\d+)?"><\/script>\s*/g,'');html=html.replace('</body>','<script src="/legal_final_ui.js?v=3"></script>\n</body>');fs.writeFileSync(indexPath,html);}
