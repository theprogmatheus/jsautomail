import 'dotenv/config';

import puppeteer from "puppeteer";
import csv from "csv-parser";
import nodemailer from "nodemailer";
import fs from "fs";
import path from "path";

async function verificarRequisitos() {
    console.log("\n🔍 Verificando requisitos do sistema...\n");

    let tudoCerto = true;

    // Verifica variáveis de ambiente obrigatórias
    const envVars = ["JSAUTOMAIL_EMAIL", "JSAUTOMAIL_PASSWORD", "JSAUTOMAIL_USERNAME"];
    for (const variable of envVars) {
        if (!process.env[variable]) {
            console.error(`❌ Variável de ambiente faltando: ${variable}`);
            tudoCerto = false;
        } else {
            console.log(`✅ ${variable} configurada`);
        }
    }

    // Verifica se o arquivo CSV existe
    const csvPath = path.resolve("./data.csv");
    if (!fs.existsSync(csvPath)) {
        console.error(`❌ Arquivo CSV não encontrado: ${csvPath}`);
        tudoCerto = false;
    } else {
        console.log(`✅ Arquivo CSV encontrado: ${csvPath}`);
    }

    // Verifica se a pasta templates existe
    const templatePath = path.resolve("./templates");
    if (!fs.existsSync(templatePath)) {
        console.error(`❌ Pasta de templates não encontrada: ${templatePath}`);
        tudoCerto = false;
    } else {
        console.log(`✅ Pasta de templates encontrada`);
    }

    // Cria a pasta de PDFs se não existir
    const pdfDir = path.resolve("./pdfs");
    if (!fs.existsSync(pdfDir)) {
        fs.mkdirSync(pdfDir, { recursive: true });
        console.log(`📂 Pasta 'pdfs' criada automaticamente`);
    } else {
        console.log(`✅ Pasta 'pdfs' encontrada`);
    }

    console.log("");

    if (!tudoCerto) {
        console.error("🚫 Erros encontrados. Corrija os itens acima antes de continuar.\n");
        process.exit(1);
    } else {
        console.log("🎯 Todos os requisitos foram verificados com sucesso!\n");
    }
}

async function main() {
    console.log("🚀 Iniciando processo de emissão de certificados...\n");

    await verificarRequisitos();

    console.log("🧩 Carregando módulos e preparando ambiente...\n");

    const browser = await puppeteer.launch();
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
            scale: 0.8,
        });

        console.log(`✅ Certificado salvo em: ${pdfPath}\n`);
        return pdfPath;
    }

    async function lerCSV() {
        console.log("📥 Lendo arquivo CSV...");
        const results = [];

        return new Promise((resolve, reject) => {
            fs.createReadStream("./data.csv")
                .pipe(csv({
                    separator: ",",
                    mapHeaders: ({ header }) => header.trim().replace(/^"|"$/g, ""),
                }))
                .on("data", (row) => {
                    results.push({
                        code: row["Código de Presença"],
                        name: row["Nome Completo"],
                        registration: row["Matrícula"],
                        email: row["Nome de usuário"],
                    });
                })
                .on("end", () => {
                    console.log(`✅ CSV lido com sucesso! ${results.length} registros encontrados.\n`);
                    resolve(results);
                })
                .on("error", (err) => {
                    console.error(`❌ Erro ao ler o CSV: ${err.message}`);
                    reject(err);
                });
        });
    }

    async function gerarCertificados(participants) {
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
