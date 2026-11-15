# André — avanço da base e do pipeline

Já implementamos o plano de aquisição, os downloads retomáveis, a auditoria de
amostra e o treinamento/validação com modelos congelados antes dos testes.
Tudo está separado da atualização visual da Anastasia.

Concluímos as 416 requisições do primeiro plano. A auditoria mostrou 162 dias e
17 semanas válidas no teste direto, e 106 dias e oito semanas no retroativo:
os mínimos de dias foram atingidos, mas os de semanas ainda não. Por isso,
nenhum modelo real foi ajustado ou avaliado nessa primeira amostra.

Registramos uma ampliação antes dos testes: completar todos os dias de
20/01/2012 a 31/12/2015 e adicionar janelas fixas de 2022–2024. A API reaproveita os
416 arquivos e consulta somente as 596 janelas adicionais. Não precisa baixar a
base inteira nem fornecer outra chave.

A resposta MODIS de 16–20/08/2021 revelou FRP negativo. Essas linhas ficam na
trilha de auditoria e são excluídas pelo filtro científico de FRP positivo; não
viram zero nem entram nas somas. A chave está funcionando.

Para transparência, registramos a implementação de interpolação, desempate e
limites do mapeamento quantílico. O benchmark ingênuo foi definido como MODIS
nativo, sem calibração, com os mesmos pesos convexos congelados e o mesmo
conjunto de dias da série calibrada. Essa definição fica explícita para sua
revisão; não escolhemos um benchmark depois de ver os erros do teste.
