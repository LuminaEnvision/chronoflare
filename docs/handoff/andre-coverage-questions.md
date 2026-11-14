# Dúvidas para o André — entrega de cobertura

André, revisamos a entrega 2 e ficaram algumas dúvidas para implementar a regra sem interpretar nada errado. Quando puder, ajuda a esclarecer estes pontos:

1. **Fontes das interrupções:** pode enviar os links oficiais de cada evento? Precisamos confirmar quando começou e terminou, o fuso e se os dias indicados entram inteiros na interrupção.

2. **S-NPP em 02/11/2026:** essa data representa encerramento do produto/satélite ou apenas o último dia disponível naquele catálogo? A captura, sozinha, não permite distinguir.

3. **Evidência de observação:** como determinamos que cada plataforma e turno observou o Pantanal quando não há detecções dentro dele? Detecções em outra parte da América do Sul não garantem essa passagem. Sem evidência suficiente, podemos manter a cobertura desconhecida, sem gerar zero?

4. **Dia solar local:** qual regra devemos usar para converter o horário UTC? A longitude de cada detecção ou uma referência fixa da região? Um exemplo próximo da meia-noite ajudaria a testar.

5. **Zero com cobertura parcial:** em quais combinações exatas de plataforma e turno ele é permitido? Hoje nosso contrato aceita zero apenas com cobertura `ok`; precisamos alinhar essa diferença antes de alterar.

6. **Valores dos exemplos:** os números apresentados são ilustrativos ou foram calculados com dados reais? Se foram calculados, pode enviar os arquivos e o procedimento para reproduzi-los?

A parte técnica dos exemplos, como colocar o dia seguinte em `period_end`, resolvemos aqui. Também já encontramos o limite oficial do IBGE 2025 e estamos preparando o recorte; não precisa procurar outro polígono. Recebemos os links do MapBiomas e do MMA e registramos seus papéis como referências de uso da terra e monitoramento histórico. Enquanto alinhamos a cobertura, seguimos com a visualização das detecções sem inferir zeros. Obrigado pelas entregas!
