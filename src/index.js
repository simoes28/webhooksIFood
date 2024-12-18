//Configuração inicial
const express = require("express");
const crypto = require("crypto");
const dotenv = require("dotenv");
const cors = require("cors");
const morgan = require("morgan");
const axios = require("axios");
const { getInfoKeys, updateDataToFirestore } = require("./server/firebase");
const {
  buscarDadosCondicao,
  buscarDados,
  adicionarDados,
  atualizarDados,
} = require("./server/operacoesMysql");

//Carregando variaveis de ambiente
dotenv.config();

const app = express();
let tokenApiIfood; //TOKEN da API do IFood
let keysIfood; // Busca do clientId e clientSecret da minha aplicação IFOOD
let cad_integracoesFlyp; //Armazena os dados de todas as integrações dentro do FLYP
let cad_empresasFlyp; //Armazena os dados de cada cliente dentro do flyp
let dados_pedidosFlyp; //Armazena todos os dados dos pedidos que estão registradas no flyp

//Forma de ler JSON / middlewares
app.use(cors()); //Permite requisições de outras origens
app.use(morgan("dev")); //Log das requisições
app.use(express.json()); //PAra permitir o corpo das requisições em formato JSON
app.use(express.urlencoded({ extended: true })); //Para lidar com dados de formularios

//Função para buscar o token IFood
async function getAccessToken() {
  try {
    const data = new URLSearchParams();
    data.append("grantType", "client_credentials");
    data.append("clientId", keysIfood[0]?.clientId);
    data.append("clientSecret", keysIfood[0]?.clientSecret);

    //Realizando busca do token
    const response = await axios.post(
      "https://merchant-api.ifood.com.br/authentication/v1.0/oauth/token",
      data
    );
    if (!response) {
      console.error("Erro ao buscar o token de acesso. Nenhum retorno da api");
      return;
    }
    tokenApiIfood = response?.data?.accessToken;
    console.log(response?.data?.accessToken);

    //Salvando TOKEN IFOOD no banco de dados FIREBASE
    const accessTokenData = {
      accessToken: String(tokenApiIfood),
    };
    const saveToken = await updateDataToFirestore(
      "accessToken",
      "D41XCuWy0HIGSInpeMnW",
      accessTokenData
    );

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

// função para buscar credenciais da minha aplicação IFood
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

//Função chamada para atualizar os dados quando uma nova integração for registrada no FLYP
const atualizarIntegracoes = async () => {
  try {
    cad_integracoesFlyp = await buscarDados("cad_integracao");
    cad_empresasFlyp = await buscarDados("cad_empresa");
  } catch (error) {
    console.error(
      `Erro ao atualizar lista de empresas: ${error}`,
      error.response ? error.response.data : error.message
    );
  }
};

//Função chamada para atualizar os dados de todos os pedidos
const atualizarDadosPedidosFlyp = async () => {
  try {
    dados_pedidosFlyp = await buscarDados("int_ifood");
  } catch (error) {
    console.error(
      `Erro ao atualizar lista de pedidos: ${error}`,
      error.response ? error.response.data : error.message
    );
  }
};

//Função para abertura de um novo pedido
const aberturaNovoPedido = async (data, tokenClienteFlyp) => {
  const dataAbrirChamado = {
    forma_pagamento: data?.fmr_pagamento,
    empresa_id: 0,
    retorno: data?.corridaComRetorno ? true : false,
    // data: "any",
    // hora: "any",
    paradas: [
      {
        nome_cliente_parada: data?.nome_cliente_parada,
        telefone_cliente_parada: data?.telefone_cliente_parada,
        endereco_parada: /*data?.endereco_parada*/ "Rua AK, 60",
        bairro_parada: /*data?.bairro_parada*/ "Delfino Magalhães",
        cidade_parada: /*data?.cidade_parada*/ "Montes Claros",
        estado_parada: /*data?.estado_parada*/ "MG",
        // lat_parada: data?.lat_parada,
        // lng_parada: data?.lng_parada,
        // codigo_confirmacao: data?.codigo_confirmacao,
      },
    ],
  };
  try {
    const responseNovoPedido = await axios.post(
      `https://integracao.flyp.com.br/abrir_entrega`,
      dataAbrirChamado,
      {
        headers: {
          Authorization: `Bearer ${tokenClienteFlyp}`, // Cabeçalho com o Bearer token
        },
      }
    );
    return responseNovoPedido;
  } catch (error) {
    console.error(
      `Erro ao realizar pedido: ${error}`,
      error.response ? error.response.data : error.message
    );
  }
};

//Função para salvar novo pedido no banco do flyp
const salvarNovoPedidoFlyp = async (dadosSalvarPedidoFlyp) => {
  try {
    const responseSalvarDadosPedidoFlyp = await adicionarDados(
      "int_ifood",
      dadosSalvarPedidoFlyp
    );
    return responseSalvarDadosPedidoFlyp;
  } catch (error) {
    console.error(
      `Erro ao salvar pedido no flyp: ${error}`,
      error.response ? error.response.data : error.message
    );
  }
};

//Função para realizar o cancelamento do pedido
const cancelamentoPedido = async (filtrarPedidoCancelamento, tokenClienteFlyp) => {
  const statusPedidoFlyp = filtrarPedidoCancelamento?.status;
  const idPedidoFlyp = filtrarPedidoCancelamento?.id_mch;
  if (
    statusPedidoFlyp === "E" ||
    statusPedidoFlyp === "F" ||
    statusPedidoFlyp === "N" ||
    statusPedidoFlyp === "C"
  ) {
    console.error(
      `Não é possível realizar o cancelamento da OS (${idPedidoFlyp}), devido seu status está em (${statusPedidoFlyp})`
    );
  } else {
    const responseCancelamentoPedido = await axios.post(
      `https://integracao.flyp.com.br/cancelar_entrega`,
      {
        id_mch: idPedidoFlyp,
      },
      {
        headers: {
          Authorization: `Bearer ${tokenClienteFlyp}`,
        },
      }
    );
    if (responseCancelamentoPedido?.data?.success === true) {
      const dadosAtualizarStatus = {
        status: "C",
      };
      const condicaoAtualizarStatus = {
        id_mch: idPedidoFlyp,
      };
      const responseAtualizarStatus = await atualizarDados(
        "int_ifood",
        dadosAtualizarStatus,
        condicaoAtualizarStatus
      );
      console.log(responseAtualizarStatus);
    }
  }
};

//Função que irá direcionar cada webhook para sua ação especifica
async function acoesWebhooks(data) {
  const direcionamentoCode = data?.code;
  const direcionamentoFullCode = data?.fullCode;
  const idClientIFood = data?.merchantId;
  const idPedido = data?.orderId;

  //Formantando data da criação para envio
  const dataCriacaoPedido = data?.createdAt;
  const dataCriacaoPedidoFormatado = new Date(dataCriacaoPedido);
  const ano = dataCriacaoPedidoFormatado?.getFullYear();
  const mes = String(dataCriacaoPedidoFormatado?.getMonth() + 1)?.padStart(
    2,
    "0"
  );
  const dia = String(dataCriacaoPedidoFormatado?.getDate())?.padStart(2, "0");
  const hora = String(dataCriacaoPedidoFormatado?.getHours())?.padStart(2, "0");
  const minuto = String(dataCriacaoPedidoFormatado?.getMinutes())?.padStart(
    2,
    "0"
  );
  const segundo = String(dataCriacaoPedidoFormatado?.getSeconds())?.padStart(
    2,
    "0"
  );

  const empresaFiltro = await cad_integracoesFlyp?.find(
    (data) => data?.int_token === idClientIFood && data?.integracao === "ifood"
  );
  const fmr_pagamento = empresaFiltro?.tipo;
  const empresa_id = empresaFiltro?.cli_id;
  const integracao_id = empresaFiltro?.id;
  const detalhesEmpresa = await cad_empresasFlyp?.find(
    (data) => data?.id_machine === empresa_id
  );
  const responseTokenFlyp = await axios.post(
    `https://integracao.flyp.com.br/token`,
    {
      api_key: detalhesEmpresa?.api_key,
    }
  );
  const tokenClienteFlyp = String(responseTokenFlyp?.data?.token);
  try {
    if (
      direcionamentoCode === "CFM" &&
      direcionamentoFullCode === "CONFIRMED"
    ) {
      //Rota para confirmação do pedido
      const responsePedido = await axios.get(
        `https://merchant-api.ifood.com.br/order/v1.0/orders/${idPedido}`,
        {
          params: {
            id: idPedido,
          },
          headers: {
            Authorization: `Bearer ${tokenApiIfood}`,
          },
        }
      );
      let endereco_parada =
        responsePedido?.data?.delivery?.deliveryAddress?.streetName;
      let bairro_parada =
        responsePedido?.data?.delivery?.deliveryAddress?.neighborhood;
      let cidade_parada = responsePedido?.data?.delivery?.deliveryAddress?.city;
      let estado_parada =
        responsePedido?.data?.delivery?.deliveryAddress?.state;
      let lat_parada =
        responsePedido?.data?.delivery?.deliveryAddress?.coordinates?.latitude;
      let lng_parada =
        responsePedido?.data?.delivery?.deliveryAddress?.coordinates?.longitude;
      let codigo_confirmacao = responsePedido?.data?.delivery?.pickupCode;
      let nome_cliente_parada = responsePedido?.data?.customer?.name;
      let telefone_cliente_parada =
        responsePedido?.data?.customer?.phone?.number;
      // //definindo se possui retorno
      const corridaComRetorno =
        await responsePedido?.data?.payments?.methods?.find(
          (data) => data?.method === "CREDIT" || data?.method === "DEBIT"
        );

      const dadosAbrirChamado = {
        fmr_pagamento: fmr_pagamento,
        corridaComRetorno: corridaComRetorno,
        nome_cliente_parada: nome_cliente_parada,
        telefone_cliente_parada: telefone_cliente_parada,
        endereco_parada: endereco_parada,
        bairro_parada: bairro_parada,
        cidade_parada: cidade_parada,
        estado_parada: estado_parada,
        lat_parada: lat_parada,
        lng_parada: lng_parada,
        codigo_confirmacao: codigo_confirmacao,
      };
      const responseNovoPedido = await aberturaNovoPedido(
        dadosAbrirChamado,
        tokenClienteFlyp
      );

      const dadosSalvarPedidoFlyp = {
        int_id: integracao_id,
        order_id: null,
        json: JSON.stringify(dadosAbrirChamado),
        status: "A",
        id_mch: responseNovoPedido?.data?.response?.id_mch,
        dt_criacao_pedido: `${ano}-${mes}-${dia} ${hora}:${minuto}:${segundo}`,
        dt_status: `${ano}-${mes}-${dia} ${hora}:${minuto}:${segundo}`,
        dt_criacao_corrida: new Date(),
        response: JSON.stringify(responseNovoPedido?.data),
        order_string: idPedido,
      };
      const responseSalvarDadosPedidoFlyp = await salvarNovoPedidoFlyp(
        dadosSalvarPedidoFlyp
      );
      console.log(responseSalvarDadosPedidoFlyp);
    } else if (
      direcionamentoCode === "CAN" &&
      direcionamentoFullCode === "CANCELLED"
    ) {
      //Rota para cancelamento
      await atualizarDadosPedidosFlyp();
      const filtrarPedidoCancelamento = await dados_pedidosFlyp?.find(
        (data) => data?.order_string === idPedido
      );
      if (filtrarPedidoCancelamento) {
        cancelamentoPedido(filtrarPedidoCancelamento, tokenClienteFlyp);
      } else {
        console.error("Não foi localizado o pedido para cancelamento.");
      }
    }
  } catch (error) {
    console.error(
      `Erro ao executar a ação: ${error}`,
      error.response ? error.response.data : error.message
    );
  }
}

//Rota de teste para inciar a operação
app.post("/", (req, res) => {
  fetchKeys();
  // buscarDadosCondicao("api_machine", {id: "2454"})
  //   .then((data) => {
  //     console.log(data);
  //   })
  //   .catch((err) => {
  //     console.error(err); // Exibe erro, caso ocorra
  //   });
  res.status(200).send(`funcionando`);
  console.log("Iniciando");
});

//Testando conexão mysql
app.post("/conexaoMySql", (req, res) => {
  res.status(200).send(`TESTE`);
  console.log("TESTE");
});

//Rota para novos cadastros de integração
app.post("/novaIntegracao", (req, res) => {
  atualizarIntegracoes();
  res.status(200).send(`TESTE`);
});

// app.post("/teste", async (req, res) => {
//   await atualizarDadosPedidosFlyp();
//   console.log(dados_pedidosFlyp);
//   res.status(200).send(`TESTE`);
// });

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
  const dataBody = req?.body;
  console.log("Webhook recebido com sucesso!");
  console.log("headers: ", req?.headers["x-ifood-signature"]);
  console.log("body: ", req?.body);
  acoesWebhooks(dataBody);
  res.status(202).send("Webhook processado com sucesso");
});

//configuração da porta, usando variavel de ambiente
const port = process.env.PORT || 8004;

app.listen(port, () => {
  console.log(`Servidor rodando na porta ${port}`);
});
