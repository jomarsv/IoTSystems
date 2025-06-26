// ==========================================================
// app.js - v4: ADICIONADO ALERTA DE BATERIA BAIXA
// ==========================================================

// --- CONFIGURAÇÕES (sem alterações) ---
const MQTT_BROKER = "f5c3450c23ed4108b8a1fc7cafde248f.s1.eu.hivemq.cloud";
const MQTT_PORT = 8884;
const MQTT_USERNAME = "jomarsv";
const MQTT_PASSWORD = "ifMA3197";
const RESTAURANTE_ID = "r001";

// --- ELEMENTOS DA UI (adicionado o container de alertas) ---
const loginScreen = document.getElementById('login-screen');
const mainScreen = document.getElementById('main-screen');
const loginBtn = document.getElementById('login-btn');
const logoutBtn = document.getElementById('logout-btn');
const garcomSelect = document.getElementById('garcom-select');
const connectionStatus = document.getElementById('connection-status');
const chamadosLista = document.getElementById('chamados-lista');
const atendimentosLista = document.getElementById('atendimentos-lista');
const cervejasPainel = document.getElementById('cervejas-painel');
const garcomInfo = document.getElementById('garcom-info');
const alertasContainer = document.getElementById('alertas-container'); // Novo elemento

// ... (Resto das variáveis e função connectMQTT não mudam) ...
const garcomMesas = { joao: [1, 2, 3, 4, 5], maria: [6, 7, 8, 9, 10], admin: Array.from({ length: 20 }, (_, i) => i + 1) };
let client;
let currentUser;
let cervejasContador = {};
function connectMQTT(user) { currentUser = user; const clientId = `garcom-app-${user}-${Math.random()}`; client = new Paho.MQTT.Client(MQTT_BROKER, MQTT_PORT, clientId); client.onConnectionLost = onConnectionLost; client.onMessageArrived = onMessageArrived; const connectOptions = { userName: MQTT_USERNAME, password: MQTT_PASSWORD, useSSL: true, onSuccess: onConnect, onFailure: onFailure, }; client.connect(connectOptions); }
function onFailure(response) { console.error("Falha:", response.errorMessage); updateStatus("Falha", "bg-danger");}
function onConnectionLost(responseObject) { if (responseObject.errorCode !== 0) { console.log("Perdido:", responseObject.errorMessage); updateStatus("Reconectando...", "bg-warning"); } }

// ==========================================================
// ALTERAÇÕES PRINCIPAIS AQUI
// ==========================================================

// Callback: Conectado com sucesso (agora se inscreve em dois tipos de tópicos)
function onConnect() {
    console.log("Conectado!");
    updateStatus("Conectado", "bg-success");
    
    // 1. Inscreve-se nos tópicos de PEDIDOS das mesas do garçom
    const mesas = garcomMesas[currentUser];
    mesas.forEach(mesaId => {
        const topic = `restaurante/${RESTAURANTE_ID}/mesa/${mesaId}/pedido`;
        client.subscribe(topic);
    });

    // 2. Inscreve-se no tópico GERAL de status de TODOS os dispositivos (apenas para o admin)
    // O '+' é um wildcard para receber status de qualquer dispositivo.
    if (currentUser === 'admin') {
        const statusTopic = `restaurante/${RESTAURANTE_ID}/dispositivo/+/status`;
        console.log(`Admin inscrevendo-se em: ${statusTopic}`);
        client.subscribe(statusTopic);
    }
}

// Callback: Mensagem recebida (agora verifica o tópico para decidir o que fazer)
function onMessageArrived(message) {
    console.log(`Mensagem recebida no tópico '${message.destinationName}':`, message.payloadString);
    
    const topic = message.destinationName;
    const payload = JSON.parse(message.payloadString);

    // Verifica se a mensagem é um PEDIDO de uma mesa
    if (topic.includes('/mesa/')) {
        try {
            new Audio('beep.mp3').play().catch(e => console.warn("Som não tocou:", e));
            addChamadoToList(payload);
        } catch (e) {
            console.error("Erro no JSON do pedido:", e);
        }
    }
    // Verifica se a mensagem é um STATUS de um dispositivo
    else if (topic.includes('/dispositivo/')) {
        try {
            // Verifica se o status é de bateria baixa
            if (payload.bateria_pct && payload.bateria_pct <= 20) {
                // Extrai o ID do dispositivo do tópico
                const mesaId = topic.split('/')[3];
                mostrarAlertaBateria(mesaId, payload.bateria_pct);
            }
        } catch (e) {
            console.error("Erro no JSON do status:", e);
        }
    }
}

// NOVA FUNÇÃO para mostrar o alerta de bateria na tela
function mostrarAlertaBateria(mesaId, nivelBateria) {
    const alertaId = `alerta-bat-mesa-${mesaId}`;
    
    // Evita mostrar o mesmo alerta várias vezes
    if (document.getElementById(alertaId)) {
        return;
    }

    const alertaDiv = document.createElement('div');
    alertaDiv.id = alertaId;
    alertaDiv.className = 'alert alert-warning alert-dismissible fade show';
    alertaDiv.setAttribute('role', 'alert');
    
    alertaDiv.innerHTML = `
        <strong>Atenção!</strong> Bateria do dispositivo da <strong>Mesa ${mesaId}</strong> está baixa (${nivelBateria}%).
        <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
    `;
    
    alertasContainer.appendChild(alertaDiv);
}


// --- Funções de manipulação de chamados (sem alterações) ---
function addChamadoToList(data) { const placeholder = chamadosLista.querySelector('.placeholder-glow'); if (placeholder) placeholder.remove(); const li = document.createElement('li'); li.className = 'list-group-item d-flex justify-content-between align-items-center chamado-item'; li.dataset.pedidoData = JSON.stringify(data); let textoChamado = `<strong>Mesa ${data.mesa_id}:</strong> `; textoChamado += (data.pedido === 'chamar_garcom') ? 'CHAMOU GARÇOM' : `Pediu ${data.item_id.replace(/_/g, ' ')}`; li.innerHTML = `<span>${textoChamado}</span><button class="btn btn-sm btn-success">Atender</button>`; chamadosLista.prepend(li); li.querySelector('button').addEventListener('click', handleAtenderClick); }
function handleAtenderClick(event) { const itemChamado = event.target.closest('.chamado-item'); const dadosPedido = JSON.parse(itemChamado.dataset.pedidoData); atendimentosLista.prepend(itemChamado); const buttonContainer = itemChamado.querySelector('button').parentElement; if (dadosPedido.pedido === 'item' && dadosPedido.item_id.includes("cerveja")) { buttonContainer.innerHTML = `<div><button class="btn btn-sm btn-primary me-2 btn-confirmar">Confirmar Entrega</button><button class="btn btn-sm btn-cancelar btn-cancelar-pedido">Cancelar Pedido</button></div>`; buttonContainer.querySelector('.btn-confirmar').addEventListener('click', handleConfirmarEntregaClick); buttonContainer.querySelector('.btn-cancelar-pedido').addEventListener('click', handleCancelarPedidoClick); } else { buttonContainer.innerHTML = `<button class="btn btn-sm btn-primary btn-concluir">Concluir</button>`; buttonContainer.querySelector('.btn-concluir').addEventListener('click', handleConcluirClick); } }
function handleConfirmarEntregaClick(event) { const itemChamado = event.target.closest('.chamado-item'); const dadosPedido = JSON.parse(itemChamado.dataset.pedidoData); incrementarCerveja(dadosPedido.mesa_id); finalizarItem(itemChamado); }
function handleCancelarPedidoClick(event) { const itemChamado = event.target.closest('.chamado-item'); finalizarItem(itemChamado); }
function handleConcluirClick(event) { const itemChamado = event.target.closest('.chamado-item'); finalizarItem(itemChamado); }
function finalizarItem(itemElemento) { itemElemento.classList.add('finalizado'); setTimeout(() => { itemElemento.remove(); }, 500); }
function incrementarCerveja(mesaId) { if (!cervejasContador[mesaId]) { cervejasContador[mesaId] = 0; } cervejasContador[mesaId]++; updateCervejasPainel(); }
function updateCervejasPainel() { const placeholder = cervejasPainel.querySelector('p'); if (placeholder) placeholder.remove(); cervejasPainel.innerHTML = ''; for (const mesaId in cervejasContador) { let mesaDiv = document.getElementById(`cerveja-mesa-${mesaId}`); if (!mesaDiv) { mesaDiv = document.createElement('div'); mesaDiv.id = `cerveja-mesa-${mesaId}`; cervejasPainel.appendChild(mesaDiv); } mesaDiv.innerHTML = `<strong>Mesa ${mesaId}:</strong> ${'🍺'.repeat(cervejasContador[mesaId])}`; } }
function updateStatus(text, bgClass) { connectionStatus.textContent = text; connectionStatus.className = `badge ${bgClass}`; }


// --- Lógica de Logout (limpa a nova área de alertas) ---
loginBtn.addEventListener('click', () => { const user = garcomSelect.value; connectMQTT(user); loginScreen.classList.add('d-none'); mainScreen.classList.remove('d-none'); garcomInfo.textContent = `Garçom: ${user.charAt(0).toUpperCase() + user.slice(1)}`; });
logoutBtn.addEventListener('click', () => { if (client && client.isConnected()) { client.disconnect(); } updateStatus("Desconectado", "bg-secondary"); loginScreen.classList.remove('d-none'); mainScreen.classList.add('d-none'); chamadosLista.innerHTML = `<li class="list-group-item placeholder-glow text-muted">Aguardando chamados...</li>`; atendimentosLista.innerHTML = ''; cervejasPainel.innerHTML = `<p class="text-muted">Nenhum pedido de cerveja ainda.</p>`; alertasContainer.innerHTML = ''; /* Limpa os alertas ao sair */ cervejasContador = {}; });

// Adiciona o script de dismiss do Bootstrap dinamicamente, se necessário.
const bootstrapScript = document.createElement('script');
bootstrapScript.src = "https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/js/bootstrap.bundle.min.js";
document.body.appendChild(bootstrapScript);