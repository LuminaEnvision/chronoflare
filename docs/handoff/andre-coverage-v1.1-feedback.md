# Feedback para André — cobertura v1.1

**Atualização:** as dúvidas de fonte abaixo foram resolvidas na v1.2. Veja o
[feedback atual](andre-coverage-v1.2-feedback.md); este texto é histórico.

André, obrigado pela revisão! Ela esclareceu a referência solar fixa de −56,65°,
a regra de não gerar zero com cobertura parcial/indeterminada e que os números
anteriores eram ilustrativos. Já implementamos a conversão solar com testes dos
exemplos e da virada de dia. Vamos seguir a regra conservadora que você autorizou:
sem evidência de observação, o resultado fica nulo. Não precisa refazer esses pontos.

Na conferência das tabelas oficiais encontramos algumas diferenças. Quando puder,
ajuda a fechar estes itens:

1. **Reconciliar as janelas:** a tabela MODAPS de Terra indica o evento de outubro
   de 2022 até 23/10 às 22:35, enquanto a entrega termina em 21/10. Para Terra em
   2001 aparecem 15/06 às 04:00 até 03/07 às 09:15, e para Aqua em 2022 o início
   aparece em 31/03 às 16:00. São diferentes das horas entregues. Pode indicar qual
   janela vale para os produtos FIRMS usados e explicar se a diferença é entre
   interrupção do instrumento e recuperação do processamento? Não precisa adotar
   automaticamente a janela maior.
2. **Corrigir a linha de fevereiro:** no documento principal o início está como
   16/02/2002, mas nas respostas está 16/02/2022. Pode confirmar a linha completa e
   enviar uma referência oficial acessível desse evento? O link de interrupções
   do MCST retornou 404 na nossa consulta.
3. **Enviar o boletim específico do S-NPP:** precisamos do link oficial que
   sustenta o corte em 02/11/2026 e esclarecer se ele fala do satélite, de um
   produto ou apenas da disponibilidade de um catálogo. Até lá não aplicaremos
   um encerramento permanente.
4. **Consolidar o catálogo:** depois desses ajustes, entregar cada evento com
   plataforma/produto afetado, início e fim exatos em UTC, indicação se o fim é
   inclusivo e link oficial. Para outras linhas ainda sem evidência específica,
   incluir a referência também. Nós fazemos a conversão para dias solares e a
   integração no código; não precisa programar isso.

Fontes que usamos na comparação:

- Terra: https://modaps.modaps.eosdis.nasa.gov/services/production/outages_terra.html
- Aqua: https://modaps.modaps.eosdis.nasa.gov/services/production/outages_aqua.html

O limite oficial IBGE 2025 e o recorte regional já estão resolvidos por aqui.
Não precisa procurar outro polígono nem reproduzir os exemplos com o antigo
arquivo do Gemini. Seguimos avançando no mapa e na engenharia enquanto essas
referências são alinhadas, sem pressão para refazer a entrega inteira.
