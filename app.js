// ================= FIREBASE =================
// Cole aqui as configurações do seu Firebase Web App.
const firebaseConfig = {
  apiKey: "AIzaSyDrtZxbKXk7hjlqBL_BLoZMTBdc5iqBCXo",
  authDomain: "ferramentas-projeto.firebaseapp.com",
  databaseURL: "https://ferramentas-projeto.firebaseio.com",
  projectId: "ferramentas-projeto",
  storageBucket: "ferramentas-projeto.appspot.com",
  messagingSenderId: "877191590019",
  appId: "1:877191590019:web:152d4d35bdd3024c53abb6"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.database();
const auth = firebase.auth();

// ================= CONFIGURAÇÃO =================
const LOGIN_ADMIN = "admin";
const SENHA_ADMIN = "870@Passadoria";
let promocaoAtual = "";
let jaGirou = false;
let premioAtual = "";
let telefoneAtual = "";
let usuarioIdAtual = "";        // ID protegido para mostrar na tela
let usuarioKeyAtual = "";       // chave segura/hash para salvar no Firebase
let avaliacaoJaEnviada = false;

const visitanteIdEl = document.getElementById("visitanteId");
if (visitanteIdEl) visitanteIdEl.textContent = "Digite seu telefone para gerar o ID";

function limparTelefone(telefone) {
  return String(telefone || "").replace(/\D/g, "");
}

function mascararTelefone(telefone) {
  const limpo = limparTelefone(telefone);
  if (!limpo) return "";
  const ultimos = limpo.slice(-4);
  return "••••••" + ultimos;
}

function gerarUsuarioIdProtegido(telefone) {
  const limpo = limparTelefone(telefone);
  if (!limpo) return "";
  return "TEL-" + mascararTelefone(limpo);
}

async function gerarChaveTelefone(telefone) {
  const limpo = limparTelefone(telefone);
  const encoder = new TextEncoder();
  const data = encoder.encode(limpo);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return "tel_" + hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
}

function telefoneValido(telefone) {
  return limparTelefone(telefone).length >= 10;
}

function atualizarUsuarioAtual() {
  const telefoneInput = document.getElementById("telefone");
  telefoneAtual = telefoneInput ? telefoneInput.value.trim() : "";
  usuarioIdAtual = gerarUsuarioIdProtegido(telefoneAtual);
  if (visitanteIdEl) visitanteIdEl.textContent = usuarioIdAtual || "Digite seu telefone para gerar o ID";
  return usuarioIdAtual;
}

function desbloquearFormulario() {
  const ids = ["nome", "telefone", "categoria", "comentario"];
  ids.forEach((id) => { const el = document.getElementById(id); if (el) el.disabled = false; });
  estrelas.forEach((s) => { s.style.pointerEvents = "auto"; });
}


function preencherDadosSalvos(dados) {
  if (!dados) return;
  const nomeEl = document.getElementById("nome");
  const telEl = document.getElementById("telefone");
  const catEl = document.getElementById("categoria");
  const comEl = document.getElementById("comentario");
  const notaEl = document.getElementById("nota");

  if (nomeEl && dados.nome) nomeEl.value = dados.nome;
  if (telEl && dados.telefoneOriginal) telEl.value = dados.telefoneOriginal;
  if (catEl && dados.categoria) catEl.value = dados.categoria;
  if (comEl && dados.comentario) comEl.value = dados.comentario;
  if (notaEl && dados.nota) notaEl.value = dados.nota;

  const n = Number(dados.nota || 0);
  estrelas.forEach((st) => st.classList.toggle("ativa", Number(st.dataset.star) <= n));
}

function bloquearFormularioParaVisualizacao(mensagem) {
  const ids = ["nome", "telefone", "categoria", "comentario"];
  ids.forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.disabled = true;
  });
  estrelas.forEach((s) => { s.style.pointerEvents = "none"; });
  if (btnGirar) {
    btnGirar.disabled = true;
    btnGirar.textContent = "BLOQUEADO";
  }
  if (btnEnviarAvaliacao) {
    btnEnviarAvaliacao.disabled = true;
    btnEnviarAvaliacao.classList.add("hidden");
  }
  if (statusEl) statusEl.textContent = mensagem || "Você já participou desta promoção. Agora é somente visualização.";
}

function extrairNumeroPromocao(id) {
  const m = String(id || "").match(/promo_(\d+)/);
  return m ? Number(m[1]) : 0;
}

async function buscarUltimaPromocaoSalva() {
  const caminhos = ["promocoes", "girosPorTelefone", "avaliacoesPorTelefone", "participantesPorTelefone"];
  let encontrada = "";
  let maior = 0;

  for (const caminho of caminhos) {
    try {
      const snap = await db.ref(caminho).once("value");
      if (snap.exists()) {
        snap.forEach((child) => {
          const key = child.key;
          const n = extrairNumeroPromocao(key);
          if (n > maior) {
            maior = n;
            encontrada = key;
          }
        });
      }
    } catch (e) {
      console.warn("Não foi possível verificar", caminho, e);
    }
  }

  return encontrada;
}

async function carregarPromocaoAtual() {
  const snap = await db.ref("config/promocaoAtual").once("value");
  const promoConfig = snap.exists() ? String(snap.val() || "") : "";
  const ultimaPromo = await buscarUltimaPromocaoSalva();

  // Regra principal:
  // 1) Se existir promoção lançada, usa sempre a mais recente.
  // 2) Nunca volta sozinho para promo_1.
  // 3) Só cria uma promoção nova quando não existe nenhuma no banco.
  let promoEscolhida = "";

  if (ultimaPromo) {
    if (!promoConfig || promoConfig === "promo_1" || extrairNumeroPromocao(ultimaPromo) >= extrairNumeroPromocao(promoConfig)) {
      promoEscolhida = ultimaPromo;
    } else {
      promoEscolhida = promoConfig;
    }
  } else if (promoConfig && promoConfig !== "promo_1") {
    promoEscolhida = promoConfig;
  } else {
    promoEscolhida = "promo_" + Date.now();
    await db.ref("promocoes/" + promoEscolhida).set({
      criadaEm: new Date().toLocaleString("pt-BR"),
      timestamp: Date.now(),
      ativa: true
    });
  }

  promocaoAtual = promoEscolhida;
  if (promoConfig !== promocaoAtual) {
    await db.ref("config/promocaoAtual").set(promocaoAtual);
  }

  if (promoAtualTexto) promoAtualTexto.textContent = promocaoAtual;
}

async function registrarEntrada() {
  try {
    await db.ref("entradas").push({
      data: new Date().toLocaleString("pt-BR"),
      timestamp: Date.now(),
      pagina: location.href,
      promocaoAtual,
      navegador: navigator.userAgent || ""
    });
  } catch (error) {
    console.error("Erro ao registrar entrada:", error);
  }
}

// ================= RODA DA SORTE =================
const canvas = document.getElementById("wheel");
const ctx = canvas.getContext("2d");
const btnGirar = document.getElementById("btnGirar");
const resultado = document.getElementById("resultado");

// Porcentagens distribuídas somente de 0% até 20%.
const premios = ["0%", "2%", "4%", "6%", "8%", "10%", "12%", "14%", "16%", "18%", "20%"]; 
const cores = ["#facc15", "#22c55e", "#3b82f6", "#ef4444", "#a855f7", "#fb923c", "#14b8a6", "#ec4899", "#84cc16", "#f97316", "#38bdf8"];
let anguloAtual = 0;
let girando = false;

function desenharRoda() {
  const centro = canvas.width / 2;
  const raio = centro - 5;
  const fatia = (2 * Math.PI) / premios.length;
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  for (let i = 0; i < premios.length; i++) {
    const inicio = anguloAtual + i * fatia;
    const fim = inicio + fatia;
    ctx.beginPath();
    ctx.moveTo(centro, centro);
    ctx.arc(centro, centro, raio, inicio, fim);
    ctx.closePath();
    ctx.fillStyle = cores[i];
    ctx.fill();

    ctx.save();
    ctx.translate(centro, centro);
    ctx.rotate(inicio + fatia / 2);
    ctx.textAlign = "right";
    ctx.fillStyle = "#111827";
    ctx.font = "bold 18px Arial";
    ctx.fillText(premios[i], raio - 22, 7);
    ctx.restore();
  }

  ctx.beginPath();
  ctx.arc(centro, centro, 35, 0, 2 * Math.PI);
  ctx.fillStyle = "#111827";
  ctx.fill();
  ctx.fillStyle = "#facc15";
  ctx.font = "bold 14px Arial";
  ctx.textAlign = "center";
  ctx.fillText("SORTE", centro, centro + 5);
}

desenharRoda();

async function verificarSeJaGirou() {
  atualizarUsuarioAtual();
  if (!telefoneValido(telefoneAtual)) {
    jaGirou = false;
    avaliacaoJaEnviada = false;
    premioAtual = "";
    resultado.textContent = "Digite seu telefone antes de girar.";
    desbloquearFormulario();
    btnGirar.disabled = false;
    btnGirar.textContent = "GIRAR RODA";
    atualizarBotaoEnviar();
    return false;
  }

  usuarioKeyAtual = await gerarChaveTelefone(telefoneAtual);

  // Primeiro olha o bloqueio final. Esse é o registro principal no Firebase.
  const snapParticipante = await db.ref(`participantesPorTelefone/${promocaoAtual}/${usuarioKeyAtual}`).once("value");
  if (snapParticipante.exists()) {
    const dados = snapParticipante.val();
    jaGirou = true;
    avaliacaoJaEnviada = true;
    premioAtual = dados.descontoSorteado || "";
    preencherDadosSalvos(dados);
    carregarMeuComentario();
    resultado.textContent = `Você já participou desta promoção. Desconto: ${premioAtual}`;
    bloquearFormularioParaVisualizacao("✅ Você já avaliou e já usou seu giro. Agora é somente visualização.");
    return true;
  }

  const snapAvaliacao = await db.ref(`avaliacoesPorTelefone/${promocaoAtual}/${usuarioKeyAtual}`).once("value");
  avaliacaoJaEnviada = snapAvaliacao.exists();

  const snapGiro = await db.ref(`girosPorTelefone/${promocaoAtual}/${usuarioKeyAtual}`).once("value");
  jaGirou = snapGiro.exists();

  if (avaliacaoJaEnviada) {
    const dados = snapAvaliacao.val();
    premioAtual = dados.descontoSorteado || "";
    preencherDadosSalvos(dados);
    carregarMeuComentario();
    await db.ref(`participantesPorTelefone/${promocaoAtual}/${usuarioKeyAtual}`).set({ ...dados, bloqueado: true });
    resultado.textContent = `Você já participou desta promoção. Desconto: ${premioAtual}`;
    bloquearFormularioParaVisualizacao("✅ Sua avaliação já foi enviada. Você só pode visualizar.");
    return true;
  }

  if (jaGirou) {
    const dados = snapGiro.val();
    premioAtual = dados.descontoSorteado || "";
    preencherDadosSalvos(dados);
    carregarMeuComentario();
    resultado.textContent = `Você já utilizou seu giro. Desconto: ${premioAtual}`;
    btnGirar.disabled = true;
    btnGirar.textContent = "GIRO JÁ UTILIZADO";
  } else {
    desbloquearFormulario();
    resultado.textContent = "Seu prêmio aparecerá aqui.";
    btnGirar.disabled = false;
    btnGirar.textContent = "GIRAR RODA";
  }
  atualizarBotaoEnviar();
  return jaGirou || avaliacaoJaEnviada;
}


const telefoneInput = document.getElementById("telefone");
if (telefoneInput) {
  telefoneInput.addEventListener("blur", async () => { await verificarSeJaGirou(); await carregarMeuComentario(); });
  telefoneInput.addEventListener("input", () => { atualizarUsuarioAtual(); atualizarBotaoEnviar(); });
}

btnGirar.addEventListener("click", async () => {
  if (girando) return;

  atualizarUsuarioAtual();
  const nome = document.getElementById("nome").value.trim();
  if (!nomeCompletoValido(nome)) return alert("Digite seu nome e sobrenome antes de girar.");
  if (!telefoneValido(telefoneAtual)) return alert("Digite um telefone válido com DDD antes de girar.");

  await verificarSeJaGirou();
  if (jaGirou) {
    alert("Você já utilizou seu giro de desconto.");
    return;
  }

  girando = true;
  btnGirar.disabled = true;
  resultado.textContent = "Girando...";

  const voltas = 6 + Math.random() * 4;
  const destino = Math.random() * 2 * Math.PI;
  const total = voltas * 2 * Math.PI + destino;
  const inicio = anguloAtual;
  const duracao = 4200;
  const start = performance.now();

  function animar(tempo) {
    const progresso = Math.min((tempo - start) / duracao, 1);
    const ease = 1 - Math.pow(1 - progresso, 4);
    anguloAtual = inicio + total * ease;
    desenharRoda();

    if (progresso < 1) {
      requestAnimationFrame(animar);
    } else {
      const anguloFinal = (anguloAtual % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI);
      const fatia = (2 * Math.PI) / premios.length;
      const ponteiro = (1.5 * Math.PI - anguloFinal + 2 * Math.PI) % (2 * Math.PI);
      const indice = Math.floor(ponteiro / fatia) % premios.length;
      premioAtual = premios[indice];

      const telefoneProtegido = mascararTelefone(telefoneAtual);
      const dadosGiro = {
        usuarioKey: usuarioKeyAtual,
        usuarioId: usuarioIdAtual,
        nome,
        telefone: telefoneProtegido,
        telefoneOriginal: limparTelefone(telefoneAtual),
        promocaoId: promocaoAtual,
        descontoSorteado: premioAtual,
        data: new Date().toLocaleString("pt-BR"),
        timestamp: Date.now()
      };

      // Salva no Firebase pelo telefone. Não usa localStorage.
      db.ref(`girosPorTelefone/${promocaoAtual}/${usuarioKeyAtual}`).set(dadosGiro)
        .then(() => db.ref("giros").push(dadosGiro))
        .then(() => db.ref("notificacoesAdm").push({
          tipo: "giro",
          titulo: "Novo giro realizado",
          nome,
          telefone: telefoneProtegido,
          telefoneOriginal: limparTelefone(telefoneAtual),
          usuarioId: usuarioIdAtual,
          descontoSorteado: premioAtual,
          promocaoId: promocaoAtual,
          data: new Date().toLocaleString("pt-BR"),
          timestamp: Date.now(),
          lida: false
        }))
        .then(() => {
          girando = false;
          jaGirou = true;
          resultado.textContent = `🎉 Você ganhou ${premioAtual} de desconto!`;
          btnGirar.textContent = "GIRO JÁ UTILIZADO";
          btnGirar.disabled = true;
          atualizarBotaoEnviar();
          // Se todos os dados já estiverem preenchidos, envia a avaliação automaticamente após o giro.
          setTimeout(() => {
            if (formularioCompletoValido() && form && !avaliacaoJaEnviada) {
              if (form.requestSubmit) form.requestSubmit();
              else form.dispatchEvent(new Event("submit", { cancelable: true, bubbles: true }));
            }
          }, 300);
        })
        .catch((error) => {
          console.error("Erro ao salvar giro:", error);
          girando = false;
          btnGirar.disabled = false;
          resultado.textContent = "❌ Erro ao salvar o giro. Confira as regras do Firebase.";
          atualizarBotaoEnviar();
        });
    }
  }

  requestAnimationFrame(animar);
});

// ================= AVALIAÇÃO =================
const estrelas = document.querySelectorAll("#estrelas span");
const notaInput = document.getElementById("nota");

estrelas.forEach((estrela) => {
  estrela.addEventListener("click", () => {
    const nota = Number(estrela.dataset.star);
    notaInput.value = nota;
    estrelas.forEach((s) => s.classList.toggle("ativa", Number(s.dataset.star) <= nota));
    atualizarBotaoEnviar();
  });
});

function nomeCompletoValido(nome) {
  return String(nome || "").trim().split(/\s+/).length >= 2;
}

const form = document.getElementById("formAvaliacao");
const statusEl = document.getElementById("status");
const btnEnviarAvaliacao = document.getElementById("btnEnviarAvaliacao");
const camposObrigatorios = ["nome", "telefone", "categoria", "comentario"].map((id) => document.getElementById(id));

function formularioCompletoValido() {
  const nome = document.getElementById("nome").value.trim();
  const telefone = document.getElementById("telefone").value.trim();
  const categoria = document.getElementById("categoria").value;
  const nota = Number(notaInput.value);
  const comentario = document.getElementById("comentario").value.trim();

  return nomeCompletoValido(nome) && telefoneValido(telefone) && !!categoria && !!nota && !!comentario && !!premioAtual && jaGirou && !avaliacaoJaEnviada;
}

function atualizarBotaoEnviar() {
  if (!btnEnviarAvaliacao) return;
  const liberar = formularioCompletoValido();
  btnEnviarAvaliacao.disabled = !liberar;
  btnEnviarAvaliacao.classList.toggle("hidden", !liberar);

  if (statusEl && !liberar && !statusEl.textContent.startsWith("✅")) {
    statusEl.textContent = "Preencha todos os dados, escolha as estrelas e gire a roda para liberar o envio.";
  }
}


camposObrigatorios.forEach((campo) => {
  if (campo) campo.addEventListener("input", atualizarBotaoEnviar);
  if (campo) campo.addEventListener("change", atualizarBotaoEnviar);
});

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const nome = document.getElementById("nome").value.trim();
  const telefone = document.getElementById("telefone").value.trim();
  const categoria = document.getElementById("categoria").value;
  const nota = Number(notaInput.value);
  const comentario = document.getElementById("comentario").value.trim();
  const usuarioId = gerarUsuarioIdProtegido(telefone);
  const usuarioKey = await gerarChaveTelefone(telefone);
  const telefoneProtegido = mascararTelefone(telefone);

  if (!nomeCompletoValido(nome)) return alert("Digite nome e sobrenome.");
  if (!telefoneValido(telefone)) return alert("Digite um telefone válido com DDD.");
  if (!categoria || !nota || !comentario) return alert("Preencha todos os campos.");
  if (!jaGirou || !premioAtual) return alert("Gire a roda primeiro para liberar o envio da avaliação.");

  const snapAvaliacaoExistente = await db.ref(`avaliacoesPorTelefone/${promocaoAtual}/${usuarioKey}`).once("value");
  if (snapAvaliacaoExistente.exists()) {
    avaliacaoJaEnviada = true;
    bloquearFormularioParaVisualizacao("✅ Você já enviou sua avaliação nesta promoção. Agora é somente visualização.");
    return;
  }

  const snapGiro = await db.ref(`girosPorTelefone/${promocaoAtual}/${usuarioKey}`).once("value");
  const dadosGiro = snapGiro.exists() ? snapGiro.val() : null;

  const dados = {
    usuarioKey,
    usuarioId,
    promocaoId: promocaoAtual,
    nome,
    telefone: telefoneProtegido,
    telefoneOriginal: limparTelefone(telefone),
    categoria,
    nota,
    comentario,
    descontoSorteado: dadosGiro ? dadosGiro.descontoSorteado : "Não girou a roda",
    data: new Date().toLocaleString("pt-BR"),
    timestamp: Date.now()
  };

  try {
    const novaRef = await db.ref("avaliacoes").push(dados);
    await db.ref(`avaliacoesPorTelefone/${promocaoAtual}/${usuarioKey}`).set({ ...dados, avaliacaoId: novaRef.key });
    await db.ref(`participantesPorTelefone/${promocaoAtual}/${usuarioKey}`).set({ ...dados, avaliacaoId: novaRef.key, bloqueado: true });
    await db.ref("notificacoesAdm").push({
      tipo: "avaliacao",
      titulo: "Nova avaliação enviada",
      nome,
      telefone: telefoneProtegido,
      telefoneOriginal: limparTelefone(telefone),
      usuarioId,
      categoria,
      nota,
      comentario,
      descontoSorteado: dados.descontoSorteado,
      promocaoId: promocaoAtual,
      data: new Date().toLocaleString("pt-BR"),
      timestamp: Date.now(),
      lida: false
    });
    avaliacaoJaEnviada = true;
    statusEl.textContent = "✅ Avaliação enviada e salva com sucesso no Firebase!";
    await carregarMeuComentario();
    await carregarTodosComentariosPublicos();
    bloquearFormularioParaVisualizacao("✅ Sua avaliação foi enviada. Você só pode visualizar.");
    atualizarBotaoEnviar();
  } catch (error) {
    console.error(error);
    statusEl.textContent = "❌ Erro ao salvar. Confira as regras do Firebase Realtime Database.";
  }
});

// ================= LISTAS DE COMENTÁRIOS DO FIREBASE =================
const meuComentarioLista = document.getElementById("meuComentarioLista");
const comentariosLista = document.getElementById("comentariosLista");

function cardMeuComentario(item) {
  return `
    <div class="comentario-card meu-card">
      <h3>${escapeHtml(item.nome || "Seu comentário")}</h3>
      <p class="estrelas-salvas">${renderizarEstrelas(item.nota)}</p>
      <p>Categoria: <strong>${escapeHtml(item.categoria || "")}</strong></p>
      <p>Desconto: <strong>${escapeHtml(item.descontoSorteado || "")}</strong></p>
      <p>💬 ${escapeHtml(item.comentario || "")}</p>
      <small>${escapeHtml(item.data || "")}</small>
    </div>
  `;
}

function cardComentarioPublico(item) {
  return `
    <div class="comentario-card publico-card">
      <h3>👤 ${escapeHtml(item.nome || "Cliente")}</h3>
      <p class="estrelas-salvas">${renderizarEstrelas(item.nota)}</p>
      <p>Categoria: <strong>${escapeHtml(item.categoria || "")}</strong></p>
      <p>💬 ${escapeHtml(item.comentario || "")}</p>
    </div>
  `;
}

async function carregarMeuComentario() {
  if (!meuComentarioLista) return;
  atualizarUsuarioAtual();

  if (!telefoneValido(telefoneAtual)) {
    meuComentarioLista.innerHTML = '<p class="vazio">Digite seu telefone para localizar seu comentário.</p>';
    return;
  }

  try {
    const usuarioKey = await gerarChaveTelefone(telefoneAtual);
    const snapParticipante = await db.ref(`participantesPorTelefone/${promocaoAtual}/${usuarioKey}`).once("value");
    const snapAvaliacao = await db.ref(`avaliacoesPorTelefone/${promocaoAtual}/${usuarioKey}`).once("value");
    const dados = snapParticipante.exists() ? snapParticipante.val() : (snapAvaliacao.exists() ? snapAvaliacao.val() : null);

    if (!dados || !dados.comentario) {
      meuComentarioLista.innerHTML = '<p class="vazio">Seu comentário ainda não foi enviado.</p>';
      return;
    }

    meuComentarioLista.innerHTML = cardMeuComentario(dados);
  } catch (error) {
    console.error(error);
    meuComentarioLista.innerHTML = '<p class="vazio">Não foi possível carregar seu comentário agora.</p>';
  }
}

function montarChaveUnicaAvaliacao(item) {
  return item.avaliacaoId || item.usuarioKey || (String(item.telefoneOriginal || "") + "_" + String(item.timestamp || ""));
}

function desenharComentariosPublicos(mapa) {
  if (!comentariosLista) return;
  const dados = Object.values(mapa)
    .filter((item) => item && item.comentario)
    .sort((a, b) => Number(b.timestamp || 0) - Number(a.timestamp || 0));

  comentariosLista.innerHTML = "";
  if (!dados.length) {
    comentariosLista.innerHTML = '<p class="vazio">Nenhum comentário ainda.</p>';
    return;
  }

  dados.forEach((item) => {
    const div = document.createElement("div");
    div.innerHTML = cardComentarioPublico(item);
    comentariosLista.appendChild(div.firstElementChild);
  });
}

async function carregarTodosComentariosPublicos() {
  if (!comentariosLista) return;
  comentariosLista.innerHTML = '<p class="vazio">Carregando todos os comentários...</p>';

  const mapa = {};

  // 1) Lista principal de avaliações.
  const snapAvaliacoes = await db.ref("avaliacoes").orderByChild("timestamp").limitToLast(200).once("value");
  if (snapAvaliacoes.exists()) {
    snapAvaliacoes.forEach((child) => {
      const item = { avaliacaoId: child.key, ...child.val() };
      mapa[montarChaveUnicaAvaliacao(item)] = item;
    });
  }

  // 2) Backup por telefone de todas as promoções. Assim aparece mesmo quando a lista principal foi apagada no ADM.
  const snapPorTelefoneTodas = await db.ref("avaliacoesPorTelefone").once("value");
  if (snapPorTelefoneTodas.exists()) {
    snapPorTelefoneTodas.forEach((promoSnap) => {
      promoSnap.forEach((child) => {
        const item = { promocaoId: promoSnap.key, ...child.val() };
        mapa[montarChaveUnicaAvaliacao(item)] = item;
      });
    });
  }

  // 3) Participantes bloqueados de todas as promoções. Mantém todos que já avaliaram visíveis na lista pública.
  const snapParticipantesTodas = await db.ref("participantesPorTelefone").once("value");
  if (snapParticipantesTodas.exists()) {
    snapParticipantesTodas.forEach((promoSnap) => {
      promoSnap.forEach((child) => {
        const item = { promocaoId: promoSnap.key, ...child.val() };
        mapa[montarChaveUnicaAvaliacao(item)] = item;
      });
    });
  }

  desenharComentariosPublicos(mapa);
}

db.ref("avaliacoes").on("value", carregarTodosComentariosPublicos);
db.ref("config/promocaoAtual").on("value", async () => {
  await carregarPromocaoAtual();
  await carregarTodosComentariosPublicos();
  if (adminPainel && !adminPainel.classList.contains("hidden")) {
    await atualizarPainelAdmin();
  }
});

// ================= ADM =================
const adminModal = document.getElementById("adminModal");
const btnAbrirAdmin = document.getElementById("btnAbrirAdmin");
const btnFecharAdmin = document.getElementById("btnFecharAdmin");
const btnEntrarAdmin = document.getElementById("btnEntrarAdmin");
const loginAdmin = document.getElementById("loginAdmin");
const senhaAdmin = document.getElementById("senhaAdmin");
const adminErro = document.getElementById("adminErro");
const adminLogin = document.getElementById("adminLogin");
const adminPainel = document.getElementById("adminPainel");
const promoAtualTexto = document.getElementById("promoAtualTexto");
const totalGirosTexto = document.getElementById("totalGirosTexto");
const totalAvaliacoesTexto = document.getElementById("totalAvaliacoesTexto");
const totalEntradasTexto = document.getElementById("totalEntradasTexto");
const btnNovaPromocao = document.getElementById("btnNovaPromocao");
const btnLimparPromocao = document.getElementById("btnLimparPromocao");
const btnVerAvaliacoes = document.getElementById("btnVerAvaliacoes");
const btnExportarPDF = document.getElementById("btnExportarPDF");
const btnExcluirComentarios = document.getElementById("btnExcluirComentarios");
const btnVerGiros = document.getElementById("btnVerGiros");
const btnVerNotificacoes = document.getElementById("btnVerNotificacoes");
const btnVerEntradas = document.getElementById("btnVerEntradas");
const btnRecuperarSenha = document.getElementById("btnRecuperarSenha");
const btnSairAdmin = document.getElementById("btnSairAdmin");
const adminUsuarioLogado = document.getElementById("adminUsuarioLogado");
const adminAvaliacoes = document.getElementById("adminAvaliacoes");
const adminGiros = document.getElementById("adminGiros");
const adminNotificacoes = document.getElementById("adminNotificacoes");
const adminEntradas = document.getElementById("adminEntradas");

btnAbrirAdmin.addEventListener("click", () => adminModal.classList.remove("hidden"));
btnFecharAdmin.addEventListener("click", () => adminModal.classList.add("hidden"));

btnEntrarAdmin.addEventListener("click", async () => {
  const email = loginAdmin.value.trim();
  const senha = senhaAdmin.value.trim();
  if (!email || !senha) {
    adminErro.textContent = "Digite e-mail e senha do ADM.";
    return;
  }
  try {
    adminErro.textContent = "Entrando...";
    await auth.signInWithEmailAndPassword(email, senha);
    adminErro.textContent = "";
  } catch (error) {
    console.error(error);
    adminErro.textContent = "Erro no login. Confira o e-mail/senha ou ative E-mail/Senha no Firebase Authentication.";
  }
});

if (btnRecuperarSenha) {
  btnRecuperarSenha.addEventListener("click", async () => {
    const email = loginAdmin.value.trim();
    if (!email) return alert("Digite o e-mail do ADM primeiro.");
    try {
      await auth.sendPasswordResetEmail(email);
      alert("E-mail de recuperação enviado.");
    } catch (error) {
      console.error(error);
      alert("Não foi possível enviar recuperação. Confira o e-mail.");
    }
  });
}

if (btnSairAdmin) {
  btnSairAdmin.addEventListener("click", async () => {
    await auth.signOut();
  });
}

auth.onAuthStateChanged(async (user) => {
  if (user) {
    adminLogin.classList.add("hidden");
    adminPainel.classList.remove("hidden");
    if (adminUsuarioLogado) adminUsuarioLogado.textContent = user.email || "ADM conectado";
    await carregarPromocaoAtual();
    await atualizarPainelAdmin();
    ativarNotificacoesTempoRealAdm();
  } else {
    adminLogin.classList.remove("hidden");
    adminPainel.classList.add("hidden");
    if (adminUsuarioLogado) adminUsuarioLogado.textContent = "";
  }
});

async function atualizarPainelAdmin() {
  promoAtualTexto.textContent = promocaoAtual;
  const snapGiros = await db.ref(`girosPorTelefone/${promocaoAtual}`).once("value");
  totalGirosTexto.textContent = snapGiros.exists() ? snapGiros.numChildren() : 0;

  const listaAvaliacoesCompleta = await carregarTodasAvaliacoesAdmin();
  totalAvaliacoesTexto.textContent = listaAvaliacoesCompleta.length;

  const snapEntradas = await db.ref("entradas").once("value");
  if (totalEntradasTexto) totalEntradasTexto.textContent = snapEntradas.exists() ? snapEntradas.numChildren() : 0;
}

btnNovaPromocao.addEventListener("click", async () => {
  if (!confirm("Criar uma nova promoção? Todos poderão girar novamente.")) return;
  promocaoAtual = "promo_" + Date.now();
  await db.ref("config/promocaoAtual").set(promocaoAtual);
  await db.ref("promocoes/" + promocaoAtual).set({ criadaEm: new Date().toLocaleString("pt-BR"), timestamp: Date.now(), ativa: true });
  jaGirou = false;
  avaliacaoJaEnviada = false;
  premioAtual = "";
  desbloquearFormulario();
  await verificarSeJaGirou();
  await atualizarPainelAdmin();
  alert("Nova promoção criada. Agora todos podem girar novamente.");
});

btnLimparPromocao.addEventListener("click", async () => {
  if (!confirm("Limpar todos os giros da promoção atual? Isso libera todos para girar de novo.")) return;
  await db.ref(`girosPorTelefone/${promocaoAtual}`).remove();
  await db.ref(`participantesPorTelefone/${promocaoAtual}`).remove();
  await db.ref(`avaliacoesPorTelefone/${promocaoAtual}`).remove();
  jaGirou = false;
  avaliacaoJaEnviada = false;
  premioAtual = "";
  desbloquearFormulario();
  await verificarSeJaGirou();
  await atualizarPainelAdmin();
  alert("Giros da promoção atual limpos. Agora todos podem girar novamente.");
});

btnVerAvaliacoes.addEventListener("click", async () => {
  adminAvaliacoes.classList.toggle("hidden");
  if (!adminAvaliacoes.classList.contains("hidden")) {
    await carregarAvaliacoesAdmin();
  }
});

function chaveAdminItem(item) {
  return item.avaliacaoId || item.key || ((item.promocaoId || "sem_promo") + "_" + (item.usuarioKey || item.telefoneOriginal || item.timestamp || Math.random()));
}

async function carregarTodasAvaliacoesAdmin() {
  const mapa = {};

  // Lista principal de avaliações.
  const snapAvaliacoes = await db.ref("avaliacoes").orderByChild("timestamp").once("value");
  if (snapAvaliacoes.exists()) {
    snapAvaliacoes.forEach((child) => {
      const item = { key: child.key, avaliacaoId: child.key, origem: "avaliacoes", ...child.val() };
      mapa[chaveAdminItem(item)] = item;
    });
  }

  // Todas as avaliações salvas por telefone, de todas as promoções.
  const snapPorTelefoneTodas = await db.ref("avaliacoesPorTelefone").once("value");
  if (snapPorTelefoneTodas.exists()) {
    snapPorTelefoneTodas.forEach((promoSnap) => {
      promoSnap.forEach((userSnap) => {
        const item = { origem: "avaliacoesPorTelefone", promocaoId: promoSnap.key, ...userSnap.val() };
        mapa[chaveAdminItem(item)] = { ...mapa[chaveAdminItem(item)], ...item };
      });
    });
  }

  // Participantes bloqueados, para não sumir cliente quando a avaliação principal tiver sido apagada.
  const snapParticipantesTodas = await db.ref("participantesPorTelefone").once("value");
  if (snapParticipantesTodas.exists()) {
    snapParticipantesTodas.forEach((promoSnap) => {
      promoSnap.forEach((userSnap) => {
        const item = { origem: "participantesPorTelefone", promocaoId: promoSnap.key, ...userSnap.val() };
        if (item.comentario) mapa[chaveAdminItem(item)] = { ...item, ...mapa[chaveAdminItem(item)] };
      });
    });
  }

  return Object.values(mapa)
    .filter((item) => item && (item.nome || item.telefone || item.comentario))
    .sort((a, b) => Number(b.timestamp || 0) - Number(a.timestamp || 0));
}

async function carregarAvaliacoesAdmin() {
  adminAvaliacoes.innerHTML = "<p>Carregando lista completa...</p>";
  const lista = await carregarTodasAvaliacoesAdmin();

  if (!lista.length) {
    adminAvaliacoes.innerHTML = '<p class="vazio">Nenhuma avaliação salva.</p>';
    return;
  }

  window.__listaAvaliacoesAdmin = lista;
  adminAvaliacoes.innerHTML = `
    <div class="admin-ajuda-pdf">✅ Marque 1 perfil abaixo e clique em <strong>COMPARTILHAR WHATSAPP</strong>.</div>
  ` + lista.map((item, index) => {
    const key = item.key || item.avaliacaoId || "";
    return `
      <div class="admin-item">
        <label class="check-pdf">
          <input type="checkbox" class="selecionar-pdf" value="${index}">
          <span>Marcar para WhatsApp</span>
        </label>
        <strong>${escapeHtml(item.nome || "Sem nome")}</strong><br>
        🆔 ${escapeHtml(item.usuarioId || "")}<br>
        📞 ${escapeHtml(item.telefone || "")}<br>
        ${renderizarEstrelas(item.nota)} | ${escapeHtml(item.categoria || "")}<br>
        🎁 Desconto: ${escapeHtml(item.descontoSorteado || "")}<br>
        💬 ${escapeHtml(item.comentario || "")}<br>
        <small>${escapeHtml(item.data || "")} | ${escapeHtml(item.promocaoId || "")}</small>
        ${key ? `<button class="btn-mini perigo-mini" onclick="excluirUmaAvaliacao('${escapeHtml(key)}', '${escapeHtml(item.promocaoId || "")}', '${escapeHtml(item.usuarioKey || "")}')">Excluir</button>` : ""}
      </div>
    `;
  }).join("");
}

window.excluirUmaAvaliacao = async function(key, promocaoId, usuarioKey) {
  if (!confirm("Excluir esta avaliação?")) return;
  try {
    const snap = await db.ref("avaliacoes/" + key).once("value");
    const dados = snap.exists() ? snap.val() : {};
    const promo = promocaoId || dados.promocaoId;
    const userKey = usuarioKey || dados.usuarioKey;

    if (key) await db.ref("avaliacoes/" + key).remove();
    if (promo && userKey) {
      await db.ref(`avaliacoesPorTelefone/${promo}/${userKey}`).remove();
      await db.ref(`participantesPorTelefone/${promo}/${userKey}`).update({
        comentario: null,
        categoria: null,
        nota: null,
        avaliacaoId: null,
        avaliacaoExcluida: true
      });
    }

    // Mantém participantesPorTelefone e girosPorTelefone para o cliente continuar bloqueado.
    // Assim ele não consegue enviar outra avaliação depois que o comentário foi excluído do painel.

    await carregarAvaliacoesAdmin();
    await carregarTodosComentariosPublicos();
    await atualizarPainelAdmin();
    alert("Avaliação excluída com sucesso.");
  } catch (error) {
    console.error(error);
    alert("Erro ao excluir avaliação. Confira as regras do Firebase.");
  }
};

btnExportarPDF.addEventListener("click", async () => {
  let listaBase = window.__listaAvaliacoesAdmin || [];
  if (!listaBase.length) {
    listaBase = await carregarTodasAvaliacoesAdmin();
    window.__listaAvaliacoesAdmin = listaBase;
  }
  if (!listaBase.length) return alert("Não tem avaliações para compartilhar.");

  const marcados = Array.from(document.querySelectorAll(".selecionar-pdf:checked"))
    .map((el) => listaBase[Number(el.value)])
    .filter(Boolean);

  if (!marcados.length) {
    alert("Marque 1 perfil na lista para compartilhar no WhatsApp.");
    if (adminAvaliacoes && adminAvaliacoes.classList.contains("hidden")) {
      adminAvaliacoes.classList.remove("hidden");
      await carregarAvaliacoesAdmin();
    }
    return;
  }

  if (marcados.length > 1) {
    alert("Marque somente 1 perfil por vez para enviar no WhatsApp do cliente.");
    return;
  }

  const a = marcados[0];
  const telefoneOriginal = String(a.telefoneOriginal || a.telefone || "").replace(/\D/g, "");
  if (!telefoneOriginal) {
    alert("Este perfil não tem telefone salvo.");
    return;
  }

  let telefoneComDDD = telefoneOriginal;
  let telefoneSemDDD = telefoneOriginal;

  if (telefoneOriginal.length >= 10) {
    telefoneSemDDD = telefoneOriginal.slice(-9);
  } else {
    const ddd = prompt("Digite o DDD do cliente para enviar com DDD. Exemplo: 34\n\nSe quiser tentar sem DDD, deixe vazio e aperte OK.");
    const dddLimpo = String(ddd || "").replace(/\D/g, "");
    if (dddLimpo) telefoneComDDD = dddLimpo + telefoneOriginal;
  }

  const mensagem = [
    "*Avaliação do Cliente - Passadoria*",
    "",
    `*Nome:* ${a.nome || "Sem nome"}`,
    `*Telefone:* ${a.telefoneOriginal || a.telefone || ""}`,
    `*ID:* ${a.usuarioId || ""}`,
    `*Categoria:* ${a.categoria || ""}`,
    `*Estrelas:* ${a.nota || ""}/5`,
    `*Desconto:* ${a.descontoSorteado || ""}`,
    `*Comentário:* ${a.comentario || ""}`,
    `*Promoção:* ${a.promocaoId || ""}`,
    `*Data:* ${a.data || ""}`
  ].join("\n");

  function abrirWhats(numero) {
    let n = String(numero || "").replace(/\D/g, "");
    if (!n) return alert("Número inválido.");
    // Para número brasileiro com DDD, usa código do Brasil 55.
    if (n.length >= 10 && !n.startsWith("55")) n = "55" + n;
    const url = "https://wa.me/" + n + "?text=" + encodeURIComponent(mensagem);
    window.open(url, "_blank");
  }

  if (telefoneOriginal.length >= 10) {
    abrirWhats(telefoneComDDD);
  } else {
    const escolher = confirm("Quer tentar enviar COM DDD?\n\nOK = com DDD\nCancelar = sem DDD");
    abrirWhats(escolher ? telefoneComDDD : telefoneSemDDD);
  }
});

btnExcluirComentarios.addEventListener("click", async () => {
  if (!confirm("Excluir TODOS os comentários/avaliações da lista? Os usuários que já participaram continuarão bloqueados nesta promoção.")) return;
  await db.ref("avaliacoes").remove();
  // Não apaga participantesPorTelefone nem girosPorTelefone. Isso mantém o bloqueio de quem já participou.
  adminAvaliacoes.innerHTML = '<p class="vazio">Comentários apagados. Os participantes continuam bloqueados.</p>';
  await carregarTodosComentariosPublicos();
  await atualizarPainelAdmin();
  alert("Comentários excluídos. Quem já participou continua bloqueado.");
});


async function carregarGirosAdmin() {
  if (!adminGiros) return;
  adminGiros.innerHTML = "<p>Carregando giros...</p>";
  const snap = await db.ref(`girosPorTelefone/${promocaoAtual}`).orderByChild("timestamp").once("value");
  const lista = [];
  if (snap.exists()) snap.forEach((child) => lista.push({ key: child.key, ...child.val() }));
  lista.sort((a,b) => Number(b.timestamp||0)-Number(a.timestamp||0));
  if (!lista.length) { adminGiros.innerHTML = '<p class="vazio">Nenhum giro nesta promoção.</p>'; return; }
  adminGiros.innerHTML = lista.map((g) => `
    <div class="admin-item">
      <strong>${escapeHtml(g.nome || "Sem nome")}</strong><br>
      🆔 ${escapeHtml(g.usuarioId || "")}<br>
      📞 ${escapeHtml(g.telefone || "")}<br>
      🎁 Desconto sorteado: <strong>${escapeHtml(g.descontoSorteado || "")}</strong><br>
      <small>${escapeHtml(g.data || "")} | ${escapeHtml(g.promocaoId || "")}</small>
    </div>`).join("");
}

if (btnVerGiros) {
  btnVerGiros.addEventListener("click", async () => {
    if (!adminGiros) return;
    adminGiros.classList.toggle("hidden");
    if (!adminGiros.classList.contains("hidden")) await carregarGirosAdmin();
  });
}

async function carregarNotificacoesAdm() {
  if (!adminNotificacoes) return;
  adminNotificacoes.innerHTML = "<p>Carregando notificações...</p>";
  const snap = await db.ref("notificacoesAdm").orderByChild("timestamp").limitToLast(80).once("value");
  const lista = [];
  if (snap.exists()) snap.forEach((child) => lista.push({ key: child.key, ...child.val() }));
  lista.sort((a,b) => Number(b.timestamp||0)-Number(a.timestamp||0));
  if (!lista.length) { adminNotificacoes.innerHTML = '<p class="vazio">Nenhuma notificação ainda.</p>'; return; }
  adminNotificacoes.innerHTML = lista.map((n) => `
    <div class="admin-item ${n.lida ? '' : 'notificacao-nova'}">
      <strong>🔔 ${escapeHtml(n.titulo || n.tipo || "Notificação")}</strong><br>
      👤 ${escapeHtml(n.nome || "Sem nome")}<br>
      📞 ${escapeHtml(n.telefone || "")}<br>
      🎁 ${escapeHtml(n.descontoSorteado || "")}<br>
      ${n.categoria ? `⭐ ${escapeHtml(n.nota || "")}/5 | ${escapeHtml(n.categoria || "")}<br>` : ""}
      ${n.comentario ? `💬 ${escapeHtml(n.comentario || "")}<br>` : ""}
      <small>${escapeHtml(n.data || "")} | ${escapeHtml(n.promocaoId || "")}</small>
    </div>`).join("");
  const updates = {};
  lista.filter(n => !n.lida).forEach(n => updates[`notificacoesAdm/${n.key}/lida`] = true);
  if (Object.keys(updates).length) await db.ref().update(updates);
}

if (btnVerNotificacoes) {
  btnVerNotificacoes.addEventListener("click", async () => {
    if (!adminNotificacoes) return;
    adminNotificacoes.classList.toggle("hidden");
    if (!adminNotificacoes.classList.contains("hidden")) await carregarNotificacoesAdm();
  });
}

let notificacaoAdmListenerAtivo = false;
function ativarNotificacoesTempoRealAdm() {
  if (notificacaoAdmListenerAtivo) return;
  notificacaoAdmListenerAtivo = true;
  const inicio = Date.now();
  db.ref("notificacoesAdm").orderByChild("timestamp").startAt(inicio).on("child_added", (snap) => {
    const n = snap.val() || {};
    if (adminPainel && !adminPainel.classList.contains("hidden")) {
      alert(`🔔 ${n.titulo || "Nova notificação"}\nCliente: ${n.nome || ""}\nDesconto: ${n.descontoSorteado || ""}`);
    }
    if (adminNotificacoes && !adminNotificacoes.classList.contains("hidden")) carregarNotificacoesAdm();
  });
}

async function carregarEntradasAdmin() {
  if (!adminEntradas) return;
  adminEntradas.innerHTML = "<p>Carregando visualizações...</p>";
  try {
    const snap = await db.ref("entradas").orderByChild("timestamp").limitToLast(100).once("value");
    const lista = [];
    if (snap.exists()) {
      snap.forEach((child) => lista.push({ key: child.key, ...child.val() }));
    }
    lista.sort((a,b) => Number(b.timestamp || 0) - Number(a.timestamp || 0));
    if (!lista.length) {
      adminEntradas.innerHTML = '<p class="vazio">Nenhuma visualização registrada ainda.</p>';
      return;
    }
    adminEntradas.innerHTML = `
      <div class="admin-ajuda-pdf">👁️ Total mostrado: <strong>${lista.length}</strong> últimas visualizações do site.</div>
    ` + lista.map((item) => `
      <div class="admin-item">
        <strong>👁️ Visualização do site</strong><br>
        📅 ${escapeHtml(item.data || "")}<br>
        🎯 Promoção: ${escapeHtml(item.promocaoAtual || "")}<br>
        🌐 Página: ${escapeHtml(item.pagina || "")}<br>
        <small>${escapeHtml(String(item.navegador || "").slice(0, 160))}</small>
      </div>
    `).join("");
  } catch (e) {
    console.error(e);
    adminEntradas.innerHTML = '<p class="vazio">Erro ao carregar visualizações.</p>';
  }
}

if (btnVerEntradas) {
  btnVerEntradas.addEventListener("click", async () => {
    adminEntradas.classList.toggle("hidden");
    if (!adminEntradas.classList.contains("hidden")) {
      if (adminAvaliacoes) adminAvaliacoes.classList.add("hidden");
      if (adminGiros) adminGiros.classList.add("hidden");
      if (adminNotificacoes) adminNotificacoes.classList.add("hidden");
      await carregarEntradasAdmin();
    }
  });
}

function renderizarEstrelas(nota) {
  const total = 5;
  const n = Math.max(0, Math.min(total, Number(nota) || 0));
  return `<span class="stars-ok">${"★".repeat(n)}</span><span class="stars-off">${"☆".repeat(total - n)}</span>`;
}

function escapeHtml(texto) {
  return String(texto || "").replace(/[&<>'"]/g, (c) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "'": "&#39;",
    '"': "&quot;"
  }[c]));
}


// Pega telefone direto do link, se você enviar assim: index.html?tel=34998607006
(function preencherTelefonePeloLink() {
  const params = new URLSearchParams(location.search);
  const tel = params.get("tel") || params.get("telefone");
  const telEl = document.getElementById("telefone");
  if (tel && telEl) {
    telEl.value = limparTelefone(tel);
    atualizarUsuarioAtual();
  }
})();

// Inicialização
carregarPromocaoAtual()
  .then(registrarEntrada)
  .then(async () => {
    if (telefoneValido(telefoneAtual)) { await verificarSeJaGirou(); } else { atualizarBotaoEnviar(); }
    await carregarMeuComentario();
  })
  .catch((e) => console.error(e));


// ================= PWA =================
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./service-worker.js')
      .then(() => console.log('PWA ativo: service worker registrado.'))
      .catch((erro) => console.warn('Falha ao registrar PWA:', erro));
  });
}
