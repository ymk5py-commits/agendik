#!/usr/bin/env python3
"""Prueba de humo de Agendik contra un stack levantado (corre en el servidor, junto al .env).

Hace lo que hace la app: registrar una cuenta, comprobar que el trigger creó la ficha, entrar,
reservar, intentar sobrevender el mismo horario, llamar a la función `notificar` y confirmar que
un cliente común no puede crear negocios ni leer fichas ajenas. Al terminar borra todo lo que creó.

  python3 probar-flujo.py [URL_BASE]      (por defecto http://127.0.0.1:3210, el borde local)
"""
import datetime, json, os, secrets, subprocess, sys, urllib.error, urllib.request

AQUI = os.path.dirname(os.path.abspath(__file__))
BASE = (sys.argv[1] if len(sys.argv) > 1 else "http://127.0.0.1:3210").rstrip("/")
ENV = {}
for linea in open(os.path.join(AQUI, ".env")):
    linea = linea.strip()
    if linea and not linea.startswith("#") and "=" in linea:
        k, v = linea.split("=", 1)
        ENV[k] = v.strip('"')
ANON = ENV["ANON_KEY"]

fallos = []
def chequeo(nombre, ok, detalle=""):
    print(("  ok   " if ok else "  FALLA"), nombre, ("— " + str(detalle)[:160]) if detalle and not ok else "")
    if not ok:
        fallos.append(nombre)

def llamar(metodo, ruta, cuerpo=None, token=None, extra=None):
    h = {"apikey": ANON, "Authorization": f"Bearer {token or ANON}", "Content-Type": "application/json"}
    h.update(extra or {})
    req = urllib.request.Request(BASE + ruta, method=metodo, headers=h,
                                 data=json.dumps(cuerpo).encode() if cuerpo is not None else None)
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            txt = r.read().decode()
            return r.status, (json.loads(txt) if txt else None)
    except urllib.error.HTTPError as e:
        txt = e.read().decode()
        try:
            return e.code, json.loads(txt)
        except Exception:
            return e.code, txt

def psql(sql):
    return subprocess.run(["docker", "exec", "-i", "ag-db", "psql", "-U", "postgres", "-At", "-v", "ON_ERROR_STOP=1"],
                          input=sql, capture_output=True, text=True)

# --- Datos base: si la base está vacía se siembra el negocio demo y se limpia al final.
st, tenants = llamar("GET", "/rest/v1/tenants?select=id,slug,business_name&order=created_at&limit=1")
sembrado = False
if st == 200 and not tenants:
    seed = os.path.join(AQUI, "..", "AGENDIK", "supabase", "seed.sql")
    r = subprocess.run(["docker", "exec", "-i", "ag-db", "psql", "-U", "postgres", "-q", "-v", "ON_ERROR_STOP=1"],
                       stdin=open(seed), capture_output=True, text=True)
    if r.returncode:
        sys.exit("No pude sembrar: " + r.stderr[:300])
    sembrado = True
    st, tenants = llamar("GET", "/rest/v1/tenants?select=id,slug,business_name&order=created_at&limit=1")
chequeo("el portal público lee el negocio (tenants, anon)", st == 200 and len(tenants) == 1, (st, tenants))
tenant = tenants[0]

email = f"prueba-{secrets.token_hex(4)}@agendik.invalid"
clave = secrets.token_urlsafe(14)
uid = None
try:
    st, r = llamar("POST", "/auth/v1/signup", {"email": "x@agendik.invalid", "password": "corta"})
    chequeo("GoTrue rechaza claves de menos de 8", st in (400, 422), (st, r))

    st, r = llamar("POST", "/auth/v1/signup", {"email": email, "password": clave,
                   "data": {"name": "Prueba E2E", "phone": "+595 000 000", "tenant_id": tenant["id"]}})
    tok = (r or {}).get("access_token") if isinstance(r, dict) else None
    uid = ((r or {}).get("user") or {}).get("id") if isinstance(r, dict) else None
    chequeo("registro con sesión inmediata (autoconfirm)", st == 200 and tok and uid, (st, r))
    if not tok:
        raise SystemExit

    st, fichas = llamar("GET", "/rest/v1/clients?select=id,tenant_id,email", token=tok)
    chequeo("el trigger creó la ficha de cliente en el negocio correcto",
            st == 200 and len(fichas) == 1 and fichas[0]["tenant_id"] == tenant["id"], (st, fichas))

    st, r = llamar("POST", "/auth/v1/token?grant_type=password", {"email": email, "password": clave})
    chequeo("login con email y clave", st == 200 and r.get("access_token"), (st, r))

    st, r = llamar("GET", "/rest/v1/clients?select=id")
    chequeo("anónimo no ve fichas de clientes", st in (401, 403) or r == [], (st, r))

    st, r = llamar("POST", "/rest/v1/rpc/create_business",
                   {"p_slug": "negocio-e2e", "p_business_name": "No debería existir", "p_phone": "+595 000",
                    "p_owner_email": "dueno-e2e@agendik.invalid", "p_owner_name": "O"}, token=tok)
    # 403 = PostgREST traduce el errcode 42501 que lanza la función; cualquier otro error (p. ej. firma mal) no prueba el permiso.
    chequeo("un cliente común NO puede crear negocios (42501)",
            st == 403 and "Solo el dueño de la plataforma" in json.dumps(r, ensure_ascii=False), (st, r))
    n = psql("select count(*) from public.tenants where slug = 'negocio-e2e';").stdout.strip()
    chequeo("y no quedó ningún negocio creado", n == "0", n)

    # --- Reserva: próximo día con horario de trabajo de un profesional del negocio.
    st, profs = llamar("GET", "/rest/v1/professionals?select=id,name&limit=1", token=tok)
    st2, srv = llamar("GET", "/rest/v1/services?select=id&limit=1", token=tok)
    chequeo("el cliente ve profesionales y servicios de su negocio", st == 200 and profs and st2 == 200 and srv, (st, st2))
    pid, sid = profs[0]["id"], srv[0]["id"]
    st, horas = llamar("GET", f"/rest/v1/working_hours?professional_id=eq.{pid}&select=weekday,start_time&order=weekday", token=tok)
    h = horas[0]
    dia = datetime.date.today() + datetime.timedelta(days=2)
    while (dia.isoweekday() % 7) != h["weekday"]:   # isoweekday: lunes=1…domingo=7 → %7 da domingo=0
        dia += datetime.timedelta(days=1)
    args = {"p_professional_id": pid, "p_date": dia.isoformat(), "p_start_time": h["start_time"],
            "p_service_ids": [sid], "p_package_id": None, "p_notes": "prueba e2e", "p_subscription_id": None}
    st, cita = llamar("POST", "/rest/v1/rpc/book_appointment", args, token=tok)
    chequeo("reservar una cita (RPC book_appointment)", st == 200 and isinstance(cita, str), (st, cita))

    st, r = llamar("POST", "/rest/v1/rpc/book_appointment", args, token=tok)
    chequeo("el mismo horario NO se puede sobrevender", st >= 400, (st, r))

    st, r = llamar("GET", "/rest/v1/appointments?select=id,status", token=tok)
    chequeo("el cliente ve su cita", st == 200 and len(r) == 1, (st, r))

    # `notificar` valida el JWT en el gateway y el dueño de la cita en la función (leyendo la cita por REST con la
    # clave de servicio). La respuesta propia de la función trae la clave `ok`: si llegó ahí, todo el camino anda.
    # Si Brevo contesta 401/403, falta BREVO_API_KEY en .env (el aviso por mail no sale, pero la cita ya está guardada).
    st, r = llamar("POST", "/functions/v1/notificar", {"appointment_id": cita, "evento": "creada"}, token=tok)
    llego = isinstance(r, dict) and "ok" in r
    chequeo("la función notificar responde (gateway → runtime → REST)", llego, (st, r))
    if llego and not r["ok"]:
        print("         aviso: Brevo respondió", r.get("brevo"), "→ falta/está mal BREVO_API_KEY en .env")
    elif llego:
        print("         mail enviado")
    st, r = llamar("POST", "/functions/v1/notificar", {"appointment_id": cita, "evento": "creada"})
    chequeo("notificar sin sesión de usuario se rechaza", st in (401, 403), (st, r))
finally:
    if uid:
        psql(f"delete from public.appointments where client_id in (select id from public.clients where user_id = '{uid}');"
             f"delete from public.clients where user_id = '{uid}'; delete from auth.users where id = '{uid}';")
    if sembrado:
        psql("truncate public.tenants cascade;")
    print("  (limpieza hecha" + (", seed retirado" if sembrado else "") + ")")

print("\nRESULTADO:", "TODO OK" if not fallos else f"{len(fallos)} FALLA(S): " + "; ".join(fallos))
sys.exit(1 if fallos else 0)
