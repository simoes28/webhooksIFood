//Configuração inicial
const express = require("express");
const crypto = require("crypto");
const dotenv = require("dotenv");
const cors = require("cors");
const morgan = require("morgan");

//carregando variaveis ambiente
dotenv.config();

const app = express();

const clientSecret = process.env.IFOOD_API_CLIENTSECRET;

//middlewares validação de assinaturas
app.use("/webhook", (req, res, next) => {
  // 1. Recupere a assinatura recebida no header 'X-IFood-Signature'
  const signature = req.headers["x-ifood-signature"];

  if (!signature) {
    // Log de erro para depuração
    console.error("Assinatura não encontrada no cabeçalho");
    return res.status(400).json({ message: "Assinatura não encontrada" });
  }

  // 2. Recupere o corpo da requisição (payload) como string JSON
  const payload = JSON.stringify(req.body);

  // 3. Gerar a assinatura HMAC usando minha chave
  const generatedSignature = crypto
    .createHmac("sha256", clientSecret)
    .update(payload)
    .digest("hex"); //A assinatura será gerada em hexadecimal

  // 4. Comparar a assinatura gerada com a assinatura recebida
  if (generatedSignature === signature) {
    return next();
  }

  //Caso a assinatura não sejá reconhecida:
  console.error("Assinatura inválida");
  return res.status(403).json({ message: "Assinatura inválida" });
});

//Forma de ler JSON / middlewares
app.use(cors()); //Permite requisições de outras origens
app.use(morgan("dev")); //Log das requisições
app.use(express.json()); //PAra permitir o corpo das requisições em formato JSON
app.use(express.urlencoded({ extended: true })); //Para lidar com dados de formularios

//Rota inicial
app.post("/webhook", (req, res) => {
  console.log("Webhook recebido com sucesso!");
  res.status(202).send("Webhook processado com sucesso");
});

//configuração da porta, usando variavel de ambiente
const port = process.env.PORT || 3000;

app.listen(port, () => {
  console.log(`Servidor rodando na porta ${port}`);
});
