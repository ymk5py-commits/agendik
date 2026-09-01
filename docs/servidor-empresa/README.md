# Los LLM del servidor de la empresa

El servidor de la oficina (Linux) se alcanza por Tailscale, igual que la Mac.
Este script contesta una pregunta concreta: **qué modelos hay instalados ahí,
cuáles están cargados en memoria ahora, y quién puede llegar a ellos.**

Es de **solo lectura**. No instala, no borra, no para ni levanta nada.

---

## Correrlo

Primero, para saber a qué máquina apuntar:

```bash
tailscale status
```

Después, sin copiar el archivo al servidor — se lo mandás por la tubería
del ssh:

```bash
ssh usuario@servidor 'bash -s' < docs/servidor-empresa/inventario-llm.sh
```

O parado adentro del servidor:

```bash
bash inventario-llm.sh
```

Con `sudo` se ve de qué proceso es cada puerto. Sin `sudo` el resto anda
igual, solo que algunos puertos salen sin nombre de proceso.

---

## Qué reporta

| Sección | Qué contesta |
|---|---|
| La máquina | sistema, núcleos, RAM usada y disponible |
| GPU | placa, VRAM ocupada, y qué proceso la está usando |
| Ollama | modelos descargados con peso y cuantización, y cuáles están cargados **ahora** |
| Otros motores | LM Studio, vLLM, llama.cpp, LocalAI, SGLang, Jan, GPT4All, Open WebUI |
| Puertos | quién escucha en 11434, 8080, 1234, 8000, 7860… |
| Docker | contenedores de LLM, y los modelos de adentro si hay un Ollama contenerizado |
| Disco | cuánto pesan los modelos y en qué carpeta están |

---

## Las dos cosas que importan de la salida

**Instalado no es lo mismo que cargado.** `ollama list` muestra lo que está
bajado al disco; `ollama ps` muestra lo que ocupa RAM o VRAM en este momento.
Un servidor puede tener 60 GB de modelos y cero cargados: se cargan al primer
pedido y se descargan solos a los minutos. El script muestra las dos listas
por separado porque responden preguntas distintas — cuánto disco se está
gastando, contra qué está corriendo ahora.

**Mirá el aviso de la sección de puertos.** Un LLM que escucha en `127.0.0.1`
lo usa solo esa máquina. Uno que escucha en `0.0.0.0` lo alcanza cualquiera
que llegue al servidor, incluido todo el tailnet, y las APIs tipo OpenAI de
Ollama y vLLM **no piden contraseña**: quien llegue al puerto usa los modelos
y lee lo que se les manda.

El aviso mira solo la columna de dirección local de `ss`, no la línea entera.
La columna de al lado es la del peer y siempre dice `0.0.0.0:*`, también
cuando el servicio está cerrado a la red: leyendo la línea completa, un Ollama
en localhost figuraba como expuesto.

---

## Entrar por SSH

Si hasta ahora entraste solo por AnyDesk, puede que el servidor **no tenga SSH
prendido**: Ubuntu Server lo trae, Ubuntu Desktop no siempre. Eso se arregla
una sola vez, y hay que hacerlo estando en la máquina — por AnyDesk, entonces.

**Una vez, desde el escritorio del servidor:**

```bash
systemctl status ssh          # ¿está corriendo?
sudo apt install openssh-server   # si no estaba
sudo systemctl enable --now ssh   # que arranque en cada reinicio

tailscale ip -4               # anotá esta dirección, empieza en 100.
```

**De ahí en más, desde tu Ubuntu:**

```bash
ssh usuario@100.x.x.x
```

Para no escribir la contraseña cada vez, dejá la llave puesta (una sola vez):

```bash
ssh-keygen -t ed25519         # si todavía no tenés una
ssh-copy-id usuario@100.x.x.x
```

### Cuál dirección usar

| Dirección | Desde dónde funciona |
|---|---|
| `100.x.x.x` (Tailscale) | desde cualquier lado, mientras las dos máquinas estén en el tailnet |
| `192.168.x.x` (LAN) | **solo** estando conectado a la red de la oficina |

La de Tailscale es fija y anda igual desde tu casa. La de la red local no sale
de la oficina: ese rango existe por separado dentro de cada red, así que desde
afuera no lleva a ninguna parte.

---

## Probar los modelos

```bash
bash probar-llm.sh                        # qué hay y qué está cargado
bash probar-llm.sh --modelo llama3.1:8b   # probar uno
bash probar-llm.sh --prompt "tu pregunta" --modelo llama3.1:8b
bash probar-llm.sh --todos                # todos, uno por uno
```

Manda una consigna, muestra la respuesta y desglosa el tiempo en tres partes:
cargar el modelo, leer la consigna y generar. Sin argumentos no genera nada.

Para charlar de ida y vuelta conviene `ollama run <modelo>`, que es
interactivo. El script sirve para lo otro: medir y comparar.

**El desglose importa más que el total.** La primera consulta a un modelo que
no estaba cargado se lleva entre 3 y 30 segundos solo en subirlo a memoria.
Si mirás el total, un modelo rápido parece lentísimo la primera vez y rapidísimo
la segunda, y ninguna de las dos lecturas sirve para comparar contra otro.
La cifra que compara es **tokens/s de generación**.

Como referencia: en GPU un modelo de 7-8B suele dar entre 30 y 80 tokens/s.
Por debajo de 5 tokens/s casi seguro está corriendo en CPU — el script lo avisa.

**`--todos` carga los modelos uno por uno**, y cada uno desaloja al anterior de
la memoria. En un servidor que usa más gente, eso se nota del otro lado: el
script avisa antes de arrancar.

---

## Cómo se verificó

Con stubs, porque el servidor no es alcanzable desde donde se escribió esto.
Un `nvidia-smi`, un `ss` y un Ollama falso — un servidor HTTP en el 11434 que
devuelve `/api/tags`, `/api/ps` y `/api/generate` con la forma real que
tienen, tiempos en nanosegundos incluidos.

Del **inventario**: que los modelos, sus tamaños y lo cargado en memoria se
parseen bien, y que el aviso de exposición salte con un `0.0.0.0:8080` y se
quede callado cuando todo está en `127.0.0.1`.

Del **probador**: el desglose de tiempos contra una respuesta con números
conocidos, un modelo lento a propósito para ver saltar el aviso de CPU, el
nombre de modelo inexistente, y que al redirigir la salida a un archivo no
queden códigos de color en el medio del texto.
