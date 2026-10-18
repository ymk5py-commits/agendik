#!/usr/bin/env python3
"""Worker de correo de Agendik: vacía la cola `cola_correos` por SMTP.

Corre cada minuto desde un timer de systemd (ver instalar-temporizador.sh), dentro de la red del stack:
  - habla con la base por PostgREST (`rest`) con la clave de servicio, usando las funciones de la migración 0017
    (reclamar_correos / resolver_correo / limpiar_cola_correos);
  - envía por el SMTP de SMTP_* (las mismas variables que usa GoTrue para recuperar contraseñas), así hay UN solo lugar
    donde se configura el correo saliente. Sin SMTP real cargado, esas variables apuntan a Mailpit y nada sale del servidor.

Solo librería estándar. Un correo que falla se reintenta con espera creciente y a la quinta queda «fallido».
"""
import json, os, smtplib, ssl, sys, urllib.error, urllib.request
from email.message import EmailMessage
from email.utils import formataddr, formatdate, make_msgid

REST = os.environ.get("REST_URL", "http://rest:3000").rstrip("/")
KEY = os.environ["SERVICE_ROLE_KEY"]
HOST = os.environ.get("SMTP_HOST") or "mailpit"
PORT = int(os.environ.get("SMTP_PORT") or 1025)
USUARIO = os.environ.get("SMTP_USER", "")
CLAVE = os.environ.get("SMTP_PASS", "")
DESDE = os.environ.get("SMTP_ADMIN_EMAIL") or "no-responder@localhost"
NOMBRE = os.environ.get("SMTP_SENDER_NAME") or "Agendik"
LOTE = int(os.environ.get("CORREO_LOTE", "20"))


def rpc(nombre, args=None):
    req = urllib.request.Request(
        f"{REST}/rpc/{nombre}", method="POST", data=json.dumps(args or {}).encode(),
        headers={"Authorization": f"Bearer {KEY}", "apikey": KEY, "Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            cuerpo = r.read().decode()
            return json.loads(cuerpo) if cuerpo else None
    except urllib.error.HTTPError as e:
        raise RuntimeError(f"{nombre}: HTTP {e.code} {e.read().decode()[:200]}") from None


def conectar():
    if PORT == 465:
        s = smtplib.SMTP_SSL(HOST, PORT, timeout=30, context=ssl.create_default_context())
        s.ehlo()
    else:
        s = smtplib.SMTP(HOST, PORT, timeout=30)
        s.ehlo()
        if s.has_extn("starttls"):          # 587 / 25 con TLS; Mailpit y los relays internos suelen no ofrecerlo
            s.starttls(context=ssl.create_default_context())
            s.ehlo()
    if USUARIO:
        s.login(USUARIO, CLAVE)
    return s


def armar(c):
    m = EmailMessage()
    m["From"] = formataddr((NOMBRE, DESDE))
    m["To"] = c["para"]
    m["Subject"] = c["asunto"]
    m["Date"] = formatdate(localtime=True)
    m["Message-ID"] = make_msgid(domain=DESDE.split("@")[-1] or "localhost")
    m["Auto-Submitted"] = "auto-generated"   # es un aviso automático: no pedir acuse ni responder en cadena
    m.set_content(c.get("texto") or "Este mensaje requiere un cliente de correo que muestre HTML.")
    m.add_alternative(c["html"], subtype="html")
    return m


def main():
    lote = rpc("reclamar_correos", {"p_limite": LOTE}) or []
    if not lote:
        print("cola vacía")
        rpc("limpiar_cola_correos")
        return 0

    ok = mal = 0
    smtp = None
    for c in lote:
        try:
            if smtp is None:
                smtp = conectar()
            smtp.send_message(armar(c))
            rpc("resolver_correo", {"p_id": c["id"], "p_ok": True})
            ok += 1
        except Exception as e:  # noqa: BLE001 — cualquier fallo de red/SMTP se anota y se reintenta
            mal += 1
            rpc("resolver_correo", {"p_id": c["id"], "p_ok": False, "p_error": f"{type(e).__name__}: {e}"})
            print(f"  falló {c['id']} → {c['para']}: {type(e).__name__}: {e}", file=sys.stderr)
            try:
                if smtp:
                    smtp.close()
            except Exception:  # noqa: BLE001
                pass
            smtp = None                       # la próxima vez se reconecta
    try:
        if smtp:
            smtp.quit()
    except Exception:  # noqa: BLE001
        pass
    rpc("limpiar_cola_correos")
    print(f"enviados={ok} fallidos={mal} (SMTP {HOST}:{PORT})")
    return 0


if __name__ == "__main__":
    sys.exit(main())
