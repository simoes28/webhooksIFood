//Configuração inicial
const express = require("express");
const crypto = require("crypto");
const dotenv = require("dotenv");
const cors = require("cors");
const morgan = require("morgan");
const axios = require("axios");
const { getInfoKeys, updateDataToFirestore } = require("./server/firebase");

dotenv.config();

const app = express();
let keysIfood;
//Forma de ler JSON / middlewares
app.use(cors()); //Permite requisições de outras origens
app.use(morgan("dev")); //Log das requisições
app.use(express.json()); //PAra permitir o corpo das requisições em formato JSON
app.use(express.urlencoded({ extended: true })); //Para lidar com dados de formularios

async function getAccessToken() {
  try {
    const data = new URLSearchParams();
    data.append("grantType", "client_credentials");
    data.append("clientId", keysIfood[0]?.clientId);
    data.append("clientSecret", keysIfood[0]?.clientSecret);

    console.log(data);

    //Realizando busca do token
    const response = await axios.post(
      "https://merchant-api.ifood.com.br/authentication/v1.0/oauth/token",
      data
    );
    if (!response) {
      console.error("Erro ao buscar o token de acesso. Nenhum retorno da api");
      return;
    }
    //resposta
    console.log(response?.data);
    const token = response?.data?.accessToken;

    //Salvando no banco de dados
    const accessTokenData = {
      accessToken: String(token),
    };
    const saveToken = await updateDataToFirestore(
      "accessToken",
      "D41XCuWy0HIGSInpeMnW",
      accessTokenData
    );
    if (saveToken) {
      console.log("Salvo token no banco");
    }

    //Garantindo que o token seja gerado novamente automaticamente 20 minutos antes de expirar
    const validacaoTempo = parseFloat(
      (response?.data?.expiresIn - 1200) * 1000
    );
    setInterval(() => {
      if (!keysIfood[0]?.clientId || !keysIfood[0]?.clientSecret) {
        fetchKeys();
      } else {
        getAccessToken();
      }
    }, validacaoTempo);
  } catch (error) {
    console.error(
      "Erro ao obter access token:",
      error.response ? error.response.data : error.message
    );
    throw new Error("Não foi possível obter o access token.");
  }
}

//Buscando credenciais api
const fetchKeys = async () => {
  try {
    keysIfood = await getInfoKeys("keysIfood");
    if (!keysIfood[0]?.clientId || !keysIfood[0]?.clientSecret) {
      throw new Error("Não foi possível obter clientId, clientSecret.");
    } else {
      getAccessToken();
    }
  } catch (error) {
    console.error(
      "Erro ao obter keys:",
      error.response ? error.response.data : error.message
    );
  }
};

fetchKeys();

//Rota de teste para inciar a operação
app.post("/", (req, res) => {
  res.status(200).send(`funcionando`);
  console.log("Iniciando");
});

//Validando assinatura IFood
app.use("/webhook", (req, res, next) => {
  // 1. Recupera a assinatura recebida no header 'X-IFood-Signature'
  const signature = req.headers["x-ifood-signature"];
  const apiClientSecret = keysIfood[0]?.clientSecret;

  if (!signature) {
    // Log de erro para depuração
    console.error("Assinatura não encontrada no cabeçalho");
    return res.status(400).json({ error: "Assinatura não encontrada" });
  }

  // 2. Recupere o corpo da requisição (payload) como string JSON
  const payload = JSON.stringify(req.body);
  // console.log(payload);

  if (!payload) {
    console.error("Corpo da requisição (payload) está vazio ou inválido");
    return res.status(400).json({ error: "Corpo da requisição inválido" });
  }

  // 3. Gerar a assinatura HMAC usando minha chave
  const generatedSignature = crypto
    .createHmac("sha256", apiClientSecret)
    .update(payload)
    .digest("hex"); //A assinatura será gerada em hexadecimal

  // 4. Comparar a assinatura gerada com a assinatura recebida
  if (generatedSignature === signature) {
    return next();
  }

  //Caso a assinatura não sejá reconhecida:
  console.error("Assinatura inválida");
  return res.status(403).json({ error: "Assinatura inválida" });
});

//Rota inicial para webhooks
app.post("/webhook", (req, res) => {
  console.log("Webhook recebido com sucesso!");
  console.log(req?.body);
  res.status(202).send("Webhook processado com sucesso");
});

//configuração da porta, usando variavel de ambiente
const port = process.env.PORT || 8004;

app.listen(port, () => {
  console.log(`Servidor rodando na porta ${port}`);
});
