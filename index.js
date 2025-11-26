import 'dotenv/config';

import fetch from "node-fetch";
import puppeteer from "puppeteer";
import csv from "csv-parser";
import nodemailer from "nodemailer";
import fs from "fs";
import path from "path";

// 🆕 CONSTANTE PARA O ARQUIVO DE REGISTRO
const SENT_EMAILS_FILE = path.resolve("./sent_emails.txt");

/**
 * 🆕 Carrega a lista de e-mails que já receberam o certificado.
 * @returns {Set<string>} Um Set de e-mails enviados (em lowercase).
 */
function loadSentEmails() {
    if (!fs.existsSync(SENT_EMAILS_FILE)) {
        // Se o arquivo não existir, retorna um set vazio
        return new Set();
    }
    const data = fs.readFileSync(SENT_EMAILS_FILE, 'utf-8');
    // Filtra linhas vazias e cria um Set para busca rápida e case-insensitive
    const emails = data.split('\n').filter(email => email.trim() !== '');
    return new Set(emails.map(email => email.trim().toLowerCase()));
}

/**
 * 🆕 Adiciona um e-mail à lista de e-mails enviados (e salva no disco).
 * @param {string} email O e-mail a ser registrado.
 */
function addSentEmail(email) {
    // Adiciona o e-mail no final do arquivo, seguido de uma nova linha
    fs.appendFileSync(SENT_EMAILS_FILE, `${email.toLowerCase().trim()}\n`);
}

async function verificarRequisitos() {
    console.log("\n🧾=====================================");
    console.log("🔍 VERIFICAÇÃO DE REQUISITOS DO SISTEMA");
    console.log("=====================================\n");

    let tudoCerto = true;

    // 1️⃣ Variáveis de ambiente obrigatórias
    const envVars = [
        "JSAUTOMAIL_EMAIL",
        "JSAUTOMAIL_PASSWORD",
        "JSAUTOMAIL_USERNAME",
        "JSAUTOMAIL_PLANILHA"
    ];

    console.log("🌱 Verificando variáveis de ambiente...");
    for (const variable of envVars) {
        if (!process.env[variable] || process.env[variable].trim() === "") {
            console.error(`   ❌ Faltando: ${variable}`);
            tudoCerto = false;
        } else {
            console.log(`   ✅ ${variable} = OK`);
        }
    }
    console.log("");

    // 2️⃣ Pastas obrigatórias
    const paths = {
        templates: path.resolve("./templates"),
        pdfs: path.resolve("./pdfs")
    };

    console.log("📁 Verificando estrutura de pastas...");
    if (!fs.existsSync(paths.templates)) {
        console.error(`   ❌ Pasta não encontrada: ${paths.templates}`);
        tudoCerto = false;
    } else {
        console.log(`   ✅ Templates encontrados`);
    }

    if (!fs.existsSync(paths.pdfs)) {
        fs.mkdirSync(paths.pdfs, { recursive: true });
        console.log(`   📂 Pasta 'pdfs' criada automaticamente`);
    } else {
        console.log(`   ✅ Pasta 'pdfs' encontrada`);
    }
    console.log("");


    // 4️⃣ Testar acesso à Internet (pra evitar travar o Puppeteer)
    console.log("🌍 Testando conexão com a Internet...");
    try {
        const response = await fetch("https://www.google.com", { method: "HEAD" });
        if (response.ok) {
            console.log("   ✅ Conexão com a Internet OK");
        } else {
            console.error("   ⚠️ Internet parece instável");
        }
    } catch {
        console.error("   ❌ Sem conexão com a Internet");
        tudoCerto = false;
    }
    console.log("");

    // 3️⃣ Testar acesso à planilha (ver se a URL CSV responde)
    const planilhaUrl = `https://docs.google.com/spreadsheets/d/${process.env.JSAUTOMAIL_PLANILHA}/gviz/tq?tqx=out:csv`;
    console.log("🌐 Testando conexão com a planilha...");

    try {
        const response = await fetch(planilhaUrl, { method: "HEAD" });
        if (response.ok) {
            console.log("   ✅ Planilha acessível");
        } else {
            console.error(`   ❌ Não foi possível acessar a planilha (HTTP ${response.status})`);
            tudoCerto = false;
        }
    } catch (err) {
        console.error(`   ❌ Erro de conexão com a planilha: ${err.message}`);
        tudoCerto = false;
    }
    console.log("");

    // ✅ Resultado final
    if (!tudoCerto) {
        console.error("🚫 Falha na verificação de requisitos. Corrija os itens acima e tente novamente.\n");
        process.exit(1);
    }

    console.log("🎯 Todos os requisitos foram verificados com sucesso!");
    console.log("=====================================\n");
}


async function main() {
    console.log("🚀 Iniciando processo de emissão de certificados...\n");

    await verificarRequisitos();

    const sentEmails = loadSentEmails();
    console.log(`✉️ ${sentEmails.size} e-mails encontrados na lista de envios anteriores.`);

    console.log("🧩 Carregando módulos e preparando ambiente...\n");

    const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
    const page = await browser.newPage();

    async function gerarPDF(templateName, participant) {
        console.log(`📄 Gerando certificado para: ${participant.name}`);

        const filePath = path.resolve(`./templates/${templateName}`);
        await page.goto(`file://${filePath}`, { waitUntil: 'networkidle0' });

        const html = fs.readFileSync(filePath, { encoding: 'utf-8' })
            .replace('{{participant.name}}', participant.name);

        await page.setContent(html);

        const pdfPath = path.resolve(`./pdfs/${participant.name} - (${participant.email}).pdf`);
        await page.pdf({
            path: pdfPath,
            format: 'A4',
            landscape: true,
            printBackground: true,
            preferCSSPageSize: true,
            scale: 0.7,
        });

        console.log(`✅ Certificado salvo em: ${pdfPath}\n`);
        return pdfPath;
    }

    async function lerCSV() {
        console.log("📥 Lendo arquivo CSV...");
        const results = [];

        const url = `https://docs.google.com/spreadsheets/d/${process.env.JSAUTOMAIL_PLANILHA}/gviz/tq?tqx=out:csv`;
        const response = await fetch(url);
        if (!response.ok)
            throw new Error("Erro ao consultar a planilha.");

        return new Promise((resolve, reject) => {
            response.body
                .pipe(csv({
                    separator: ",",
                    mapHeaders: ({ header }) => header.trim().replace(/^"|"$/g, ""),
                }))
                .on("data", (row) => {
                    results.push({
                        code: row["Código de Presença"],
                        name: row["Nome Completo"],
                        registration: row["Matrícula"],
                        email: row["Endereço de e-mail"],
                    });
                })
                .on("end", () => {
                    console.log(`✅ CSV carregado com ${results.length} participantes.`);
                    const newParticipants = results.filter(p => p.email && !sentEmails.has(p.email.toLowerCase().trim()));
                    console.log(`➡️  ${newParticipants.length} participantes prontos para receber o certificado (novos envios).`);
                    resolve(newParticipants);
                })
                .on("error", (err) => {
                    console.error("❌ Erro ao ler CSV:", err.message);
                    reject(err);
                });
        });

    }

    async function gerarCertificados(participants) {
        if (participants.length === 0) return [];

        console.log(`🏗️ Gerando certificados (${participants.length})...\n`);
        const certificates = [];

        for (const participant of participants) {
            try {
                const pdfPath = await gerarPDF("certificate.html", participant);
                certificates.push({
                    participant,
                    certificate: pdfPath
                });
            } catch (err) {
                console.error(`❌ Erro ao gerar certificado para ${participant.name}: ${err.message}`);
            }
        }

        console.log(`🎉 Todos os certificados foram gerados com sucesso!\n`);
        return certificates;
    }

    async function enviarCertificadosPorEmail(certificados) {
        if (certificados.length === 0) {
            console.log("\n😴 Nenhuma certificado novo para enviar. Pulando envio por e-mail.\n");
            return;
        }

        console.log("📤 Iniciando envio dos certificados por e-mail...\n");

        const transporter = nodemailer.createTransport({
            service: "gmail",
            auth: {
                user: process.env.JSAUTOMAIL_EMAIL,
                pass: process.env.JSAUTOMAIL_PASSWORD,
            },
        });

        for (const { participant, certificate } of certificados) {
            const mailOptions = {
                from: `"${process.env.JSAUTOMAIL_USERNAME}" <${process.env.JSAUTOMAIL_EMAIL}>`,
                to: participant.email,
                subject: "Certificado de Participação - Webinar: Planejamento de Carreira em TI",
                text: `Olá ${participant.name},\n\nSegue seu certificado de participação em anexo.\n\nAbraço!`,
                attachments: [
                    {
                        filename: path.basename(certificate),
                        path: certificate,
                    },
                ],
            };
            try {
                await transporter.sendMail(mailOptions);
                console.log(`✅ E-mail enviado para ${participant.email}`);
                addSentEmail(participant.email);
                await new Promise(res => setTimeout(res, 1000));
            } catch (err) {
                console.error(`❌ Erro ao enviar e-mail para ${participant.email}: ${err.message}`);
            }
        }

        console.log("\n📬 Todos os e-mails foram processados!\n");
    }

    try {
        const participants = await lerCSV();
        const certificados = await gerarCertificados(participants);
        await enviarCertificadosPorEmail(certificados);
    } catch (err) {
        console.error(`💥 Erro inesperado: ${err.message}`);
    }

    await browser.close();
    console.log("🏁 Processo finalizado com sucesso!\n");
}

main();
