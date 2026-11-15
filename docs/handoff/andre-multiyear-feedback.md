# André — avanço da base e do pipeline

Já implementamos o plano de aquisição, os downloads retomáveis, a auditoria de
amostra e o treinamento/validação com modelos congelados antes dos testes.
Tudo está separado da atualização visual da Anastasia.

Conseguimos 211 requisições e oito blocos completos nas estações seca e úmida de
2017–2020. Identificamos FRP negativo em uma resposta MODIS de 16–20/08/2021:
essas linhas ficam preservadas na auditoria e são rejeitadas pelo critério de
FRP positivo, sem virar zero nem entrar nos indicadores. A chave está funcionando;
a aquisição foi retomada com esse tratamento.

Ainda não precisa baixar a base inteira. O pipeline vai medir a amostra real e
só executar o ajuste e os testes finais quando os mínimos registrados forem
cumpridos. Se houver impedimento na API ou necessidade de ampliar o recorte,
passamos o pedido exato, sem pedir download desnecessário.

Para transparência, registramos a implementação de interpolação, desempate e
limites do mapeamento quantílico. O benchmark ingênuo foi definido como MODIS
nativo, sem calibração, com os mesmos pesos convexos congelados e o mesmo
conjunto de dias da série calibrada. Essa definição fica explícita para sua
revisão; não escolhemos um benchmark depois de ver os erros do teste.
