#!/bin/bash
# Pruebas end-to-end de DatoYa
B=http://localhost:3000/api
J="Content-Type: application/json"
P=0; F=0
ck() { if echo "$2" | grep -q "$3"; then echo "✅ $1"; P=$((P+1)); else echo "❌ $1 → $2"; F=$((F+1)); fi }

echo "=== 1. Catálogos públicos ==="
ck "Categorías (10)" "$(curl -s $B/categories | python3 -c 'import sys,json;print(len(json.load(sys.stdin)["categories"]))')" "10"
ck "Comunas" "$(curl -s $B/comunas | python3 -c 'import sys,json;print(len(json.load(sys.stdin)["comunas"]))')" "34"
ck "Búsqueda gasfíter" "$(curl -sG "$B/workers" --data-urlencode "q=gasfíter" | python3 -c 'import sys,json;d=json.load(sys.stdin);print(len(d["workers"]))')" "[3-9]"
ck "Filtro verificados" "$(curl -s "$B/workers?verified=1" | python3 -c 'import sys,json;print(len(json.load(sys.stdin)["workers"]))')" "1[0-9]"
ck "Perfil trabajador sin datos sensibles" "$(curl -s $B/workers/1 | python3 -c 'import sys,json;d=json.load(sys.stdin)["worker"];print("phone" in d or "email" in d)')" "False"

echo "=== 2. Auth ==="
R=$(curl -s -c /tmp/dy_cli -X POST $B/auth/login -H "$J" -d '{"email":"cliente@demo.cl","password":"demo1234"}')
ck "Login cliente" "$R" '"ok":true'
R=$(curl -s -c /tmp/dy_tra -X POST $B/auth/login -H "$J" -d '{"email":"trabajador@demo.cl","password":"demo1234"}')
ck "Login trabajador" "$R" '"ok":true'
R=$(curl -s -c /tmp/dy_adm -X POST $B/auth/login -H "$J" -d '{"email":"admin@demo.cl","password":"demo1234"}')
ck "Login admin" "$R" '"ok":true'
ck "Login incorrecto rechazado" "$(curl -s -X POST $B/auth/login -H "$J" -d '{"email":"cliente@demo.cl","password":"mala"}')" "incorrectos"
ck "Ruta protegida sin sesión" "$(curl -s $B/requests/mine)" "No autenticado"

echo "=== 3. Registro ==="
R=$(curl -s -X POST $B/auth/register -H "$J" -d '{"name":"Test User","email":"test@test.cl","password":"test1234","role":"cliente","comuna_id":4}')
ck "Registro nuevo usuario" "$R" '"ok":true'
ck "Registro duplicado rechazado" "$(curl -s -X POST $B/auth/register -H "$J" -d '{"name":"X","email":"test@test.cl","password":"test1234"}')" "Ya existe"

echo "=== 4. Flujo completo: solicitud → cotización → aceptar → finalizar → reseña ==="
R=$(curl -s -b /tmp/dy_cli -X POST $B/requests -H "$J" -d '{"category_id":1,"title":"Prueba E2E: cambio de llave","description":"Necesito cambiar la llave de la ducha","comuna_id":4,"urgency":"hoy","budget":35000}')
ck "Cliente crea solicitud" "$R" '"ok":true'
REQ=$(echo $R | python3 -c 'import sys,json;print(json.load(sys.stdin)["id"])')
ck "Trabajador ve solicitud en bandeja" "$(curl -s -b /tmp/dy_tra $B/requests/feed)" "Prueba E2E"
R=$(curl -s -b /tmp/dy_tra -X POST $B/quotes -H "$J" -d "{\"request_id\":$REQ,\"price\":32000,\"description\":\"Cambio de llave completo\",\"available_date\":\"2026-09-09\",\"duration_estimate\":\"1 hora\",\"materials_included\":true}")
ck "Trabajador envía cotización" "$R" '"ok":true'
QID=$(curl -s -b /tmp/dy_cli $B/requests/$REQ | python3 -c 'import sys,json;print(json.load(sys.stdin)["quotes"][-1]["id"])')
R=$(curl -s -b /tmp/dy_cli -X POST $B/quotes/$QID/accept -H "$J")
ck "Cliente acepta cotización" "$R" '"ok":true'
JOB=$(echo $R | python3 -c 'import sys,json;print(json.load(sys.stdin)["job_id"])')
ck "Comisión calculada (10% de 32000=3200)" "$(curl -s -b /tmp/dy_cli $B/jobs | python3 -c "import sys,json;j=[x for x in json.load(sys.stdin)['jobs'] if x['id']==$JOB][0];print(j['commission_amount'])")" "3200"
R=$(curl -s -b /tmp/dy_tra -X POST $B/jobs/$JOB/status -H "$J" -d '{"status":"CONFIRMADO"}')
ck "Trabajador confirma" "$R" '"ok":true'
curl -s -b /tmp/dy_tra -X POST $B/jobs/$JOB/status -H "$J" -d '{"status":"EN_PROCESO"}' >/dev/null
ck "Cliente NO puede saltarse el flujo: trabajador no finaliza" "$(curl -s -b /tmp/dy_tra -X POST $B/jobs/$JOB/status -H "$J" -d '{"status":"FINALIZADO"}')" "Solo el cliente"
R=$(curl -s -b /tmp/dy_cli -X POST $B/jobs/$JOB/status -H "$J" -d '{"status":"FINALIZADO"}')
ck "Cliente marca terminado" "$R" '"ok":true'
R=$(curl -s -b /tmp/dy_cli -X POST $B/jobs/$JOB/review -H "$J" -d '{"rating":5,"quality":5,"punctuality":5,"treatment":5,"price_rating":4,"comment":"Excelente, llegó rápido"}')
ck "Cliente califica" "$R" '"ok":true'
ck "No se puede calificar dos veces" "$(curl -s -b /tmp/dy_cli -X POST $B/jobs/$JOB/review -H "$J" -d '{"rating":4}')" "Ya calificaste"

echo "=== 5. Seguridad de solicitudes y cotizaciones ==="
# Segundo trabajador compatible: debe poder entrar a la solicitud, pero solo ver sus propias cotizaciones.
R=$(curl -s -c /tmp/dy_tra2 -X POST $B/auth/register -H "$J" -d '{"name":"Segundo Trabajador","email":"trabajador2@test.cl","password":"test1234","role":"trabajador","phone":"56911112222","comuna_id":4}')
ck "Registro segundo trabajador" "$R" '"ok":true'
R=$(curl -s -b /tmp/dy_tra2 -X PUT $B/worker/profile -H "$J" -d '{"oficio":"Gasfíter","description":"Trabajador de prueba","status":"disponible","comuna_id":4,"categories":[1],"comunas":[4]}')
ck "Segundo trabajador configura categoría/zona" "$R" '"ok":true'
R=$(curl -s -b /tmp/dy_cli -X POST $B/requests -H "$J" -d '{"category_id":1,"title":"Prueba E2E privacidad cotizaciones","description":"Solicitud para probar aislamiento de cotizaciones","comuna_id":4,"urgency":"normal","budget":50000}')
REQ2=$(echo $R | python3 -c 'import sys,json;print(json.load(sys.stdin)["id"])')
R=$(curl -s -b /tmp/dy_tra -X POST $B/quotes -H "$J" -d "{\"request_id\":$REQ2,\"price\":45000,\"description\":\"Cotización trabajador A\",\"available_date\":\"2026-09-10\",\"duration_estimate\":\"2 horas\",\"materials_included\":true}")
ck "Trabajador A cotiza solicitud privada" "$R" '"ok":true'
DETAIL2=$(curl -s -b /tmp/dy_tra2 $B/requests/$REQ2)
ck "Trabajador B puede ver solicitud compatible" "$DETAIL2" '"request"'
ck "Trabajador B NO ve cotización de A" "$DETAIL2" '"quotes":\[\]'
R=$(curl -s -b /tmp/dy_tra2 -X POST $B/quotes -H "$J" -d "{\"request_id\":$REQ2,\"price\":47000,\"description\":\"Cotización trabajador B\",\"available_date\":\"2026-09-11\",\"duration_estimate\":\"2 horas\",\"materials_included\":true}")
ck "Trabajador B envía su propia cotización" "$R" '"ok":true'
DETAIL2=$(curl -s -b /tmp/dy_tra2 $B/requests/$REQ2)
ck "Trabajador B solo ve su cotización" "$DETAIL2" 'Cotización trabajador B'
if echo "$DETAIL2" | grep -q 'Cotización trabajador A'; then echo "❌ Trabajador B recibió la cotización de A"; F=$((F+1)); else echo "✅ Trabajador B no recibió la cotización de A"; P=$((P+1)); fi
# Trabajador incompatible por categoría no puede consultar la solicitud directamente.
R=$(curl -s -b /tmp/dy_tra2 -X PUT $B/worker/profile -H "$J" -d '{"categories":[2],"comunas":[4],"comuna_id":4,"status":"disponible"}')
ck "Segundo trabajador cambia a categoría incompatible" "$R" '"ok":true'
ck "Trabajador incompatible no puede consultar solicitud" "$(curl -s -b /tmp/dy_tra2 $B/requests/$REQ2)" "No eres compatible"

echo "=== 6. Chat anti-estafas ==="
CONV=$(curl -s -b /tmp/dy_cli $B/conversations | python3 -c 'import sys,json;print(json.load(sys.stdin)["conversations"][0]["id"])')
R=$(curl -s -b /tmp/dy_cli -X POST $B/conversations/start -H "$J" -d '{"worker_id":2}')
C2=$(echo $R | python3 -c 'import sys,json;print(json.load(sys.stdin)["id"])')
R=$(curl -s -b /tmp/dy_cli -X POST $B/conversations/$C2/messages -H "$J" -d '{"body":"Hola, llámame al +56 9 8765 4321 o escribe a test@gmail.com"}')
ck "Chat bloquea teléfono/email antes de aceptar trabajo" "$R" '"blocked":true'
ck "Mensaje normal pasa" "$(curl -s -b /tmp/dy_cli -X POST $B/conversations/$C2/messages -H "$J" -d '{"body":"Hola, ¿puedes venir mañana?"}')" '"blocked":false'
ck "Usuario ajeno no lee chat privado" "$(curl -s -b /tmp/dy_adm -o /dev/null -w '%{http_code}' $B/conversations/$C2/messages; curl -s -c /tmp/dy_otro -X POST $B/auth/login -H "$J" -d '{"email":"cliente1@demo.cl","password":"demo1234"}' >/dev/null; curl -s -b /tmp/dy_otro $B/conversations/$C2/messages)" "Sin acceso"

echo "=== 7. RBAC (control de roles) ==="
ck "Cliente no accede a admin" "$(curl -s -b /tmp/dy_cli $B/admin/stats)" "permiso"
ck "Cliente no crea perfil trabajador" "$(curl -s -b /tmp/dy_cli -X PUT $B/worker/profile -H "$J" -d '{}')" "permiso"
ck "Trabajador no crea solicitudes" "$(curl -s -b /tmp/dy_tra -X POST $B/requests -H "$J" -d '{"category_id":1,"title":"x"}')" "permiso"

echo "=== 8. Admin ==="
ck "Stats admin" "$(curl -s -b /tmp/dy_adm $B/admin/stats | python3 -c 'import sys,json;d=json.load(sys.stdin)["stats"];print(d["jobs_completed"]>0 and d["commissions"]>0)')" "True"
R=$(curl -s -b /tmp/dy_adm -X POST $B/admin/settings -H "$J" -d '{"commission_pct":12}')
ck "Admin cambia comisión a 12%" "$R" '"ok":true'
ck "Comisión persistida" "$(curl -s $B/config | python3 -c 'import sys,json;print(json.load(sys.stdin)["commission_pct"])')" "12"
curl -s -b /tmp/dy_adm -X POST $B/admin/settings -H "$J" -d '{"commission_pct":10}' >/dev/null
ck "Admin ve denuncias" "$(curl -s -b /tmp/dy_adm $B/admin/reports)" "incumplimiento"
ck "Admin ve verificaciones pendientes" "$(curl -s -b /tmp/dy_adm $B/admin/verifications)" "pendiente"

echo "=== 9. Retiro trabajador ==="
R=$(curl -s -b /tmp/dy_tra -X POST $B/worker/payout -H "$J")
ck "Trabajador solicita retiro" "$R" '"ok":true'

echo ""
echo "==================================="
echo "RESULTADO: $P pasaron, $F fallaron"
