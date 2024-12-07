const admin = require("firebase-admin"); // Importação do Firebase Admin SDK
const dotenv = require("dotenv"); // Importando o dotenv para carregar variáveis de ambiente

// Carregando variáveis de ambiente
dotenv.config(); // Isso permite que você acesse as variáveis de ambiente do arquivo .env

// Verificando se o Firebase já foi inicializado
if (admin.apps.length === 0) {
  // Inicializando o Firebase Admin SDK apenas se ainda não foi inicializado
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n"), // Corrige a chave privada
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    }),
  });
} else {
  console.log("Firebase Admin já inicializado.");
}

// Obtendo instâncias do Auth e Firestore
const auth = admin.auth(); // Instância do Firebase Auth para autenticação
const db = admin.firestore(); // Instância do Firestore para interações com o banco de dados

// Funções para realizar operações de autenticação e banco de dados
// const createUser = async (email, password) => {
//   try {
//     const userRecord = await auth.createUser({
//       email,
//       password,
//     });
//     console.log("Usuário criado com sucesso:", userRecord.uid);
//   } catch (error) {
//     console.error("Erro ao criar usuário:", error);
//   }
// };

const getInfoKeys = async (collection) => {
  try {
    const querySnapshot = await db.collection(collection).get();
    //Armazena os dados em um array
    const data = [];
    querySnapshot.forEach((doc) => {
      data.push({ id: doc?.id, ...doc?.data() });
    });
    console.log("Dados recuperados: ", data);
    return data;
  } catch (error) {
    console.error("Erro ao buscar dados: ", error);
    return error;
  }
};

const saveDataToFirestore = async (collection, data) => {
  try {
    const docRef = db.collection(collection).doc;
    await docRef.set(data);
    console.log("Dados salvos com sucesso:");
  } catch (error) {
    console.error("Erro ao salvar dados:", error);
  }
};

const updateDataToFirestore = async (collection, docId, data) => {
  try {
    const docRef = db.collection(collection).doc(docId);
    await docRef.update(data);
    console.log("Dados atualizados com sucesso:", docId);
  } catch (error) {
    console.error("Erro ao atualizar dados:", error);
  }
};

// Exportando as instâncias para uso posterior em outros arquivos
export { auth, db, saveDataToFirestore, updateDataToFirestore, getInfoKeys };
