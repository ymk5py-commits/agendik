#!/usr/bin/env python3
"""Parte remota de poner-smtp.sh: lee 6 líneas por stdin (host, puerto, usuario, clave, remitente, nombre) y las
escribe en .env. La clave NO se imprime ni pasa por la línea de comandos. Guarda copia del .env anterior."""
import os, re, shutil, sys, time

AQUI = os.path.dirname(os.path.abspath(__file__))
ruta = os.path.join(AQUI, ".env")
host, puerto, usuario, clave, desde, nombre = [l.rstrip("\n") for l in sys.stdin.read().split("\n")[:6]]

def falla(m):
    sys.exit("poner-smtp: " + m)

if not re.fullmatch(r"[A-Za-z0-9.-]+", host):
    falla("el servidor SMTP no parece un nombre válido")
if not puerto.isdigit() or not 0 < int(puerto) < 65536:
    falla("puerto inválido")
if not re.fullmatch(r"[^@\s'\"]+@[^@\s'\"]+\.[^@\s'\"]+", desde):
    falla("el remitente no parece un email")
for k, v in (("usuario", usuario), ("clave", clave), ("nombre", nombre)):
    if "'" in v or "\r" in v or "\n" in v:
        falla(f"{k}: no puede llevar comillas simples ni saltos de línea")
clave = clave.replace(" ", "")   # Gmail muestra las contraseñas de aplicación en grupos de 4 con espacios

nuevos = {"SMTP_HOST": host, "SMTP_PORT": puerto, "SMTP_USER": usuario, "SMTP_PASS": clave,
          "SMTP_ADMIN_EMAIL": desde, "SMTP_SENDER_NAME": nombre or "Agendik"}

texto = open(ruta).read()
copia = f"{ruta}.bak-smtp-{time.strftime('%Y%m%d-%H%M%S')}"
shutil.copy2(ruta, copia); os.chmod(copia, 0o600)
for k, v in nuevos.items():
    linea = f"{k}='{v}'"
    texto, n = re.subn(rf"(?m)^{k}=.*$", lambda _: linea, texto)
    if n != 1:
        falla(f"no encontré {k} en .env")
open(ruta, "w").write(texto); os.chmod(ruta, 0o600)
print(f"SMTP cargado: {host}:{puerto} · usuario={'(sin usuario)' if not usuario else usuario} · remitente={desde} · (copia: {os.path.basename(copia)})")
