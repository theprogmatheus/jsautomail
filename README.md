# JSAutoMail

**Automação para envio automático de certificados de participação por e-mail**

Repositório: [https://github.com/theprogmatheus/jsautomail](https://github.com/theprogmatheus/jsautomail)

---

## Visão Geral

O **JSAutoMail** é um sistema automatizado que:
1. Lê uma planilha pública do Google Sheets contendo os dados dos participantes.
2. Gera certificados personalizados em PDF a partir de um template HTML.
3. Envia os certificados automaticamente por e-mail.
4. Registra os e-mails já enviados para evitar duplicidade.
5. Pode ser agendado para execução automática via `crontab`.

Ideal para eventos, webinars, workshops e cursos com emissão recorrente de certificados.

---

## Requisitos

### Ambiente

- **Node.js** versão 18 ou superior  
- **npm** (instalado junto com o Node)
- Sistema operacional Linux ou Windows com suporte ao Node.js

Verifique as versões instaladas:
```bash
node -v
npm -v
````

---

## Instalação e Configuração

### 1. Clonar o repositório

```bash
git clone https://github.com/theprogmatheus/jsautomail.git
cd jsautomail
```

### 2. Instalar dependências

```bash
npm install
```

### 3. Criar o arquivo `.env`

Crie um arquivo `.env` na raiz do projeto com o seguinte conteúdo:

```bash
JSAUTOMAIL_EMAIL=seuemail@gmail.com
JSAUTOMAIL_PASSWORD=sua_senha_ou_app_password
JSAUTOMAIL_USERNAME=Seu Nome ou Organização
JSAUTOMAIL_PLANILHA=ID_DA_PLANILHA_GOOGLE
```

#### Como obter o `JSAUTOMAIL_PLANILHA`:

* Abra sua planilha no Google Sheets.
* Copie o trecho entre `/d/` e `/edit` da URL.
  Exemplo:
  `https://docs.google.com/spreadsheets/d/1aBcD123XYZ456EfGhI7890/edit#gid=0`
  O ID da planilha é `1aBcD123XYZ456EfGhI7890`.

---

## Estrutura de Pastas

```
jsautomail/
├── templates/
│   └── certificate.html        # Template do certificado
├── pdfs/                       # PDFs gerados serão salvos aqui
├── logs/                       # Logs do cron serão gravados aqui
├── sent_emails.txt             # Registro de e-mails já enviados
├── index.js                    # Script principal
├── package.json
└── .env
```

---

## Execução Manual

Antes de configurar o agendamento, teste manualmente:

```bash
node index.js
```

Se tudo estiver configurado corretamente, o processo irá:

* Validar o ambiente
* Ler a planilha
* Gerar certificados
* Enviar por e-mail
* Registrar envios no arquivo `sent_emails.txt`

---

## Configuração do Crontab

### 1. Criar a pasta de logs

```bash
mkdir -p /caminho/para/jsautomail/logs
```

### 2. Editar o crontab

Abra o editor do cron:

```bash
crontab -e
```

### 3. Adicionar a tarefa agendada

#### Executar a cada 10 minutos:

```bash
*/10 * * * * cd /caminho/para/jsautomail && /usr/bin/node index.js >> logs/$(date +\%Y-\%m-\%d).log 2>&1
```

#### Explicação:

| Trecho                        | Função                                                  |
| :---------------------------- | :------------------------------------------------------ |
| `*/10 * * * *`                | Executa a cada 10 minutos                               |
| `cd /caminho/para/jsautomail` | Entra no diretório do projeto                           |
| `/usr/bin/node index.js`      | Executa o script principal                              |
| `>> logs/...`                 | Salva logs de execução diária                           |
| `2>&1`                        | Redireciona também os erros para o mesmo arquivo de log |

### 4. Confirmar o agendamento

```bash
crontab -l
```

---

## Dicas de Produção

* Sempre use **caminhos absolutos** no cron.
* Verifique o caminho correto do Node:

  ```bash
  which node
  ```
* O arquivo `.env` deve estar na raiz do projeto.
* A pasta `logs/` deve existir antes do primeiro agendamento.
* Para forçar execução manual, basta rodar novamente:

  ```bash
  node index.js
  ```

---

## Licença

Este projeto é distribuído sob a licença MIT.
Sinta-se livre para utilizar e modificar conforme suas necessidades.

```
