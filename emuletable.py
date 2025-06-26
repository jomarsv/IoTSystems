import paho.mqtt.client as mqtt
import time
import json
import os
from dotenv import load_dotenv

load_dotenv()

# --- Configurações (Lidas do mesmo arquivo .env) ---
BROKER_ADDRESS = os.getenv("MQTT_BROKER")
BROKER_PORT = int(os.getenv("MQTT_PORT", 8883))
MQTT_USERNAME = os.getenv("MQTT_USER")
MQTT_PASSWORD = os.getenv("MQTT_PASSWORD")

RESTAURANTE_ID = "r001"

# --- Callbacks ---
def on_connect(client, userdata, flags, rc):
    if rc == 0:
        print("Simulador conectado ao Broker com sucesso!")
        # Inscreve-se no tópico de status para esta mesa
        mesa_id = userdata['mesa_id']
        topic_status = f"restaurante/{RESTAURANTE_ID}/mesa/{mesa_id}/status"
        client.subscribe(topic_status)
        print(f"Inscrito em '{topic_status}' para receber comandos.")
    else:
        print(f"Falha na conexão, código: {rc}")

def on_message(client, userdata, msg):
    print(f"\n[Feedback Recebido no Tópico '{msg.topic}']")
    try:
        payload = json.loads(msg.payload.decode())
        print(f"  -> Comando: {payload.get('comando')}, Cor: {payload.get('cor')}")
        print("Simulando LED... Ligando LED na cor:", payload.get('cor'))
    except Exception as e:
        print("  -> Mensagem não é um JSON válido:", msg.payload.decode())

# --- Lógica Principal ---
def main():
    try:
        mesa_id = input("Digite o ID da mesa que deseja simular (ex: 12): ")
        if not mesa_id.isdigit():
            print("ID da mesa inválido.")
            return

        userdata = {'mesa_id': mesa_id}
        client = mqtt.Client(mqtt.CallbackAPIVersion.VERSION1, client_id=f"sim-mesa-{mesa_id}", userdata=userdata)
        client.username_pw_set(MQTT_USERNAME, MQTT_PASSWORD)
        client.tls_set()
        client.on_connect = on_connect
        client.on_message = on_message
        client.connect(BROKER_ADDRESS, BROKER_PORT, 60)
        client.loop_start()

        topic_pedido = f"restaurante/{RESTAURANTE_ID}/mesa/{mesa_id}/pedido"
        topic_manutencao = f"restaurante/{RESTAURANTE_ID}/dispositivo/{mesa_id}/status"

        while True:
            print("\n--- Ações da Mesa ---")
            print("[1] Chamar Garçom")
            print("[2] Pedir Cerveja")
            print("[3] Simular Bateria Baixa (20%)")
            print("[q] Sair")
            
            escolha = input("Escolha uma ação: ")

            payload = {}
            topic = topic_pedido # Tópico padrão

            if escolha == '1':
                payload = {"mesa_id": int(mesa_id), "pedido": "chamar_garcom", "timestamp": time.time()}
                print(f"Publicando em '{topic_pedido}': {json.dumps(payload)}")
            elif escolha == '2':
                payload = {"mesa_id": int(mesa_id), "pedido": "item", "item_id": "cerveja", "timestamp": time.time()}
                print(f"Publicando em '{topic_pedido}': {json.dumps(payload)}")
            elif escolha == '3':
                payload = {"bateria_pct": 20, "timestamp": time.time()}
                topic = topic_manutencao # Tópico muda para manutenção
                print(f"Publicando em '{topic_manutencao}': {json.dumps(payload)}")
            elif escolha.lower() == 'q':
                break
            else:
                print("Opção inválida.")
                continue

            client.publish(topic, json.dumps(payload))
            print("... Simulação do LED Amarelo (Enviando) -> Verde (Confirmado)")

    except KeyboardInterrupt:
        print("\nSimulador encerrado.")
    finally:
        client.loop_stop()
        client.disconnect()
        print("Desconectado do Broker.")

if __name__ == "__main__":
    main()