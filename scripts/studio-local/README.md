# VELT Studio local — protótipo

Este protótipo permite usar um modelo próprio para roteiros e gerar, **em uma máquina do operador**, um vídeo vertical básico a partir de um roteiro exportado. Ele não gera imagens com IA, não é uma fila multiusuário, não faz upload nem publica automaticamente. Requer revisão humana.

## 1. Roteiros sem API paga por token

Instale e execute o Ollama no mesmo computador/servidor em que o VELT roda (ou em servidor privado alcançável por ele). Baixe um modelo compatível com geração JSON, cujo uso comercial seja permitido pela licença. A qualidade em pt-BR e os recursos necessários variam por modelo e máquina.

No ambiente **do servidor VELT**, configure:

```dotenv
STUDIO_AI_PROVIDER=ollama
STUDIO_OLLAMA_URL=http://127.0.0.1:11434
STUDIO_OLLAMA_MODEL=nome-do-modelo-instalado
```

Reinicie o VELT. Por exemplo, após instalar um modelo no Ollama, use seu nome exato em `STUDIO_OLLAMA_MODEL` (sem colchetes). O endereço localhost é visto pelo **servidor**, não pelo navegador. Se forem contêineres separados ou se o VELT estiver na nuvem, use a rede privada apropriada. Não exponha o Ollama diretamente na internet; proteja a comunicação entre serviços. O protótipo não implementa autenticação para Ollama remoto.

O padrão continua `STUDIO_AI_PROVIDER=lovable`, que usa o gateway externo e pode gerar cobranças. Com `ollama`, se o modelo falhar, **não há fallback automático para API paga**. Outros recursos do produto que usam IA não mudam com essa configuração. Tokens de OAuth das redes continuam necessários para as integrações de publicação: são credenciais, não tokens de faturamento de IA.

## 2. Exportar roteiro

Entre em **Conteúdo → VELT Studio**, gere e revise o roteiro e clique em **Exportar roteiro para vídeo local**. O JSON exportado contém somente versão, título e narração. As sugestões de cenas, CTA e legenda continuam no rascunho do VELT, mas não são usadas pelo renderizador atual. O arquivo pode ser editado antes do processamento:

```json
{"version":1,"title":"Organize suas tarefas","narration":"Escolha uma prioridade e comece por ela."}
```

## 3. Montar o vídeo na máquina local

Requisitos: Python 3, Pillow, FFmpeg com `libx264`/AAC e uma fonte TTF. Se FFmpeg não estiver no PATH, o script tenta usar o executável do pacote `imageio-ffmpeg`. Em um ambiente virtual Python:

```bash
python -m pip install Pillow imageio-ffmpeg
python scripts/studio-local/render.py \
  --script velt-roteiro.json --audio minha-narracao.wav --output video.mp4
```

O arquivo de áudio fornecido deve ser WAV PCM, com duração entre 0,5 e 120 segundos. Em Windows/macOS, ou em Linux sem a fonte padrão, acrescente `--font /caminho/fonte.ttf`. Uma imagem licenciada pode ser usada com `--background /caminho/imagem.jpg`.

Para narrar sem API externa, instale `piper-tts`, baixe uma voz ONNX em pt-BR **e seu arquivo de configuração correspondente**, verifique a licença de ambos, e use em vez de `--audio`:

```bash
python scripts/studio-local/render.py \
  --script velt-roteiro.json --piper-model /caminho/voz.onnx --output video.mp4
```

O Piper é um exemplo sujeito às suas próprias licenças; confirme compatibilidade com o uso e distribuição do produto antes de adotá-lo comercialmente. O mesmo vale para o FFmpeg, suas bibliotecas e modelos de IA. A voz e seu modelo não são fornecidos aqui.

As legendas são divididas automaticamente e têm **sincronização aproximada**, proporcional ao tamanho do texto, não alinhamento por palavra. Não inventa imagens nem usa as sugestões de cenas. Revise narração, legendas, conteúdo, direitos e exigências das plataformas antes de publicar. Este comando roda na máquina do operador e ainda **não é acionado pelo navegador nem anexa o MP4 automaticamente ao rascunho**.

Para testar o renderizador:

```bash
python scripts/studio-local/test_render.py
```

## 4. Worker local integrado à tela (experimental)

O Studio pode solicitar um vídeo diretamente pela interface **quando o VELT e o worker estiverem na mesma máquina**. O navegador nunca acessa localhost; o servidor VELT fala com o worker em loopback. Não há fallback para serviços pagos.

1. Instale Python/Pillow, FFmpeg e `piper-tts`; baixe uma voz pt-BR com a licença adequada e seu arquivo de configuração, como descrito acima.
2. Gere um segredo aleatório de pelo menos 32 caracteres ASCII. Configure o **mesmo** segredo no servidor VELT e no processo do worker. Não adicione o segredo ao repositório.
3. No ambiente do servidor VELT, defina `STUDIO_WORKER_URL=http://127.0.0.1:8765` e `STUDIO_WORKER_SECRET`.
4. Em outro terminal na mesma máquina, configure as variáveis e inicie o worker (exemplo em Linux/macOS):

```bash
export STUDIO_WORKER_SECRET='COLOQUE_AQUI_UM_SEGREDO_ALEATORIO_PRIVADO'
export VELT_PIPER_MODEL='/caminho/voz.onnx'
# Se necessário: export VELT_FONT='/caminho/fonte.ttf'
python scripts/studio-local/worker.py
```

5. Reinicie o VELT com o mesmo segredo, gere ou abra um roteiro, revise e clique em **Gerar vídeo local**. Mantenha a tela aberta e baixe o MP4 quando estiver pronto.

O worker escuta apenas em `127.0.0.1`, exige o segredo compartilhado e confere usuário e workspace para consultar/baixar. O VELT valida a sessão e o papel do usuário antes de acessar o worker. Os trabalhos existem apenas na memória do worker; uma reinicialização perde a fila e o vínculo com os vídeos. O limite é quatro trabalhos pendentes/em execução, um processando de cada vez, 50 trabalhos armazenados e 8 MiB por MP4. Eles expiram uma hora após terminar e são removidos durante novas operações. Após uma queda abrupta, arquivos temporários podem permanecer no disco e precisam de limpeza pelo operador. O processamento não foi projetado para múltiplos servidores, escala, isolamento de processos, durabilidade nem produção pública. O limite de requisições do VELT é por processo, não uma quota distribuída. Não publique a porta do worker nem o segredo.

Teste da integração local (usa uma voz simulada, não valida a qualidade do Piper):

```bash
python scripts/studio-local/test_worker.py
```
