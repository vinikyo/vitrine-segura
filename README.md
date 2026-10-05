# Vitrine
Projeto acadêmico de comércio eletrônico. Frontend React/Vinext, backend em Cloudflare Workers e persistência SQLite/D1. Login gerenciado pela plataforma ChatGPT.

## Fluxo de demonstração
1. Entrar com ChatGPT.
2. Minha conta: preencher nome, CPF com 11 dígitos, telefone, CEP e endereço **fictícios**; selecionar cartão teste.
3. Explorar: buscar e filtrar, consultar produtos e adicionar à sacola.
4. Confirmar compra simulada e consultar Meus pedidos.
5. Minha loja: criar, listar, editar e retirar produtos; comprar um produto próprio permite demonstrar a entrega, avançando seus estados em Minha loja.
6. Excluir o perfil em Minha conta.

## Segurança
- A identidade é recebida do gateway confiável da hospedagem, nunca de um ID enviado pelo cliente. Não expor o Worker diretamente sem o gateway.
- APIs exigem identidade e verificam propriedade nas alterações de produtos, perfil e pedidos.
- AES-256-GCM com IV aleatório e identidade como additional authenticated data. DATA_KEY: chave hexadecimal de 32 bytes, configurada apenas como segredo no runtime. Rotação requer recriptografar os registros antes de substituir a chave.
- Dados pessoais não são gravados no navegador nem em logs. Pedidos preservam snapshot de entrega criptografado.
- Zod com listas permitidas e limites de tamanho. React escapa texto; sem HTML de usuários.
- SQL parametrizado; confirmação recalcula preços e entrega no backend; nonce de idempotência. D1 batch transacional garante compra e baixa de estoque juntos.
- Origin e cabeçalho obrigatório nas mutações mitigam CSRF. Respostas da API usam no-store e nosniff.
- Limite de 40 mutações por identidade/minuto persistido no D1. Autenticação e suas sessões ficam sob responsabilidade da plataforma.
- Sem coleta de PAN ou CVV. Cartões são apenas duas opções fictícias. Sem gateway de pagamentos nem transações monetárias reais.

## Limites explícitos
Loja privada, adequada à demonstração. Não certificada OWASP/PCI/LGPD. CPF valida o formato para permitir dados fictícios; não faz verificação de identidade. Estoque dos produtos embutidos é ilustrativo; estoque de vendedores é transacional. Produtos de demonstração não possuem vendedor operacional e permanecem Confirmados. Entregas são atualizadas por seus vendedores, sem transportadora real. Frete fixo de R$19,90 por linha de produto. Excluir perfil não elimina snapshots de pedidos; um serviço comercial requer política de retenção, exercício de direitos, backups, recuperação de desastre, monitoramento, testes de penetração e integração de pagamento tokenizado. Rate-limit buckets precisam de política periódica de limpeza em escala.

## Executar e validar
Instalar dependências com o helper de Sites; `npm run db:generate` gera migrations; build pelo helper de Sites. Banco e segredos são provisionados pela hospedagem. Sem DATA_KEY a API falha fechada.

Referências: https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html e https://cheatsheetseries.owasp.org/cheatsheets/Transaction_Authorization_Cheat_Sheet.html
