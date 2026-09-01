# Qué LLMs corren en el servidor de la empresa

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

## Cómo se verificó

Con stubs, porque el servidor no es alcanzable desde donde se escribió esto.
Un `nvidia-smi`, un `ss` y un Ollama falso — un servidor HTTP en el 11434 que
devuelve `/api/tags` y `/api/ps` con la forma real que tienen — para
comprobar que los modelos, sus tamaños y lo cargado en memoria se parsean
bien, y que el aviso de exposición salta con un `0.0.0.0:8080` y se queda
callado cuando todo está en `127.0.0.1`.
