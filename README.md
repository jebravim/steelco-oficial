# Steel & Co. — calculadora de orçamento

Aplicação para estimar o valor de uma construção em steel frame a partir da área construída e do preço por metro quadrado definido pela equipe.

O projeto também funciona como PWA: pode ser instalado no computador ou celular, abre em janela própria e mantém os arquivos essenciais disponíveis offline. A área do funcionário usa Neon Auth; o preço oficial é persistido no Lakebase Postgres e compartilhado entre todos os dispositivos.

## Executar localmente

Sirva a pasta `dist` com um servidor HTTP local. Por exemplo:

```powershell
python -m http.server 4173 --directory dist
```

Depois, acesse `http://localhost:4173`.

## Publicação na Vercel

O arquivo `vercel.json` configura `dist` como diretório de saída, sem etapa de build.

```powershell
vercel --prod
```

## Área do funcionário e persistência

O navegador carrega o preço público pela API `/api/price`. Somente uma sessão válida do Neon Auth cujo e-mail esteja ativo em `public.employee_access` pode atualizar esse valor. O registro oficial fica em `public.pricing_settings`; o `localStorage` é usado apenas como cache offline de leitura.

As variáveis de ambiente necessárias na Vercel são:

- `DATABASE_URL`: conexão Postgres agrupada do projeto Steel & Co. Oficial.
- `NEON_AUTH_BASE_URL`: URL do Auth da branch de produção.
- `NEON_AUTH_JWKS_URL`: endpoint JWKS usado pela API para verificar os tokens.
