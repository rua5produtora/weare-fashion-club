# Weare Fashion Club

Site estático do clube, publicado pelo GitHub Pages. Os arquivos públicos estão em `dist/`.

## Journal e painel

O Journal usa Supabase para autenticação, publicações e fotos. O painel fica em `/admin/` e aceita somente `rua5produtora@gmail.com`. O login envia um link de acesso por e-mail. As regras de acesso estão em `supabase/schema.sql`; nunca adicione uma chave secreta ao site.

Crie `.env.local` a partir de `.env.example` para desenvolver localmente. Rode `node scripts/build-site.mjs` para gerar `dist/js/config.js` e as páginas individuais de conteúdos publicados. O GitHub Actions recebe `SUPABASE_URL` e `SUPABASE_PUBLISHABLE_KEY` como variáveis do repositório e refaz as páginas individuais periodicamente. A home e os índices consultam o banco diretamente, portanto aparecem assim que um conteúdo é publicado.

Para testar localmente, sirva a pasta `dist` como raiz de um servidor estático. Não abra o HTML pelo explorador de arquivos, pois os módulos JavaScript dependem de HTTP.

