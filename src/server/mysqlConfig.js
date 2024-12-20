const mysql = require("mysql2");

// Configuração de pool de conexões
const pool = mysql.createPool({
  host: "node196409-env-7131121.sp1.br.saveincloud.net.br",
  user: "root",
  password: "Sandbox2024@!@#",
  database: "sandbox_flyp",
  port: 7979, // Porta do MySQL
  connectionLimit: 1000, // Limite de conexões simultâneas
});

// Teste de conexão usando pool
pool.getConnection(function (erro, conexao) {
  if (erro) throw erro;
  console.log("Conexão efetuada com sucesso");
  conexao.release(); // Libera a conexão para o pool após o uso
});

module.exports = { pool };
