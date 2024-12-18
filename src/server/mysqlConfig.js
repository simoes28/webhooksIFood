const mysql = require("mysql2");

//Configuração de conexão

const conexaoMySql = mysql.createConnection({
  host: "node196409-env-7131121.sp1.br.saveincloud.net.br",
  user: "root",
  password: "Sandbox2024@!@#",
  database: "sandbox_flyp",
  port: 7979,
});

//Teste de conexão
conexaoMySql.connect(function (erro) {
  if (erro) throw erro;
  console.log("Conexão efetuada com sucesso");
});

module.exports = { conexaoMySql };
