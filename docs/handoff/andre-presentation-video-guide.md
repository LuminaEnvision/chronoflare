# ChronoFlare — guia de apresentação e vídeo para André

Preparado em 15/11/2026. Base: main com as PRs #50, #51 e #52. O calendário, as referências diárias e os dois gráficos foram conferidos no site publicado. Este guia orienta a demonstração; não substitui o parecer científico nem o regulamento da submissão.

Site: https://chronoflare.vercel.app/
Repositório: https://github.com/j-c-fstk-dev/chronoflare

## 1. A mensagem que precisa ficar

“Satélites diferentes enxergam o fogo de formas diferentes. O ChronoFlare transforma essa dificuldade em uma comparação histórica explícita: mostra observações separadas, estima uma referência comum quando há suporte e revela as lacunas e a incerteza.”

O resultado de hoje é um protótipo funcional para o Pantanal, com harmonização v2 aprovada pelo responsável científico. A publicação exige Terra e Aqua completos. Não é uma série diária contínua nem um sistema de alerta.

Três números para memorizar:

- Teste independente registrado antes da aquisição: 506 dias pareados, em 40 semanas elegíveis.
- Viés semanal do v2: aproximadamente −1,0%, contra −29,4% do benchmark sem calibração.
- MAE semanal: 1.675,5 MW, contra 2.589,0 MW do benchmark nos mesmos dados; redução aproximada de 35,3%.

Duas ressalvas que devem aparecer espontaneamente:

- Só 6 estimativas são publicadas em 2025 e 5 em 2026. A evidência é mais forte em 2020–2024.
- Não há teste retroativo independente; concordância no período de treino não é validação.

Na demonstração, use um dia para explicar a interface. Use o conjunto independente agregado para sustentar o desempenho. Uma comparação visual bonita de um único dia não comprova o modelo.

## 2. Problema, público e valor — respostas diretas

### Qual problema resolvemos?

MODIS e VIIRS têm resoluções e horários de passagem diferentes. Juntar suas somas brutas pode fazer uma mudança no sistema de observação parecer uma mudança na atividade de fogo. A falta de registros também pode ser confundida com ausência de fogo.

O ChronoFlare mantém as fontes identificadas, usa um modelo calibrado para a comparação aprovada e preserva lacunas. Ele permite explorar o histórico sem esconder essas diferenças.

### Para quem isso pode ser útil?

O público-alvo proposto são pesquisadores, analistas ambientais e equipes que comunicam padrões históricos de atividade de fogo. Eles precisam comparar períodos e entender o que os sensores efetivamente registraram.

Exemplo de pergunta: “Como a atividade registrada se distribuiu em dois anos do Pantanal, usando uma mesma série e reconhecendo os dias sem suporte?”

Esses são usos propostos. Não afirmar que já houve validação com usuários, adoção por órgãos públicos ou decisões operacionais baseadas no app.

### O que o usuário consegue fazer agora?

Selecionar ano e série, explorar dias no calendário, comparar dois anos, consultar FRP e intervalos, distinguir treino de teste e conferir os resultados científicos. O mapa permite explorar uma entrega separada de detecções de agosto de 2020.

### Onde está o diferencial?

A relação entre sensores foi testada e pode ser auditada. O primeiro candidato falhou e foi preservado; o v2 foi congelado, passou por teste registrado antes da aquisição dos novos dados e recebeu aprovação com escopo restrito. Essa história é mais convincente que afirmar apenas que usamos dados da NASA ou um mapa.

Não dizer “somos os primeiros”, “melhor que todas as alternativas” ou “precisão de 99%”: não temos essas evidências.

## 3. Demonstração do aplicativo — ordem recomendada

### Passo 1 — abrir a aplicação já na cena certa

Abra este endereço antes de gravar:
https://chronoflare.vercel.app/?obs_source=harmonized&obs_year=2020&obs_date=2020-08-01

Em Calendar, confirme Series = “Harmonized · Terra + Aqua” e Year = 2020. O resumo informa Plano A e os limites de publicação. O calendário usa cor para magnitude, sem inventar valores em dias sem suporte.

Diga: “A cor mostra o indicador de potência radiativa. Uma lacuna continua sendo lacuna; ela não vira zero.”

### Passo 2 — tornar a harmonização concreta em um dia

No calendário, selecione 1º de agosto de 2020, ou mantenha a data do link. Role até “Inspect a solar day”. O painel mostra:

- Estimativa harmonizada: 11.455,6 MW.
- “S-NPP observed, same solar date”: 10.966,4 MW.
- “Uncalibrated MODIS benchmark”: 9.358,3 MW.
- Intervalo empírico de 80%: 6.447,5 a 17.346,5 MW.
- Papel da data: “Previously examined date · post-hoc evidence”.

O site usa separadores em inglês: os mesmos números aparecem como 11,455.6 e 10,966.4. Não trocar vírgula decimal com milhar ao narrar.

Diga: “Aqui vemos a estimativa, a referência observada e o valor sem calibração na mesma data. Este é um exemplo de leitura da interface; a validação vem do teste agregado, não deste dia.”

Esse dia foi examinado anteriormente. Não o apresentar como exemplo de teste independente. A referência S-NPP também é uma observação por satélite, não uma medição absoluta de toda a atividade de fogo no solo.

### Passo 3 — mostrar a comparação entre anos

Abra:
https://chronoflare.vercel.app/?obs_source=harmonized&obs_year=2020&obs_date=2020-08-01&obs_compare=2024

Em “Compare with”, o segundo ano é 2024. Role até “Same series · two years”. As linhas compartilham mês/dia e eixo vertical; datas ausentes interrompem as linhas. Pontos isolados continuam visíveis. Use “Compare a month/day” para consultar valores sem depender de hover.

Diga: “Comparamos os períodos na mesma série. Não preenchemos lacunas nem calculamos uma variação anual como se o registro fosse completo.”

Não usar a altura ou a soma das curvas para anunciar “2020 teve X% mais incêndios”. FRP não é contagem de incêndios, e o suporte temporal é incompleto.

### Passo 4 — demonstrar que a ciência sustenta a interface

Abra Methodology:
https://chronoflare.vercel.app/?view=methodology

Mostre primeiro “All registered combined-view checks passed.” A tabela apresenta resultado, benchmark, critério e “Passed”. Explique o ganho de magnitude com o viés e o MAE; não tente narrar cada métrica.

Depois mostre os dois gráficos:

- “Before: uncalibrated MODIS benchmark”: benchmark contra a observação S-NPP.
- “After: harmonized estimate”: estimativa contra a mesma observação S-NPP, com intervalos empíricos de 80%.

Como explicar: cada ponto é uma data solar; os eixos são logarítmicos. A diagonal tracejada indica igualdade. Pontos abaixo dela subestimam o S-NPP; acima, superestimam. Os segmentos verticais no painel harmonizado são intervalos, não uma trajetória temporal.

Os filtros são botões alternáveis. Para destacar só a evidência independente, desligue “Training period” e “Previously examined”; mantenha “Independent test” ligado. Os papéis também têm formas diferentes: treino = quadrado, previamente examinado = losango, independente = círculo. Não depender apenas da cor.

Importante: o gráfico representa o subconjunto publicado que também possui S-NPP pareado. Ele não reproduz todo o conjunto de 506 dias da avaliação. Portanto, a redução de MAE de 35,3% vem da tabela registrada, e não de uma métrica recalculada sobre os pontos filtrados no gráfico.

### Passo 5 — mostrar os limites sem enfraquecer a apresentação

Ainda em Methodology, mostre “Strongest evidence is in 2020–2024.” Ou selecione Year = 2025 no calendário:
https://chronoflare.vercel.app/?obs_source=harmonized&obs_year=2025

Diga: “A aprovação não esconde a falta de suporte. Com a exigência de duas plataformas completas, há apenas seis estimativas em 2025 e cinco em 2026. Nós mantemos essas lacunas visíveis.”

A aprovação não inclui detecção automática de anomalias ou classificação de temporada.

### Passo 6 — mapa, se houver tempo

https://chronoflare.vercel.app/?view=map

O mapa é uma entrega separada de 1º a 15 de agosto de 2020. É útil para situar as detecções e explorar registros. Não afirmar que ele mostra os pontos exatos de qualquer célula ou de qualquer ano do calendário. Não deixar o mapa ocupar o tempo do resultado central de harmonização.

## 4. Roteiro falado de aproximadamente três minutos

A duração abaixo é uma sugestão de ensaio, não uma regra oficial. Ajustar ao limite real do formulário.

### 0:00–0:25 — o problema

“Comparar o fogo no tempo parece simples, até percebermos que satélites diferentes não observam da mesma forma. MODIS e VIIRS têm resoluções e horários de passagem distintos. Uma mudança de sensor pode parecer uma mudança ambiental; e um dia sem registros não significa necessariamente um dia sem fogo.”

### 0:25–0:50 — a proposta

“Criamos o ChronoFlare para explorar esse histórico com transparência. Usamos observações reais da NASA FIRMS e o limite oficial do Pantanal do IBGE. As plataformas originais permanecem separadas, e uma série calibrada oferece uma referência comum apenas quando os dados atendem ao escopo aprovado.”

### 0:50–1:25 — a experiência no calendário

“Aqui escolhemos um ano, exploramos um dia e comparamos períodos. O detalhe mostra a estimativa harmonizada, a observação S-NPP, o benchmark sem calibração e o intervalo de incerteza. Cada data informa seu papel na pesquisa. Este dia ilustra a interface; o desempenho é sustentado pelo teste independente agregado. As lacunas continuam visíveis.”

### 1:25–2:10 — o resultado científico

“O primeiro candidato falhou, e preservamos esse resultado. O v2 foi congelado e avaliado em um conjunto de datas não examinadas, registrado antes da aquisição. Foram 506 dias pareados em 40 semanas elegíveis. O viés semanal ficou em aproximadamente menos um por cento; o erro absoluto médio caiu cerca de 35 por cento em relação ao benchmark nos mesmos dados. Os critérios registrados foram cumpridos e o responsável científico aprovou o Plano A.”

### 2:10–2:40 — os gráficos e os limites

“Esses gráficos comparam os valores nas mesmas datas e separam treino, dados previamente examinados e teste independente. A publicação exige Terra e Aqua completos. Isso deixa somente seis estimativas em 2025 e cinco em 2026. Também não temos um teste retroativo independente. A interface mostra essas limitações, em vez de transformá-las em certeza.”

### 2:40–3:00 — valor e próximo passo

“Nosso público-alvo são pesquisadores e analistas que precisam interpretar padrões históricos com a origem e a incerteza dos dados à vista. Entregamos uma aplicação funcional e um método auditável. O próximo passo é ampliar o suporte e validar as análises sazonais, sem confundir uma visualização atraente com evidência científica.”

## 5. Versão curta em inglês, pronta para adaptar

“Different satellites do not observe fire in the same way. ChronoFlare helps researchers and environmental analysts explore historical fire activity while keeping sensor provenance, uncertainty and missing data visible.

We use real NASA FIRMS observations and the official IBGE Pantanal boundary. Our frozen v2 harmonization passed a registered independent test of 506 paired days across 40 eligible weeks. Weekly bias was approximately minus one percent, and weekly mean absolute error was about 35 percent lower than the matched uncalibrated benchmark.

The application shows native series, calibrated estimates, uncertainty intervals and the role of each date in the evidence. Publication requires complete Terra and Aqua inputs. Only six estimates are published in 2025 and five in 2026, and there is no independent backward test.

ChronoFlare is a working historical exploration prototype. It is not a fire forecast, a burned-area product or an emergency alert system. Our goal is to make comparisons useful without hiding what the data cannot support.”

## 6. Perguntas dos avaliadores — respostas para ensaiar

### “Vocês só colocaram dados da NASA em um mapa?”

“O mapa é contextual. O trabalho central é o processamento rastreável, a calibração entre plataformas, o teste fora do treino, a aprovação com escopo explícito e o calendário que preserva lacunas. O painel permite inspecionar essa evidência.”

### “O que significa FRP?”

“Fire Radiative Power, em MW: potência radiativa associada às detecções térmicas. Usamos sua soma como indicador de atividade. Não é energia total, área queimada ou contagem de incêndios. Não chamar de MWh, MW por dia ou área destruída.”

### “Como provaram que a harmonização funciona?”

“Comparamos previsões congeladas com S-NPP nos mesmos dias, usando critérios registrados antes do teste independente e dados não examinados antes da aquisição autorizada. A tabela apresenta o resultado e o benchmark. A aprovação vale para o modelo e o escopo registrados, não para qualquer região ou período.”

### “O que são os 35,3%?”

“Redução relativa do MAE semanal no mesmo conjunto pareado: 1 − 1.675,5097 / 2.588,9938. Não é uma precisão de 35%, ganho em todas as métricas, nem redução no número de incêndios.”

### “O benchmark tem correlação maior. Isso não é pior?”

“O benchmark tem Spearman 0,971, contra 0,965 do v2. Ele ordena as semanas ligeiramente melhor. A harmonização melhora magnitude e viés, cumpre o critério de correlação e reduz MAE. Não afirmamos superar o benchmark em tudo.”

### “O intervalo de 80% garante cobertura de 80%?”

“Não. É um intervalo empírico nominal, derivado do treino. A cobertura diária medida no teste foi 72,7%, dentro da faixa registrada de 70%–92%, mas próxima do piso. Não é a probabilidade de ocorrer um incêndio.”

### “Por que tão poucas datas em 2025–2026?”

“Publicamos apenas com ambas as plataformas completas e não preenchemos a falta de observações. Os dois anos têm pouco suporte, e não prometemos desempenho equivalente a 2020–2024. Melhorar suporte é trabalho futuro.”

### “Por que há 635 estimativas, mas o teste tem 506 dias?”

“São conjuntos distintos. A série publicada contém treino e outros períodos, com uma regra de disponibilidade mais restrita. O teste avalia a visão combinada registrada; publicação exige as duas plataformas completas. Não são 635 validações independentes.”

### “Isso detecta períodos incomuns, prevê fogo ou mede área queimada?”

“Hoje permite exploração histórica e comparação com proveniência. A aprovação da harmonização não aprova classificação automática de anomalias ou temporadas. Não fazemos previsão, confirmação de incêndios individuais ou estimativa de área queimada.”

### “A IA criou os dados ou aprovou a ciência?”

“As observações vêm das fontes citadas. Assistentes de IA ajudaram no código, testes, documentação e investigação. Há um modo sintético separado e identificado. Os resultados foram calculados por scripts versionados; a decisão científica é do André. Precisamos declarar também qualquer mídia ou voz gerada por IA na submissão.”

## 7. Números de apoio — não misturar os conjuntos

- Entradas disponíveis para o app: 4.318 datas solares adquiridas em 2012–2015 e 2017–2026. Não há dados adquiridos de 2016; isso não descreve uma série integral contínua.
- Série aprovada publicada: 635 estimativas; 55 marcadas como extrapoladas além da faixa de treino.
- Papéis nas 635 datas: 232 no período de treino, 161 previamente examinadas, 242 em datas do conjunto independente.
- Gráfico do app: 620 das 635 datas têm também referência S-NPP com ambos os turnos; 15 ficam indisponíveis para esse gráfico. Entre os pontos independentes publicados, há 229 pareados. Esses números não substituem os 506 dias da avaliação registrada.
- Teste independente: 506 dias pareados e 40 semanas elegíveis. Dias pareados em 2025 e 2026: 28 e 13, respectivamente.
- Critério semanal: média dos mesmos dias válidos pareados; ao menos cinco dias por semana ISO. MAE, viés e Spearman apresentados na tabela principal são semanais.
- rMAE semanal: 0,200; limite 0,45. Spearman: 0,965; mínimo 0,75. Viés: −1,0%; limite ±25%.
- Cobertura diária dos intervalos: 72,7%; largura relativa mediana: 1,74, para teto registrado 2,0. A cobertura do intervalo não é semanal.

O benchmark é a combinação ponderada das observações MODIS nativas sem calibração, conforme o protocolo. Não é uma soma ingênua de todas as detecções dos dois sensores e não é um segundo modelo de IA.

## 8. Fontes e créditos para o vídeo e a submissão

- NASA FIRMS: detecções e FRP de MODIS Terra/Aqua e VIIRS Suomi-NPP em Standard Processing. https://firms.modaps.eosdis.nasa.gov/
- IBGE, edição 2025, escala 1:250.000: limite oficial do bioma Pantanal. Não confundir com o arquivo de uso da terra de 2018 enviado anteriormente.
- MapBiomas, Coleção 11, ano 2020, 30 m, asset de cobertura v3: contexto opcional de uso e cobertura da terra. https://brasil.mapbiomas.org/
- NASA GIBS: imagem opcional de contexto MODIS Terra em cor verdadeira. https://nasa-gibs.github.io/gibs-api-docs/access-basics/
- OpenStreetMap contributors: mapa-base. https://www.openstreetmap.org/copyright
- IA: Codex, Cursor e Claude/Claude Code, conforme o inventário confirmado da equipe. Código assistido por IA não transforma observações reais em dados sintéticos. Declarar separadamente imagens, voz ou vídeo gerados por IA, se usados.

Créditos detalhados e metadados:
https://chronoflare.vercel.app/ai-disclosure.json
https://github.com/j-c-fstk-dev/chronoflare/blob/main/docs/ai-disclosure.md

As camadas de contexto não geram os focos, não comprovam cobertura do sensor e não são mapas de área queimada. O antigo polígono gerado com Gemini foi substituído; não é a geometria ativa do estudo.

Texto de créditos em inglês para adaptar:

“Data: NASA FIRMS MODIS Terra/Aqua and VIIRS Suomi-NPP Standard Processing; official IBGE 2025 Pantanal boundary. Optional geographic context: MapBiomas Collection 11 land cover for 2020, NASA GIBS imagery and OpenStreetMap contributors. AI assistants supported software, testing, documentation and research diagnostics. Original satellite observations were not generated by AI. See the repository disclosure for scope and limitations.”

Esse texto não dispensa registrar o uso efetivo de IA no material audiovisual. André confere o guia e os campos atuais da submissão; a duração e o formato deste roteiro não são exigências oficiais.

## 9. Antes de gravar e antes de enviar

1. Abrir os links deste guia no navegador que será usado e ensaiar as seis cenas. Usar um nível de zoom em que os números fiquem legíveis na gravação.
2. Confirmar “Harmonized · Terra + Aqua”, 2020 e a data correta; não gravar o modo “Synthetic demonstration” como se fossem dados reais.
3. Preparar as abas Calendar e Methodology antes da gravação. O resultado é estático e rastreável; não precisa mostrar espera artificial ou executar aquisição/calibração ao vivo.
4. Testar o filtro dos gráficos: os botões alternam grupos; não esconder que o treino não é validação. Não narrar o gráfico como série temporal contínua.
5. Gravar a tela e a voz com notificações ocultas. Não mostrar chaves, tokens, configurações privadas ou mensagens pessoais.
6. Guardar uma gravação curta de reserva e capturas das telas, identificadas como demonstração gravada, caso a rede falhe. Não fingir que uma gravação de reserva é uma execução ao vivo.
7. Manter uma versão estável durante a gravação. Testar o link público sem depender do login do autor; conferir também celular e Safari com a equipe.
8. Conferir áudio, legendas, fontes, declaração de IA, URL do app, URL do código e todos os campos obrigatórios do formulário. A entrega formal e o envio continuam com André.

Frases a evitar: “99% de precisão”, “635 dias de validação independente”, “dias sem fogo”, “alerta em tempo real”, “área queimada”, “histórico completo desde 2000”, “anomalias já validadas” e “treinado por IA da NASA”. Nenhuma delas descreve a entrega atual.

Se houver pouco tempo, preservar quatro cenas: problema; um dia com estimativa e referência; teste independente em Methodology; limitações e valor para o usuário. Um vídeo curto, claro e verificável é preferível a uma lista longa de funcionalidades.

## 10. Evidências para consultar se surgir uma dúvida técnica

- Aprovação e escopo: science/configs/harmonization_decision.json.
- Métricas do teste: docs/multiyear-evidence/v2-candidate/independent-summary-v2.json.
- Valores diários e papéis: docs/multiyear-evidence/harmonized-series/pantanal-harmonized-daily-v2.json.
- Exportação do app: app/public/data/observations/v1/manifest.json.
- Pares usados na visualização: app/public/data/harmonization-pairs.json.
- Método e histórico do v2: docs/harmonization-v2-candidate.md.

A frase aprovada pelo André continua sendo: “série harmonizada para o Pantanal, validada em teste independente de 2020–2026, com cobertura limitada em 2025–2026 e sem teste retroativo independente”. Não ampliar essa afirmação ao improvisar uma resposta.
